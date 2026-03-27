import { Stethoscope, HeartPulse, Users } from "lucide-react";
import doctorDashboard from "@/assets/doctor-dashboard.png";

const impacts = [
  {
    icon: Users,
    title: "Nurses & Hospital Staff",
    color: "bg-primary",
    items: [
      "Eliminates manual monitoring overload",
      "Automated repetitive follow-up calls reduces burnout",
      "Acknowledge critical alerts instantly",
    ],
  },
  {
    icon: Stethoscope,
    title: "Doctors",
    color: "bg-secondary",
    featured: true,
    items: [
      "Recovers 80% of consultation time",
      "AI reports help in faster diagnosis",
      "Easy dosage change approvals",
      "Automated appointment scheduling",
    ],
  },
  {
    icon: HeartPulse,
    title: "Chronic Patients",
    color: "bg-quaternary",
    items: [
      "Prevents emergencies via early detection",
      "Continuous, proactive health support",
      "Multilingual voice conversations",
    ],
  },
];

const ImpactSection = () => {
  return (
    <section className="relative py-20 md:py-28 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <span className="inline-block px-4 py-2 rounded-full bg-secondary text-secondary-foreground font-heading font-bold text-sm border-2 border-foreground shadow-pop">
            Impact & Benefits
          </span>
          <h2 className="font-heading font-extrabold text-3xl md:text-5xl">
            Who <span className="text-quaternary">Benefits</span>?
          </h2>
        </div>

        {/* Doctor dashboard illustration */}
        <div className="flex justify-center mb-12">
          <div className="relative bg-card border-2 border-foreground rounded-2xl shadow-pop p-4 max-w-lg">
            <img
              src={doctorDashboard}
              alt="Doctor reviewing AI-powered health dashboard"
              width={800}
              height={600}
              loading="lazy"
              className="w-full rounded-lg"
            />
            <div className="absolute -top-3 -right-3 px-3 py-1 rounded-full bg-tertiary text-tertiary-foreground font-heading font-bold text-xs border-2 border-foreground shadow-pop">
              AI Dashboard
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 items-start">
          {impacts.map((impact) => {
            const Icon = impact.icon;
            return (
              <div
                key={impact.title}
                className={`relative bg-card border-2 border-foreground rounded-xl p-6 ${impact.featured ? 'shadow-pink md:scale-105 md:-translate-y-2' : 'shadow-soft'} hover:-rotate-1 hover:scale-[1.02] transition-all duration-300 ease-bounce`}
              >
                {impact.featured && (
                  <div className="absolute -top-5 -right-3 bg-tertiary text-tertiary-foreground px-3 py-1 rounded-full font-heading font-bold text-xs border-2 border-foreground shadow-pop rotate-12">
                    ★ KEY IMPACT
                  </div>
                )}
                <div className={`w-14 h-14 ${impact.color} rounded-full flex items-center justify-center border-2 border-foreground mb-4`}>
                  <Icon className="w-7 h-7 text-card" strokeWidth={2.5} />
                </div>
                <h3 className="font-heading font-bold text-xl mb-4">{impact.title}</h3>
                <ul className="space-y-3">
                  {impact.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1 w-2 h-2 rounded-full bg-quaternary shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ImpactSection;
