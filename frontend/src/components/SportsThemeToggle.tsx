import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/ThemeProvider";

interface SportsThemeToggleProps {
  className?: string;
  size?: "sm" | "md";
}

export default function SportsThemeToggle({ className = "", size = "md" }: SportsThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const isSmall = size === "sm";
  const trackWidth = isSmall ? 50 : 58;
  const trackHeight = isSmall ? 26 : 30;
  const ballSize = isSmall ? 20 : 24;
  const travelDistance = trackWidth - ballSize - 4; // padding offset

  const handleClick = (e: React.MouseEvent) => {
    toggleTheme(e);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle sports stadium theme"
      title={isDark ? "⚽ Kick off: Switch to Day Match (Light Mode)" : "🎾 Serve: Switch to Floodlit Night Match (Dark Mode)"}
      onClick={handleClick}
      className={`relative inline-flex items-center rounded-full p-[2px] transition-all duration-500 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#39FF14] ${
        isDark
          ? "bg-gradient-to-r from-[#05140b] via-[#0b2414] to-[#041008] border border-[#39FF14]/35 shadow-[0_0_14px_-2px_rgba(57,255,20,0.3)]"
          : "bg-gradient-to-r from-[#10b981] via-[#059669] to-[#047857] border border-emerald-500/50 shadow-[0_2px_10px_rgba(16,185,129,0.25)]"
      } ${className}`}
      style={{
        width: `${trackWidth}px`,
        height: `${trackHeight}px`,
      }}
    >
      {/* Turf Field Pitch Markings Background */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none rounded-full overflow-hidden"
        viewBox="0 0 58 30"
        preserveAspectRatio="none"
      >
        {/* Halfway Line */}
        <line
          x1="29"
          y1="2"
          x2="29"
          y2="28"
          stroke="#ffffff"
          strokeWidth="0.8"
          strokeDasharray="1.5 1.5"
          opacity={isDark ? "0.2" : "0.35"}
        />
        {/* Center Circle */}
        <circle
          cx="29"
          cy="15"
          r="6.5"
          fill="none"
          stroke="#ffffff"
          strokeWidth="0.8"
          opacity={isDark ? "0.2" : "0.35"}
        />
        {/* Pitch boundary inner border glow */}
        <rect
          x="1"
          y="1"
          width="56"
          height="28"
          rx="14"
          fill="none"
          stroke={isDark ? "#39FF14" : "#ffffff"}
          strokeWidth="0.5"
          opacity={isDark ? "0.25" : "0.3"}
        />
        {/* Night floodlight sparkles in dark mode */}
        {isDark ? (
          <>
            <circle cx="10" cy="8" r="0.8" fill="#ffffff" opacity="0.6" />
            <circle cx="14" cy="22" r="0.6" fill="#39FF14" opacity="0.7" />
            <circle cx="48" cy="8" r="0.7" fill="#39FF14" opacity="0.7" />
          </>
        ) : (
          /* Day sun warm highlight */
          <circle cx="48" cy="15" r="4" fill="#fde047" opacity="0.25" />
        )}
      </svg>

      {/* The Animated Rolling Sports Ball */}
      <motion.div
        className="relative z-10 flex items-center justify-center rounded-full will-change-transform"
        style={{
          width: `${ballSize}px`,
          height: `${ballSize}px`,
        }}
        initial={false}
        animate={{
          x: isDark ? travelDistance : 0,
          rotate: isDark ? 360 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 420,
          damping: 24,
          mass: 0.8,
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.88 }}
      >
        {isDark ? (
          /* ======================================================== */
          /* NIGHT MATCH: 3D CLASSIC FOOTBALL (SOCCER BALL ⚽)        */
          /* ======================================================== */
          <svg
            viewBox="0 0 24 24"
            className="w-full h-full drop-shadow-[0_2px_5px_rgba(0,0,0,0.65)]"
          >
            <defs>
              <radialGradient id="footballShade" cx="30%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="65%" stopColor="#f1f5f9" />
                <stop offset="100%" stopColor="#94a3b8" />
              </radialGradient>
            </defs>
            {/* Outer Sphere */}
            <circle
              cx="12"
              cy="12"
              r="11"
              fill="url(#footballShade)"
              stroke="#334155"
              strokeWidth="0.7"
            />
            {/* Center Dark Pentagon */}
            <polygon
              points="12,7 16,9.8 14.5,14.8 9.5,14.8 8,9.8"
              fill="#1e293b"
            />
            {/* Seams Radiating from Center */}
            <line x1="12" y1="7" x2="12" y2="1.5" stroke="#1e293b" strokeWidth="0.85" />
            <line x1="16" y1="9.8" x2="21.5" y2="7.8" stroke="#1e293b" strokeWidth="0.85" />
            <line x1="14.5" y1="14.8" x2="18.5" y2="20.2" stroke="#1e293b" strokeWidth="0.85" />
            <line x1="9.5" y1="14.8" x2="5.5" y2="20.2" stroke="#1e293b" strokeWidth="0.85" />
            <line x1="8" y1="9.8" x2="2.5" y2="7.8" stroke="#1e293b" strokeWidth="0.85" />
            {/* Edge Patches */}
            <polygon points="12,1.5 13.8,1 10.2,1" fill="#1e293b" />
            <polygon points="21.5,7.8 22.8,10 22.2,6" fill="#1e293b" />
            <polygon points="18.5,20.2 19.8,21.6 17,22.2" fill="#1e293b" />
            <polygon points="5.5,20.2 4.2,21.6 7,22.2" fill="#1e293b" />
            <polygon points="2.5,7.8 1.2,10 1.8,6" fill="#1e293b" />
          </svg>
        ) : (
          /* ======================================================== */
          /* DAY MATCH: CHAMPIONSHIP TENNIS / CRICKET BALL (🎾)       */
          /* ======================================================== */
          <svg
            viewBox="0 0 24 24"
            className="w-full h-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]"
          >
            <defs>
              <radialGradient id="tennisFeltShade" cx="30%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#facc15" />
                <stop offset="50%" stopColor="#ccff00" />
                <stop offset="95%" stopColor="#84cc16" />
                <stop offset="100%" stopColor="#65a30d" />
              </radialGradient>
            </defs>
            {/* Ball Sphere */}
            <circle
              cx="12"
              cy="12"
              r="11"
              fill="url(#tennisFeltShade)"
              stroke="#4d7c0f"
              strokeWidth="0.6"
            />
            {/* Curved White Seam Lines */}
            <path
              d="M 6.2 3.8 C 10.8 7.5, 10.8 16.5, 6.2 20.2"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M 17.8 3.8 C 13.2 7.5, 13.2 16.5, 17.8 20.2"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        )}
      </motion.div>
    </button>
  );
}
