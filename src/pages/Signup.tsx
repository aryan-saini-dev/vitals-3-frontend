import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account created successfully!");
      // Supabase auto-logs the user in if email verification is off.
      // The onAuthStateChange hook will catch this and naturally route them.
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-background overflow-hidden p-4">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px', color: 'hsl(var(--foreground))' }}></div>
      <div className="absolute top-20 right-10 w-32 h-32 bg-secondary rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-float" style={{ animationDelay: '0.5s' }}></div>
      <div className="absolute bottom-20 left-10 w-40 h-40 bg-quaternary blob-radius mix-blend-multiply filter blur-2xl opacity-70 animate-float" style={{ animationDelay: '1.5s' }}></div>

      {/* Main Content Card */}
      <div className="relative z-10 w-full max-w-md bg-card border-2 border-border shadow-pop rounded-xl p-8 hover:transform hover:rotate-[1deg] hover:scale-[1.01] transition-all duration-300">
        
        {/* Floating Icon */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-tertiary rounded-full border-2 border-border shadow-pop flex items-center justify-center text-foreground animate-wiggle">
          <Sparkles className="w-6 h-6" />
        </div>

        <div className="text-center mt-4 mb-8">
          <h1 className="text-3xl font-heading font-extrabold text-foreground mb-2 tracking-tight">Join the Fun!</h1>
          <p className="text-muted-foreground font-body font-medium">Create your account to get started.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-heading font-bold uppercase tracking-wide text-foreground ml-1" htmlFor="email">Email</label>
            <input 
              id="email"
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-12 px-4 bg-input border-2 border-border rounded-lg text-foreground font-body focus:outline-none focus:border-accent focus:shadow-pop transition-all duration-200"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-heading font-bold uppercase tracking-wide text-foreground ml-1" htmlFor="password">Password</label>
            <input 
              id="password"
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full h-12 px-4 bg-input border-2 border-border rounded-lg text-foreground font-body focus:outline-none focus:border-accent focus:shadow-pop transition-all duration-200"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full relative group h-14 bg-secondary text-white font-heading font-bold rounded-full border-2 border-border shadow-pop hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-pop-hover active:translate-x-[2px] active:translate-y-[2px] active:shadow-pop-active transition-all flex items-center justify-center p-2 mt-4"
          >
            <span className="flex-1 text-center pr-10 text-lg">{loading ? 'Creating...' : 'Sign Up'}</span>
            <div className="absolute right-2 top-2 bottom-2 aspect-square bg-white rounded-full flex items-center justify-center text-secondary group-hover:bg-tertiary group-hover:text-foreground transition-colors border-2 border-transparent group-hover:border-border">
              <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
            </div>
          </button>
        </form>

        <p className="mt-8 text-center font-body text-sm font-medium text-muted-foreground">
          Already have an account? <Link to="/login" className="text-accent hover:text-secondary underline font-bold transition-colors">Log in -&gt;</Link>
        </p>
      </div>
    </div>
  );
}
