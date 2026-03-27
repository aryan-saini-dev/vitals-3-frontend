import { ArrowRight, Phone, Brain, ShieldCheck } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden py-20 md:py-32 px-4">
      {/* Big yellow circle decoration */}
      <div className="absolute -left-20 top-1/4 w-72 h-72 md:w-[500px] md:h-[500px] rounded-full bg-tertiary opacity-20 pointer-events-none" />
      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        {/* Text Side */}
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-foreground bg-card shadow-pop font-heading font-bold text-sm tracking-wide uppercase">
            <div className="w-6 h-6 rounded-full bg-quaternary flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-quaternary-foreground" strokeWidth={2.5} />
            </div>
            Agentic AI Healthcare
          </div>

          <h1 className="font-heading font-extrabold text-4xl md:text-6xl leading-tight">
            Closing the{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-primary">Care Gap</span>
              <svg className="absolute -bottom-2 left-0 w-full h-3" viewBox="0 0 200 12">
                <path d="M0 8 Q50 0 100 8 Q150 16 200 8" fill="none" stroke="hsl(var(--secondary))" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </span>{" "}
            Between Staff &amp; Patients
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-lg font-body">
            VITALS is a proactive AI system that autonomously monitors chronic patients through human-like voice calls, freeing overburdened healthcare staff.
          </p>

          <div className="flex flex-wrap gap-4">
            <button className="group inline-flex items-center gap-3 px-8 py-4 rounded-full bg-primary text-primary-foreground font-heading font-bold border-2 border-foreground shadow-pop hover:shadow-pop-hover hover:-translate-x-0.5 hover:-translate-y-0.5 active:shadow-pop-active active:translate-x-0.5 active:translate-y-0.5 transition-all duration-300 ease-bounce">
              Get Started
              <span className="w-8 h-8 rounded-full bg-card flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-foreground" strokeWidth={2.5} />
              </span>
            </button>
            <button className="inline-flex items-center gap-2 px-8 py-4 rounded-full border-2 border-foreground font-heading font-bold hover:bg-tertiary transition-all duration-300 ease-bounce">
              Learn More
            </button>
          </div>
        </div>

        {/* Visual Side */}
        <div className="relative flex justify-center">
          {/* Dotted pattern behind */}
          <div
            className="absolute inset-0 rounded-3xl opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(hsl(var(--primary)) 2px, transparent 2px)',
              backgroundSize: '16px 16px',
            }}
          />
          {/* Main visual card */}
          <div className="relative bg-card border-2 border-foreground rounded-3xl shadow-pop p-8 md:p-10 space-y-6 max-w-sm w-full">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                <Phone className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div>
                <p className="font-heading font-bold text-lg">Voice Check-in</p>
                <p className="text-sm text-muted-foreground">Active Session</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-quaternary animate-pulse" />
                <span className="text-sm font-medium">Symptom Correlation Active</span>
              </div>
              <div className="bg-muted rounded-lg p-3 blob-radius">
                <p className="text-sm text-muted-foreground italic">"Have you noticed any metallic taste recently? This could indicate a change in your condition..."</p>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 rounded-full bg-quaternary text-quaternary-foreground text-xs font-bold border-2 border-foreground">Low Risk</span>
                <span className="px-3 py-1 rounded-full bg-tertiary text-tertiary-foreground text-xs font-bold border-2 border-foreground">Monitoring</span>
              </div>
            </div>
            {/* Floating badge */}
            <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-secondary flex items-center justify-center border-2 border-foreground shadow-pop animate-float">
              <ShieldCheck className="w-8 h-8 text-secondary-foreground" strokeWidth={2.5} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
