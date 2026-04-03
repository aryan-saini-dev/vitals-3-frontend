import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { generateDoctorSummary } from "@/lib/gemini";
import {
  Activity,
  AlertTriangle,
  Bot,
  Clipboard,
  Shield,
  User,
} from "lucide-react";
import { VoiceAssistant, PatientInfo } from "@/components/VoiceAssistant";

type CallPhase = "idle" | "completed";

export default function SimulateCall() {
  const { user } = useAuth();

  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [callerNumber, setCallerNumber] = useState("");
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [summaryData, setSummaryData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchPatients() {
      if (!user) return;
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("docuuid", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed fetching patients for simulate call:", error);
        return;
      }

      if (data) {
        const mapped: PatientInfo[] = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          condition: p.condition,
          age: p.age,
          risk_level: p.risk_level,
        }));
        setPatients(mapped);
      }
    }
    fetchPatients();
  }, [user]);

  const selectedPatient =
    patients.find((p) => p.id === selectedPatientId) || null;

  async function handleCallFinished(payload: {
    transcript: string;
    durationSeconds: number;
  }) {
    if (!user || !selectedPatient) return;

    setIsSaving(true);
    try {
      const summary = await generateDoctorSummary(payload.transcript);

      await supabase.from("calls").insert({
        docuuid: user.id,
        patient_id: selectedPatient.id,
        agent_id: null,
        duration_seconds: payload.durationSeconds,
        transcript: payload.transcript,
        risk_level: summary.risk_level,
        alert_type: summary.alert_type,
        vitals_data: summary.vitals_data,
        action_required: summary.action_required,
      });

      setSummaryData(summary);
      setPhase("completed");
    } catch (e) {
      console.error("Error saving call / generating summary:", e);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 md:p-8 relative">
      <div className="fixed inset-0 overflow-hidden -z-10 opacity-30 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
      </div>

      {phase === "idle" && (
        <div className="max-w-3xl w-full bg-card/80 backdrop-blur-xl border-2 border-border p-8 md:p-10 rounded-[32px] shadow-soft space-y-8 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="px-4 py-1.5 bg-tertiary/20 text-foreground text-xs font-black uppercase tracking-[0.2em] rounded-full border-2 border-tertiary/40">
              Live Agent Connected
            </span>
          </div>

          <div className="w-24 h-24 bg-tertiary mx-auto rounded-full flex items-center justify-center border-4 border-white shadow-pop">
            <Bot className="w-12 h-12 text-foreground" />
          </div>

          <div className="space-y-3 text-center">
            <h1 className="text-4xl font-heading font-extrabold tracking-tight">
              AI Patient Chat
            </h1>
            <p className="text-muted-foreground font-medium text-lg">
              Select a patient, enter your number, and start a real-time voice
              call with your Vapi agent.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto pt-2">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <select
                className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-border bg-background focus:border-primary outline-none font-bold transition-all appearance-none cursor-pointer"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
              >
                <option value="">Select Patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.condition ? `— ${p.condition}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  className="w-[104px] px-3 py-4 rounded-2xl border-2 border-border bg-background focus:border-primary outline-none font-bold transition-all"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                >
                  <option value="+91">+91 (India)</option>
                  <option value="+1">+1 (US)</option>
                  <option value="+44">+44 (UK)</option>
                  <option value="+61">+61 (Australia)</option>
                  <option value="+234">+234 (Nigeria)</option>
                  <option value="+971">+971 (UAE)</option>
                  <option value="+27">+27 (South Africa)</option>
                  <option value="+33">+33 (France)</option>
                  <option value="+49">+49 (Germany)</option>
                </select>
                <input
                  type="tel"
                  className="flex-1 px-4 py-4 rounded-2xl border-2 border-border bg-background focus:border-primary outline-none font-bold transition-all"
                  placeholder="Phone number"
                  value={callerNumber}
                  onChange={(e) => setCallerNumber(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">
                Used for context and logging only. No real SMS will be sent.
              </p>
            </div>
          </div>

          <div className="pt-4">
            <VoiceAssistant
              patient={selectedPatient}
              callerPhoneNumber={`${countryCode}${callerNumber}`}
              onCallFinished={handleCallFinished}
            />
            {isSaving && (
              <p className="mt-3 text-xs text-muted-foreground text-center font-semibold">
                Analyzing transcript and saving call…
              </p>
            )}
          </div>
        </div>
      )}

      {phase === "completed" && summaryData && (
        <div className="w-full max-w-4xl space-y-8 animate-in slide-in-from-bottom-12 duration-700">
           <div className="bg-card border-4 border-border rounded-[40px] shadow-soft overflow-hidden">
              <div className="bg-quaternary p-8 flex justify-between items-center text-white border-b-4 border-border">
                 <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                       <Clipboard className="w-8 h-8" />
                    </div>
                    <div>
                       <h2 className="text-3xl font-heading font-black uppercase tracking-tight text-white border-none bg-transparent m-0 leading-none">Clinical Assessment</h2>
                       <p className="font-bold opacity-80 uppercase text-xs tracking-widest text-white border-none bg-transparent mt-2">Demo Report Generation Successful</p>
                    </div>
                 </div>
                 <div className={`px-6 py-3 rounded-2xl border-2 border-white/50 backdrop-blur-md font-black italic text-xl uppercase ${summaryData.risk_level === 'high' ? 'bg-destructive ring-4 ring-destructive/30' : 'bg-primary'}`}>
                    {summaryData.risk_level} Risk
                 </div>
              </div>

              <div className="p-10 space-y-10">
                 <div className="space-y-4 text-left">
                    <h4 className="flex items-center gap-2 text-muted-foreground font-black uppercase tracking-widest text-sm border-none bg-transparent">
                       <Activity className="w-4 h-4 text-quaternary" /> Executive Summary
                    </h4>
                    <p className="text-2xl font-bold leading-relaxed">{summaryData.summary}</p>
                 </div>

                 <div className="grid md:grid-cols-2 gap-8">
                    <div className="p-6 bg-muted/40 rounded-3xl border-2 border-border space-y-4 text-left">
                       <h4 className="flex items-center gap-2 text-muted-foreground font-black uppercase tracking-widest text-sm border-none bg-transparent">
                          <AlertTriangle className="w-4 h-4 text-secondary" /> Diagnostic Alerts
                       </h4>
                       <div className="p-4 bg-white border-2 border-border rounded-2xl font-black text-xl text-secondary shadow-pop uppercase italic">
                          {summaryData.alert_type}
                       </div>
                    </div>
                    
                    <div className="p-6 bg-muted/40 rounded-3xl border-2 border-border space-y-4 text-left">
                       <h4 className="flex items-center gap-2 text-muted-foreground font-black uppercase tracking-widest text-sm border-none bg-transparent">
                          <Clipboard className="w-4 h-4 text-primary" /> Observed Symptoms
                       </h4>
                       <div className="flex flex-wrap gap-2">
                          {summaryData.symptoms.map((s: string, i: number) => (
                             <span key={i} className="px-3 py-1 bg-white border-2 border-border rounded-full font-bold text-sm">
                                {s}
                             </span>
                          ))}
                       </div>
                    </div>
                 </div>

                 <div className="p-8 bg-muted/80 rounded-3xl border-2 border-border grid grid-cols-3 gap-6">
                    {Object.entries(summaryData.vitals_data).map(([key, val]: any) => (
                       <div key={key} className="text-center p-3 bg-white rounded-2xl border-2 border-border shadow-soft">
                          <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-tighter">{key.replace('_',' ')}</p>
                          <p className="text-lg font-black text-foreground">{val}</p>
                       </div>
                    ))}
                 </div>

                 <div className="p-8 bg-secondary/5 rounded-3xl border-4 border-dashed border-secondary/30 flex items-center justify-between text-left">
                    <div>
                       <h4 className="text-secondary font-black uppercase tracking-widest text-sm mb-1 border-none bg-transparent">Recommended Action</h4>
                       <p className="text-xl font-bold">{summaryData.action_required}</p>
                    </div>
                    <Shield className="w-12 h-12 text-secondary opacity-20" />
                 </div>
              </div>

              <div className="p-8 bg-muted border-t-4 border-border flex gap-4">
                 <button 
                 onClick={() => {
                   setPhase("idle");
                   setSummaryData(null);
                 }} 
                  className="flex-1 py-5 bg-white text-foreground font-heading font-black uppercase rounded-2xl border-4 border-foreground shadow-pop hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                 >
                    New Call
                 </button>
                 <button 
                 onClick={() => setPhase("idle")} 
                 className="px-10 py-5 bg-tertiary text-foreground font-heading font-black uppercase rounded-2xl border-4 border-foreground shadow-pop hover:-translate-y-1 transition-all"
                 >
                    Back to Setup
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
