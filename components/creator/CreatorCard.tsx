"use client";

import { Creator } from "@/types/creator";
import Waveform from "@/components/audio/Waveform";

export default function CreatorCard({
  creator,
}: {
  creator: Creator;
}) {
  function handlePreview() {
    if (creator.intro_audio) {
      const audio = new Audio(creator.intro_audio);
      audio.play();
      return;
    }

    alert("Preview audio will be added soon.");
  }

  function handleStartChat() {
    alert(`Starting chat with ${creator.display_name} soon.`);
  }

  return (
    <div className="bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">
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

      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="text-2xl font-bold">
              {creator.display_name}
            </h2>

            <p className="text-zinc-400 text-sm mt-1">
              {creator.bio}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {creator.tags?.map((tag) => (
            <span
              key={tag}
              className="bg-zinc-800 px-3 py-1 rounded-full text-xs text-zinc-300"
            >
              #{tag}
            </span>
          ))}
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
            onClick={handlePreview}
            className="rounded-2xl bg-zinc-800 py-3 text-sm font-semibold hover:bg-zinc-700 transition"
          >
            ▶ Preview
          </button>

          <button
            onClick={handleStartChat}
            className="rounded-2xl bg-white text-black py-3 text-sm font-semibold hover:bg-zinc-200 transition"
          >
            Start chat
          </button>
        </div>
      </div>
    </div>
  );
}