"use client";

import { Creator } from "@/types/creator";
import Waveform from "@/components/audio/Waveform";
import { useRouter } from "next/navigation";


export default function CreatorCard({
  creator,
}: {
  creator: Creator;
}) {
  const router = useRouter();
  function handlePreview() {
    const audio = new Audio(creator.intro_audio || "/mock-voice.mp3");
    audio.play();
  }
  function openProfile() {
    router.push(`/creator/${creator.username}`);
  }
  function handleStartChat() {
    router.push(`/chat/${creator.username}`);
  }

  return (
    <div
      onClick={openProfile}
      className="bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl cursor-pointer"
    >
      <div className="relative h-44 bg-gradient-to-br from-purple-900/60 via-zinc-800 to-black flex items-center justify-center">
        {creator.banner_image && (
          <img
            src={creator.banner_image}
            alt={`${creator.display_name} banner`}
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
        )}

        <div className="relative w-24 h-24 rounded-full bg-zinc-800/90 border border-zinc-600 flex items-center justify-center text-3xl shadow-xl">
          {creator.profile_image ? (
            <img
              src={creator.profile_image}
              alt={creator.display_name}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span>👤</span>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold">
          {creator.display_name}
        </h2>

        <p className="text-zinc-500 text-sm mt-1">
          @{creator.username}
        </p>

        <p className="text-zinc-300 text-sm mt-3">
          {creator.tagline || creator.bio}
        </p>
      </div>


      <div className="bg-black/40 border border-zinc-800 rounded-2xl p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            Voice preview
          </p>
          <p className="text-xs text-zinc-500">
            Listen before starting
          </p>
        </div>

        <Waveform />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePreview();
          }}
          className="rounded-2xl bg-zinc-800 py-3 text-sm font-semibold hover:bg-zinc-700 transition"
        >
          ▶ Preview
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleStartChat();
          }}
          className="rounded-2xl bg-white text-black py-3 text-sm font-semibold hover:bg-zinc-200 transition"
        >
          Start chat
        </button>
      </div>
     </div>
  );
}