import express from "express";
import cors from "cors";
import crypto from "crypto";
import http from "http";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const nodeRequire = createRequire(import.meta.url);
import dotenv from "dotenv";
import PDFDocument from "pdfkit";
import { VapiClient } from "@vapi-ai/server-sdk";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Load env from project root (not cwd) so `npm run dev:server` always sees VITE_* vars.
dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config({ path: path.join(projectRoot, ".env.local") });

try {
  const expressVer = nodeRequire("express/package.json").version;
  console.log("[Server] boot Vitals API — Express", expressVer);
} catch {
  console.log("[Server] boot Vitals API");
}

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
const REPORTS_BUCKET = process.env.SUPABASE_REPORTS_BUCKET || "call-reports";

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

type ReportData = {
  summary: string;
  diagnosis: string;
  risk_level: string;
  alert_type: string;
  symptoms: string[];
  vitals_data: Record<string, any>;
  action_required: string;
  /** Relevant chronic / prior context from chart + call */
  relevant_history: string;
  /** Brief clinical reasoning (not legal advice) */
  clinical_reasoning: string;
  /** Optional differentials for doctor review */
  differential_diagnosis: string[];
  /** Structured follow-up plan */
  follow_up_plan: string;
};

async function authenticateRequest(accessToken: string) {
  const supabase = createClient(requireSupabaseUrl(), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: authData, error: authErr } = await supabase.auth.getUser(accessToken);
  if (authErr || !authData?.user) return null;
  return {
    userId: authData.user.id,
    supabase,
    userEmail: String(authData.user.email || ""),
  };
}

/**
 * Vapi GET /call and webhooks expose metadata in different shapes; outbound calls also put patientId in variableValues.
 */
function extractVapiPersistContext(vapiBody: any): {
  patient_id: string | null;
  agent_id: string | null;
  metadataDocuuid: string | null;
  doctor_email: string | null;
} {
  const metadata =
    vapiBody?.metadata ||
    vapiBody?.call?.metadata ||
    vapiBody?.data?.metadata ||
    {};
  const assistantOverrides =
    vapiBody?.assistantOverrides || vapiBody?.call?.assistantOverrides || {};
  const variableValues = assistantOverrides?.variableValues || {};

  const patient_id =
    metadata?.patient_id != null
      ? String(metadata.patient_id).trim()
      : metadata?.patientId != null
        ? String(metadata.patientId).trim()
        : variableValues?.patientId != null
          ? String(variableValues.patientId).trim()
          : variableValues?.patient_id != null
            ? String(variableValues.patient_id).trim()
            : null;

  const agent_id =
    metadata?.agent_id != null
      ? String(metadata.agent_id).trim()
      : metadata?.agentId != null
        ? String(metadata.agentId).trim()
        : null;

  const metadataDocuuid =
    metadata?.docuuid != null && String(metadata.docuuid).trim() !== ""
      ? String(metadata.docuuid).trim()
      : null;

  const doctor_emailRaw =
    metadata?.doctor_email ?? metadata?.doctorEmail ?? variableValues?.doctor_email ?? "";
  const doctor_email =
    doctor_emailRaw != null && String(doctor_emailRaw).trim() !== ""
      ? String(doctor_emailRaw).trim()
      : null;

  return {
    patient_id: patient_id || null,
    agent_id: agent_id || null,
    metadataDocuuid,
    doctor_email,
  };
}

/** Vapi list/get payloads occasionally nest the call under `call` or `data`. */
function unwrapVapiCallResponse(raw: any): any {
  if (!raw || typeof raw !== "object") return raw;
  if (raw.call && typeof raw.call === "object") return raw.call;
  if (raw.data && typeof raw.data === "object" && raw.data.id) return raw.data;
  return raw;
}

function normalizeVapiMessageContent(m: any): string {
  const c = m?.message ?? m?.content ?? m?.text;
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c)) {
    return c
      .map((part: any) => {
        if (typeof part === "string") return part;
        if (part?.text) return String(part.text);
        return "";
      })
      .filter(Boolean)
      .join(" ");
  }
  if (c && typeof c === "object" && typeof (c as any).text === "string") return String((c as any).text);
  return "";
}

function transcriptFromMessagesArray(messages: any[]): string {
  if (!Array.isArray(messages) || !messages.length) return "";
  const lines: string[] = [];
  for (const m of messages) {
    const role = (m.role || m.type || "unknown").toString().toLowerCase();
    const text = normalizeVapiMessageContent(m);
    if (!text) continue;
    lines.push(`${role}: ${text}`);
  }
  return lines.join("\n");
}

/** Collect transcript text from all common Vapi call shapes (phone + web). */
function buildTranscriptFromVapiCall(body: any): string {
  if (!body || typeof body !== "object") return "";
  const direct = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (direct) return direct;
  const art = body.artifact;
  if (art && typeof art.transcript === "string" && art.transcript.trim()) return art.transcript.trim();
  if (art && Array.isArray(art.messages)) {
    const t = transcriptFromMessagesArray(art.messages);
    if (t) return t;
  }
  if (Array.isArray(body.messages)) {
    const t = transcriptFromMessagesArray(body.messages);
    if (t) return t;
  }
  const eoc = body.endOfCallReport || body.end_of_call_report;
  if (eoc && typeof eoc.transcript === "string" && eoc.transcript.trim()) return eoc.transcript.trim();
  if (eoc && Array.isArray(eoc.messages)) {
    const t = transcriptFromMessagesArray(eoc.messages);
    if (t) return t;
  }
  return "";
}

function extractVapiDurationSeconds(body: any): number {
  if (!body || typeof body !== "object") return 0;
  const candidates = [
    body.durationSeconds,
    body.duration,
    body.artifact?.durationSeconds,
    body.endOfCallReport?.durationSeconds,
    body.end_of_call_report?.durationSeconds,
  ];
  for (const raw of candidates) {
    if (raw == null) continue;
    let n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (n > 48 * 3600) continue;
    if (n > 36_000) n = Math.round(n / 1000);
    return Math.round(n);
  }
  const started = body.startedAt || body.started_at;
  const ended = body.endedAt || body.ended_at;
  if (started && ended) {
    const a = new Date(String(started)).getTime();
    const b = new Date(String(ended)).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) return Math.round((b - a) / 1000);
  }
  return 0;
}

