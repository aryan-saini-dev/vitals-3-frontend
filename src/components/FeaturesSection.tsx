import { Phone, Brain, FileText, AlertTriangle, CheckCircle, Clock } from "lucide-react";

const features = [
  {
    icon: Phone,
    title: "Autonomous Voice Check-ins",
    description: "Human-like calling agent powered by ElevenLabs reduces staff overload with natural multilingual conversations.",
    color: "bg-primary",
    shadowClass: "shadow-pop",
  },
  {
    icon: Brain,
    title: "Intelligent Symptom Correlation",
    description: "Agent asks context-aware questions — like detecting metallic taste as a sign of Type 2 progressing to Type 3 Diabetes.",
    color: "bg-secondary",
    shadowClass: "shadow-pink",
  },
  {
    icon: FileText,
    title: "Automated History Synthesis",
    description: "RAG-enhanced retrieval builds accurate patient histories, saving 80% of consultation time from manual history-taking.",
    color: "bg-tertiary",
    shadowClass: "shadow-soft",
  },
  {
    icon: AlertTriangle,
    title: "Risk-Based Escalation",
    description: "Autonomously evaluates risk levels, schedules appointments, and sends doctors reports with suggested dosage changes.",
    color: "bg-quaternary",
    shadowClass: "shadow-pop",
  },
  {
    icon: CheckCircle,
    title: "One-Click Doctor Approval",
    description: "Doctors review AI-generated summaries and approve or deny changes with a single click, keeping humans in the loop.",
    color: "bg-primary",
    shadowClass: "shadow-pink",
  },
  {
    icon: Clock,
    title: "Preventive, Not Reactive",
    description: "Continuous proactive monitoring prevents emergencies via early detection — no more waiting until symptoms become critical.",
    color: "bg-secondary",
    shadowClass: "shadow-soft",
  },
];

const FeaturesSection = () => {
  return (
    <section className="relative py-20 md:py-28 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <span className="inline-block px-4 py-2 rounded-full bg-tertiary text-tertiary-foreground font-heading font-bold text-sm border-2 border-foreground shadow-pop">
            Core Capabilities
          </span>
          <h2 className="font-heading font-extrabold text-3xl md:text-5xl">
            How VITALS{" "}
            <span className="text-primary">Works for You</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            An end-to-end agentic AI pipeline from voice check-in to doctor approval.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={`group relative bg-card border-2 border-foreground rounded-xl p-6 ${feature.shadowClass} hover:-rotate-1 hover:scale-[1.02] transition-all duration-300 ease-bounce`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Floating icon */}
                <div className={`absolute -top-5 left-6 w-10 h-10 ${feature.color} rounded-full flex items-center justify-center border-2 border-foreground group-hover:animate-wiggle`}>
                  <Icon className="w-5 h-5 text-card" strokeWidth={2.5} />
                </div>
                <div className="pt-4 space-y-3">
                  <h3 className="font-heading font-bold text-lg">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
