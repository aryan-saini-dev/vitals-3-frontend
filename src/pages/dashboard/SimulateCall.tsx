import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { createPatientChatSession, generateDoctorSummary } from "@/lib/gemini";
import { useSpeech } from "@/lib/useSpeech";
import { Bot, Phone, PhoneOff, Mic, Activity, CheckCircle, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SimulateCall() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [callState, setCallState] = useState<"idle" | "ringing" | "active" | "analyzing" | "completed">("idle");
  const [chatSession, setChatSession] = useState<any>(null);
  const [transcriptLog, setTranscriptLog] = useState<{role: "user" | "agent", text: string}[]>([]);
  const [processingUserTurn, setProcessingUserTurn] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [startTime, setStartTime] = useState<number>(0);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const { listen, stopListening, isListening, transcript: liveTranscript, speak, stopSpeaking } = useSpeech();

  // Load Patients
  useEffect(() => {
    async function fetchPatients() {
      if (!user) return;
      const { data } = await supabase.from("patients").select("*").eq("docuuid", user.id);
      if (data) setPatients(data);
    }
    fetchPatients();
  }, [user]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptLog, liveTranscript]);

  const handleStartCall = async () => {
    if (!selectedPatientId) return;
    const patientObj = patients.find(p => p.id === selectedPatientId);
    
    setCallState("ringing");
    setTranscriptLog([]);
    setStartTime(Date.now());
    
    try {
      // Connect specifically trained Gemini instance
      const session = await createPatientChatSession(patientObj);
      setChatSession(session);
      
      setCallState("active");
      
      const prompt = `Start the conversation organically. Introduce yourself as their VITALS care assistant and ask how they are feeling today.`;
      
      const result = await session.sendMessage(prompt);
      const aiResponse = result.response.text();
      
      setTranscriptLog(prev => [...prev, { role: "agent", text: aiResponse }]);
      speak(aiResponse, () => {
         listen(); // Automatically listen when AI finishes speaking
      });
      
    } catch (err: any) {
      console.error(err);
      alert("Failed to initialize Gemini. Did you set VITE_GEMINI_API_KEY?");
      setCallState("idle");
    }
  };

  const handleUserTurnEnd = async () => {
    if (!liveTranscript.trim() || !chatSession) return;
    
    const textToSubmit = liveTranscript;
    stopListening(); // Stop immediately so we lock the text
    setProcessingUserTurn(true);
    
    setTranscriptLog(prev => [...prev, { role: "user", text: textToSubmit }]);
    
    try {
       const result = await chatSession.sendMessage(textToSubmit);
       const aiResponse = result.response.text();
       
       setTranscriptLog(prev => [...prev, { role: "agent", text: aiResponse }]);
       speak(aiResponse, () => {
          listen(); // Resume listening when AI finishes
       });
    } catch (e) {
       console.error("Gemini Response Failed", e);
    } finally {
       setProcessingUserTurn(false);
    }
  };

  const handUpAndAnalyze = async () => {
    stopListening();
    stopSpeaking();
    setCallState("analyzing");
    
    const durationSec = Math.floor((Date.now() - startTime) / 1000);
    const patientObj = patients.find(p => p.id === selectedPatientId);
    
    // Format transcript for Gemini Tool
    const flatTranscript = transcriptLog.map(t => `${t.role === 'agent' ? 'Agent' : 'Patient'}: ${t.text}`).join("\n\n");
    
    try {
      const summary = await generateDoctorSummary(flatTranscript);
      setSummaryData(summary);
      
      // Save Call
      const { error: callError } = await supabase.from("calls").insert({
        docuuid: user!.id,
        patient_id: patientObj.id,
        agent_id: patientObj.assigned_agent_id || null, // Best effort link
        duration_seconds: durationSec,
        transcript: flatTranscript,
        vitals_data: { 
           ...summary.vitals_data, 
           AI_Diagnosis_Risk: summary.alert_type,
           Symptom_Tags: summary.symptoms,
           Patient_Status: summary.risk_level.toUpperCase() 
        }
      });
      console.log("Call Saved", callError);

      // Trigger High Risk Alert if needed
      if (summary.risk_level === "high" || summary.risk_level === "medium") {
         await supabase.from("alerts").insert({
            docuuid: user!.id,
            patient_id: patientObj.id,
            agent_id: patientObj.assigned_agent_id || null,
            alert_type: summary.alert_type,
            severity: summary.risk_level,
            status: "open"
         });
      }
      
      setCallState("completed");
    } catch (e) {
      console.error("Post-call analysis failed", e);
      alert("Post-call analysis failed. Check console constraints.");
      setCallState("idle"); 
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
         <div>
           <h1 className="text-4xl font-heading font-extrabold text-foreground tracking-tight">AI Call Simulation</h1>
           <p className="mt-2 text-muted-foreground font-medium flex items-center gap-2">Gemini 2.5 Active Reasoning + Native Web Speech <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse hidden md:block" /></p>
         </div>
         <div className="w-16 h-16 rounded-full bg-quaternary opacity-80 mix-blend-multiply blur-xl animate-float"></div>
      </div>

      {callState === "idle" && (
        <div className="bg-card border-2 border-border shadow-soft rounded-xl p-8 flex flex-col items-center">
           <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center text-white border-2 border-border shadow-pop mb-6">
             <Bot className="w-10 h-10" />
           </div>
           <h2 className="text-2xl font-heading font-extrabold mb-4">Start Simulated Web-Call</h2>
           <p className="text-muted-foreground text-center max-w-md mb-8">
             Select a patient from your dashboard to initiate a live voice call. The AI will dynamically analyze their chronic medical history before speaking.
           </p>
           
           <div className="w-full max-w-sm flex flex-col gap-4">
             <select 
               className="w-full p-4 rounded-xl border-2 border-border bg-background font-bold text-foreground outline-none focus:border-accent transition-colors"
               value={selectedPatientId}
               onChange={(e) => setSelectedPatientId(e.target.value)}
             >
               <option value="" disabled>-- Select Patient --</option>
               {patients.map(p => (
                 <option key={p.id} value={p.id}>{p.name} ({p.condition})</option>
               ))}
             </select>
             
             <button 
               onClick={handleStartCall}
               disabled={!selectedPatientId}
               className="w-full py-4 bg-tertiary text-foreground font-heading font-bold rounded-full border-2 border-border shadow-pop hover:-translate-y-1 hover:shadow-pop-hover active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none transition-all flex justify-center items-center gap-2"
             >
               <Phone className="w-5 h-5" /> Initiate AI Call
             </button>
           </div>
        </div>
      )}

      {callState === "ringing" && (
         <div className="bg-card border-2 border-border shadow-soft rounded-xl p-16 text-center flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-tertiary animate-pulse flex items-center justify-center border-2 border-border mb-6">
               <Phone className="w-10 h-10 text-white animate-wiggle" />
            </div>
            <h2 className="text-3xl font-heading font-extrabold text-foreground animate-pulse">Dialing...</h2>
            <p className="text-muted-foreground font-medium mt-2">Connecting Gemini reasoning engine...</p>
         </div>
      )}

      {callState === "active" && (
         <div className="grid grid-cols-1 gap-6">
            <div className="bg-card border-2 border-border shadow-soft rounded-xl flex flex-col h-[500px]">
               {/* Header */}
               <div className="p-4 border-b-2 border-border border-dashed flex justify-between items-center bg-muted/20">
                  <div className="flex items-center gap-3">
                     <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                     <span className="font-bold text-foreground tracking-widest uppercase text-sm">Call In Progress</span>
                  </div>
                  <span className="font-extrabold text-muted-foreground">{patients.find(p=>p.id === selectedPatientId)?.name}</span>
               </div>
               
               {/* Transcript Box */}
               <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {transcriptLog.map((t, idx) => (
                    <div key={idx} className={`flex w-full ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] p-4 rounded-xl border-2 border-border shadow-[4px_4px_0_0_rgba(30,41,59,0.1)] relative ${t.role === 'user' ? 'bg-background' : 'bg-primary text-white'}`}>
                           <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70`}>
                             {t.role === 'user' ? 'Patient' : 'VITALS AI'}
                           </p>
                           <p className="text-base font-medium leading-relaxed">{t.text}</p>
                        </div>
                    </div>
                  ))}
                  
                  {/* Live Listening Render */}
                  {(isListening || liveTranscript) && (
                    <div className="flex w-full justify-end">
                       <div className="max-w-[75%] p-4 rounded-xl border-2 border-border bg-background relative flex items-center gap-3 shadow-pop">
                           <Mic className="w-4 h-4 text-secondary animate-pulse shrink-0" />
                           <p className="text-base font-medium leading-relaxed italic text-muted-foreground break-words w-full">
                              {liveTranscript || "Listening..."}
                           </p>
                       </div>
                    </div>
                  )}

                  {/* Thinking Render */}
                  {processingUserTurn && (
                    <div className="flex w-full justify-start">
                       <div className="px-4 py-3 rounded-xl border-2 border-border bg-primary text-white relative flex gap-2 items-center">
                           <div className="w-2 h-2 rounded-full bg-white animate-bounce" />
                           <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{animationDelay: "0.2s"}} />
                           <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{animationDelay: "0.4s"}} />
                       </div>
                    </div>
                  )}
                  <div ref={transcriptEndRef} />
               </div>
               
               {/* Call Controls */}
               <div className="p-4 border-t-2 border-border border-dashed flex justify-center gap-4 bg-muted/20">
                  <button 
                     onClick={isListening ? () => handleUserTurnEnd() : listen} 
                     disabled={processingUserTurn}
                     className={`px-8 py-4 rounded-full border-2 border-border font-heading font-extrabold uppercase tracking-wide transition-all shadow-pop hover:-translate-y-1 hover:shadow-pop-hover active:translate-y-0 ${isListening ? 'bg-secondary text-white' : 'bg-card text-foreground'}`}
                  >
                     {isListening ? "Send Voice Response" : "Hold to Talk"}
                  </button>
                  <button 
                     onClick={handUpAndAnalyze}
                     className="w-14 h-14 rounded-full bg-destructive flex items-center justify-center border-2 border-border shadow-pop hover:-translate-y-1 hover:shadow-pop-hover active:translate-y-0 text-white transition-all shrink-0"
                  >
                     <PhoneOff className="w-6 h-6" />
                  </button>
               </div>
            </div>
         </div>
      )}

      {callState === "analyzing" && (
         <div className="bg-card border-2 border-border shadow-soft rounded-xl p-16 text-center flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center border-2 border-border mb-6">
               <Activity className="w-10 h-10 text-white animate-spin" style={{ animationDuration: '3s' }} />
            </div>
            <h2 className="text-3xl font-heading font-extrabold text-foreground mb-4 tracking-tight">Post-Call Analysis</h2>
            <p className="text-muted-foreground font-medium max-w-lg mx-auto">
               The Gemini reasoning layer is running Pattern Recognition on the transcript. It will evaluate the risk level, summarize medical patterns, and generate automated alerts for the doctor-in-the-loop approval board.
            </p>
         </div>
      )}

      {callState === "completed" && summaryData && (
         <div className="space-y-6">
           <div className="bg-card border-2 border-border shadow-[8px_8px_0_0_rgba(52,211,153,1)] rounded-xl p-8 md:p-12 relative overflow-hidden group">
              <div className="w-16 h-16 rounded-full bg-quaternary flex items-center justify-center text-white border-2 border-border shadow-pop mb-6">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-heading font-extrabold text-foreground mb-4">Risk Assessed & Saved</h2>
              <p className="text-lg text-muted-foreground font-medium mb-8">
                {summaryData.summary}
              </p>
              
              <div className="grid md:grid-cols-2 gap-4 mt-6">
                <div className="p-4 border-2 border-border rounded-lg bg-background">
                  <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Diagnostic Tag</span>
                  <span className="font-extrabold text-lg flex items-center gap-2">
                     {summaryData.risk_level === 'high' && <AlertTriangle className="w-5 h-5 text-secondary" />}
                     {summaryData.alert_type}
                  </span>
                </div>
                <div className="p-4 border-2 border-border rounded-lg bg-background">
                  <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Risk Level</span>
                  <span className={`inline-block px-3 py-1 font-bold text-sm uppercase rounded-full border-2 border-border ${summaryData.risk_level === 'high' ? 'bg-secondary text-white' : 'bg-muted text-foreground'}`}>
                     {summaryData.risk_level}
                  </span>
                </div>
              </div>

              <div className="mt-8 flex gap-4">
                 <button onClick={() => navigate('/dashboard/alerts')} className="px-6 py-3 bg-secondary text-white font-heading font-bold rounded-full border-2 border-border shadow-pop hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#1E293B]">
                   View Alerts Dashboard
                 </button>
                 <button onClick={() => setCallState("idle")} className="px-6 py-3 bg-card text-foreground font-heading font-bold rounded-full border-2 border-border shadow-pop hover:-translate-y-1 hover:bg-muted transition-all">
                   Run Another Call
                 </button>
              </div>
           </div>
         </div>
      )}
    </div>
  );
}
