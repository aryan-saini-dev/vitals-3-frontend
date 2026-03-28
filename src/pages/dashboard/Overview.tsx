import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Users, Bot, Bell, Phone } from "lucide-react";
import { Link } from "react-router-dom";

export default function Overview() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ patients: 0, agents: 0, alerts: 0, calls: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;
      
      const docuuid = user.id;

      try {
        const [patientsQuery, agentsQuery, alertsQuery, callsQuery] = await Promise.all([
          supabase.from("patients").select("*", { count: "exact", head: true }).eq("docuuid", docuuid),
          supabase.from("agents").select("*", { count: "exact", head: true }).eq("docuuid", docuuid),
          supabase.from("alerts").select("*", { count: "exact", head: true }).eq("docuuid", docuuid).eq("status", "open"),
          supabase.from("calls").select("*", { count: "exact", head: true }).eq("docuuid", docuuid)
        ]);

        setStats({
          patients: patientsQuery.count || 0,
          agents: agentsQuery.count || 0,
          alerts: alertsQuery.count || 0,
          calls: callsQuery.count || 0,
        });
      } catch (err) {
        console.error("Failed to fetch dashboard stats", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [user]);

  const handleSeedData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Insert Agent
      const { data: agentData, error: agentErr } = await supabase.from('agents').insert({
        docuuid: user.id,
        name: "VITALS Chronic Care AI AGENT",
        specialty: "Chronic Illness Monitoring",
        description: "Initiates casual 5-minute check-in calls to identify subtle symptoms ignored by patients. Cross-references conversation data with patient history to flag early disease progression."
      }).select().single();
      if (agentErr) throw agentErr;

      const agentId = agentData.id;

      // 2. Insert Patients (Focused on Anita's Use Case + 7 others)
      const { data: patientsData, error: patErr } = await supabase.from('patients').insert([
        { docuuid: user.id, assigned_agent_id: agentId, name: "Anita", condition: "Type 2 Diabetes", date_of_birth: "1982-05-14" },
        { docuuid: user.id, assigned_agent_id: agentId, name: "Jude Smith", condition: "Post-Op CABG", date_of_birth: "1958-11-04" },
        { docuuid: user.id, assigned_agent_id: agentId, name: "Penny Lane", condition: "Heart Failure", date_of_birth: "1960-02-14" },
        { docuuid: user.id, assigned_agent_id: agentId, name: "Marcus Thorne", condition: "COPD", date_of_birth: "1951-09-02" },
        { docuuid: user.id, assigned_agent_id: agentId, name: "Sarah Connor", condition: "Hypertension", date_of_birth: "1975-03-22" },
        { docuuid: user.id, assigned_agent_id: agentId, name: "David Bowman", condition: "Atrial Fibrillation", date_of_birth: "1968-12-10" },
        { docuuid: user.id, assigned_agent_id: agentId, name: "Ellen Ripley", condition: "Post-Op Appendectomy", date_of_birth: "1980-07-25" },
        { docuuid: user.id, assigned_agent_id: agentId, name: "James Kirk", condition: "Asthma", date_of_birth: "1990-01-01" },
      ]).select();
      if (patErr) throw patErr;

      const p1 = patientsData[0].id;
      const p2 = patientsData[1].id;

      // 3. Insert Alerts
      await supabase.from('alerts').insert([
        { docuuid: user.id, patient_id: p1, agent_id: agentId, alert_type: "HIGH RISK: Stage 3 Kidney Disease Progression", severity: "high", status: "open" },
        { docuuid: user.id, patient_id: p2, agent_id: agentId, alert_type: "Missed Medication check-in", severity: "medium", status: "open" }
      ]);

      // 4. Insert Calls
      await supabase.from('calls').insert([
        { 
          docuuid: user.id, 
          patient_id: p1, 
          agent_id: agentId, 
          duration_seconds: 300, 
          transcript: "Agent: Hi Anita, this is your VITALS care assistant checking in. How have you been feeling lately? Any changes in your routine or how you feel?\n\nPatient: Oh, I'm perfectly fine! Nothing big to report.\n\nAgent: That's great to hear. Have you noticed any small changes, maybe related to your appetite, energy, or perhaps tasting anything 'different' recently?\n\nPatient: Actually, now that you mention it, my tea tasted quite metallic yesterday. I just assumed the milk had gone bad, honestly. Didn't think it was worth a $30 doctor visit for such a small nuisance.\n\nAgent: I understand. However, a metallic taste, especially alongside your Type 2 Diabetes history, is a medical pattern we should definitely note. Have you experienced any fatigue or changes in urination?\n\nPatient: A little more tired than usual, but I thought I was just working too hard.\n\nAgent: Thank you for sharing, Anita. Based on your history and these specific symptoms, I'm going to tag this and format a symptom report for your doctor. We will help set up an appointment just to be safe.", 
          vitals_data: { 
            "Blood_Sugar": "Unknown - Pending Visit", 
            "Symptom_Tags": ["Metallic Taste", "Fatigue"], 
            "AI_Diagnosis_Risk": "Stage 3 Kidney Disease Progression",
            "Patient_Status": "HIGH RISK" 
          } 
        },
        { 
          docuuid: user.id, 
          patient_id: p2, 
          agent_id: agentId, 
          duration_seconds: 90, 
          transcript: "Agent: Hi Jude. Have you safely taken your morning dose of carvedilol?\n\nPatient: No, I actually forgot to pick it up from the pharmacy.\n\nAgent: This is important for your recovery. I've flagged this for your clinical team to follow up with sorting your prescription.", 
          vitals_data: {} 
        }
      ]);

      // Refresh Stats natively
      window.location.reload();
    } catch (err: any) {
      console.error("SEED RAW ERROR", err);
      const msg = err?.message || err?.details || JSON.stringify(err);
      alert(`Supabase Error Saving Data:\n\n${msg}\n\nPlease copy this and send it back to me. It usually means a table is missing, columns misnamed, or RLS policies are preventing your docuuid.`);
      setLoading(false);
    }
  };

  const statCards = [
    { name: "Patients", value: stats.patients, icon: Users, color: "bg-tertiary", shadowHover: "hover:shadow-[8px_8px_0_0_rgb(251,191,36)]", link: "/dashboard/patients" },
    { name: "Active Alerts", value: stats.alerts, icon: Bell, color: "bg-secondary", shadowHover: "hover:shadow-[8px_8px_0_0_rgb(244,114,182)]", link: "/dashboard/alerts" },
    { name: "Care Agents", value: stats.agents, icon: Bot, color: "bg-accent", shadowHover: "hover:shadow-[8px_8px_0_0_rgb(139,92,246)]", link: "/dashboard/agents" },
    { name: "Total Calls", value: stats.calls, icon: Phone, color: "bg-quaternary", shadowHover: "hover:shadow-[8px_8px_0_0_rgb(52,211,153)]", link: "/dashboard/calls" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
         <div>
           <h1 className="text-4xl font-heading font-extrabold text-foreground tracking-tight">Dashboard Overview</h1>
           <p className="mt-2 text-muted-foreground font-medium">Welcome back. Here is the pulse of your patients today.</p>
         </div>
         <div className="flex items-center gap-4 z-10">
           <button onClick={handleSeedData} disabled={loading} className="px-6 py-3 bg-tertiary text-foreground font-heading font-bold uppercase tracking-widest text-sm rounded-full border-2 border-border shadow-pop hover:-translate-y-1 hover:shadow-pop-hover active:translate-y-0 transition-all">
             {loading ? "Generating..." : "Generate Demo Data"}
           </button>
           <div className="w-16 h-16 rounded-full bg-tertiary opacity-80 mix-blend-multiply blur-xl animate-float absolute -right-4 -top-4 pointer-events-none"></div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <Link key={stat.name} to={stat.link} className="block group">
            <div className={`relative bg-card border-2 border-border rounded-xl p-6 transition-all duration-300 shadow-soft group-hover:-translate-y-1 group-hover:rotate-[1deg] ${stat.shadowHover}`}>
              <div className={`absolute -top-4 -right-4 w-12 h-12 ${stat.color} rounded-full border-2 border-border shadow-pop flex items-center justify-center text-white z-10 animate-wiggle`} style={{ animationDelay: `${i * 0.2}s` }}>
                <stat.icon className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-1">{stat.name}</p>
              {loading ? (
                 <div className="h-10 w-16 bg-muted rounded animate-pulse"></div>
              ) : (
                 <p className="text-5xl font-heading font-extrabold text-foreground">{stat.value}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
      
      {/* Simple decorative divider */}
       <div className="w-full h-8 flex overflow-hidden">
          {Array.from({length: 20}).map((_, i) => (
             <div key={i} className="w-4 h-4 rounded-full bg-border mx-2 mt-4 opacity-50"></div>
          ))}
       </div>

      {stats.patients === 0 && stats.agents === 0 && !loading && (
        <div className="mt-12 bg-card border-4 border-border border-dashed rounded-xl p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center border-2 border-border mb-4 animate-wiggle">
              <Bot className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-heading font-extrabold text-foreground mb-2">Looks Empty!</h3>
            <p className="text-muted-foreground font-medium max-w-md mb-6">You don't have any patients or agents set up yet. Click the button above to generate some realistic mock data.</p>
        </div>
      )}
    </div>
  );
}
