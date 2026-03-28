import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { ArrowLeft, Phone, Activity, Heart, Wind, Stethoscope } from "lucide-react";

export default function CallDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [call, setCall] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCall() {
      if (!user || !id) return;
      const { data: callData } = await supabase
        .from("calls")
        .select("*")
        .eq("id", id)
        .eq("docuuid", user.id)
        .single();

      if (callData) {
         const [patRes, agRes] = await Promise.all([
            callData.patient_id ? supabase.from("patients").select("name").eq("id", callData.patient_id).single() : Promise.resolve({ data: null }),
            callData.agent_id ? supabase.from("agents").select("name").eq("id", callData.agent_id).single() : Promise.resolve({ data: null })
         ]);
         
         setCall({
            ...callData,
            patient_name: patRes.data?.name || 'Unknown',
            agent_name: agRes.data?.name || 'Unknown'
         });
      }
      setLoading(false);
    }
    fetchCall();
  }, [user, id]);

  if (loading) return <div className="p-8 text-center text-muted-foreground font-bold animate-pulse">Loading call log...</div>;
  if (!call) return <div className="p-8 text-center text-muted-foreground font-bold">Call record not found.</div>;

  const vitals = call.vitals_data || {};

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link to="/dashboard/calls" className="inline-flex items-center text-muted-foreground hover:text-foreground font-bold transition-colors mb-2">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Calls
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left Col: Vitals & Metadata */}
         <div className="space-y-6">
            <div className="bg-card border-2 border-border shadow-soft rounded-xl p-6 md:p-8 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-quaternary opacity-10 rounded-full blur-2xl group-hover:scale-110 transition-transform"></div>
               
               <div className="w-16 h-16 bg-quaternary rounded-full flex items-center justify-center text-white border-2 border-border shadow-pop mb-6">
                 <Phone className="w-8 h-8 animate-wiggle" />
               </div>

               <h1 className="text-3xl font-heading font-extrabold text-foreground mb-4 leading-tight">Interaction Review</h1>
               
               <div className="space-y-4 font-medium text-foreground relative z-10">
                 <div className="flex justify-between items-center py-2 border-b-2 border-dashed border-border text-lg">
                    <span className="text-muted-foreground font-bold">Patient</span>
                    <span className="font-extrabold">{call.patient_name}</span>
                 </div>
                 <div className="flex justify-between items-center py-2 border-b-2 border-dashed border-border text-lg">
                    <span className="text-muted-foreground font-bold">Agent</span>
                    <span className="font-extrabold">{call.agent_name}</span>
                 </div>
                 <div className="flex justify-between items-center py-2 border-b-2 border-dashed border-border text-lg">
                    <span className="text-muted-foreground font-bold">Duration</span>
                    <span className="font-extrabold bg-muted px-3 py-1 rounded inline-block">{Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s</span>
                 </div>
               </div>
            </div>

            {/* Extracted Vitals */}
            <div className="bg-card border-2 border-border shadow-soft rounded-xl p-6 md:p-8">
               <h3 className="text-2xl font-heading font-extrabold flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center border-2 border-border shadow-[2px_2px_0_0_#1E293B]">
                   <Activity className="w-5 h-5" />
                 </div>
                 Extracted Vitals
               </h3>
               
               {Object.keys(vitals).length === 0 ? (
                 <p className="text-muted-foreground font-bold text-center py-8 border-2 border-dashed border-border rounded-lg bg-muted/20">No vitals extracted from conversation.</p>
               ) : (
                 <div className="grid grid-cols-2 gap-4">
                    {Object.entries(vitals).map(([key, value]) => {
                       // Dynamic geometric mapping
                       let Icon = Stethoscope;
                       let color = "bg-accent";
                       if (key.toLowerCase().includes('bpm') || key.toLowerCase().includes('heart')) { Icon = Heart; color = "bg-secondary"; }
                       if (key.toLowerCase().includes('bp') || key.toLowerCase().includes('pressure')) { color = "bg-tertiary"; }
                       if (key.toLowerCase().includes('o2') || key.toLowerCase().includes('oxygen')) { Icon = Wind; color = "bg-quaternary"; }

                       return (
                         <div key={key} className={`p-4 rounded-xl border-2 border-border shadow-[4px_4px_0_0_#1E293B] ${color} text-white hover:-translate-y-1 transition-transform`}>
                           <Icon className="w-6 h-6 mb-2" />
                           <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">{key}</p>
                           <p className="text-2xl font-heading font-extrabold tracking-tight">{String(value)}</p>
                         </div>
                       )
                    })}
                 </div>
               )}
            </div>
         </div>

         {/* Right Col: Transcript */}
         <div className="lg:col-span-2 bg-card border-2 border-border shadow-soft rounded-xl p-6 md:p-8 flex flex-col h-[700px]">
            <h3 className="text-2xl font-heading font-extrabold pb-4 border-b-2 border-border border-dashed tracking-tight mb-6 shrink-0">
               Call Transcript
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-6 pr-4 custom-scrollbar">
               {call.transcript ? (
                 call.transcript.split('\n\n').map((block: string, idx: number) => {
                   // Extremely simple bubble parsed based on Agent/Patient lines. 
                   const isAgent = block.toLowerCase().startsWith('agent:');
                   const isPatient = block.toLowerCase().startsWith('patient:');
                   
                   const cleanText = block.replace(/^(Agent:|Patient:)\s*/i, '');
                   
                   if (!isAgent && !isPatient) {
                     return <p key={idx} className="text-muted-foreground text-center font-bold text-sm my-4 uppercase tracking-widest">{block}</p>
                   }

                   return (
                     <div key={idx} className={`flex w-full ${isPatient ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-5 rounded-2xl border-2 border-border bg-background shadow-[4px_4px_0_0_rgba(30,41,59,0.1)] relative`}>
                           {/* Geometric tail */}
                           <div className={`absolute top-4 w-4 h-4 border-2 border-border bg-background rotate-45 ${isPatient ? '-right-2 border-l-0 border-b-0' : '-left-2 border-r-0 border-t-0'}`}></div>
                           
                           <p className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2 ${isPatient ? 'text-secondary justify-end' : 'text-accent'}`}>
                             {isPatient ? 'Patient' : 'AI Agent'}
                           </p>
                           <p className="text-foreground text-lg leading-relaxed font-medium">{cleanText}</p>
                        </div>
                     </div>
                   )
                 })
               ) : (
                 <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
                   <div className="w-24 h-24 border-4 border-dashed border-border rounded-full flex items-center justify-center mb-4">
                     <Stethoscope className="w-10 h-10 text-muted-foreground" />
                   </div>
                   <p className="font-heading font-bold text-2xl text-foreground mb-2">Transcript Unavailable</p>
                   <p className="text-muted-foreground font-medium">No conversation text was logged for this session.</p>
                 </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
