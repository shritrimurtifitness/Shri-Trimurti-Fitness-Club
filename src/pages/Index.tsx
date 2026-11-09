import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import UpcomingTournaments from "@/components/landing/UpcomingTournaments";
import FacilitiesSection from "@/components/landing/FacilitiesSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import PricingSection from "@/components/landing/PricingSection";
import GallerySection from "@/components/landing/GallerySection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import ContactSection from "@/components/landing/ContactSection";
import FooterSection from "@/components/landing/FooterSection";

const Index = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      setTimeout(() => {
        const id = location.hash.replace("#", "");
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 150);
    } else {
      // Force scroll to top multiple times to beat async API content rendering
      window.scrollTo(0, 0);
      const t1 = setTimeout(() => window.scrollTo(0, 0), 100);
      const t2 = setTimeout(() => window.scrollTo(0, 0), 300);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <UpcomingTournaments />
      <FacilitiesSection />
      <FeaturesSection />
      <PricingSection />
      <GallerySection />
      <TestimonialsSection />
      <ContactSection />
      <FooterSection />
    </div>
  );
};

export default Index;
