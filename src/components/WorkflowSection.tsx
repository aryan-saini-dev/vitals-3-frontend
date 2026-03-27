import { PhoneCall, Mic, Database, Activity, ThumbsUp } from "lucide-react";

const steps = [
  {
    icon: PhoneCall,
    title: "Voice Call Initiation",
    description: "Twilio + Vapi bridge AI agents with the call system. AI calls the user or assigns a multilingual agent.",
    color: "bg-primary",
  },
  {
    icon: Mic,
    title: "Human-like Voice Pipeline",
    description: "Deepgram (STT) → GPT (Reasoning) → ElevenLabs (TTS) for indistinguishable voice conversations.",
    color: "bg-secondary",
  },
  {
    icon: Database,
    title: "Context-Aware RAG Queries",
    description: "De-identified patient reports sent to LLM with RAG for non-hallucinated pattern detection.",
    color: "bg-tertiary",
  },
  {
    icon: Activity,
    title: "Risk Evaluation",
    description: "Automatically evaluates risk, suggests dosage changes, and schedules appointments for high-risk patients.",
    color: "bg-quaternary",
  },
  {
    icon: ThumbsUp,
    title: "Doctor Approval",
    description: "Doctor receives summary → Approves or denies with one click. Changes are applied instantly.",
    color: "bg-primary",
  },
];

const WorkflowSection = () => {
  return (
    <section className="relative py-20 md:py-28 px-4 overflow-hidden">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, hsl(var(--foreground)) 0, hsl(var(--foreground)) 1px, transparent 0, transparent 50%)`,
          backgroundSize: '16px 16px',
        }}
      />

      <div className="relative max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <span className="inline-block px-4 py-2 rounded-full bg-quaternary text-quaternary-foreground font-heading font-bold text-sm border-2 border-foreground shadow-pop">
            Technical Workflow
          </span>
          <h2 className="font-heading font-extrabold text-3xl md:text-5xl">
            The <span className="text-secondary">5-Step</span> Pipeline
          </h2>
        </div>

        <div className="relative space-y-8 md:space-y-0 md:grid md:grid-cols-5 md:gap-4">
          {/* Dashed connector line */}
          <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 border-t-2 border-dashed border-foreground opacity-20 pointer-events-none" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="relative flex flex-col items-center text-center space-y-4">
                {/* Step number */}
                <div className="relative">
                  <div className={`w-20 h-20 ${step.color} rounded-full flex items-center justify-center border-2 border-foreground shadow-pop`}>
                    <Icon className="w-8 h-8 text-card" strokeWidth={2.5} />
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-card border-2 border-foreground flex items-center justify-center font-heading font-bold text-xs">
                    {index + 1}
                  </span>
                </div>
                <h3 className="font-heading font-bold text-sm">{step.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed max-w-[180px]">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WorkflowSection;
