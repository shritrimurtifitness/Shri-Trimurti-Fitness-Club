import { useEffect, useState } from "react";
import { motion, Variants } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Star, Clock, Trophy, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-arena.jpg";
import api from "@/lib/api";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 110, damping: 16 },
  },
};

/** Evaluates if the arena is currently open based on working_hours string */
function checkIsOpenNow(workingHours: string): boolean {
  if (!workingHours) return true; // optimistic default
  try {
    const normalized = workingHours
      .replace(/[–—]/g, "-")
      .replace(/\s+to\s+/gi, "-");
    const timesPart = normalized.includes(":") ? normalized.split(":").slice(1).join(":") : normalized;
    const parts = timesPart.split("-");
    if (parts.length < 2) return true;

    const parseMinutes = (t: string) => {
      const match = t.trim().match(/(\d+)(?::(\d+))?\s*(AM|PM)?/i);
      if (!match) return null;
      let h = parseInt(match[1], 10);
      const m = match[2] ? parseInt(match[2], 10) : 0;
      const mer = match[3]?.toUpperCase();
      if (mer === "PM" && h !== 12) h += 12;
      if (mer === "AM" && h === 12) h = 0;
      return h * 60 + m;
    };

    const start = parseMinutes(parts[0]);
    const end = parseMinutes(parts[1]);
    if (start === null || end === null) return true;

    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();

    if (end < start) {
      // Overnight span like 10:00 AM – 12:00 AM (midnight)
      return current >= start || current <= end;
    }
    return current >= start && current <= end;
  } catch {
    return true;
  }
}

