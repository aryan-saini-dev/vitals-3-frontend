import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

export function createPatientChatSession(patient: any) {
  if (!apiKey) throw new Error("Missing VITE_GEMINI_API_KEY in .env.local");

  const systemInstruction = `You are VITALS (Virtual Intelligent Triage and Logging System), an empathetic, deeply knowledgeable AI chronic care agent.
Your current patient is ${patient.name}, born ${patient.date_of_birth || "Unknown"}, with a chronic medical history of ${patient.condition}.

Instructions:
1. Act as a human-like, casual, and caring medical assistant.
2. Formulate 1-2 questions at a time. Do not overwhelm the patient.
3. Proactively investigate hidden symptoms related to their specific condition (${patient.condition}). 
4. Do NOT give medical advice or diagnose explicitly to the patient. You are a triage monitor.
5. Keep your responses short (under 3 sentences) because they will be read aloud via Text-to-Speech.
6. Acknowledge what they say empathetically before asking your next question.`;

  const modelWithSystem = genAI.getGenerativeModel({ 
     model: "gemini-2.5-flash",
     systemInstruction: systemInstruction
  });

  return modelWithSystem.startChat({
    history: [],
    generationConfig: { temperature: 0.6, maxOutputTokens: 250 }
  });
}

export async function generateDoctorSummary(transcript: string) {
  if (!apiKey) throw new Error("Missing VITE_GEMINI_API_KEY in .env.local");
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Analyze the following patient-AI call transcript. 
Extract key vitals or reported symptoms. Determine if the patient is HIGH RISK, MEDIUM RISK, or LOW RISK.
Output STRICTLY as a raw JSON object, exactly matching this schema (no markdown formatting, no backticks):
{
  "summary": "Brief 2 sentence clinical summary for the doctor.",
  "risk_level": "high" | "medium" | "low",
  "alert_type": "Short title of the alert (e.g. Metric Out Of Range, Routine Check-in Clear)",
  "symptoms": ["List", "Of", "Symptoms", "Identified"],
  "vitals_data": { "extracted_vital_key": "extracted_value_if_any" },
  "action_required": "e.g. Schedule urgent visit, Re-evaluate in 3 days, None"
}

Transcript:
${transcript}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  // Clean JSON block if Gemini returns Markdown
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const rawJson = jsonMatch ? jsonMatch[1] : text;

  try {
    return JSON.parse(rawJson.trim());
  } catch (err) {
    console.error("Failed to parse Gemini summary JSON", rawJson);
    throw new Error("Invalid output from AI");
  }
}
