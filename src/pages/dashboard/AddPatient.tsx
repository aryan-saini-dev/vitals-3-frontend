import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

export default function AddPatient() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    date_of_birth: "",
    condition: "",
    assigned_agent_id: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchAgents() {
      if (!user) return;
      const { data } = await supabase.from("agents").select("id, name").eq("docuuid", user.id);
      if (data) setAgents(data);
    }
    fetchAgents();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    
    const { error } = await supabase.from("patients").insert([{
      ...formData,
      assigned_agent_id: formData.assigned_agent_id || null,
      docuuid: user.id
    }]);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Patient added successfully!");
      navigate("/dashboard/patients");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/dashboard/patients" className="inline-flex items-center text-muted-foreground hover:text-foreground font-bold transition-colors mb-4">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Patients
      </Link>

      <div className="bg-card border-2 border-border shadow-soft rounded-xl p-6 md:p-10 relative overflow-hidden">
         <div className="absolute -top-10 -right-10 w-40 h-40 bg-secondary rounded-full mix-blend-multiply opacity-20 blur-2xl pointer-events-none"></div>
         
         <h1 className="text-3xl font-heading font-extrabold text-foreground mb-8">Add New Patient</h1>

         <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
           <div className="space-y-2">
             <label className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Full Name</label>
             <input required type="text" className="w-full h-12 px-4 bg-input border-2 border-border rounded-lg focus:outline-none focus:border-accent focus:shadow-pop transition-all font-medium text-foreground" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Jane Doe" />
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
               <label className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Date of Birth</label>
               <input type="date" className="w-full h-12 px-4 bg-input border-2 border-border rounded-lg focus:outline-none focus:border-accent focus:shadow-pop transition-all font-medium text-foreground" value={formData.date_of_birth} onChange={e => setFormData({...formData, date_of_birth: e.target.value})} />
             </div>
             
             <div className="space-y-2">
               <label className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Primary Condition</label>
               <input required type="text" className="w-full h-12 px-4 bg-input border-2 border-border rounded-lg focus:outline-none focus:border-accent focus:shadow-pop transition-all font-medium text-foreground" value={formData.condition} onChange={e => setFormData({...formData, condition: e.target.value})} placeholder="e.g. Hypertension, Post-Op Care" />
             </div>
           </div>

           <div className="space-y-2">
             <label className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Assign Care Agent</label>
             <select className="w-full h-12 px-4 bg-input border-2 border-border rounded-lg focus:outline-none focus:border-accent focus:shadow-pop transition-all font-bold text-foreground appearance-none cursor-pointer" value={formData.assigned_agent_id} onChange={e => setFormData({...formData, assigned_agent_id: e.target.value})}>
               <option value="">-- No Agent (Manual Care) --</option>
               {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
             </select>
           </div>

           <div className="pt-8 flex justify-end">
             <button type="submit" disabled={loading} className="w-full md:w-auto inline-flex items-center justify-center gap-2 h-14 px-8 bg-tertiary text-foreground font-heading font-bold rounded-full border-2 border-border shadow-pop hover:-translate-y-1 hover:-translate-x-1 hover:shadow-pop-hover active:translate-y-1 active:translate-x-1 active:shadow-pop-active transition-all text-lg">
                <Save className="w-5 h-5" strokeWidth={2.5} /> {loading ? "Saving..." : "Save Patient"}
             </button>
           </div>
         </form>
      </div>
    </div>
  );
}