export default function HeroSection() {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    api.get("/settings/contact")
      .then((res) => setSettings(res.data))
      .catch(() => {});
  }, []);

  const rating = settings?.google_rating ? `${settings.google_rating} ★` : "4.6 ★";
  const hours = settings?.working_hours || "10:00 AM – 12:00 AM";
  const isOpen = checkIsOpenNow(hours);

  return (
    <section className="relative flex items-center overflow-hidden min-h-[calc(100vh-4rem)] lg:min-h-screen bg-background pt-20 sm:pt-24 pb-14 lg:py-0 transition-colors duration-300">
      {/* Background Decorative Glows */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-0 w-[280px] h-[280px] sm:w-[500px] sm:h-[500px] bg-[#39FF14]/5 rounded-full blur-[100px] lg:blur-[140px]" />
        <div className="absolute bottom-1/4 right-0 w-[240px] h-[240px] sm:w-[450px] sm:h-[450px] bg-[#39FF14]/5 rounded-full blur-[90px] lg:blur-[130px]" />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">

          {/* LEFT SIDE - Content */}
          <motion.div
            className="lg:col-span-6 flex flex-col justify-center text-left"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* 1. Live Badge */}
            <motion.div
              variants={itemVariants}
              className="inline-flex items-center self-start gap-2.5 px-3.5 py-1.5 rounded-full bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 backdrop-blur-sm mb-5 sm:mb-7"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#39FF14] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#39FF14]"></span>
              </span>
              <span className="text-xs font-semibold tracking-wider text-zinc-900 dark:text-white uppercase flex items-center gap-1.5">
                Bookings Live
                <span className="text-zinc-400 dark:text-zinc-500 font-normal">|</span>
                <span className="text-zinc-600 dark:text-zinc-300 font-normal normal-case">Book your slot in 60 seconds</span>
              </span>
            </motion.div>

            {/* 2. Headline */}
            <motion.h1
              variants={itemVariants}
              className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-950 dark:text-white mb-5 leading-[1.08] sm:leading-[1.05]"
            >
              Play Hard.
              <br />
              <span className="text-gradient-turf drop-shadow-[0_2px_10px_rgba(57,255,20,0.15)]">
                Compete Better.
              </span>
            </motion.h1>

            {/* 3. Supporting Text */}
            <motion.p
              variants={itemVariants}
              className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 font-light leading-relaxed max-w-xl mb-7 sm:mb-9"
            >
              Premier box cricket turf with full safety netting & championship football arena in Koparde. High-lumen floodlights for day & night matches.
            </motion.p>

            {/* 4. Action Buttons */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-3.5 sm:gap-4 items-stretch sm:items-center justify-start mb-8 sm:mb-11"
            >
              <Link to="/book" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-[#39FF14] text-black hover:bg-[#32e010] font-extrabold text-sm sm:text-base px-7 sm:px-9 h-12 sm:h-14 rounded-xl shadow-[0_4px_22px_rgba(57,255,20,0.3)] transition-all duration-300 group"
                >
                  Book a Slot
                  <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <a href="#facilities" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-zinc-300 dark:border-zinc-800 bg-zinc-100/40 dark:bg-zinc-950/40 text-zinc-900 dark:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-900/60 font-semibold text-sm sm:text-base px-6 sm:px-8 h-12 sm:h-14 rounded-xl backdrop-blur-md transition-all duration-300"
                >
                  Explore Facilities
                </Button>
              </a>
            </motion.div>

            {/* 5. Live Stats Row */}
            <motion.div
              variants={itemVariants}
              className="grid grid-cols-3 divide-x divide-zinc-200 dark:divide-zinc-800/80 border-t border-zinc-200 dark:border-zinc-800/80 pt-5 sm:pt-7 w-full max-w-lg"
            >
              {[
                { icon: Trophy, value: "1,200+", label: "Bookings" },
                { icon: Star, value: rating, label: "Google Rating" },
                { icon: Clock, value: "10AM–12AM", label: "Open Daily" },
              ].map((stat) => {
                const StatIcon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="flex flex-col justify-center items-start pl-3.5 sm:pl-6 first:pl-0"
                  >
                    <div className="flex items-center gap-1.5 text-zinc-900 dark:text-white font-heading font-extrabold text-base sm:text-2xl">
                      <StatIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[#39FF14] shrink-0" />
                      <span>{stat.value}</span>
                    </div>
                    <p className="text-[10px] sm:text-xs uppercase tracking-wider text-zinc-500 font-semibold mt-1">
                      {stat.label}
                    </p>
                  </div>
                );
              })}
            </motion.div>
          </motion.div>

          {/* RIGHT SIDE - Showcase Card */}
          <motion.div
            className="lg:col-span-6 flex justify-center items-center relative"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 80, damping: 15, delay: 0.2 }}
          >
            {/* Ambient Back Glow */}
            <div className="absolute inset-0 bg-[#39FF14]/15 dark:bg-[#39FF14]/10 rounded-[2.5rem] blur-[60px] pointer-events-none scale-[1.02]" />

            <div className="relative w-full max-w-[34rem] aspect-[6/5] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border border-zinc-200 dark:border-zinc-800/80 shadow-[0_15px_45px_rgba(0,0,0,0.25)] group bg-zinc-100 dark:bg-zinc-950">
              <img
                src={heroImage}
                alt="SHRI TRIMURTI FITNESS CLUB box cricket and football turf"
                // @ts-expect-error fetchpriority attribute
                fetchpriority="high"
                loading="eager"
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
              />

              <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

              {/* Floating Highlight Card */}
              <div className="absolute bottom-3 left-3 right-3 sm:bottom-6 sm:left-6 sm:right-6 p-3 sm:p-5 rounded-[1.25rem] sm:rounded-[1.75rem] bg-black/75 border border-white/15 backdrop-blur-xl shadow-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#39FF14]/20 border border-[#39FF14]/30 flex items-center justify-center shrink-0">
                    <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-[#39FF14]" />
                  </div>
                  <div>
                    <span className="text-[9px] sm:text-xs uppercase tracking-wider text-[#39FF14] font-bold">
                      Box Cricket • Football
                    </span>
                    <h4 className="text-white text-xs sm:text-sm font-semibold flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-zinc-400" /> Koparde, Sangrul Fata
                    </h4>
                  </div>
                </div>

                {/* Dynamic Open / Closed indicator */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
                  isOpen
                    ? "bg-[#39FF14]/15 border-[#39FF14]/30 text-[#39FF14]"
                    : "bg-red-500/15 border-red-500/30 text-red-400"
                }`}>
                  <span className={`h-2 w-2 rounded-full ${isOpen ? "bg-[#39FF14] animate-pulse" : "bg-red-500"}`} />
                  <span>{isOpen ? "Open Now" : "Closed"}</span>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-background pointer-events-none z-10" />
    </section>
  );
}
