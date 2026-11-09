import { motion, Variants } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Star, Clock, Trophy, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-arena.jpg";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 15 }
  }
};

export default function HeroSection() {
  return (
    <section className="relative flex items-center overflow-hidden min-h-[calc(100vh-4rem)] lg:min-h-screen bg-background pt-28 pb-16 lg:py-0 transition-colors duration-300">
      {/* Background Decorative Glows */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-0 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] bg-[#39FF14]/3 dark:bg-[#39FF14]/5 rounded-full blur-[100px] lg:blur-[130px]" />
        <div className="absolute bottom-1/4 right-0 w-[250px] h-[250px] sm:w-[450px] sm:h-[450px] bg-[#39FF14]/3 dark:bg-[#39FF14]/5 rounded-full blur-[90px] lg:blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

          {/* LEFT SIDE - Content Area */}
          <motion.div
            className="lg:col-span-6 flex flex-col justify-center text-left"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* 1. Status Badge */}
            <motion.div
              variants={itemVariants}
              className="inline-flex items-center self-start gap-2.5 px-4 py-2 rounded-full bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 backdrop-blur-sm mb-6 sm:mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#39FF14] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#39FF14]"></span>
              </span>
              <span className="text-xs sm:text-sm font-semibold tracking-wider text-zinc-900 dark:text-white uppercase flex items-center gap-1.5">
                Bookings Live
                <span className="text-zinc-400 dark:text-zinc-500 font-normal">|</span>
                <span className="text-zinc-600 dark:text-zinc-300 font-normal normal-case">Book your slot instantly.</span>
              </span>
            </motion.div>

            {/* 2. Large Headline */}
            <motion.h1
              variants={itemVariants}
              className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-950 dark:text-white mb-6 leading-[1.08] sm:leading-[1.05]"
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
              className="text-base sm:text-lg md:text-xl text-zinc-600 dark:text-zinc-400 font-light leading-relaxed max-w-xl mb-8 sm:mb-10"
            >
              Premium cricket turf, pro netting systems, a championship football arena designed for serious players and casual enthusiasts.
            </motion.p>

            {/* 4. Primary & Secondary CTA Buttons */}
            <motion.div
              variants={itemVariants}
              className="flex flex-row gap-4 items-center justify-start mb-10 sm:mb-12"
            >
              <Link to="/book" className="flex-1 sm:flex-initial">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-[#39FF14] text-black hover:bg-[#32e010] font-bold text-sm sm:text-base px-6 sm:px-8 h-12 sm:h-14 rounded-xl shadow-[0_4px_20px_rgba(57,255,20,0.25)] transition-all duration-300 group"
                >
                  Book a Session
                  <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <a href="#facilities" className="flex-1 sm:flex-initial">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-zinc-200 dark:border-zinc-800 bg-zinc-100/40 dark:bg-zinc-950/40 text-zinc-900 dark:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-900/60 hover:text-zinc-950 dark:hover:text-white font-semibold text-sm sm:text-base px-6 sm:px-8 h-12 sm:h-14 rounded-xl backdrop-blur-md transition-all duration-300"
                >
                  View Facilities
                </Button>
              </a>
            </motion.div>

            {/* 5. Stats Row */}
            <motion.div
              variants={itemVariants}
              className="grid grid-cols-3 divide-x divide-zinc-200 dark:divide-zinc-800/80 border-t border-zinc-200 dark:border-zinc-800/80 pt-6 sm:pt-8 w-full max-w-lg"
            >
              {[
                { icon: Trophy, value: "10,000+", label: "Sessions" },
                { icon: Star, value: "4.9 ★", label: "Rating" },
                { icon: Clock, value: "6AM–12AM", label: "Open Daily" },
              ].map((stat) => {
                const StatIcon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="flex flex-col justify-center items-start pl-4 sm:pl-6 first:pl-0"
                  >
                    <div className="flex items-center gap-1.5 text-zinc-900 dark:text-white font-heading font-extrabold text-lg sm:text-2xl">
                      <StatIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[#39FF14] shrink-0" />
                      <span>{stat.value}</span>
                    </div>
                    <p className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-500 font-semibold mt-1">
                      {stat.label}
                    </p>
                  </div>
                );
              })}
            </motion.div>
          </motion.div>

          {/* RIGHT SIDE - Visual Showcase Area */}
          <motion.div
            className="lg:col-span-6 flex justify-center items-center relative"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 80, damping: 15, delay: 0.3 }}
          >
            {/* Outer Ambient Glow Behind Container */}
            <div className="absolute inset-0 bg-[#39FF14]/15 dark:bg-[#39FF14]/8 rounded-[2.5rem] blur-[60px] pointer-events-none scale-[1.03]" />

            {/* Premium Rounded Card Wrapper with Edge Glow */}
            <div className="relative w-full max-w-[34rem] aspect-[6/5] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border border-zinc-200 dark:border-zinc-800/60 shadow-[0_0_40px_rgba(57,255,20,0.1),0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_0_60px_rgba(57,255,20,0.12),0_20px_50px_rgba(0,0,0,0.8)] group bg-zinc-100 dark:bg-zinc-950">

              {/* High-quality Arena Image */}
              <img
                src={heroImage}
                alt="Shri Trimurti Sports Arena premium sports facility"
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
              />

              {/* Card Dark Gradient Overlay (Only at the bottom to contrast the floating card) */}
              <div className="absolute bottom-0 left-0 right-0 h-2/5 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300" />

              {/* Floating Information Card — Facility Highlight */}
              <div className="absolute bottom-2 left-2 right-2 sm:bottom-6 sm:left-6 sm:right-6 p-2.5 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] bg-black/70 border border-white/15 backdrop-blur-xl shadow-2xl flex items-center justify-between gap-2 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="w-7 h-7 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-[#39FF14]/15 border border-[#39FF14]/25 flex items-center justify-center shrink-0">
                    <Trophy className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#39FF14]" />
                  </div>
                  <div>
                    <span className="text-[8px] sm:text-xs uppercase tracking-widest text-[#39FF14] font-bold">
                      Premium Facility
                    </span>
                    <h4 className="text-white text-[10px] sm:text-sm font-semibold mt-0">
                      Cricket • Football
                    </h4>
                  </div>
                </div>
                
                {/* Open Now Pulse Pill */}
                <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#39FF14] animate-pulse" />
                  <span className="text-[10px] text-white/70 font-semibold tracking-wider uppercase">
                    Open Now
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>

      {/* Smooth bottom transition to resolve any seams */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-background pointer-events-none z-10" />
    </section>
  );
}
