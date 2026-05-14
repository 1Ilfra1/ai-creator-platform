"use client";

import { useRef, useState } from "react";
import Waveform from "@/components/audio/Waveform";

export default function AudioPlayer({
  audioUrl,
}: {
  audioUrl: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

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
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3 mt-3">
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex items-center justify-between gap-4">
        <button
          onClick={toggleAudio}
          className="bg-white text-black rounded-full w-9 h-9 text-sm font-bold"
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>

        <div className="flex-1">
          <Waveform />
        </div>
      </div>
    </div>
  );
}