import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ArrowRight, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Successfully logged in!");
      navigate("/");
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      }
    });
    
    if (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-background overflow-hidden p-4">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px', color: 'hsl(var(--foreground))' }}></div>
      <div className="absolute top-20 left-10 w-32 h-32 bg-secondary rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-float"></div>
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-tertiary blob-radius mix-blend-multiply filter blur-2xl opacity-70 animate-float" style={{ animationDelay: '1s' }}></div>

      {/* Main Content Card */}
      <div className="relative z-10 w-full max-w-md bg-card border-2 border-border shadow-pop rounded-xl p-8 hover:transform hover:rotate-[-1deg] hover:scale-[1.01] transition-all duration-300">
        
        {/* Floating Icon */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-accent rounded-full border-2 border-border shadow-pop flex items-center justify-center text-white animate-wiggle">
          <Mail className="w-6 h-6" />
        </div>

        <div className="text-center mt-4 mb-8">
          <h1 className="text-3xl font-heading font-extrabold text-foreground mb-2 tracking-tight">Welcome Back!</h1>
          <p className="text-muted-foreground font-body font-medium">Log in to view your health dashboard.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
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
              className="w-full h-12 px-4 bg-input border-2 border-border rounded-lg text-foreground font-body focus:outline-none focus:border-accent focus:shadow-pop transition-all duration-200"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full relative group h-14 bg-accent text-white font-heading font-bold rounded-full border-2 border-border shadow-pop hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-pop-hover active:translate-x-[2px] active:translate-y-[2px] active:shadow-pop-active transition-all flex items-center justify-center p-2 mt-4"
          >
            <span className="flex-1 text-center pr-10 text-lg">{loading ? 'Logging in...' : 'Log In'}</span>
            <div className="absolute right-2 top-2 bottom-2 aspect-square bg-white rounded-full flex items-center justify-center text-accent group-hover:bg-tertiary group-hover:text-foreground transition-colors border-2 border-transparent group-hover:border-border">
              <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
            </div>
          </button>
        </form>

        <div className="mt-8 mb-6 relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
             <div className="w-full border-t-2 border-dashed border-border"></div>
          </div>
          <div className="relative bg-card px-4 font-body text-sm font-bold uppercase text-muted-foreground tracking-widest">
            or
          </div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          type="button"
          className="w-full h-14 bg-transparent text-foreground font-heading font-bold rounded-full border-2 border-border hover:bg-tertiary transition-colors flex items-center justify-center gap-3 text-lg"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <p className="mt-8 text-center font-body text-sm font-medium text-muted-foreground">
          Don't have an account? <Link to="/signup" className="text-secondary hover:text-accent underline font-bold transition-colors">Sign up -&gt;</Link>
        </p>
      </div>
    </div>
  );
}
