/**
 * Backfills the N most recent calls for a doctor with demo transcript + report
 * and sets created_at to 2 April 2026 (staggered times).
 *
 * Default: last 5 calls, always overwritten (not only “empty” rows).
 *
 * Usage (from project root):
 *   npm run seed:fake-calls
 *   (docuuid = newest call’s docuuid, or set DOCUUID)
 *
 * Optional:
 *   DOCUUID=<uuid> npm run seed:fake-calls
 *   SEED_CALL_LIMIT=10 npm run seed:fake-calls
 *   SEED_ONLY_EMPTY=1 npm run seed:fake-calls   — only rows missing report/transcript
 *
 * Requires in .env.local: VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing VITE_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

type ReportShape = {
  summary: string;
  diagnosis: string;
  risk_level: string;
  alert_type: string;
  symptoms: string[];
  vitals_data: Record<string, unknown>;
  action_required: string;
  relevant_history: string;
  clinical_reasoning: string;
  differential_diagnosis: string[];
  follow_up_plan: string;
};

function buildFakePayload(index: number): {
  transcript: string;
  duration_seconds: number;
  vitals_data: Record<string, unknown>;
} {
  const scenarios = [
    {
      duration: 418,
      transcript: `user: Hi, thanks for picking up — I've had this headache on and off for about three days and I'm getting nauseous when I try to eat.
assistant: I'm sorry you're going through that. I'm going to ask a few questions so the care team has a clear picture. When did the headache first start — suddenly or gradually?
user: More gradual. I noticed a dull ache Monday evening and it's just kind of hung around since then.
assistant: On a scale of zero to ten, zero being no pain and ten the worst you can imagine, where would you put it right now, and has that changed day to day?
user: Right now maybe a six. Yesterday afternoon it felt closer to a seven. Mornings are a little better, like a four or five.
assistant: Where is the pain mainly — one side of the head, both sides, behind the eyes, or the back of the head and neck?
user: Mostly both temples and across my forehead. Sometimes it creeps toward the back of my skull.
assistant: Any visual changes — blurring, double vision, bright zigzag lines, or temporary blind spots?
user: No, vision's been normal. Screens are a bit uncomfortable but I think that's just the brightness.
assistant: Have you measured a fever at home, or felt feverish with chills or sweats?
user: I haven't taken my temperature today. I don't think I've had chills. Maybe a little warm last night but nothing dramatic.
assistant: Any neck stiffness that's new, especially if you can't touch your chin to your chest, or pain when you bend forward?
user: My neck feels stiff when I wake up but I sleep on a weird pillow. Bending forward doesn't make the headache explode or anything.
assistant: How about nausea and vomiting — are you actually throwing up or mostly nauseated?
user: Mostly nauseated. I dry-heaved once yesterday after lunch. Today I ate toast and felt queasy but kept it down.
assistant: Have you taken anything for the pain — acetaminophen, ibuprofen, or a prescription you already have?
user: I've been taking ibuprofen every six hours or so. It takes the edge off for a couple hours then it creeps back.
assistant: Any recent head injury, fall, or car accident, even if it seemed minor?
user: No, nothing like that.
assistant: Do you have a history of migraines or bad headaches like this in the past?
user: I get tension headaches sometimes but not usually this long or with this much nausea.
assistant: Any numbness, weakness, trouble speaking, or confusion — even briefly?
user: No, I feel clearheaded. Typing at work is fine.
assistant: How has sleep been — are you getting a full night, and any snoring or sleep apnea that you know of?
user: Sleep's been fragmented. I wake up once or twice. My partner says I snore lightly but I've never been tested for apnea.
assistant: Stress level lately — any big deadlines, life changes, or anxiety keeping you keyed up?
user: Work's been intense and I'm juggling childcare. I'm definitely tense across my shoulders.
assistant: Hydration and caffeine — are you drinking enough water, and has your coffee or soda habit changed?
user: Probably dehydrated honestly. I've had extra coffee to push through fatigue. Maybe three cups instead of one.
assistant: Any sinus pressure, tooth pain, or recent dental work that could refer pain to the head?
user: No sinus infection symptoms that I know of. Teeth feel fine.
assistant: For women of childbearing age we sometimes ask — any chance of pregnancy or new hormonal medications?
user: Not pregnant that I know of. Birth control hasn't changed.
assistant: Red-flag symptoms we take seriously include thunderclap worst-headache-of-life, fever with stiff neck, or new neuro deficits. None of those sound like a perfect match for you today, but we still want the clinician to review. Does anything we discussed feel inaccurate?
user: No, that's accurate. I just want to stop feeling seasick every time I eat.
assistant: I'll summarize for your team: multiday bilateral headache peaking afternoons, nausea with limited vomiting, partial relief with ibuprofen, no focal neuro symptoms reported, possible contributors include tension, hydration, and sleep. They may recommend evaluation timing, hydration plan, and whether to adjust OTC meds. Is there anything else you want the doctor to know?
user: Mention that loud noise at the office makes it worse — I had to step away from a meeting today.
assistant: Got it — I'll include sound sensitivity. Anything else?
user: That's everything, thanks.
assistant: Thank you for walking through this in detail. A clinician will follow up per your care plan. If you develop sudden severe headache, fever with stiff neck, weakness, confusion, or repeated vomiting, seek urgent care or emergency services. Take care until then.`,
      report: {
        summary:
          "Patient reports subacute headache with mild nausea, moderate intensity, worse in afternoon. Denies fever or visual changes. Mild neck stiffness attributed to sleep posture.",
        diagnosis: "Tension-type headache vs migraine prodrome — clinical correlation needed",
        risk_level: "medium",
        alert_type: "Headache with nausea — routine callback within 24–48h",
        symptoms: [
          "Headache × 3 days, severity ~6/10, worse PM",
          "Nausea with meals; brief dry heave",
          "Mild neck stiffness (patient attributes to sleep)",
          "Phonophobia — loud office noise worsens pain",
        ],
        vitals_data: { headache_scale: "6/10", nausea: "with meals", fever: "denied", sound_sensitivity: "yes" },
        action_required: "Clinician to rule out red flags; consider OTC guidance and follow-up if worsening.",
        relevant_history: "Per chart: outpatient; no prior neuro imaging documented in snippet.",
        clinical_reasoning:
          "Pattern suggests primary headache; absence of fever reduces acute CNS infection likelihood but stiff neck warrants clinician judgment.",
        differential_diagnosis: ["Tension headache", "Migraine without aura", "Medication overuse (if applicable)"],
        follow_up_plan: "Return call if thunderclap onset, focal neuro signs, or fever develops.",
      } satisfies ReportShape,
    },
    {
      duration: 255,
      transcript: `user: Hi, I'm calling because my glucose numbers have been scary high the last few days and I'm not sure what to do until I see the doctor.
assistant: I'm glad you reached out. Let's go through this carefully. What numbers are you seeing, and are those fasting readings or after meals?
user: Fasting the last two mornings were about 180. After dinner last night I was 240 something. I double-checked with a new strip.
assistant: What medications are you supposed to be on right now, and are you taking them exactly as prescribed?
user: Metformin twice a day with meals, and a small dose of basal insulin at bedtime — I've been on that combo for a year.
assistant: Have you missed any doses of metformin or insulin in the past week?
user: Yeah — I ran out of metformin and the pharmacy was closed over the weekend, so I missed two full days and caught up Monday.
assistant: Understood. Since restarting, have the morning numbers improved at all?
user: A little yesterday but this morning was still 178. I'm worried I'm sliding backward.
assistant: Any classic high-sugar symptoms — excessive thirst, dry mouth, waking up to urinate, blurry vision, fatigue?
user: Thirst is through the roof. I'm up three times at night peeing. My eyes feel a bit fuzzy when I read my phone.
assistant: Any unintentional weight loss, vomiting, abdominal pain, or fruity-smelling breath?
user: No vomiting. Stomach's a little upset but I think that's from worrying. No weird breath that I notice.
assistant: Have you been sick recently — fever, cough, urinary burning, or foot infection?
user: No fever. No UTI symptoms. I had a mild cold two weeks ago but I'm over it.
assistant: Diet-wise — more carbs or sweets than usual, irregular meal times, or alcohol?
user: Birthday cake at the office twice last week and I've skipped lunch a couple days then overeat at dinner — not great, I know.
assistant: Activity level — still walking or exercising like you usually do?
user: Desk job, barely 4,000 steps. I was doing short walks after dinner but I fell off that routine.
assistant: Do you have ketone strips at home, and have you checked for ketones with these highs?
user: I don't have strips right now. I've never been told to check unless I'm sick.
assistant: Fluid intake — are you drinking mostly water, and any dehydration from heat or exercise?
user: Mostly coffee and diet soda honestly. Probably not enough water.
assistant: Sleep and stress — insomnia or high cortisol weeks at work?
user: Both. Sleep's been five or six hours and work pressure is insane.
assistant: Any history of DKA — hospital admission for ketones — that we should flag mentally?
user: No hospitalizations for that. I've had highs before but never like an emergency.
assistant: Family context — anyone available to help you get meds on time or pick up from pharmacy after hours?
user: My spouse can go tonight if the doctor wants something changed today.
assistant: Access — do you have enough insulin pens and needles, and have you rotated injection sites properly?
user: Pens are fine. I rotate belly and thigh. No lumps that I feel.
assistant: Hypoglycemia — any lows under 5.5 / 70 lately, shakiness, sweating, confusion?
user: No lows recently. If anything I'm running high only.
assistant: I'll capture this for your clinician: persistent fasting hyperglycemia after a metformin gap, osmotic symptoms, dietary and sleep stressors, adequate insulin supply — they're likely to advise hydration, meal structure, adherence reinforcement, and whether to adjust short-term insulin or order labs. Anything you want them to prioritize?
user: Ask if I should temporarily increase basal or add correction doses — I'm flying blind.
assistant: I'll note your question about basal versus correction strategy. Before we wrap, any chest pain, shortness of breath, or confusion right this minute?
user: No, I'm alert and breathing okay sitting here.
assistant: Good. If you develop vomiting with inability to keep fluids down, severe abdominal pain, rapid breathing, or you can't stay awake, seek emergency care. Otherwise expect follow-up from your team per protocol. Thanks for the thorough rundown.
user: Thank you — I'll drink more water and try to fix meals today.
assistant: You're welcome. We'll transmit this to your care team now.`,
      report: {
        summary:
          "Patient with known diabetes reports elevated fasting glucose (~180) x2 days with polyuria and polydipsia. Recent 2-day metformin lapse.",
        diagnosis: "Hyperglycemia — likely multifactorial; adherence gap identified",
        risk_level: "high",
        alert_type: "Hyperglycemia with osmotic symptoms",
        symptoms: ["Elevated fasting glucose (~180)", "Polydipsia", "Nocturia", "Metformin lapse 2 days"],
        vitals_data: { fasting_glucose_reported: "~180 mg/dL ×2", medications: "metformin gap noted" },
        action_required: "Nurse or clinician to advise on medication restart, hydration, and when to seek ER.",
        relevant_history: "Diabetes follow-up context; verify A1c and current meds on chart.",
        clinical_reasoning:
          "Symptoms align with hyperglycemia; recent missed metformin is a plausible contributor but not sole explanation.",
        differential_diagnosis: ["Uncontrolled T2DM", "Stress hyperglycemia", "Infection (to exclude if fever)"],
        follow_up_plan: "SMBG log, medication reconciliation, consider urgent visit if ketones or vomiting.",
      } satisfies ReportShape,
    },
    {
      duration: 362,
      transcript: `user: Hey — this is my scheduled follow-up. I finished the antibiotic course yesterday and wanted to report how I'm doing.
assistant: Thanks for checking in. I'll ask a structured review so your chart stays complete. Which antibiotic were you on, for how many days, and did you take every dose without skipping?
user: Amoxicillin-clavulanate, ten days, twice a day. I didn't miss any doses after the first day when I almost forgot the evening pill.
assistant: What infection was it treating — pneumonia, sinus, skin, UTI, or something else your clinician labeled?
user: Sinus and upper respiratory — green congestion, facial pressure, low fever for two days when it started.
assistant: How is the congestion and pressure now compared to the start?
user: Much better. I can breathe through both nostrils most of the day. Pressure is mild only in the morning.
assistant: Cough — productive or dry, how many times per day, and any blood-streaked sputum?
user: A little productive cough maybe four or five times a day. Yellowish phlegm still but lighter. No blood I've seen.
assistant: Breathing — any wheeze, chest tightness, or need for an inhaler you didn't use before?
user: No wheeze. Stair-climbing at home is fine, maybe slightly winded if I run upstairs with laundry but that's normal for me.
assistant: Fever, chills, or night sweats since completing antibiotics?
user: No fever on the thermometer. Nights are a bit sweaty but I think that's my heavy blanket.
assistant: Energy level and appetite — back to baseline?
user: Appetite's back. Energy is maybe eighty percent — still a little tired by evening.
assistant: Ear pain, sore throat, or swollen glands that returned after you improved?
user: Throat's scratchy once in a while but not like the strep-y pain before. Ears feel clear.
assistant: GI symptoms while on the antibiotic — diarrhea, cramping, or foul stools?
user: First few days I had loose stool once a day. It's firmed up since I added yogurt.
assistant: Any rash, hives, itching, lip swelling, or trouble swallowing that could suggest allergy?
user: No rash. No swelling. I tolerated the pills okay aside from the stomach stuff early on.
assistant: Urinary changes — pain, frequency, or odor suggesting a secondary UTI?
user: All normal down there.
assistant: Pain or redness at IV site — you didn't have IV antibiotics, correct?
user: Correct, all oral.
assistant: Travel, new sick contacts, or exposure to anyone hospitalized recently?
user: Kids had colds at school but nothing severe. We stayed home over the weekend.
assistant: Smoking, vaping, or anything that could slow sinus clearance?
user: I quit smoking two years ago. No vape.
assistant: Hydration, saline rinses, or humidifier use while recovering?
user: Saline rinse morning and night. Humidifier in the bedroom. Water bottle at work.
assistant: Other meds — steroids, decongestants, or NSAIDs you're still taking?
user: I stopped pseudoephedrine after day five. Occasional acetaminophen for headache only.
assistant: Mental health check — anxiety or low mood during the illness that's lingering?
user: A bit anxious about it coming back but I'm not depressed. Just want a clean bill of health.
assistant: Work and activity — cleared to return full duty or still pacing yourself?
user: Back at work full time since day six of antibiotics. So far so good.
assistant: Red flags we watch after respiratory infection: returning fever, worsening shortness of breath, confusion, or chest pain. Any of those?
user: None of those. If anything I'm slowly improving.
assistant: I'll document: completed course, residual mild productive cough without red flags, good functional capacity, no allergy signs, supportive care ongoing. Clinician may decide if imaging or follow-up culture is needed — any question you want passed along?
user: Ask if I should do another sinus rinse week or stop now.
assistant: I'll include that question. Final vitals-at-home if you measured — oxygen, temperature, blood pressure?
user: Temp 98.2 this morning. SpO2 was 97 on a friend's pulse ox. BP 128 over 82 at the grocery kiosk yesterday.
assistant: Helpful, thanks. Anything else?
user: That's the full story — thanks for taking the time.
assistant: Appreciate the detail. If symptoms worsen again — high fever, facial swelling, severe headache, or stiff neck — contact urgent care. Otherwise routine follow-up stands. Have a good recovery.`,
      report: {
        summary:
          "Post-antibiotic follow-up: patient feels largely recovered with minimal residual cough. No chest pain or dyspnea on exertion.",
        diagnosis: "Resolving infection — routine recovery per patient report",
        risk_level: "low",
        alert_type: "Routine post-antibiotic check-in — stable",
        symptoms: ["Minimal intermittent cough", "No chest pain", "Ambulation upstairs without SOB"],
        vitals_data: { antibiotic_course: "completed", exertion: "stairs OK" },
        action_required: "Provider to confirm antibiotic appropriateness and if any follow-up culture needed per protocol.",
        relevant_history: "Recent antibiotic course completed; aligns with infection recovery narrative.",
        clinical_reasoning:
          "Absence of red-flag cardiopulmonary symptoms supports low-acuity recovery, with mild cough acceptable residual.",
        differential_diagnosis: ["Post-viral cough", "Residual bronchial irritation"],
        follow_up_plan: "Patient education on when to call back; routine monitoring as per care plan.",
      } satisfies ReportShape,
    },
  ];

  const s = scenarios[index % scenarios.length];
  const report = s.report;
  const vapiId = `fake-seed-${Date.now()}-${index}`;
  const doctorEmail = (process.env.FAKE_DOCTOR_EMAIL || "").trim() || "demo-clinician@example.com";

  const vitals_data: Record<string, unknown> = {
    ...report.vitals_data,
    Symptoms: report.symptoms,
    Summary: report.summary,
    Diagnosis: report.diagnosis,
    RelevantHistory: report.relevant_history,
    ClinicalReasoning: report.clinical_reasoning,
    DifferentialDiagnosis: report.differential_diagnosis,
    FollowUpPlan: report.follow_up_plan,
    ActionRequired: report.action_required,
    ReportData: report,
    VapiCallId: vapiId,
    CallTranscript: s.transcript.trim(),
    PdfStoredInStorage: false,
    PdfGeneratedAt: new Date().toISOString(),
    DoctorEmail: doctorEmail,
  };

  return {
    transcript: s.transcript.trim(),
    duration_seconds: s.duration,
    vitals_data,
  };
}

function lacksData(row: { transcript?: string | null; vitals_data?: Record<string, unknown> | null }): boolean {
  const t = String(row.transcript || "").trim();
  const vt = String(row.vitals_data?.CallTranscript || "").trim();
  const hasTranscript = Boolean(t || vt);
  const hasReport = Boolean(row.vitals_data?.ReportData);
  return !hasReport || !hasTranscript;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const seedLimit = Math.min(50, Math.max(1, Number(process.env.SEED_CALL_LIMIT || "5") || 5));
  const onlyEmpty = String(process.env.SEED_ONLY_EMPTY || "").trim() === "1";

  let docuuid = (process.env.DOCUUID || process.argv[2] || "").trim();
  if (!docuuid) {
    const { data: newest, error: newestErr } = await supabase
      .from("calls")
      .select("docuuid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (newestErr) {
      console.error("Auto-detect docuuid failed:", newestErr.message);
      process.exit(1);
    }
    if (!newest?.docuuid) {
      console.error("No calls in database — create a call first or set DOCUUID.");
      process.exit(1);
    }
    docuuid = String(newest.docuuid);
    console.log("Auto-selected docuuid from most recent call:", docuuid);
  }

  const fetchCap = Math.max(seedLimit, 20);
  const { data: rows, error: qErr } = await supabase
    .from("calls")
    .select("id, transcript, vitals_data, created_at")
    .eq("docuuid", docuuid)
    .order("created_at", { ascending: false })
    .limit(fetchCap);

  if (qErr) {
    console.error("Query failed:", qErr.message);
    process.exit(1);
  }

  const ordered = rows || [];
  const list = onlyEmpty ? ordered.filter(lacksData).slice(0, seedLimit) : ordered.slice(0, seedLimit);

  if (!list.length) {
    console.log(
      onlyEmpty
        ? `No calls missing report/transcript (checked ${ordered.length} most recent for this docuuid).`
        : "No calls found for this docuuid.",
    );
    process.exit(0);
  }

  console.log(
    `Mode: ${onlyEmpty ? "only empty rows" : "last N calls (overwrite)"} — updating ${list.length} row(s) (limit ${seedLimit}).`,
  );

  /** 2026-04-02 staggered (UTC) — April 2nd */
  const base = new Date(Date.UTC(2026, 3, 2, 14, 0, 0));

  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    const fake = buildFakePayload(i);
    const created = new Date(base.getTime() + i * 75 * 60 * 1000);
    const vitalsMerged = {
      ...(row.vitals_data && typeof row.vitals_data === "object" ? row.vitals_data : {}),
      ...fake.vitals_data,
    } as Record<string, unknown>;

    const { error: uErr } = await supabase
      .from("calls")
      .update({
        transcript: fake.transcript,
        duration_seconds: fake.duration_seconds,
        vitals_data: vitalsMerged,
        created_at: created.toISOString(),
      })
      .eq("id", row.id)
      .eq("docuuid", docuuid);

    if (uErr) {
      console.error(`Update failed for ${row.id}:`, uErr.message);
      process.exit(1);
    }
    console.log(`Updated call ${row.id} — created_at ${created.toISOString()} — chars ${fake.transcript.length}`);
  }

  console.log(`Done. Patched ${list.length} call(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
