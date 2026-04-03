import express from "express";
import cors from "cors";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { VapiClient } from "@vapi-ai/server-sdk";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Load env from project root (not cwd) so `npm run dev:server` always sees VITE_* vars.
dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config({ path: path.join(projectRoot, ".env.local") });

const app = express();
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));

const PORT = Number(process.env.PORT || 4000);

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

/** Supabase URL: Vite uses VITE_SUPABASE_URL; allow plain SUPABASE_URL for server-only .env */
function requireSupabaseUrl(): string {
  const url =
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  if (!url) {
    throw new Error(
      "Missing Supabase URL: set VITE_SUPABASE_URL or SUPABASE_URL in .env.local",
    );
  }
  return url;
}

function normalizeE164(input: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  return "+" + trimmed.replace(/\D/g, "");
}

function parseVapiError(e: any) {
  const body =
    e?.body ||
    e?.response?.data ||
    e?.response?.body ||
    e?.data ||
    null;
  const message =
    body?.message ||
    e?.message ||
    "Outbound call failed";
  const statusCode = Number(body?.statusCode || e?.statusCode || 500);
  return { statusCode, message, body };
}

async function detectAssistantMisconfig(assistantId: string): Promise<string | null> {
  try {
    const apiKey = requireEnv("VAPI_API_KEY");
    const resp = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) return null;
    const assistant: any = await resp.json();
    const provider = String(assistant?.model?.provider || "");
    const modelUrl = String(assistant?.model?.url || "");
    // Common misconfiguration: webhook URL is placed in custom-llm model URL.
    if (
      provider === "custom-llm" &&
      /\/api\/vapi\/webhook\/?$/i.test(modelUrl)
    ) {
      return "Assistant model is misconfigured: custom-llm URL points to /api/vapi/webhook. Use a real LLM endpoint for model URL, and keep /api/vapi/webhook only as Vapi server webhook URL.";
    }
    return null;
  } catch {
    return null;
  }
}

function parseJsonFromModelText(text: string): any {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const rawJson = jsonMatch ? jsonMatch[1] : text;
  return JSON.parse(rawJson.trim());
}

async function generateDoctorSummaryServer(transcript: string) {
  const geminiApiKey =
    process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  if (!geminiApiKey) throw new Error("Missing Gemini API key env var");
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `Act as a senior triage nurse. Analyze this patient call transcript and extract clinical data.
Transcript:
${transcript}

Output ONLY a JSON object:
{
  "summary": "1-2 sentence clinical summary.",
  "risk_level": "high" | "medium" | "low",
  "alert_type": "Medical Title (e.g. Respiratory Distress, Routine Clear)",
  "symptoms": ["Symptom1", "Symptom2"],
  "vitals_data": { "key": "value" },
  "action_required": "Clinical next step"
}`;
  const result = await model.generateContent(prompt);
  return parseJsonFromModelText(result.response.text());
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/debug/vapi-config", (_req, res) => {
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID || "";
  const assistantId = process.env.VAPI_ASSISTANT_ID || "";
  return res.json({
    hasVapiApiKey: Boolean(process.env.VAPI_API_KEY),
    assistantId,
    phoneNumberId,
  });
});

app.get("/api/vapi/call/:callId", async (req, res) => {
  try {
    const { callId } = req.params;
    const vapiApiKey = requireEnv("VAPI_API_KEY");
    const resp = await fetch(`https://api.vapi.ai/call/${callId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${vapiApiKey}`,
      },
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("[CallStatus] provider error:", body);
      return res.status(resp.status).json({
        error: body?.message || "Failed to fetch call status",
        provider: body,
      });
    }

    const call = body || {};
    return res.json({
      id: call.id,
      status: call.status,
      endedReason: call.endedReason || null,
      transcript: call.transcript || "",
      messages: Array.isArray(call.messages) ? call.messages : [],
      customer: call.customer || null,
      startedAt: call.startedAt || null,
      endedAt: call.endedAt || null,
      phoneCallProvider: call.phoneCallProvider || null,
    });
  } catch (e: any) {
    console.error("[CallStatus] fatal error:", e);
    return res.status(500).json({ error: e?.message || "Call status failed" });
  }
});