function wrapTextToWidth(text: string, maxChars: number): string[] {
  const normalized = (text || "N/A").replace(/\s+/g, " ").trim() || "N/A";
  const words = normalized.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= maxChars) line = next;
    else {
      if (line) lines.push(line);
      line = w.length > maxChars ? `${w.slice(0, maxChars - 1)}…` : w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function writeParagraph(doc: InstanceType<typeof PDFDocument>, text: string, fontSize = 10) {
  doc.fontSize(fontSize);
  wrapTextToWidth(text, 92).forEach((ln) => doc.text(ln));
  doc.moveDown(0.5);
}

function generateReportPdfBuffer(input: {
  callId: string;
  patientName: string;
  patientCondition: string;
  patientAge?: string;
  durationSeconds: number;
  transcriptSnippet?: string;
  report: ReportData;
  /** Logged-in clinician email (Supabase user) for audit trail on PDF */
  doctorEmail?: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 48, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(18).text("Vitals – Clinical Summary Report", { align: "center" });
      doc.moveDown(0.4);
      doc.fontSize(9).fillColor("#333333").text("(Prescription-style summary for clinician review – not a legal medical record)", {
        align: "center",
      });
      doc.fillColor("black");
      doc.moveDown(0.8);

      doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`);
      doc.text(`Internal record ID: ${input.callId}`);
      if (input.doctorEmail) {
        doc.text(`Attending clinician (account): ${input.doctorEmail}`);
      }
      doc.text(
        `Call duration: ${Math.floor(input.durationSeconds / 60)}m ${input.durationSeconds % 60}s`,
      );
      doc.moveDown(0.6);

      doc.fontSize(12).text("Patient", { underline: true });
      doc.moveDown(0.25);
      doc.fontSize(10);
      doc.text(`Name: ${input.patientName || "Unknown"}`);
      doc.text(`Known condition / focus: ${input.patientCondition || "N/A"}`);
      if (input.patientAge) doc.text(`Age: ${input.patientAge}`);
      doc.moveDown(0.6);

      doc.fontSize(12).text("Relevant history & context", { underline: true });
      doc.moveDown(0.25);
      writeParagraph(doc, input.report.relevant_history || "See summary below.", 10);

      doc.fontSize(12).text("Executive summary", { underline: true });
      doc.moveDown(0.25);
      writeParagraph(doc, input.report.summary, 11);

      doc.fontSize(12).text("Symptoms reported / observed", { underline: true });
      doc.moveDown(0.25);
      const symptoms = input.report.symptoms?.length ? input.report.symptoms : ["None explicitly stated"];
      symptoms.forEach((s) => {
        doc.fontSize(10).text(`• ${s}`);
      });
      doc.moveDown(0.5);

      doc.fontSize(12).text("Clinical impression (working diagnosis)", { underline: true });
      doc.moveDown(0.25);
      writeParagraph(doc, input.report.diagnosis, 11);

      doc.fontSize(12).text("Clinical reasoning (brief)", { underline: true });
      doc.moveDown(0.25);
      writeParagraph(doc, input.report.clinical_reasoning, 10);

      const diffs = input.report.differential_diagnosis?.filter(Boolean) || [];
      if (diffs.length) {
        doc.fontSize(12).text("Differential considerations (for review)", { underline: true });
        doc.moveDown(0.25);
        diffs.forEach((d) => doc.fontSize(10).text(`• ${d}`));
        doc.moveDown(0.5);
      }

      doc.fontSize(12).text("Structured vitals / measurements (from AI extract)", { underline: true });
      doc.moveDown(0.25);
      const vitalsEntries = Object.entries(input.report.vitals_data || {});
      if (!vitalsEntries.length) {
        doc.fontSize(10).text("None captured in structured form.");
      } else {
        vitalsEntries.forEach(([k, v]) => doc.fontSize(10).text(`${k}: ${String(v)}`));
      }
      doc.moveDown(0.5);

      doc.fontSize(12).text("Triage / alert", { underline: true });
      doc.moveDown(0.25);
      doc.fontSize(10).text(`Risk level: ${input.report.risk_level || "N/A"}`);
      doc.text(`Alert type: ${input.report.alert_type || "N/A"}`);
      doc.moveDown(0.4);

      doc.fontSize(12).text("Plan & follow-up", { underline: true });
      doc.moveDown(0.25);
      writeParagraph(doc, input.report.follow_up_plan || input.report.action_required, 10);

      doc.fontSize(12).text("Immediate actions recommended", { underline: true });
      doc.moveDown(0.25);
      writeParagraph(doc, input.report.action_required, 10);

      if (input.transcriptSnippet) {
        doc.addPage();
        doc.fontSize(12).text("Call transcript (excerpt)", { underline: true });
        doc.moveDown(0.25);
        const excerpt =
          input.transcriptSnippet.length > 8000
            ? `${input.transcriptSnippet.slice(0, 8000)}\n\n[... truncated ...]`
            : input.transcriptSnippet;
        writeParagraph(doc, excerpt, 9);
      }

      doc.moveDown();
      doc.fontSize(8).fillColor("gray").text(
        "Disclaimer: This document was produced with AI-assisted summarization and must be verified by a licensed clinician. It is not a prescription or formal diagnosis.",
        { align: "left" },
      );
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Step 1 of the report pipeline:
 * Clean a raw (possibly multilingual) transcript into structured English-only text.
 * Preserves speaker roles (Patient / Agent), removes filler words, normalises medical terms,
 * and translates any non-English segments into English.
 */
async function cleanTranscriptToEnglish(rawTranscript: string): Promise<string> {
  const geminiApiKey =
    process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  if (!geminiApiKey) throw new Error("Missing Gemini API key env var");
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are a medical transcript processor. Your job is to take a raw call transcript that may contain:
- Multiple languages (Hindi, Spanish, regional dialects, etc.)
- Filler words (um, uh, hmm, like, you know)
- Repetitions and false starts
- Unclear formatting

Process the transcript through these steps and output ONLY the cleaned result:

1. **Translate**: Convert ALL non-English segments into fluent, natural English. Preserve the medical/clinical meaning precisely.
2. **Clean**: Remove filler words, stutters, false starts, and repetitions.
3. **Preserve roles**: Keep speaker labels exactly as "Patient:" or "Agent:" at the start of each turn.
4. **Medical accuracy**: Keep all medical terms, drug names, dosages, vitals, symptoms, and clinical details EXACTLY as stated. Do NOT paraphrase medical content.
5. **Formatting**: One speaker turn per paragraph, separated by blank lines. Keep it chronological.
6. **If the transcript is already clean English**: Return it as-is with only minor formatting fixes.

IMPORTANT: Output ONLY the cleaned transcript text. No commentary, no preamble, no wrapper. Just the cleaned conversation.

Raw transcript:
${rawTranscript}`;

  const result = await model.generateContent(prompt);
  const cleaned = result.response.text().trim();
  console.log(
    "[TranscriptCleaner] raw chars:", rawTranscript.length,
    "→ cleaned chars:", cleaned.length,
  );
  return cleaned;
}

/**
 * Step 2 of the report pipeline:
 * Generate a well-structured clinical report from a CLEANED English transcript + patient chart.
 * This is a more detailed version of generateDoctorSummaryServer, designed for on-demand
 * report generation from the CallDetail page.
 */
async function generateStructuredReport(cleanedTranscript: string, patientChartJson: string) {
  const geminiApiKey =
    process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  if (!geminiApiKey) throw new Error("Missing Gemini API key env var");
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are an expert clinical documentation specialist generating a structured medical report from a voice call between an AI health agent and a patient.

## Inputs

Patient chart (may be partial):
${patientChartJson || "{}"}

Cleaned call transcript:
${cleanedTranscript}

## Instructions

Analyze BOTH the patient chart and the cleaned transcript thoroughly. Generate a comprehensive, well-structured clinical report.

CRITICAL RULES:
- Every symptom MUST be directly traceable to something the PATIENT said in the transcript.
- Do NOT invent symptoms or findings not mentioned by the patient.
- If the transcript is empty or contains no patient dialogue, say so explicitly.
- All clinical reasoning must reference specific patient statements.
- Use professional medical terminology appropriate for a licensed clinician's review.

Output ONLY a JSON object with this exact shape (no markdown outside JSON):
{
  "summary": "3-5 sentence comprehensive clinical summary. Include: reason for call, key findings, and current patient status. Written as a professional handoff note.",
  "relevant_history": "Prior conditions, medications, allergies, and relevant history from the chart. Cross-reference with what the patient mentioned about their history during the call. Note any discrepancies.",
  "diagnosis": "Working clinical impression based on the transcript and chart data. State confidence level (strong suspicion / possible / unlikely but consider). This is NOT a definitive diagnosis.",
  "clinical_reasoning": "4-8 sentences of structured reasoning: (1) What symptoms point toward this impression, (2) What from the chart supports it, (3) What contradicts or complicates it, (4) Red flags or concerning patterns. Reference specific patient statements.",
  "differential_diagnosis": ["Differential 1 with brief rationale", "Differential 2 with brief rationale", "Differential 3 if applicable"],
  "risk_level": "high" | "medium" | "low",
  "alert_type": "Specific triage classification (e.g., 'Acute chest pain — rule out ACS', 'Routine diabetes follow-up — well controlled', 'Medication non-compliance — moderate risk')",
  "symptoms": ["Each symptom as a concise clinical bullet. Format: 'Symptom — patient stated: [brief quote or paraphrase]'. Must be grounded in transcript."],
  "vitals_data": {"Include any vitals or measurements the patient reported during the call, e.g. BP, HR, glucose, temperature, weight. Use standard clinical keys."},
  "action_required": "Specific, actionable next steps for the care team. Include: (1) Immediate actions, (2) Tests or labs to order, (3) Medication changes if indicated, (4) Referrals needed.",
  "follow_up_plan": "Structured plan: (1) Follow-up timeline, (2) What to monitor, (3) Patient education points discussed or needed, (4) Escalation criteria — when to seek emergency care."
}`;

  const result = await model.generateContent(prompt);
  return parseJsonFromModelText(result.response.text());
}

async function generateDoctorSummaryServer(transcript: string, patientChartJson: string) {

  const geminiApiKey =
    process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  if (!geminiApiKey) throw new Error("Missing Gemini API key env var");
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `You are documenting a phone check-in for a licensed clinician. Use BOTH the patient chart snippet and the call transcript.

Patient chart (may be partial JSON):
${patientChartJson || "{}"}

Call transcript:
${transcript}

Output ONLY a JSON object with this exact shape (no markdown outside JSON):
{
  "summary": "2-4 sentence clinical summary suitable for a handoff note.",
  "relevant_history": "Relevant chronic conditions, prior context from chart + what the patient said about history in the call.",
  "diagnosis": "Working clinical impression for chart review — not a definitive diagnosis.",
  "clinical_reasoning": "2-5 sentences: why this impression, what supports/contradicts it from transcript+chart.",
  "differential_diagnosis": ["Optional alternative 1", "Optional alternative 2"],
  "risk_level": "high" | "medium" | "low",
  "alert_type": "Concise triage title (e.g. Hyperglycemia concern, Routine follow-up clear)",
  "symptoms": ["Short clinical-style symptom bullets. Each MUST reflect what the PATIENT actually said in the transcript (user/patient/customer lines). Do not invent findings not spoken by the patient. If the transcript is empty, use one entry: \"No transcript text — verify recording/transcript settings in Vapi.\""],
  "vitals_data": { "optional_key": "optional_value" },
  "action_required": "What the doctor or care team should do next (specific).",
  "follow_up_plan": "Follow-up timing, monitoring, education, or escalation guidance."
}`;
  const result = await model.generateContent(prompt);
  return parseJsonFromModelText(result.response.text());
}

function normalizeReportData(raw: any): ReportData {
  return {
    summary: String(raw.summary || ""),
    diagnosis: String(raw.diagnosis || ""),
    risk_level: String(raw.risk_level || "medium"),
    alert_type: String(raw.alert_type || ""),
    symptoms: Array.isArray(raw.symptoms) ? raw.symptoms.map(String) : [],
    vitals_data: (raw.vitals_data || {}) as Record<string, any>,
    action_required: String(raw.action_required || ""),
    relevant_history: String(raw.relevant_history || ""),
    clinical_reasoning: String(raw.clinical_reasoning || ""),
    differential_diagnosis: Array.isArray(raw.differential_diagnosis)
      ? raw.differential_diagnosis.map(String)
      : [],
    follow_up_plan: String(raw.follow_up_plan || ""),
  };
}

/** Pull symptom-sized snippets from patient-side lines in the saved transcript (user/patient/customer roles). */
function extractSymptomsFromPatientLines(transcript: string): string[] {
  const text = (transcript || "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n");
  const out: string[] = [];
  const patientRe = /^(user|patient|customer)\s*:\s*(.+)$/i;
  for (const line of lines) {
    const m = line.match(patientRe);
    if (!m) continue;
    const content = m[2].trim();
    if (content.length < 4) continue;
    if (/^(ok|yeah|yes|no|thanks|thank you|uh[\s-]?huh)\.?$/i.test(content)) continue;
    const clipped = content.length > 280 ? `${content.slice(0, 277)}…` : content;
    out.push(clipped);
  }
  return [...new Set(out.map((s) => s.trim()))].filter(Boolean).slice(0, 15);
}

/** Return AI-extracted symptom labels and prevent appending raw transcript sentences. */
function mergeSymptomsFromTranscript(aiSymptoms: string[], transcript: string): string[] {
  const merged: string[] = aiSymptoms.map((s) => s.trim()).filter(Boolean);
  return merged;
}

function effectiveCallTranscript(call: { transcript?: string | null; vitals_data?: any }): string {
  const col = call.transcript != null ? String(call.transcript).trim() : "";
  if (col) return col;
  return String(call.vitals_data?.CallTranscript || "").trim();
}

async function persistCallAndAlertAfterAnalysis(input: {
  supabase: any;
  docuuid: string;
  patient_id: string;
  agent_id: string | null;
  duration_seconds: number;
  transcript: string;
  summaryRaw: any;
  vapiCallId: string;
  patientRow: any | null;
  doctor_email?: string | null;
}) {
  const {
    supabase,
    docuuid,
    patient_id,
    agent_id,
    duration_seconds,
    transcript,
    summaryRaw,
    vapiCallId,
    patientRow,
    doctor_email,
  } = input;

  const summary = normalizeReportData(summaryRaw);
  const transcriptNorm = String(transcript || "").trim();
  const reportData: ReportData = {
    ...summary,
    symptoms: mergeSymptomsFromTranscript(summary.symptoms, transcriptNorm),
  };

  const doctorEmailNorm = String(doctor_email || "").trim();

  const vitals_data: Record<string, any> = {
    ...(reportData.vitals_data || {}),
    Symptoms: reportData.symptoms,
    Summary: reportData.summary,
    Diagnosis: reportData.diagnosis,
    RelevantHistory: reportData.relevant_history,
    ClinicalReasoning: reportData.clinical_reasoning,
    DifferentialDiagnosis: reportData.differential_diagnosis,
    FollowUpPlan: reportData.follow_up_plan,
    ActionRequired: reportData.action_required,
    ReportData: reportData,
    PatientName: patientRow?.name || "",
    PatientCondition: patientRow?.condition || "",
    PatientAge: patientRow?.age != null ? String(patientRow.age) : "",
    VapiCallId: vapiCallId,
    PdfGeneratedAt: new Date().toISOString(),
    CallTranscript: transcriptNorm,
    ...(doctorEmailNorm ? { DoctorEmail: doctorEmailNorm } : {}),
  };

  console.log(
    "[CallPersist] transcript chars:",
    transcriptNorm.length,
    "symptom items:",
    reportData.symptoms.length,
  );

  try {
    const pdfBuffer = await generateReportPdfBuffer({
      callId: vapiCallId,
      patientName: String(patientRow?.name || vitals_data.PatientName || "Unknown"),
      patientCondition: String(patientRow?.condition || vitals_data.PatientCondition || "N/A"),
      patientAge: patientRow?.age != null ? String(patientRow.age) : vitals_data.PatientAge,
      durationSeconds: duration_seconds,
      transcriptSnippet: transcriptNorm,
      report: reportData,
      doctorEmail: doctorEmailNorm || undefined,
    });
    const uploadPath = `doctor-reports/${docuuid}/${patient_id}/${vapiCallId}-${Date.now()}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from(REPORTS_BUCKET)
      .upload(uploadPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (!uploadErr) {
      vitals_data.ReportPdfPath = uploadPath;
      vitals_data.PdfStoredInStorage = true;
      console.log("[CallPersist] PDF uploaded:", uploadPath);
    } else {
      vitals_data.PdfStoredInStorage = false;
      vitals_data.PdfStorageError = uploadErr.message;
      console.error("[CallPersist] report upload failed:", uploadErr.message);
    }
  } catch (reportErr) {
    vitals_data.PdfStoredInStorage = false;
    vitals_data.PdfGenerationError = String(reportErr);
    console.error("[CallPersist] PDF generation failed:", reportErr);
  }

  const { data: inserted, error: callErr } = await supabase
    .from("calls")
    .insert({
      docuuid,
      patient_id,
      agent_id: agent_id ? String(agent_id) : null,
      duration_seconds,
      transcript: transcriptNorm,
      vitals_data,
    })
    .select("id")
    .single();

  if (callErr) {
    console.error("[CallPersist] call insert failed:", callErr);
    return { ok: false as const, error: callErr.message };
  }

  const { error: alertErr } = await supabase.from("alerts").insert({
    docuuid,
    patient_id,
    agent_id: agent_id ? String(agent_id) : null,
    alert_type: reportData.alert_type,
    severity: reportData.risk_level,
    status: "open",
  });
  if (alertErr) console.error("[CallPersist] alert insert failed:", alertErr);

  console.log("[CallPersist] stored call for patient:", patient_id, "db id:", inserted?.id);
  return { ok: true as const, callId: inserted?.id as string };
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/ping", (_req, res) => res.json({ ok: true, service: "vitals-api" }));

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

    const call = unwrapVapiCallResponse(body) || {};
    const transcript = buildTranscriptFromVapiCall(call);
    const durationSeconds = extractVapiDurationSeconds(call);
    return res.json({
      id: call.id,
      status: call.status,
      endedReason: call.endedReason || null,
      transcript,
      durationSeconds,
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

/**
 * GET /api/vapi/call/:callId/transcript
 * Fetches a single call from Vapi and returns only the transcript text.
 * Uses the same helper functions as the rest of the Vapi integration —
 * does NOT affect any existing routes or the webhook pipeline.
 */
app.get("/api/vapi/call/:callId/transcript", async (req, res) => {
  try {
    const { callId } = req.params;
    if (!callId) {
      return res.status(400).json({ error: "callId is required" });
    }

    // Vapi requires a valid UUID — reject placeholder IDs (e.g. "unknown-<timestamp>") early
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(callId)) {
      console.warn("[TranscriptFetch] non-UUID callId skipped:", callId);
      return res.status(400).json({
        error: "callId must be a valid UUID (Vapi call IDs are UUIDs).",
        callId,
      });
    }
    const vapiApiKey = requireEnv("VAPI_API_KEY");
    const resp = await fetch(`https://api.vapi.ai/call/${callId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${vapiApiKey}`,
      },
    });

    const body = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error("[TranscriptFetch] Vapi error:", body);
      return res.status(resp.status).json({
        error: body?.message || "Failed to fetch call from Vapi",
        provider: body,
      });
    }

    const call = unwrapVapiCallResponse(body) || {};
    const transcript = buildTranscriptFromVapiCall(call);

    console.log(
      "[TranscriptFetch] callId:", callId,
      "| transcript chars:", transcript.length,
    );

    return res.json({
      callId,
      transcript: transcript || "No transcript found.",
      hasTranscript: transcript.length > 0,
    });
  } catch (e: any) {
    console.error("[TranscriptFetch] error:", e);
    return res.status(500).json({ error: e?.message || "Transcript fetch failed" });
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

    const authCtx = await authenticateRequest(accessToken);
    if (!authCtx) return res.status(401).json({ error: "Invalid token" });
    const { userId, supabase, userEmail } = authCtx;

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
    const call = (await vapi.calls.create({
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
        doctor_email: userEmail || "",
      },
    } as any)) as any;

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

/** When Vapi webhook cannot reach localhost, client can sync the finished call by provider id. */
app.post("/api/vapi/sync-call", async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization || "");
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";
    if (!accessToken) return res.status(401).json({ error: "Missing Authorization Bearer token" });
    const authCtx = await authenticateRequest(accessToken);
    if (!authCtx) return res.status(401).json({ error: "Invalid token" });
    const { userId, supabase, userEmail } = authCtx;
    const bodyIn = (req.body || {}) as {
      vapiCallId?: string;
      transcript?: string;
      durationSeconds?: number;
    };

    const vapiCallId = String(bodyIn.vapiCallId || "").trim();
    if (!vapiCallId) return res.status(400).json({ error: "vapiCallId is required" });

    const { data: existing } = await supabase
      .from("calls")
      .select("id")
      .eq("docuuid", userId)
      .contains("vitals_data", { VapiCallId: vapiCallId })
      .maybeSingle();

    if (existing?.id) {
      return res.json({ ok: true, duplicated: true, callId: existing.id });
    }

    const vapiApiKey = requireEnv("VAPI_API_KEY");
    const vapiResp = await fetch(`https://api.vapi.ai/call/${vapiCallId}`, {
      headers: { Authorization: `Bearer ${vapiApiKey}` },
    });
    const rawVapi = await vapiResp.json().catch(() => ({}));
    if (!vapiResp.ok) {
      console.error("[SyncCall] Vapi GET failed:", vapiResp.status, rawVapi);
      return res.status(vapiResp.status).json({
        error: rawVapi?.message || `Could not fetch call from Vapi (${vapiResp.status})`,
        provider: rawVapi,
      });
    }

    const vapiBody = unwrapVapiCallResponse(rawVapi);
    const ctx = extractVapiPersistContext(vapiBody);
    if (!ctx.patient_id) {
      return res.status(400).json({
        error:
          "Could not determine patient for this call. Vapi did not return patient metadata (patient_id / patientId / variableValues.patientId). Ensure outbound calls set metadata (this app sets it in /api/vapi/outbound-call).",
      });
    }
    if (ctx.metadataDocuuid && ctx.metadataDocuuid !== userId) {
      return res.status(403).json({ error: "Call metadata does not belong to this account" });
    }

    let transcript = buildTranscriptFromVapiCall(vapiBody);
    const clientTranscript = String(bodyIn.transcript || "").trim();
    if (!transcript.trim() && clientTranscript) transcript = clientTranscript;
    else if (clientTranscript.length > transcript.length + 20) transcript = clientTranscript;

    let duration_seconds = extractVapiDurationSeconds(vapiBody);
    const clientDur = Number(bodyIn.durationSeconds);
    if ((!duration_seconds || duration_seconds < 1) && Number.isFinite(clientDur) && clientDur > 0) {
      duration_seconds = Math.min(Math.round(clientDur), 24 * 3600);
    }

    const doctorEmail = (ctx.doctor_email?.trim() || userEmail || "").trim();

    const { data: patientRow } = await supabase
      .from("patients")
      .select("*")
      .eq("id", ctx.patient_id)
      .eq("docuuid", userId)
      .single();

    if (!patientRow) {
      return res.status(403).json({ error: "Patient not found for this account" });
    }

    const agentResolved =
      ctx.agent_id ||
      (patientRow.assigned_agent_id != null ? String(patientRow.assigned_agent_id) : null);

    const chartJson = JSON.stringify(
      patientRow
        ? {
            name: patientRow.name,
            condition: patientRow.condition,
            age: patientRow.age,
            risk_level: patientRow.risk_level,
            date_of_birth: patientRow.date_of_birth,
          }
        : {},
    );

    const summaryRaw = await generateDoctorSummaryServer(String(transcript || ""), chartJson);
    const result = await persistCallAndAlertAfterAnalysis({
      supabase,
      docuuid: userId,
      patient_id: String(ctx.patient_id),
      agent_id: agentResolved,
      duration_seconds,
      transcript: String(transcript || ""),
      summaryRaw,
      vapiCallId,
      patientRow,
      doctor_email: doctorEmail || null,
    });

    if (!result.ok) return res.status(500).json({ error: result.error });
    return res.json({ ok: true, callId: result.callId });
  } catch (e: any) {
    console.error("[SyncCall] error:", e);
    return res.status(500).json({ error: e?.message || "Sync failed" });
  }
});

