import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import BirthdaySection from "@/components/BirthdaySection";
import AnimatedLines from "@/components/AnimatedLines";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative">
      <AnimatedLines />
      <Navbar />
      <Hero />
      <HowItWorks />
      <BirthdaySection />
      <Footer />
    </div>
  );
};

export default Index;
