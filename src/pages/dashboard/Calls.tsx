import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Phone, PhoneCall, Search } from "lucide-react";
import { Link } from "react-router-dom";

export default function Calls() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchCalls() {
      if (!user) return;
      try {
        const [callsRes, patsRes, agentsRes] = await Promise.all([
          supabase.from("calls").select("*").eq("docuuid", user.id).order("created_at", { ascending: false }),
          supabase.from("patients").select("*").eq("docuuid", user.id),
          supabase.from("agents").select("*").eq("docuuid", user.id)
        ]);

        if (callsRes.error) console.error("Calls error", callsRes.error);

        if (callsRes.data) {
          const merged = callsRes.data.map(call => {
            const p = patsRes.data?.find(p => p.id === call.patient_id);
            const a = agentsRes.data?.find(a => a.id === call.agent_id);
            return { ...call, patient_name: p?.name || "Unknown", agent_name: a?.name || "Unknown" };
          });
          setCalls(merged);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchCalls();
  }, [user]);

  const filteredCalls = calls.filter(c => 
    c.patient_name.toLowerCase().includes(search.toLowerCase()) || 
    c.agent_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <div>
           <h1 className="text-4xl font-heading font-extrabold text-foreground tracking-tight">Call Logs</h1>
           <p className="mt-2 text-muted-foreground font-medium">Review the history of AI-led conversational check-ins.</p>
         </div>
      </div>

      <div className="bg-card border-2 border-border rounded-xl shadow-soft overflow-hidden">
        <div className="p-4 border-b-2 border-border border-dashed bg-muted/30">
           <div className="relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
             <input 
               type="text" 
               placeholder="Search by patient or agent name..." 
               value={search}
               onChange={e => setSearch(e.target.value)}
               className="w-full h-14 pl-12 pr-4 bg-input border-2 border-border rounded-lg text-foreground font-bold text-lg focus:outline-none focus:border-quaternary focus:shadow-[4px_4px_0_0_#1E293B] transition-all"
             />
           </div>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-muted-foreground font-bold animate-pulse">Loading calls...</div>
        ) : filteredCalls.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center border-2 border-border mb-4">
              <PhoneCall className="w-10 h-10 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-xl font-heading font-bold text-foreground mb-2">No call records found</h3>
            <p className="text-muted-foreground">Agents have not yet completed any phone check-ins.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-border bg-muted/10">
                  <th className="p-5 font-heading font-extrabold uppercase tracking-wide text-sm text-foreground">Date / Time</th>
                  <th className="p-5 font-heading font-extrabold uppercase tracking-wide text-sm text-foreground hidden sm:table-cell">Patient</th>
                  <th className="p-5 font-heading font-extrabold uppercase tracking-wide text-sm text-foreground hidden md:table-cell">Agent</th>
                  <th className="p-5 font-heading font-extrabold uppercase tracking-wide text-sm text-foreground text-center">Duration</th>
                  <th className="p-5 font-heading font-extrabold uppercase tracking-wide text-sm text-foreground text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-border divide-dashed">
                {filteredCalls.map(call => (
                  <tr key={call.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="p-5">
                      <div className="font-extrabold text-foreground text-lg mb-1">{new Date(call.created_at).toLocaleDateString()}</div>
                      <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{new Date(call.created_at).toLocaleTimeString()}</div>
                      <div className="text-sm text-muted-foreground md:hidden mt-2 font-medium border-l-2 pl-2 border-quaternary">{call.patient_name}</div>
                    </td>
                    <td className="p-5 hidden sm:table-cell">
                       <span className="font-extrabold text-foreground text-lg">{call.patient_name}</span>
                    </td>
                    <td className="p-5 hidden md:table-cell">
                       <span className="inline-flex items-center gap-2 px-3 py-1 bg-quaternary/20 text-foreground border-2 border-border rounded-full text-sm font-bold shadow-[2px_2px_0_0_#1E293B]">
                         <BotIcon /> {call.agent_name}
                       </span>
                    </td>
                    <td className="p-5 text-center">
                      <span className="inline-block px-3 py-1 font-heading font-extrabold text-sm border-2 border-border rounded bg-background text-muted-foreground">
                        {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
                      </span>
                    </td>
                    <td className="p-5 text-right">
                      <Link to={`/dashboard/calls/${call.id}`} className="inline-block px-6 py-3 bg-quaternary text-white font-heading font-bold rounded-full border-2 border-border hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#1E293B] active:translate-y-0 active:shadow-[2px_2px_0_0_#1E293B] transition-all whitespace-nowrap">
                        View Log -{'>'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const BotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
);
