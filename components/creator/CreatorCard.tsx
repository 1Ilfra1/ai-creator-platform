"use client";

import { PublicCreator } from "@/types/creator";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreatorCard({
  creator,
}: {
  creator: PublicCreator;
}) {
  const router = useRouter();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

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

  async function handleShare() {
    const link = `${window.location.origin}/creator/${creator.username}`;

    try {
      await navigator.clipboard.writeText(link);
      setCopyStatus("copied");
    } catch (error) {
      console.error("Failed to copy creator link:", error);
      setCopyStatus("failed");
    }

    window.setTimeout(() => {
      setCopyStatus("idle");
    }, 2000);
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

      <div className="p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">
            {creator.display_name}
          </h2>

          <span className="text-zinc-500 text-sm">
            @{creator.username}
          </span>
        </div>

        <p className="text-zinc-300 text-sm mt-3 line-clamp-2">
          {creator.tagline || creator.bio}
        </p>

        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openProfile();
              }}
              className="rounded-2xl bg-zinc-800 py-3 text-xs font-semibold hover:bg-zinc-700 transition"
            >
              View profile
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePreview();
              }}
              className="rounded-2xl bg-zinc-800 py-3 text-xs font-semibold hover:bg-zinc-700 transition"
            >
              ▶ Voice
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }}
              className={`rounded-2xl py-3 text-xs font-semibold transition ${copyStatus === "copied"
                ? "bg-green-500 text-black"
                : copyStatus === "failed"
                  ? "bg-red-500 text-white"
                  : "bg-zinc-800 hover:bg-zinc-700"
                }`}
            >
              {copyStatus === "copied"
                ? "Copied ✓"
                : copyStatus === "failed"
                  ? "Copy failed"
                  : "Share"}
            </button>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleStartChat();
            }}
            className="w-full rounded-2xl bg-white text-black py-4 text-sm font-bold hover:bg-zinc-200 transition"
          >
            Start chat
          </button>
        </div>
      </div>
    </div>
  );
}
