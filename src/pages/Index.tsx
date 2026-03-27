import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import TechStackMarquee from "@/components/TechStackMarquee";
import WorkflowSection from "@/components/WorkflowSection";
import ImpactSection from "@/components/ImpactSection";
import TeamSection from "@/components/TeamSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <HeroSection />
      <TechStackMarquee />
      <FeaturesSection />
      <WorkflowSection />
      <ImpactSection />
      <TeamSection />
      <Footer />
    </div>
  );
};

export default Index;
