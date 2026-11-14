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

  // Generate unique ID per instance to prevent Android Chrome duplicate SVG ID conflicts
  const reactId = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const footballShadeId = `football-shade-${reactId}`;
  const tennisShadeId = `tennis-shade-${reactId}`;

  const isSmall = size === "sm";
  const trackWidth = isSmall ? 52 : 60;
  const trackHeight = isSmall ? 28 : 32;
  const ballSize = isSmall ? 22 : 26;
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
      className={`relative inline-flex items-center rounded-full p-[2px] transition-colors duration-300 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#39FF14] ${
        isDark
          ? "bg-[#082012] border-2 border-[#39FF14] shadow-[0_0_12px_rgba(57,255,20,0.35)]"
          : "bg-[#059669] border-2 border-emerald-300 shadow-[0_2px_8px_rgba(5,150,105,0.35)]"
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
          strokeWidth="1"
          strokeDasharray="2 2"
          opacity={isDark ? "0.45" : "0.55"}
        />
        {/* Center Circle */}
        <circle
          cx="29"
          cy="15"
          r="7"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1"
          opacity={isDark ? "0.45" : "0.55"}
        />
        {/* Pitch boundary inner border */}
        <rect
          x="1.5"
          y="1.5"
          width="55"
          height="27"
          rx="13.5"
          fill="none"
          stroke={isDark ? "#39FF14" : "#ffffff"}
          strokeWidth="0.8"
          opacity={isDark ? "0.4" : "0.45"}
        />
        {/* Night floodlight sparkles in dark mode */}
        {isDark ? (
          <>
            <circle cx="10" cy="8" r="0.9" fill="#ffffff" opacity="0.8" />
            <circle cx="13" cy="22" r="0.7" fill="#39FF14" opacity="0.9" />
            <circle cx="48" cy="8" r="0.8" fill="#39FF14" opacity="0.9" />
          </>
        ) : (
          /* Day warm sunshine highlight */
          <circle cx="48" cy="15" r="4.5" fill="#fde047" opacity="0.4" />
        )}
      </svg>

      {/* The Animated Rolling Sports Ball */}
      <motion.div
        className="relative z-10 flex items-center justify-center rounded-full will-change-transform shadow-md"
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
        whileTap={{ scale: 0.9 }}
      >
        {isDark ? (
          /* ======================================================== */
          /* NIGHT MATCH: 3D CLASSIC FOOTBALL (SOCCER BALL ⚽)        */
          /* ======================================================== */
          <svg
            viewBox="0 0 24 24"
            className="w-full h-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]"
          >
            <defs>
              <radialGradient id={footballShadeId} cx="32%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="65%" stopColor="#f1f5f9" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </radialGradient>
            </defs>

            {/* Base solid sphere (100% opaque on Android) */}
            <circle cx="12" cy="12" r="11" fill="#ffffff" />
            {/* Shaded sphere overlay */}
            <circle
              cx="12"
              cy="12"
              r="11"
              fill={`url(#${footballShadeId})`}
              stroke="#0f172a"
              strokeWidth="0.8"
            />

            {/* Center Dark Pentagon */}
            <polygon
              points="12,6.8 16.2,9.8 14.6,15 9.4,15 7.8,9.8"
              fill="#0f172a"
            />

            {/* Seams Radiating from Center Pentagon */}
            <line x1="12" y1="6.8" x2="12" y2="1.2" stroke="#0f172a" strokeWidth="1" strokeLinecap="round" />
            <line x1="16.2" y1="9.8" x2="21.8" y2="7.8" stroke="#0f172a" strokeWidth="1" strokeLinecap="round" />
            <line x1="14.6" y1="15" x2="18.8" y2="20.5" stroke="#0f172a" strokeWidth="1" strokeLinecap="round" />
            <line x1="9.4" y1="15" x2="5.2" y2="20.5" stroke="#0f172a" strokeWidth="1" strokeLinecap="round" />
            <line x1="7.8" y1="9.8" x2="2.2" y2="7.8" stroke="#0f172a" strokeWidth="1" strokeLinecap="round" />

            {/* Edge Pentagons */}
            <polygon points="12,1.2 14,0.8 10,0.8" fill="#0f172a" />
            <polygon points="21.8,7.8 23,10 22.4,5.8" fill="#0f172a" />
            <polygon points="18.8,20.5 20.2,22 17.2,22.6" fill="#0f172a" />
            <polygon points="5.2,20.5 3.8,22 6.8,22.6" fill="#0f172a" />
            <polygon points="2.2,7.8 1,10 1.6,5.8" fill="#0f172a" />
          </svg>
        ) : (
          /* ======================================================== */
          /* DAY MATCH: CHAMPIONSHIP TENNIS / CRICKET BALL (🎾)       */
          /* ======================================================== */
          <svg
            viewBox="0 0 24 24"
            className="w-full h-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
          >
            <defs>
              <radialGradient id={tennisShadeId} cx="32%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="45%" stopColor="#d9f99d" />
                <stop offset="85%" stopColor="#a3e635" />
                <stop offset="100%" stopColor="#65a30d" />
              </radialGradient>
            </defs>

            {/* Base solid sphere (100% bright vibrant opaque felt on Android) */}
            <circle cx="12" cy="12" r="11" fill="#ccff00" />
            {/* Shaded sphere overlay */}
            <circle
              cx="12"
              cy="12"
              r="11"
              fill={`url(#${tennisShadeId})`}
              stroke="#3f6212"
              strokeWidth="0.8"
            />

            {/* Thick Crisp White Seam Lines */}
            <path
              d="M 6.2 3.6 C 11.2 7.4, 11.2 16.6, 6.2 20.4"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M 17.8 3.6 C 12.8 7.4, 12.8 16.6, 17.8 20.4"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </motion.div>
    </button>
  );
}
