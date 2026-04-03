import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { apiUrl } from "@/lib/api";
import { Activity, Users, Bot, Bell, Phone, LogOut, Menu, X, Mic, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

const navItems = [
  { name: "Overview", href: "/dashboard", icon: Activity },
  { name: "Patients", href: "/dashboard/patients", icon: Users },
  { name: "Agents", href: "/dashboard/agents", icon: Bot },
  { name: "Alerts", href: "/dashboard/alerts", icon: Bell },
  { name: "Calls", href: "/dashboard/calls", icon: Phone },
  { name: "Simulate Web-Call", href: "/dashboard/calls/simulate", icon: Mic },
  { name: "Misdiagnosis Solution", href: "/dashboard/misdiagnosis-solution", icon: ShieldCheck },
];

export default function DashboardLayout() {
  const { signOut, user, session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openAlertsCount, setOpenAlertsCount] = useState(0);

  useEffect(() => {
    if (!session?.access_token) return;
    const load = async () => {
      try {
        const r = await fetch(apiUrl("/api/alerts"), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const d = await r.json().catch(() => ({}));
        const list = Array.isArray(d.alerts) ? d.alerts : [];
        setOpenAlertsCount(list.filter((a: { status?: string }) => a.status === "open").length);
      } catch {
        setOpenAlertsCount(0);
      }
    };
    void load();
    const t = window.setInterval(load, 20000);
    const onInv = () => void load();
    window.addEventListener("vitals:invalidate-lists", onInv);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("vitals:invalidate-lists", onInv);
    };
  }, [session?.access_token]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-background font-body overflow-hidden">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 border-r-2 border-border bg-card shadow-[4px_0_0_0_rgba(30,41,59,0.05)] z-20 shrink-0">
        <Link to="/" className="p-6 h-20 flex items-center border-b-2 border-border border-dashed font-heading font-extrabold text-2xl text-foreground hover:bg-muted/50 transition-colors">
          <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center mr-3 shadow-pop animate-wiggle">
            <Activity className="w-5 h-5" />
          </div>
          Vitals
        </Link>
        <nav className="flex-1 p-4 space-y-3 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all duration-200 ${
                  isActive
                    ? "bg-secondary text-white border-2 border-border shadow-pop translate-x-1"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground border-2 border-transparent"
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" strokeWidth={2.5} />
                <span className="flex-1 min-w-0">{item.name}</span>
                {item.href === "/dashboard/alerts" && openAlertsCount > 0 ? (
                  <span className="shrink-0 min-w-[1.5rem] h-7 px-2 rounded-full bg-destructive text-white text-xs font-black flex items-center justify-center border-2 border-border">
                    {openAlertsCount > 9 ? "9+" : openAlertsCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t-2 border-border border-dashed">
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 w-full p-3 font-bold rounded-lg text-foreground border-2 border-border hover:bg-tertiary transition-colors shadow-sm"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative min-w-0 overflow-hidden">
         {/* Decorative Grid - Absolute underneath all content */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '16px 16px', color: 'hsl(var(--foreground))' }}></div>

        {/* Top Header */}
        <header className="h-20 border-b-2 border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center gap-4">
             <button aria-label="Menu" className="md:hidden" onClick={() => setMobileMenuOpen(true)}>
               <Menu className="w-6 h-6 text-foreground" />
             </button>
             <h2 className="font-heading font-bold text-xl text-foreground capitalize">
               {location.pathname === "/dashboard" ? "Overview" : location.pathname.split("/")[2]?.replace("-", " ") || "Dashboard"}
             </h2>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden sm:block text-sm font-bold text-muted-foreground">Provider: {user?.email}</div>
             <div className="w-10 h-10 rounded-full border-2 border-border bg-quaternary flex items-center justify-center shadow-pop">
               <span className="font-heading font-bold text-white uppercase">{user?.email?.[0] || 'D'}</span>
             </div>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
             <div className="fixed inset-y-0 left-0 w-64 bg-card border-r-2 border-border flex flex-col animate-pop-in">
                <div className="p-4 flex justify-end">
                   <button onClick={() => setMobileMenuOpen(false)}><X className="w-6 h-6" /></button>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 p-3 rounded-lg font-bold border-2 ${
                        location.pathname === item.href ? "bg-secondary text-white border-border shadow-pop" : "border-transparent"
                      }`}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span className="flex-1">{item.name}</span>
                      {item.href === "/dashboard/alerts" && openAlertsCount > 0 ? (
                        <span className="min-w-[1.5rem] h-7 px-2 rounded-full bg-destructive text-white text-xs font-black flex items-center justify-center">
                          {openAlertsCount > 9 ? "9+" : openAlertsCount}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </nav>
             </div>
          </div>
        )}

        {/* Outlet container */}
        <main className="flex-1 overflow-auto p-4 md:p-8 z-0 relative">
          <div className="max-w-6xl mx-auto h-full space-y-8 animate-pop-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