/** Register `/api/calls/list` before any `/api/calls/:callId/...` route (Express matches in order). */
app.get("/api/calls/list", async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization || "");
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";
    if (!accessToken) return res.status(401).json({ error: "Missing Authorization Bearer token" });
    const authCtx = await authenticateRequest(accessToken);
    if (!authCtx) return res.status(401).json({ error: "Invalid token" });
    const { userId, supabase } = authCtx;
    const patientIdFilter = String((req.query as any).patientId || "").trim();
    const vapiCallIdFilter = String((req.query as any).vapiCallId || "").trim();

    let listQuery = supabase.from("calls").select("*").eq("docuuid", userId);
    if (patientIdFilter) listQuery = listQuery.eq("patient_id", patientIdFilter);
    if (vapiCallIdFilter) listQuery = listQuery.contains("vitals_data", { VapiCallId: vapiCallIdFilter });
    const { data: calls, error: callsErr } = await listQuery.order("created_at", { ascending: false });

    if (callsErr) {
      console.error("[CallsList] query error:", callsErr);
      return res.status(500).json({ error: callsErr.message });
    }

    const rows = calls || [];
    const patientIds = [...new Set(rows.map((c: any) => c.patient_id).filter(Boolean))];
    const agentIds = [...new Set(rows.map((c: any) => c.agent_id).filter(Boolean))];

    const [patsRes, agsRes] = await Promise.all([
      patientIds.length
        ? supabase.from("patients").select("id,name").eq("docuuid", userId).in("id", patientIds)
        : Promise.resolve({ data: [] as any[] }),
      agentIds.length
        ? supabase.from("agents").select("id,name").eq("docuuid", userId).in("id", agentIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const pMap = Object.fromEntries((patsRes.data || []).map((p: any) => [p.id, p.name]));
    const aMap = Object.fromEntries((agsRes.data || []).map((a: any) => [a.id, a.name]));

    const merged = rows.map((c: any) => ({
      ...c,
      patient_name: pMap[c.patient_id] || "Unknown",
      agent_name: c.agent_id ? aMap[c.agent_id] || "Unknown" : "Unknown",
    }));

    return res.json({ calls: merged });
  } catch (e: any) {
    console.error("[CallsList] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to load calls" });
  }
});

