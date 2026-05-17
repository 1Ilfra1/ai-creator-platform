"use client";

import { motion } from "framer-motion";

export default function Waveform({
  isPlaying,
}: {
  isPlaying: boolean;
}) {
  const bars = [
    10, 18, 26, 14, 30, 20, 12, 24, 15, 28,
    16, 22, 11, 27, 19, 30, 13, 25, 17, 23,
    12, 29, 18, 21, 14, 26, 16, 24,
  ];
  return (
    <div className="w-full flex items-end justify-between h-8 overflow-hidden">
      {bars.map((height, index) => (
        <motion.div
          key={index}
          className="w-[3px] rounded-full bg-gradient-to-t from-fuchsia-500 to-purple-300"
          style={{
            height,
            boxShadow: isPlaying
              ? "0 0 8px rgba(192, 132, 252, 0.45)"
              : "none",
          }}
          animate={
            isPlaying
              ? {
                scaleY: [0.45, 1, 0.55, 1],
                opacity: [0.45, 1, 0.65, 1],
              }
              : {
                scaleY: 1,
                opacity: 0.5,
              }
          }
          transition={{
            duration: 0.8,
            repeat: isPlaying ? Infinity : 0,
            delay: index * 0.035,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}