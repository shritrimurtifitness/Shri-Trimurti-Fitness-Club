import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Phone, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import logoImage from "@/assets/logo.png";
import api from "@/lib/api";
import SportsThemeToggle from "@/components/SportsThemeToggle";

const navLinks = [
  { name: "Home", path: "/", hash: "" },
  { name: "Tournaments", path: "/#tournaments", hash: "tournaments" },
  { name: "Facilities", path: "/#facilities", hash: "facilities" },
  { name: "Pricing", path: "/#pricing", hash: "pricing" },
  { name: "FAQs", path: "/#faq", hash: "faq" },
  { name: "Contact", path: "/#contact-section", hash: "contact-section" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [phone, setPhone] = useState("+919595153006");
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    api.get("/settings/contact")
      .then((res) => {
        if (res.data?.phone) setPhone(res.data.phone);
      })
      .catch(() => {});
  }, []);

  const cleanPhone = phone.replace(/[^0-9]/g, "");

  const isLinkActive = (link: typeof navLinks[0]) => {
    if (link.hash) {
      return location.pathname === "/" && location.hash === `#${link.hash}`;
    }
    return location.pathname === link.path && !location.hash;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 dark:bg-black/60 backdrop-blur-xl border-b border-zinc-200/80 dark:border-white/10 transition-colors">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={logoImage}
              alt="SHRI TRIMURTI FITNESS CLUB logo"
              className="w-10 h-10 rounded-full object-cover ring-2 ring-[#39FF14]/50 shadow-turf"
            />
            <span className="font-heading font-extrabold text-base sm:text-xl text-zinc-900 dark:text-white tracking-tight">
              <span className="hidden sm:inline">Shri Trimurti Fitness </span>
              <span className="sm:hidden">Trimurti </span>
              <span className="text-gradient-turf">Club</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  isLinkActive(link)
                    ? "text-emerald-600 bg-emerald-50 dark:text-[#39FF14] dark:bg-[#39FF14]/15 font-semibold"
                    : "text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10"
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Desktop Right CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href={`https://wa.me/${cleanPhone}?text=Hi%20Shri%20Trimurti%20Fitness%20Club,%20I%20would%20like%20to%20inquire%20about%20turf%20booking.`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:text-emerald-500 dark:hover:text-[#39FF14] hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
              title="Chat on WhatsApp"
              aria-label="WhatsApp"
            >
              <MessageCircle className="w-5 h-5 text-emerald-500" />
            </a>

            <SportsThemeToggle />

            <Link to="/book">
              <Button size="sm" className="bg-gradient-turf text-primary-foreground font-bold shadow-turf hover:opacity-95 transition-opacity px-5">
                Book Now
              </Button>
            </Link>
          </div>

          {/* Mobile Right Quick Actions */}
          <div className="flex md:hidden items-center gap-1.5">
            <a
              href={`tel:${phone}`}
              aria-label="Call arena"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10"
            >
              <Phone className="w-4 h-4 text-emerald-500" />
            </a>

            <a
              href={`https://wa.me/${cleanPhone}?text=Hi,%20I%20want%20to%20book%20a%20turf%20slot.`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp arena"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-emerald-500 hover:bg-zinc-100 dark:hover:bg-white/10"
            >
              <MessageCircle className="w-4 h-4" />
            </a>

            <SportsThemeToggle size="sm" />

            <button
              className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-900 dark:text-white ml-0.5"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="md:hidden bg-card/95 backdrop-blur-xl border-t border-border shadow-2xl"
          >
            <div className="container mx-auto px-4 py-4 space-y-1.5">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isLinkActive(link)
                      ? "text-emerald-500 bg-emerald-500/10 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  {link.name}
                </Link>
              ))}

              <Link
                to="/my-bookings"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              >
                My Bookings
              </Link>

              <div className="pt-3 pb-1">
                <Link to="/book" onClick={() => setIsOpen(false)}>
                  <Button size="lg" className="w-full bg-gradient-turf text-primary-foreground font-bold shadow-turf">
                    Book Slot Now
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
