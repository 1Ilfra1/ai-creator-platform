"use client";

import { useEffect, useRef, useState } from "react";
import Waveform from "@/components/audio/Waveform";

export default function AudioPlayer({
  audioUrl,
  autoPlay = false,
}: {
  audioUrl: string;
  autoPlay?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  useEffect(() => {
  if (autoPlay && audioRef.current) {
    audioRef.current.play();
    setIsPlaying(true);
  }
}, [autoPlay]);

  function toggleAudio() {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    audioRef.current.play();
    setIsPlaying(true);
  }

  return (
    <div className="w-[230px] max-w-full bg-zinc-950/80 border border-zinc-800 rounded-3xl px-3 py-2 mt-3 backdrop-blur">
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={toggleAudio}
          className={`rounded-full w-10 h-10 text-sm font-bold transition-all duration-200 ${isPlaying
            ? "bg-green-500 text-black scale-105"
            : "bg-white text-black hover:scale-105"
            }`}
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>

        <div className="flex-1 overflow-hidden">
          <Waveform isPlaying={isPlaying} />
        </div>
      </div>
    </div>
  );
}