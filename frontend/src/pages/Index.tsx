import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import UpcomingTournaments from "@/components/landing/UpcomingTournaments";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import FacilitiesSection from "@/components/landing/FacilitiesSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import PricingSection from "@/components/landing/PricingSection";
import GallerySection from "@/components/landing/GallerySection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import FAQSection from "@/components/landing/FAQSection";
import ContactSection from "@/components/landing/ContactSection";
import FooterSection from "@/components/landing/FooterSection";
import WhatsAppFloat from "@/components/WhatsAppFloat";

const Index = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      const timer = setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 150);
      return () => clearTimeout(timer);
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden relative">
      <Navbar />
      <HeroSection />
      <UpcomingTournaments />
      <HowItWorksSection />
      <FacilitiesSection />
      <FeaturesSection />
      <PricingSection />
      <GallerySection />
      <TestimonialsSection />
      <FAQSection />
      <ContactSection />
      <FooterSection />
      <WhatsAppFloat />
    </div>
  );
};

export default Index;
