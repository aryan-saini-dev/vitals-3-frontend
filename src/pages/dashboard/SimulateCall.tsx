import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Activity, AlertTriangle, Clipboard, Phone, Shield, User } from "lucide-react";
import type { PatientInfo } from "@/components/VoiceAssistant";
import { useNavigate } from "react-router-dom";

type CallPhase = "idle" | "dialing" | "completed";

export default function SimulateCall() {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [callerNumber, setCallerNumber] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [summaryData, setSummaryData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [vapiCallId, setVapiCallId] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [callStatus, setCallStatus] = useState<string>("idle");
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showPostCallPopup, setShowPostCallPopup] = useState(false);
  const [recentCallId, setRecentCallId] = useState<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const statusPollRef = useRef<number | null>(null);
  const lastEndedReasonRef = useRef<string | null>(null);
  const syncAttemptedRef = useRef<string | null>(null);

  async function syncCallToDatabase(vapiId: string | null) {
    if (!session || !vapiId) return;
    if (syncAttemptedRef.current === vapiId) return;
    syncAttemptedRef.current = vapiId;
    try {
      const resp = await fetch("http://localhost:4000/api/vapi/sync-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ vapiCallId: vapiId }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        pushDebug(`Sync to DB failed: ${data?.error || resp.status}`);
        return;
      }
      if (data.duplicated) pushDebug("Sync: call already in database (webhook or prior sync).");
      else pushDebug(`Sync: stored call in database id ${data.callId || "ok"}`);
    } catch (e) {
      pushDebug(`Sync error: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  function pushDebug(line: string) {
    const stamp = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [...prev.slice(-39), `[${stamp}] ${line}`]);
  }

  useEffect(() => {
    async function fetchPatients() {
      if (!user) return;
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("docuuid", user.id)
        .order("created_at", { ascending: false });
      if (error) return;
      if (data) {
        setPatients(
          data.map((p: any) => ({
            id: p.id,
            name: p.name,
            condition: p.condition,
            age: p.age,
            risk_level: p.risk_level,
            assigned_agent_id: p.assigned_agent_id,
            date_of_birth: p.date_of_birth,
          })),
        );
      }
    }
    fetchPatients();
  }, [user]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || null;
  const destinationNumberE164 = useMemo(() => {
    const digits = String(callerNumber || "").replace(/\D/g, "");
    return digits ? `${countryCode}${digits}` : "";
  }, [callerNumber, countryCode]);

  async function buildSummaryFromDb(sinceMs?: number) {
    if (!user || !selectedPatient) return null;
    const { data: callsData } = await supabase
      .from("calls")
      .select("*")
      .eq("docuuid", user.id)
      .eq("patient_id", selectedPatient.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!callsData?.[0]) return null;
    const call = callsData[0];
    if (sinceMs) {
      const callTs = call.created_at ? new Date(call.created_at).getTime() : 0;
      if (!callTs || callTs < sinceMs) return null;
    }

    const { data: alertsData } = await supabase
      .from("alerts")
      .select("*")
      .eq("docuuid", user.id)
      .eq("patient_id", selectedPatient.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!alertsData?.[0]) return null;
    const alert = alertsData[0];
    if (sinceMs) {
      const alertTs = alert.created_at ? new Date(alert.created_at).getTime() : 0;
      if (!alertTs || alertTs < sinceMs) return null;
    }

    const vitals = (call.vitals_data || {}) as Record<string, any>;
    const vitalsOnly = Object.fromEntries(
      Object.entries(vitals).filter(
        ([k]) =>
          ![
            "Symptoms",
            "Summary",
            "Diagnosis",
            "ActionRequired",
            "RelevantHistory",
            "ClinicalReasoning",
            "DifferentialDiagnosis",
            "FollowUpPlan",
            "ReportData",
            "PatientName",
            "PatientCondition",
            "PatientAge",
            "VapiCallId",
            "ReportPdfPath",
            "PdfStoredInStorage",
            "PdfStorageError",
            "PdfGenerationError",
            "PdfGeneratedAt",
            "DoctorDecision",
            "DoctorDecisionAt",
          ].includes(k),
      ),
    );
    return {
      summary: vitals.Summary || "",
      risk_level: alert.severity || "medium",
      alert_type: alert.alert_type || "",
      symptoms: vitals.Symptoms || [],
      vitals_data: vitalsOnly,
      action_required: vitals.ActionRequired || "",
    };
  }

  async function handleStartOutboundCall() {
    if (!user || !session || !selectedPatient || !destinationNumberE164) return;
    setIsSaving(true);
    setSummaryData(null);
    setErrorMessage("");
    setPhase("dialing");
    setVapiCallId(null);
    setLiveTranscript("");
    setCallStatus("dialing");
    setDebugLogs([]);
    lastEndedReasonRef.current = null;
    syncAttemptedRef.current = null;
    pushDebug("Starting outbound call request");

    let createdCallId: string | null = null;
    try {
      const resp = await fetch("http://localhost:4000/api/vapi/outbound-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          destinationNumber: destinationNumberE164,
          callerNumber: destinationNumberE164,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Outbound call start failed");
      createdCallId = data.vapiCallId || null;
      setVapiCallId(createdCallId);
      setRecentCallId(createdCallId);
      console.log("[UI] vapiCallId:", data.vapiCallId);
      pushDebug(`Outbound call created: ${data.vapiCallId || "unknown id"}`);
    } catch (e) {
      console.error("[UI] outbound start error:", e);
      setErrorMessage(e instanceof Error ? e.message : "Could not start outbound call.");
      pushDebug(`Outbound start error: ${e instanceof Error ? e.message : "unknown"}`);
      setIsSaving(false);
      setPhase("idle");
      return;
    }

    if (statusPollRef.current) window.clearInterval(statusPollRef.current);
    statusPollRef.current = window.setInterval(async () => {
      if (!createdCallId) return;
      try {
        const resp = await fetch(`http://localhost:4000/api/vapi/call/${createdCallId}`);
        const data = await resp.json();
        if (!resp.ok) {
          pushDebug(`Status poll error: ${data?.error || "unknown error"}`);
          return;
        }
        setCallStatus(String(data?.status || "unknown"));
        if (typeof data?.transcript === "string") {
          setLiveTranscript(data.transcript);
        }
        const endedReason = data?.endedReason ? String(data.endedReason) : null;
        if (endedReason && endedReason !== lastEndedReasonRef.current) {
          lastEndedReasonRef.current = endedReason;
          pushDebug(`Call ended reason: ${endedReason}`);
        }
        if (data?.status === "ended") {
          void syncCallToDatabase(createdCallId);
          setIsSaving(false);
          if (!summaryData) {
            setErrorMessage(endedReason ? `Call ended: ${endedReason}` : "Call ended.");
          }
          if (statusPollRef.current) {
            window.clearInterval(statusPollRef.current);
            statusPollRef.current = null;
          }
          if (pollTimerRef.current && !summaryData) {
            window.clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        }
      } catch (err) {
        pushDebug(`Status poll failed: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }, 2000);

    const startedAt = Date.now();
    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    pollTimerRef.current = window.setInterval(async () => {
      const summaryFromDb = await buildSummaryFromDb(startedAt);
      if (!summaryFromDb) return;
      setSummaryData(summaryFromDb);
      setIsSaving(false);
      setPhase("completed");
      pushDebug("Summary detected in DB, call flow completed");
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (statusPollRef.current) {
        window.clearInterval(statusPollRef.current);
        statusPollRef.current = null;
      }
    }, 3000);
  }

  async function handleHangUpOutbound() {
    if (!session || !vapiCallId) return;
    pushDebug(`Hangup requested for call ${vapiCallId}`);
    try {
      const resp = await fetch(`http://localhost:4000/api/vapi/outbound-call/${vapiCallId}/hangup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = data?.error || "Hangup failed";
        setErrorMessage(msg);
        pushDebug(`Hangup failed: ${msg}`);
        return;
      }
      pushDebug("Hangup succeeded");
      void syncCallToDatabase(vapiCallId);
      if (statusPollRef.current) {
        window.clearInterval(statusPollRef.current);
        statusPollRef.current = null;
      }
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      setCallStatus("ended");
      setIsSaving(false);
      setPhase("idle");
      setShowPostCallPopup(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Hangup failed";
      setErrorMessage(msg);
      pushDebug(`Hangup exception: ${msg}`);
    }
  }

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
      if (statusPollRef.current) window.clearInterval(statusPollRef.current);
    };
  }, []);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 md:p-8 relative">
      <div className="fixed inset-0 overflow-hidden -z-10 opacity-30 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
      </div>

      {phase === "idle" && (
        <div className="max-w-3xl w-full bg-card/80 backdrop-blur-xl border-2 border-border p-8 md:p-10 rounded-[32px] shadow-soft space-y-8 animate-in fade-in zoom-in duration-300">
          <div className="space-y-3 text-center">
            <h1 className="text-4xl font-heading font-extrabold tracking-tight">AI Patient Chat</h1>
            <p className="text-muted-foreground font-medium text-lg">
              Select patient and phone number to place outbound PSTN call.
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
                  <option value="+1">+1 (US)</option>
                  <option value="+91">+91 (India)</option>
                </select>
                <input
                  type="tel"
                  className="flex-1 px-4 py-4 rounded-2xl border-2 border-border bg-background focus:border-primary outline-none font-bold transition-all"
                  placeholder="Phone number"
                  value={callerNumber}
                  onChange={(e) => setCallerNumber(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={handleStartOutboundCall}
              disabled={!selectedPatient || !destinationNumberE164 || !session || isSaving}
              className="w-full py-5 bg-tertiary text-foreground font-heading font-bold rounded-full border-4 border-foreground shadow-pop disabled:opacity-50"
            >
              Start Phone Call
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedPatientId("");
                setCallerNumber("");
                setSummaryData(null);
              }}
              disabled={isSaving}
              className="w-full py-5 bg-white text-foreground font-heading font-black rounded-full border-4 border-foreground shadow-pop disabled:opacity-50"
            >
              Clear
            </button>
          </div>

          {isSaving && (
            <p className="mt-3 text-xs text-muted-foreground text-center font-semibold">
              Dialing patient via Vapi… waiting for transcript
            </p>
          )}
          {!isSaving && errorMessage && (
            <p className="mt-3 text-xs text-destructive text-center font-semibold">
              {errorMessage}
            </p>
          )}
          {!isSaving && countryCode !== "+1" && (
            <p className="mt-1 text-xs text-muted-foreground text-center font-semibold">
              Free Vapi numbers usually dial US numbers only. Use +1 or upgrade your Vapi number plan.
            </p>
          )}
        </div>
      )}

      {showPostCallPopup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border-2 border-border rounded-2xl p-6 shadow-soft space-y-4">
            <h3 className="text-2xl font-heading font-extrabold">Call Ended</h3>
            <p className="text-sm text-muted-foreground font-medium">
              Open Alerts to review call details, approve/deny doctor decision, and download prescription-style PDF report.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPostCallPopup(false);
                  navigate("/dashboard/alerts", {
                    state: {
                      focusPatientId: selectedPatientId,
                      focusCallId: recentCallId,
                    },
                  });
                }}
                className="px-4 py-3 rounded-xl border-2 border-foreground bg-quaternary text-white font-bold"
              >
                View Details
              </button>
              <button
                type="button"
                onClick={() => setShowPostCallPopup(false)}
                className="px-4 py-3 rounded-xl border-2 border-foreground bg-white font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "dialing" && (
        <div className="flex flex-col items-center space-y-8 animate-in fade-in zoom-in duration-500 max-w-3xl w-full">
          <div className="w-16 h-16 bg-tertiary mx-auto rounded-full flex items-center justify-center border-4 border-white shadow-pop">
            <Phone className="w-8 h-8 text-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-heading font-black uppercase italic tracking-tighter">Dialing…</h2>
            <p className="text-xs text-muted-foreground font-semibold">
              Status: {callStatus}
            </p>
          </div>
          <button
            type="button"
            onClick={handleHangUpOutbound}
            disabled={!vapiCallId}
            className="px-6 py-3 bg-destructive text-white rounded-xl border-2 border-foreground shadow-pop disabled:opacity-50"
          >
            Hang Up
          </button>
          <div className="w-full max-w-3xl bg-card border border-border rounded-xl p-4 text-left space-y-2">
            <p className="text-xs font-black uppercase text-muted-foreground">Live Transcript</p>
            <p className="text-sm whitespace-pre-wrap min-h-[56px]">
              {liveTranscript || "Waiting for transcript..."}
            </p>
          </div>
          <div className="w-full max-w-3xl bg-card border border-border rounded-xl p-4 text-left space-y-2 max-h-48 overflow-auto">
            <p className="text-xs font-black uppercase text-muted-foreground">Debug Logs</p>
            {debugLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No logs yet.</p>
            ) : (
              debugLogs.map((line, idx) => (
                <p key={`${line}-${idx}`} className="text-xs font-mono">
                  {line}
                </p>
              ))
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
                   setVapiCallId(null);
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
