import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
// import { supabase } from "@/lib/supabase"; // Bypassed for Mock Demo
// import { createPatientChatSession, generateDoctorSummary } from "@/lib/gemini"; // Bypassed for Mock Demo
import { 
  Bot, Phone, PhoneOff, Activity, CheckCircle, 
  AlertTriangle, User, Calendar, Clipboard, 
  ChevronRight, Volume2, Shield, HeartPulse, Send, MessageCircle, Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type CallPhase = "idle" | "ringing" | "active" | "analyzing" | "completed";

// --- MOCK DATA FOR DEMO ---
const MOCK_PATIENTS = [
  { id: "p1", name: "Sarah Jenkins", condition: "Chronic Heart Failure", age: 68, risk: "high" },
  { id: "p2", name: "Robert Chen", condition: "Type 2 Diabetes", age: 54, risk: "medium" },
  { id: "p3", name: "Elena Rodriguez", condition: "COPD / Respiratory", age: 72, risk: "low" }
];

const MOCK_AI_PHRASES = [
  "I've noted that. Have you noticed any unusual swelling in your ankles today?",
  "That's important information for your care team. Are you feeling any shortness of breath while resting?",
  "Thank you for sharing. Have you been consistent with your prescribed medication this morning?",
  "I understand. On a scale of 1-10, how would you rate your fatigue right now?",
  "I'm recording this for Dr. Smith. Based on what you've said, we should monitor your oxygen levels closely.",
  "That sounds manageable, but let's stay vigilant. Are there any other symptoms you'd like to report?"
];

export default function SimulateCall() {
  // Contexts/Navigation
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // States
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [transcriptLog, setTranscriptLog] = useState<{role: "user" | "agent", text: string}[]>([]);
  const [processingUserTurn, setProcessingUserTurn] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [duration, setDuration] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [mockResponseIndex, setMockResponseIndex] = useState(0);

  // Refs
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer logic
  useEffect(() => {
    if (phase === "active") {
      setStartTime(Date.now());
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - (startTime || Date.now())) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, startTime]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptLog, processingUserTurn]);

  const handleStartCall = async () => {
    if (!selectedPatientId) return;
    
    setPhase("ringing");
    setTranscriptLog([]);
    setDuration(0);
    setMockResponseIndex(0);
    
    // DELAY FOR IMMERSION
    setTimeout(() => {
        setPhase("active");
        const patient = MOCK_PATIENTS.find(p => p.id === selectedPatientId);
        const intro = `Hello, I'm your Vitals Assistant. I'm checking in on your ${patient?.condition} management today. How are you feeling this morning?`;
        setTranscriptLog([{ role: "agent", text: intro }]);
    }, 2000);
  };

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!chatInput.trim() || processingUserTurn) return;
    
    const textToSubmit = chatInput;
    setChatInput("");
    setProcessingUserTurn(true);
    setTranscriptLog(prev => [...prev, { role: "user", text: textToSubmit }]);
    
    // SIMULATE AI THINKING
    setTimeout(() => {
       const aiResponse = MOCK_AI_PHRASES[mockResponseIndex % MOCK_AI_PHRASES.length];
       setMockResponseIndex(prev => prev + 1);
       setTranscriptLog(prev => [...prev, { role: "agent", text: aiResponse }]);
       setProcessingUserTurn(false);
    }, 1500);
  }

  const handleHangUp = async () => {
    setPhase("analyzing");
    
    const patientObj = MOCK_PATIENTS.find(p => p.id === selectedPatientId);

    // MOCK SUMMARY GENERATION
    setTimeout(() => {
      const mockSummary = {
        summary: `Patient ${patientObj?.name} reported moderate symptom progression related to ${patientObj?.condition}. Overall stability is ${patientObj?.risk === 'high' ? 'concerning' : 'maintaining'}.`,
        risk_level: patientObj?.risk || "medium",
        alert_type: patientObj?.risk === 'high' ? "Severe Fluid Retention" : "Routine Check-in Analysis",
        symptoms: ["Mild Edema", "Increased Fatigue", "Normal BP"],
        vitals_data: { 
           Weight: "184 lbs (+2.4)", 
           Blood_Pressure: "132/88",
           Oxygen: "96%"
        },
        action_required: patientObj?.risk === 'high' ? "Schedule Urgent In-Person Review" : "Continue Current Medication Path"
      };
      
      setSummaryData(mockSummary);
      setPhase("completed");
    }, 2500);
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 md:p-8 relative">
      {/* Background Blobs */}
      <div className="fixed inset-0 overflow-hidden -z-10 opacity-30 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
      </div>

      {phase === "idle" && (
        <div className="max-w-2xl w-full bg-card/80 backdrop-blur-xl border-2 border-border p-10 rounded-[32px] shadow-soft text-center space-y-8 animate-in fade-in zoom-in duration-300">
           <div className="flex items-center justify-center gap-3 mb-2">
              <span className="px-4 py-1.5 bg-tertiary/20 text-foreground text-xs font-black uppercase tracking-[0.2em] rounded-full border-2 border-tertiary/40">Demo Mode Active</span>
           </div>

           <div className="w-24 h-24 bg-tertiary mx-auto rounded-full flex items-center justify-center border-4 border-white shadow-pop">
             <Bot className="w-12 h-12 text-foreground" />
           </div>
           
           <div className="space-y-3">
             <h1 className="text-4xl font-heading font-extrabold tracking-tight">AI Patient Chat</h1>
             <p className="text-muted-foreground font-medium text-lg">
               Simulate clinical triage with our zero-latency demo engine. No API key required.
             </p>
           </div>

           <div className="space-y-4 max-w-sm mx-auto pt-4">
             <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <select 
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-border bg-background focus:border-primary outline-none font-bold transition-all appearance-none cursor-pointer"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                >
                  <option value="" disabled>Select Target Patient</option>
                  {MOCK_PATIENTS.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {p.condition} ({p.risk.toUpperCase()})</option>
                  ))}
                </select>
             </div>
             
             <button 
               onClick={handleStartCall}
               disabled={!selectedPatientId}
               className="w-full py-5 bg-tertiary text-foreground font-heading font-bold rounded-full border-4 border-foreground shadow-pop hover:-translate-y-1 hover:shadow-pop-hover active:translate-x-0.5 active:translate-y-0.5 transition-all flex justify-center items-center gap-3 text-xl disabled:opacity-50"
             >
               <MessageCircle className="w-6 h-6 fill-current" /> Start Demo Session
             </button>
           </div>
        </div>
      )}

      {phase === "ringing" && (
        <div className="flex flex-col items-center space-y-8 animate-in fade-in zoom-in duration-500">
           <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              <div className="relative w-40 h-40 bg-card rounded-full border-4 border-border flex items-center justify-center shadow-soft">
                  <Phone className="w-16 h-16 text-primary" />
              </div>
           </div>
           <div className="text-center">
              <h2 className="text-4xl font-heading font-black uppercase italic tracking-tighter">Connecting Engine</h2>
              <p className="text-muted-foreground font-bold mt-2 uppercase text-xs tracking-[0.3em]">Initializing Medical Graph...</p>
           </div>
        </div>
      )}

      {phase === "active" && (
        <div className="w-full max-w-5xl h-[800px] bg-card/90 backdrop-blur-2xl border-4 border-border rounded-[40px] shadow-soft overflow-hidden flex flex-col relative animate-in slide-in-from-bottom-12 duration-500">
           {/* Top Bar */}
           <div className="p-6 border-b-4 border-border flex justify-between items-center bg-muted/30">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white border-2 border-border shadow-pop">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                 </div>
                 <div>
                    <h3 className="font-heading font-extrabold text-xl">{MOCK_PATIENTS.find(p=>p.id === selectedPatientId)?.name}</h3>
                    <div className="flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                       <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{formatTime(duration)} — Simulated Demo</span>
                    </div>
                 </div>
              </div>
              
              <button 
                onClick={handleHangUp}
                className="px-6 py-3 bg-destructive text-white rounded-xl border-2 border-foreground shadow-pop hover:-translate-y-0.5 transition-all font-bold uppercase tracking-tighter flex items-center gap-2"
              >
                 <PhoneOff className="w-4 h-4" /> End Session
              </button>
           </div>

           {/* Transcript Area */}
           <div className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth pb-0">
              {transcriptLog.map((t, i) => (
                <div key={i} className={`flex items-start gap-4 ${t.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in slide-in-from-bottom-4 duration-300`}>
                   <div className={`w-10 h-10 rounded-full border-2 border-border flex items-center justify-center shadow-pop shrink-0 ${t.role === 'user' ? 'bg-secondary' : 'bg-primary'}`}>
                      {t.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                   </div>
                   <div className={`max-w-[70%] p-5 rounded-2xl border-2 border-border shadow-soft relative ${t.role === 'user' ? 'bg-white rounded-tr-none' : 'bg-primary/10 rounded-tl-none'}`}>
                      <p className="text-lg font-medium leading-relaxed">{t.text}</p>
                   </div>
                </div>
              ))}

              {processingUserTurn && (
                <div className="flex items-start gap-4 flex-row animate-in fade-in">
                   <div className="w-10 h-10 rounded-full border-2 border-border bg-primary/50 flex items-center justify-center shadow-pop">
                      <Bot className="w-5 h-5 text-white animate-spin" />
                   </div>
                   <div className="p-4 bg-muted rounded-2xl border-2 border-border flex gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                   </div>
                </div>
              )}
              <div key="spacer" className="h-4" />
              <div ref={transcriptEndRef} />
           </div>

           {/* Manual Input Area */}
           <div className="p-8 pb-10 bg-muted/20 border-t-4 border-border">
              <form onSubmit={handleSendMessage} className="relative group max-w-4xl mx-auto flex gap-4">
                 <input 
                   type="text" 
                   className="flex-1 px-8 py-5 rounded-2xl border-4 border-border bg-background shadow-soft outline-none focus:border-primary transition-all font-bold text-lg"
                   placeholder="Try saying 'I feel dizzy' or 'Yes, I took it'..."
                   value={chatInput}
                   onChange={(e) => setChatInput(e.target.value)}
                   disabled={processingUserTurn}
                 />
                 <button 
                  type="submit"
                  disabled={!chatInput.trim() || processingUserTurn}
                  className="px-8 py-5 bg-tertiary text-foreground font-black uppercase rounded-2xl border-4 border-foreground shadow-pop hover:-translate-y-1 hover:shadow-pop-hover active:translate-y-0 disabled:opacity-50 transition-all flex items-center gap-2"
                 >
                    Send <Send className="w-5 h-5" />
                 </button>
              </form>
           </div>
        </div>
      )}

      {phase === "analyzing" && (
        <div className="text-center space-y-8 animate-in zoom-in duration-500">
           <div className="w-48 h-48 bg-primary/10 rounded-full flex items-center justify-center relative mx-auto overflow-hidden border-4 border-border">
              <Activity className="w-20 h-20 text-primary animate-pulse" />
              <div className="absolute inset-0 border-[6px] border-primary/20 border-t-primary rounded-full animate-spin [animation-duration:3s]" />
           </div>
           <div className="space-y-4">
              <h2 className="text-5xl font-heading font-black uppercase italic tracking-tighter">Clinical Analysis</h2>
              <p className="text-muted-foreground font-bold max-w-md mx-auto uppercase text-xs tracking-[0.4em]">
                Extracting medical intent from demo session...
              </p>
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
                  onClick={() => setPhase("idle")} 
                  className="flex-1 py-5 bg-white text-foreground font-heading font-black uppercase rounded-2xl border-4 border-foreground shadow-pop hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                 >
                    Reset Demo
                 </button>
                 <button 
                  onClick={() => setPhase("idle")} 
                  className="px-10 py-5 bg-tertiary text-foreground font-heading font-black uppercase rounded-2xl border-4 border-foreground shadow-pop hover:-translate-y-1 transition-all"
                 >
                    New Patient
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
