import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Bell, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function Alerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, [user]);

  async function fetchAlerts() {
    if (!user) return;
    try {
      const [alertsRes, patsRes, agentsRes] = await Promise.all([
        supabase.from("alerts").select("*").eq("docuuid", user.id).order("created_at", { ascending: false }),
        supabase.from("patients").select("*").eq("docuuid", user.id),
        supabase.from("agents").select("*").eq("docuuid", user.id)
      ]);
      
      if (alertsRes.error) console.error("Alerts Err:", alertsRes.error);

      if (alertsRes.data) {
        const merged = alertsRes.data.map(alert => {
           const pat = patsRes.data?.find(p => p.id === alert.patient_id);
           const ag = agentsRes.data?.find(a => a.id === alert.agent_id);
           return { ...alert, patient_name: pat?.name || "Unknown", agent_name: ag?.name || "Unknown" };
        });
        setAlerts(merged);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const markResolved = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    const { error } = await supabase.from("alerts").update({ status: 'resolved' }).eq("id", id).eq("docuuid", user.id);
    if (!error) {
       toast.success("Alert marked as resolved.");
       setAlerts(alerts.map(a => a.id === id ? { ...a, status: 'resolved' } : a));
    } else {
       toast.error("Failed to resolve alert");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <div>
           <h1 className="text-4xl font-heading font-extrabold text-foreground tracking-tight">Triage & Alerts</h1>
           <p className="mt-2 text-muted-foreground font-medium">Real-time flags raised by your AI agents during check-ins.</p>
         </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground font-bold animate-pulse">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="bg-card border-2 border-border rounded-xl shadow-soft p-16 text-center flex flex-col items-center">
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center border-2 border-border mb-6 shadow-[4px_4px_0_0_#1E293B]">
            <Bell className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-3xl font-heading font-extrabold text-foreground mb-3">All clear!</h3>
          <p className="text-muted-foreground font-medium max-w-sm text-lg leading-relaxed">There are no health flags requiring your attention right now.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {alerts.map((alert) => {
             const isOpen = alert.status === 'open';
             const isHigh = alert.severity === 'high';
             const isValidHigh = isHigh && isOpen;
             
             // Playful geometric specific active states
             const highlightColor = isValidHigh 
               ? 'bg-secondary text-white border-2 border-border shadow-[4px_4px_0_0_#1E293B] -translate-y-1' 
               : isOpen 
                 ? 'bg-card text-foreground border-2 border-border shadow-soft'
                 : 'bg-muted/30 text-muted-foreground border-2 border-dashed border-border opacity-70';
                 
             const pillColor = isValidHigh ? 'bg-white text-secondary' : 'bg-background text-foreground border-2 border-border';

             return (
              <div key={alert.id} className={`p-6 rounded-xl transition-all duration-300 relative overflow-hidden group ${highlightColor}`}>
                
                {isValidHigh && <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-xl pointer-events-none translate-x-1/2 -translate-y-1/2"></div>}
                
                <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center relative z-10">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                       <span className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-full shadow-[2px_2px_0_0_rgba(30,41,59,0.3)] ${pillColor}`}>
                         {alert.severity} Priority
                       </span>
                       <span className={`text-sm font-bold uppercase tracking-widest ${isValidHigh ? 'text-white/80' : 'text-muted-foreground'}`}>{new Date(alert.created_at).toLocaleString()}</span>
                    </div>
                    
                    <h3 className={`text-2xl font-heading font-extrabold mb-2 tracking-tight ${isValidHigh ? 'text-white' : 'text-foreground'}`}>{alert.alert_type}</h3>
                    
                    <p className={`font-medium text-base ${isValidHigh ? 'text-white/90' : 'text-muted-foreground'}`}>
                      Patient: <Link to={`/dashboard/patients/${alert.patient_id}`} className={`font-bold underline decoration-2 underline-offset-4 ${isValidHigh ? 'hover:text-white' : 'hover:text-accent'}`}>
                        {alert.patient_name}
                      </Link> 
                      &nbsp;&bull;&nbsp; Agent: {alert.agent_name}
                    </p>
                  </div>
                  
                  <div className="shrink-0 flex items-center justify-end w-full md:w-auto">
                     {isOpen ? (
                        <button 
                          onClick={(e) => markResolved(alert.id, e)}
                          className={`inline-flex items-center justify-center gap-3 h-14 px-8 font-heading font-extrabold text-lg uppercase tracking-wide rounded-full border-2 transition-all shadow-[4px_4px_0_0_#1E293B] hover:-translate-y-1 active:translate-y-0 active:shadow-[2px_2px_0_0_#1E293B] ${isValidHigh ? 'bg-white text-secondary border-transparent hover:bg-muted' : 'bg-background text-foreground border-border hover:bg-muted font-bold'}`}
                        >
                          <CheckCircle2 className="w-6 h-6" strokeWidth={2.5}/> Resolve
                        </button>
                     ) : (
                        <span className="inline-flex items-center gap-2 px-6 py-3 bg-background border-2 border-border rounded-full text-sm font-bold uppercase text-muted-foreground tracking-widest">
                          <CheckCircle2 className="w-5 h-5" /> Resolved
                        </span>
                     )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
}