/** Alerts list with patient/agent names and latest matching call per patient (same RLS bypass as calls). */
app.get("/api/alerts", async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization || "");
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";
    if (!accessToken) return res.status(401).json({ error: "Missing Authorization Bearer token" });
    const authCtx = await authenticateRequest(accessToken);
    if (!authCtx) return res.status(401).json({ error: "Invalid token" });
    const { userId, supabase } = authCtx;

    const [{ data: alertRows, error: alertsErr }, { data: callRows }] = await Promise.all([
      supabase.from("alerts").select("*").eq("docuuid", userId).order("created_at", { ascending: false }),
      supabase.from("calls").select("*").eq("docuuid", userId).order("created_at", { ascending: false }),
    ]);

    if (alertsErr) {
      console.error("[AlertsList] query error:", alertsErr);
      return res.status(500).json({ error: alertsErr.message });
    }

    const calls = callRows || [];
    const callsByPatient = new Map<string, any[]>();
    for (const c of calls) {
      const pid = c.patient_id;
      if (!pid) continue;
      if (!callsByPatient.has(pid)) callsByPatient.set(pid, []);
      callsByPatient.get(pid)!.push(c);
    }
    for (const [, arr] of callsByPatient) {
      arr.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    }

    const alerts = alertRows || [];
    const patientIds = [...new Set(alerts.map((a: any) => a.patient_id).filter(Boolean))];
    const agentIds = [...new Set(alerts.map((a: any) => a.agent_id).filter(Boolean))];

    const [patsRes, agsRes] = await Promise.all([
      patientIds.length
        ? supabase.from("patients").select("id,name").eq("docuuid", userId).in("id", patientIds)
        : Promise.resolve({ data: [] as any[] }),
      agentIds.length
        ? supabase.from("agents").select("id,name").eq("docuuid", userId).in("id", agentIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const pMap = Object.fromEntries((patsRes.data || []).map((p: any) => [p.id, p.name]));
    const aMap = Object.fromEntries((agsRes.data || []).map((a: any) => [a.id, a.name]));

    const pickCallForAlert = (patientId: string, alertCreated: string | null) => {
      const list = callsByPatient.get(patientId);
      if (!list?.length) return null;
      const alertMs = alertCreated ? new Date(alertCreated).getTime() : 0;
      if (alertMs) {
        const windowMs = 5 * 60 * 1000;
        const near = list.find((c) => {
          const t = c.created_at ? new Date(c.created_at).getTime() : 0;
          return t && Math.abs(t - alertMs) <= windowMs;
        });
        if (near) return near;
      }
      return list[0];
    };

    const merged = alerts.map((a: any) => ({
      ...a,
      patient_name: pMap[a.patient_id] || "Unknown",
      agent_name: a.agent_id ? aMap[a.agent_id] || "Unknown" : "Unknown",
      call: pickCallForAlert(a.patient_id, a.created_at),
    }));

    return res.json({ alerts: merged });
  } catch (e: any) {
    console.error("[AlertsList] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to load alerts" });
  }
});

