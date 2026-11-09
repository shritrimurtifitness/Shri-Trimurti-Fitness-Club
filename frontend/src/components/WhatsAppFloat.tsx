import { useState, useEffect } from "react";
import { MessageCircle, ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";

export default function WhatsAppFloat() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [phone, setPhone] = useState("917083738373");

  useEffect(() => {
    api.get("/settings/contact")
      .then((res) => {
        if (res.data?.phone) {
          const clean = res.data.phone.replace(/[^0-9]/g, "");
          if (clean) setPhone(clean);
        }
      })
      .catch(() => {});

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 350);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const whatsappUrl = `https://wa.me/${phone}?text=Hi%20Shri%20Trimurti%20Sports%20Arena,%20I%20would%20like%20to%20inquire%20about%20booking%20a%20turf%20slot.`;

  return (
    <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
      {/* Back to top button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={scrollToTop}
            aria-label="Back to top of page"
            className="w-10 h-10 rounded-full bg-card/90 border border-border shadow-md hover:bg-secondary flex items-center justify-center text-foreground hover:text-primary transition-all pointer-events-auto backdrop-blur-sm"
          >
            <ArrowUp className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating WhatsApp Action Pill */}
      <motion.a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Arena on WhatsApp"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="pointer-events-auto flex items-center gap-2.5 bg-[#25D366] text-white px-4 py-3 rounded-full shadow-[0_6px_25px_rgba(37,211,102,0.4)] hover:bg-[#20ba59] transition-all group"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
        </span>
        <MessageCircle className="w-5 h-5 fill-white text-[#25D366]" />
        <span className="hidden sm:inline font-bold text-sm tracking-wide">
          Chat with Us
        </span>
      </motion.a>
    </div>
  );
}
