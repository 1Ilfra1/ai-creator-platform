"use client";

import { PublicCreator } from "@/types/creator";
import { trackEvent } from "@/services/analytics";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreatorCard({
  creator,
}: {
  creator: PublicCreator;
}) {
  const router = useRouter();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [previewStarted, setPreviewStarted] = useState(false);

  async function handlePreview() {
    if (!creator.intro_audio) return;

    const audio = new Audio(creator.intro_audio);
    audio.onplay = () => setPreviewStarted(true);
    audio.onended = () => setPreviewStarted(true);

    try {
      await audio.play();
      setPreviewStarted(true);
    } catch (error) {
      console.error("Failed to play creator intro:", error);
    }
  }

  function openProfile() {
    router.push(`/creator/${creator.username}`);
  }

  function handleStartChat() {
    trackEvent({
      eventType: "creator_profile_start_chat_clicked",
      entityType: "creator",
      entityId: creator.id,
      metadata: {
        source: "creator_card",
        username: creator.username,
      },
    });

    router.push(`/chat/${creator.username}`);
  }

  async function handleShare() {
    const link = `${window.location.origin}/creator/${creator.username}`;

    try {
      await navigator.clipboard.writeText(link);
      setCopyStatus("copied");
      trackEvent({
        eventType: "creator_profile_shared",
        entityType: "creator",
        entityId: creator.id,
        metadata: {
          source: "creator_card",
        },
      });
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
      <div className="relative h-44 bg-gradient-to-br from-purple-900/60 via-zinc-800 to-black">
        {creator.banner_image && (
          <img
            src={creator.banner_image}
            alt={`${creator.display_name} banner`}
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
        )}

        <div className="absolute left-4 -bottom-10 w-24 h-24 rounded-full bg-zinc-800/90 border-4 border-zinc-900 flex items-center justify-center text-3xl shadow-xl">
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

      <div className="px-4 pb-4 pt-12">
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
              disabled={!creator.intro_audio}
              className="rounded-2xl bg-zinc-800 py-3 text-xs font-semibold hover:bg-zinc-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {creator.intro_audio ? "Play voice" : "No intro"}
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
            className={`w-full rounded-2xl py-4 text-sm font-bold transition ${
              previewStarted
                ? "bg-green-500 text-black hover:bg-green-400"
                : "bg-white text-black hover:bg-zinc-200"
            }`}
          >
            {previewStarted ? "Start chat now" : "Start chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