app.get("/api/calls/:callId/report/download", async (req, res) => {
  try {
    const { callId } = req.params;
    const authHeader = String(req.headers.authorization || "");
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";
    if (!accessToken) return res.status(401).json({ error: "Missing Authorization Bearer token" });
    const authCtx = await authenticateRequest(accessToken);
    if (!authCtx) return res.status(401).json({ error: "Invalid token" });
    const { userId, supabase, userEmail } = authCtx;

    const { data: call, error } = await supabase
      .from("calls")
      .select("*")
      .eq("id", callId)
      .eq("docuuid", userId)
      .single();
    if (error || !call) return res.status(404).json({ error: "Call not found" });

    const reportRaw = call.vitals_data?.ReportData || null;
    const report = reportRaw ? normalizeReportData(reportRaw) : null;
    if (!report) return res.status(404).json({ error: "Report data not available for this call" });
    const patientName = String(call.vitals_data?.PatientName || "Unknown");
    const patientCondition = String(call.vitals_data?.PatientCondition || "N/A");
    const patientAge = String(call.vitals_data?.PatientAge || "");
    const doctorOnFile = String(call.vitals_data?.DoctorEmail || "").trim();
    const pdf = await generateReportPdfBuffer({
      callId: String(call.id),
      patientName,
      patientCondition,
      patientAge,
      durationSeconds: Number(call.duration_seconds || 0),
      transcriptSnippet: effectiveCallTranscript(call),
      report,
      doctorEmail: doctorOnFile || userEmail || undefined,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="doctor-report-${call.id}.pdf"`);
    return res.send(pdf);
  } catch (e: any) {
    console.error("[ReportDownload] error:", e);
    return res.status(500).json({ error: e?.message || "Report download failed" });
  }
});

app.get("/api/calls/:callId/detail", async (req, res) => {
  try {
    const { callId } = req.params;
    const authHeader = String(req.headers.authorization || "");
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";
    if (!accessToken) return res.status(401).json({ error: "Missing Authorization Bearer token" });
    const authCtx = await authenticateRequest(accessToken);
    if (!authCtx) return res.status(401).json({ error: "Invalid token" });
    const { userId, supabase } = authCtx;

    const { data: call, error } = await supabase
      .from("calls")
      .select("*")
      .eq("id", callId)
      .eq("docuuid", userId)
      .single();

    if (error || !call) return res.status(404).json({ error: "Call not found" });

    const transcriptResolved = effectiveCallTranscript(call);

    const [patRes, agRes] = await Promise.all([
      call.patient_id
        ? supabase.from("patients").select("name").eq("id", call.patient_id).eq("docuuid", userId).maybeSingle()
        : Promise.resolve({ data: null }),
      call.agent_id
        ? supabase.from("agents").select("name").eq("id", call.agent_id).eq("docuuid", userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return res.json({
      call: {
        ...call,
        transcript: transcriptResolved,
        patient_name: patRes.data?.name || "Unknown",
        agent_name: agRes.data?.name || "Unknown",
      },
    });
  } catch (e: any) {
    console.error("[CallDetailApi] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to load call" });
  }
});

app.post("/api/calls/:callId/decision", async (req, res) => {
  try {
    const { callId } = req.params;
    const { decision } = req.body || {};
    if (!["approved", "denied"].includes(String(decision))) {
      return res.status(400).json({ error: "decision must be approved or denied" });
    }
    const authHeader = String(req.headers.authorization || "");
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";
    if (!accessToken) return res.status(401).json({ error: "Missing Authorization Bearer token" });
    const authCtx = await authenticateRequest(accessToken);
    if (!authCtx) return res.status(401).json({ error: "Invalid token" });
    const { userId, supabase } = authCtx;

    const { data: call, error: callErr } = await supabase
      .from("calls")
      .select("*")
      .eq("id", callId)
      .eq("docuuid", userId)
      .single();
    if (callErr || !call) return res.status(404).json({ error: "Call not found" });

    const nextVitals = {
      ...(call.vitals_data || {}),
      DoctorDecision: decision,
      DoctorDecisionAt: new Date().toISOString(),
    };
    const { error: updateCallErr } = await supabase
      .from("calls")
      .update({ vitals_data: nextVitals })
      .eq("id", callId)
      .eq("docuuid", userId);
    if (updateCallErr) return res.status(500).json({ error: updateCallErr.message });

    const { data: alertRow } = await supabase
      .from("alerts")
      .select("id")
      .eq("docuuid", userId)
      .eq("patient_id", call.patient_id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (alertRow?.id) {
      const { error: alertUpdateErr } = await supabase
        .from("alerts")
        .update({ status: decision })
        .eq("id", alertRow.id)
        .eq("docuuid", userId);
      if (alertUpdateErr) console.error("[Decision] alert update failed:", alertUpdateErr);
    }

    return res.json({ ok: true, decision });
  } catch (e: any) {
    console.error("[Decision] error:", e);
    return res.status(500).json({ error: e?.message || "Decision update failed" });
  }
});

/**
 * POST /api/calls/:callId/generate-report
 *
 * On-demand report generation pipeline for the CallDetail page:
 *  1. Fetch the live transcript (prefer Vapi live → stored fallback).
 *  2. Clean & translate the transcript to English via Gemini.
 *  3. Generate a structured clinical report from cleaned transcript + patient chart.
 *  4. Persist both the cleaned transcript and the new report into the call's vitals_data.
 *
 * Accepts optional body: { transcript?: string } — the frontend can forward
 * the transcript it already has to avoid a redundant Vapi round-trip.
 *
 * Does NOT affect any existing routes or the webhook pipeline.
 */
app.post("/api/calls/:callId/generate-report", async (req, res) => {
  try {
    const { callId } = req.params;
    const authHeader = String(req.headers.authorization || "");
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";
    if (!accessToken) return res.status(401).json({ error: "Missing Authorization Bearer token" });
    const authCtx = await authenticateRequest(accessToken);
    if (!authCtx) return res.status(401).json({ error: "Invalid token" });
    const { userId, supabase } = authCtx;

    // 1. Load the call from DB
    const { data: call, error: callErr } = await supabase
      .from("calls")
      .select("*")
      .eq("id", callId)
      .eq("docuuid", userId)
      .single();
    if (callErr || !call) return res.status(404).json({ error: "Call not found" });

    // 2. Resolve transcript: prefer body.transcript (frontend already has it) → stored in DB
    const bodyTranscript = String((req.body as any)?.transcript || "").trim();
    let rawTranscript = bodyTranscript || effectiveCallTranscript(call);

    // If still empty, try fetching live from Vapi
    const storedVapiId = String(call.vitals_data?.VapiCallId || "").trim();
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!rawTranscript && storedVapiId && uuidRe.test(storedVapiId)) {
      try {
        const vapiApiKey = requireEnv("VAPI_API_KEY");
        const vapiResp = await fetch(`https://api.vapi.ai/call/${storedVapiId}`, {
          headers: { Authorization: `Bearer ${vapiApiKey}` },
        });
        if (vapiResp.ok) {
          const vapiBody = unwrapVapiCallResponse(await vapiResp.json().catch(() => ({})));
          rawTranscript = buildTranscriptFromVapiCall(vapiBody);
        }
      } catch (e) {
        console.warn("[GenerateReport] Vapi live fetch failed, using stored:", e);
      }
    }

    if (!rawTranscript) {
      return res.status(400).json({
        error: "No transcript available for this call. Cannot generate report without a transcript.",
      });
    }

    console.log("[GenerateReport] starting pipeline for call:", callId, "| raw transcript chars:", rawTranscript.length);

    // 3. Step 1 — Clean & translate the transcript to English
    const cleanedTranscript = await cleanTranscriptToEnglish(rawTranscript);

    // 4. Gather patient chart for context
    const { data: patientRow } = call.patient_id
      ? await supabase.from("patients").select("*").eq("id", call.patient_id).eq("docuuid", userId).single()
      : { data: null };

    const chartJson = JSON.stringify(
      patientRow
        ? {
            name: patientRow.name,
            condition: patientRow.condition,
            age: patientRow.age,
            risk_level: patientRow.risk_level,
            date_of_birth: patientRow.date_of_birth,
          }
        : {},
    );

    // 5. Step 2 — Generate the structured clinical report from cleaned transcript
    const reportRaw = await generateStructuredReport(cleanedTranscript, chartJson);
    const report = normalizeReportData(reportRaw);
    const symptoms = mergeSymptomsFromTranscript(report.symptoms, cleanedTranscript);

    console.log("[GenerateReport] report generated | risk:", report.risk_level, "| symptoms:", symptoms.length);

    // 6. Persist the cleaned transcript + new report into vitals_data
    const updatedVitals = {
      ...(call.vitals_data || {}),
      CleanedTranscript: cleanedTranscript,
      ReportData: { ...report, symptoms },
      Summary: report.summary,
      Diagnosis: report.diagnosis,
      Symptoms: symptoms,
      RelevantHistory: report.relevant_history,
      ClinicalReasoning: report.clinical_reasoning,
      DifferentialDiagnosis: report.differential_diagnosis,
      FollowUpPlan: report.follow_up_plan,
      ActionRequired: report.action_required,
      ReportGeneratedAt: new Date().toISOString(),
      ReportPipeline: "clean-then-generate",
    };

    const { error: updateErr } = await supabase
      .from("calls")
      .update({
        transcript: cleanedTranscript,
        vitals_data: updatedVitals,
      })
      .eq("id", callId)
      .eq("docuuid", userId);

    if (updateErr) {
      console.error("[GenerateReport] DB update failed:", updateErr);
      return res.status(500).json({ error: updateErr.message });
    }

    // 7. Also update the matching alert severity if one exists
    if (call.patient_id) {
      const { data: alertRow } = await supabase
        .from("alerts")
        .select("id")
        .eq("docuuid", userId)
        .eq("patient_id", call.patient_id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (alertRow?.id) {
        await supabase
          .from("alerts")
          .update({
            alert_type: report.alert_type,
            severity: report.risk_level,
          })
          .eq("id", alertRow.id)
          .eq("docuuid", userId);
      }
    }

    console.log("[GenerateReport] done for call:", callId);

    return res.json({
      ok: true,
      cleanedTranscript,
      report: { ...report, symptoms },
    });
  } catch (e: any) {
    console.error("[GenerateReport] error:", e);
    return res.status(500).json({ error: e?.message || "Report generation failed" });
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

    const vapiCallId = String(
      payload?.id || payload?.callId || payload?.call?.id || payload?.data?.id || "",
    );
    if (vapiCallId) {
      const { data: dup } = await supabase
        .from("calls")
        .select("id")
        .eq("docuuid", docuuid)
        .contains("vitals_data", { VapiCallId: vapiCallId })
        .maybeSingle();
      if (dup?.id) {
        console.log("[Webhook] duplicate Vapi call skipped:", vapiCallId);
        return res.json({ received: true, duplicate: true });
      }
    }

    const { data: patientRow } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patient_id)
      .eq("docuuid", docuuid)
      .single();

    const chartJson = JSON.stringify(
      patientRow
        ? {
            name: patientRow.name,
            condition: patientRow.condition,
            age: patientRow.age,
            risk_level: patientRow.risk_level,
            date_of_birth: patientRow.date_of_birth,
          }
        : {},
    );

    const doctor_email =
      metadata?.doctor_email != null && String(metadata.doctor_email).trim() !== ""
        ? String(metadata.doctor_email).trim()
        : metadata?.doctorEmail != null && String(metadata.doctorEmail).trim() !== ""
          ? String(metadata.doctorEmail).trim()
          : null;

    const summaryRaw = await generateDoctorSummaryServer(String(transcript || ""), chartJson);
    await persistCallAndAlertAfterAnalysis({
      supabase,
      docuuid,
      patient_id: String(patient_id),
      agent_id: agent_id ? String(agent_id) : null,
      duration_seconds,
      transcript: String(transcript || ""),
      summaryRaw,
      vapiCallId: vapiCallId || `unknown-${Date.now()}`,
      patientRow,
      doctor_email,
    });

    console.log("[Webhook] processed call for patient:", patient_id);
    return res.json({ received: true });
  } catch (e: any) {
    console.error("[Webhook] fatal error:", e);
    return res.status(200).json({ received: true, error: e?.message });
  }
});

app.use((req, res) => {
  if (String(req.originalUrl || "").startsWith("/api")) {
    console.warn("[Server] API 404:", req.method, req.originalUrl);
  }
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

const server = http.createServer(app);

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[Server] Port ${PORT} is already in use — the API did not start.`);
    console.error("[Server] Another `npm run dev` / `tsx server` may still be running, or another app owns this port.");
    console.error(`[Server] Free it:  npm run free:api-port`);
    console.error(`[Server] Or use another port in .env.local — set both:\n  PORT=4001\n  VITE_DEV_API_PORT=4001`);
    process.exit(1);
  }
  console.error("[Server] HTTP server error:", err);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`[Server] listening on http://127.0.0.1:${PORT} (GET /api/calls/list — call list)`);
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