app.post("/api/vapi/outbound-call", async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization || "");
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";
    if (!accessToken) {
      return res.status(401).json({ error: "Missing Authorization Bearer token" });
    }

    const supabaseUrl = requireSupabaseUrl();
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authErr } = await supabase.auth.getUser(accessToken);
    if (authErr || !authData?.user) return res.status(401).json({ error: "Invalid token" });
    const userId = authData.user.id;

    const { patientId, destinationNumber, callerNumber } = req.body || {};
    if (!patientId || !destinationNumber) {
      return res.status(400).json({ error: "patientId and destinationNumber are required" });
    }
    const destinationE164 = normalizeE164(destinationNumber);

    const patientRes = await supabase
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .eq("docuuid", userId)
      .single();
    if (patientRes.error || !patientRes.data) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const patient = patientRes.data as any;
    const assistantId = requireEnv("VAPI_ASSISTANT_ID");
    const phoneNumberId = requireEnv("VAPI_PHONE_NUMBER_ID");
    const assistantMisconfig = await detectAssistantMisconfig(assistantId);
    if (assistantMisconfig) {
      return res.status(400).json({ error: assistantMisconfig });
    }

    const vapi = new VapiClient({ token: requireEnv("VAPI_API_KEY") });
    const call = await vapi.calls.create({
      assistantId,
      phoneNumberId,
      customer: { number: destinationE164 },
      assistantOverrides: {
        variableValues: {
          patientId: String(patient.id),
          patientName: patient.name || "",
          patientCondition: patient.condition || "",
          patientAge: patient.age ?? "",
          patientRiskLevel: patient.risk_level || "",
          callerNumber: callerNumber ? String(callerNumber) : destinationE164,
        },
      },
      metadata: {
        docuuid: userId,
        patient_id: String(patient.id),
        agent_id: patient.assigned_agent_id ? String(patient.assigned_agent_id) : null,
      },
    } as any);

    console.log("[Outbound] created call:", call?.id);
    return res.json({ vapiCallId: call?.id });
  } catch (e: any) {
    const parsed = parseVapiError(e);
    console.error("[Outbound] error:", parsed.body || e);
    if (
      parsed.statusCode === 400 &&
      /international calls/i.test(String(parsed.message))
    ) {
      return res.status(400).json({
        error:
          "Your current Vapi phone number plan does not support international calls. Use a US (+1) destination or upgrade/buy an international-capable number in Vapi.",
        provider: parsed.body,
      });
    }
    return res.status(parsed.statusCode >= 400 ? parsed.statusCode : 500).json({
      error: parsed.message,
      provider: parsed.body || undefined,
    });
  }
});

app.post("/api/vapi/outbound-call/:callId/hangup", async (req, res) => {
  try {
    const { callId } = req.params;
    const vapiApiKey = requireEnv("VAPI_API_KEY");
    const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${vapiApiKey}`,
        "Content-Type": "application/json",
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[Hangup] provider error:", body);
      return res.status(response.status).json({
        error: body?.message || "Hangup failed at provider",
        provider: body,
      });
    }
    console.log("[Hangup] call ended:", callId);
    return res.json({ ok: true, provider: body });
  } catch (e: any) {
    console.error("[Hangup] error:", e);
    return res.status(500).json({ error: e?.message || "Hangup failed" });
  }
});

app.post("/api/vapi/webhook", async (req, res) => {
  try {
    const secret = process.env.VAPI_WEBHOOK_SECRET;
    if (secret) {
      const signature = String(req.headers["x-vapi-signature"] || "");
      const rawBody: Buffer = (req as any).rawBody;
      const computed = crypto
        .createHmac("sha256", secret)
        .update(rawBody || Buffer.from(""))
        .digest("hex");
      if (signature && signature !== computed) {
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const payload: any = req.body;
    const metadata =
      payload?.metadata ||
      payload?.data?.metadata ||
      payload?.endOfCallReport?.metadata ||
      {};

    const docuuid = metadata?.docuuid;
    const patient_id = metadata?.patient_id;
    const agent_id = metadata?.agent_id;
    const transcript =
      payload?.transcript ||
      payload?.data?.transcript ||
      payload?.endOfCallReport?.transcript ||
      payload?.end_of_call_report?.transcript ||
      "";
    const durationRaw =
      payload?.durationSeconds ?? payload?.data?.durationSeconds ?? payload?.duration ?? 0;
    const duration_seconds = typeof durationRaw === "number" ? durationRaw : Number(durationRaw) || 0;

    if (!docuuid || !patient_id) return res.json({ received: true, skipped: true });

    const supabase = createClient(
      requireSupabaseUrl(),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const summary = await generateDoctorSummaryServer(String(transcript || ""));
    const vitals_data = {
      ...(summary.vitals_data || {}),
      Symptoms: summary.symptoms ?? [],
      Summary: summary.summary ?? "",
      ActionRequired: summary.action_required ?? "",
    };

    const { error: callErr } = await supabase.from("calls").insert({
      docuuid,
      patient_id,
      agent_id: agent_id ? String(agent_id) : null,
      duration_seconds,
      transcript: String(transcript || ""),
      vitals_data,
    });
    if (callErr) console.error("[Webhook] call insert failed:", callErr);

    const { error: alertErr } = await supabase.from("alerts").insert({
      docuuid,
      patient_id,
      agent_id: agent_id ? String(agent_id) : null,
      alert_type: summary.alert_type,
      severity: summary.risk_level,
      status: "open",
    });
    if (alertErr) console.error("[Webhook] alert insert failed:", alertErr);

    console.log("[Webhook] stored summary for patient:", patient_id);
    return res.json({ received: true });
  } catch (e: any) {
    console.error("[Webhook] fatal error:", e);
    return res.status(200).json({ received: true, error: e?.message });
  }
});

const server = app.listen(PORT, () => {
  console.log(`[Server] listening on http://localhost:${PORT}`);
});

server.on("close", () => {
  console.log("[Server] http server closed");
});

process.on("SIGINT", () => {
  console.log("[Server] SIGINT received, shutting down...");
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received, shutting down...");
  server.close(() => process.exit(0));
});

process.on("uncaughtException", (err) => {
  console.error("[Server] uncaughtException:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Server] unhandledRejection:", reason);
});

// Keep process alive in environments that auto-close stdin/event loop.
process.stdin.resume();

