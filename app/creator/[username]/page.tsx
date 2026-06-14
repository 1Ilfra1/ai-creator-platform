"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/services/analytics";

import AudioPlayer from "@/components/audio/AudioPlayer";

import BottomNav from "@/components/navigation/BottomNav";

interface Creator {
    id: string;
    username: string;
    display_name: string;
    tagline: string | null;
    bio: string | null;
    tags: string[] | null;
    topics: string[] | null;
    profile_image: string | null;
    banner_image: string | null;
    intro_audio: string | null;
}

export default function CreatorProfilePage({
    params,
}: {
    params: Promise<{ username: string }>
}) {

    const { username } = use(params);
    const router = useRouter();

    const [creator, setCreator] = useState<Creator | null>(null);

    const [loading, setLoading] = useState(true);

    const [showFullBio, setShowFullBio] = useState(false);
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
    const [showBackButton, setShowBackButton] = useState(false);

    useEffect(() => {

        async function loadCreator() {

            const { data } = await supabase
                .from("public_creators")
                .select("id, username, display_name, tagline, bio, tags, topics, profile_image, banner_image, intro_audio, is_active, is_published")
                .eq("username", username)
                .eq("is_active", true)
                .eq("is_published", true)
                .single();

            setCreator(data);
            if (data) {
                trackEvent({
                    eventType: "creator_profile_opened",
                    entityType: "creator",
                    entityId: data.id,
                    metadata: {
                        username: data.username,
                    },
                });
            }
            setLoading(false);
        }

        loadCreator();

    }, [username]);

    useEffect(() => {
        if (!document.referrer) return;

        try {
            const referrerUrl = new URL(document.referrer);

            setShowBackButton(referrerUrl.origin === window.location.origin);
        } catch {
            setShowBackButton(false);
        }
    }, []);

    if (loading) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center">
                Loading creator...
            </main>
        );
    }

    if (!creator) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center">
                <div className="max-w-sm">
                    <h1 className="text-2xl font-bold mb-3">
                        Creator profile is not available
                    </h1>

                    <p className="text-zinc-500 mb-6">
                        This creator may not be published yet, or the link may be incorrect.
                    </p>

                    <button
                        onClick={() => router.push("/")}
                        className="w-full bg-white text-black py-4 rounded-3xl font-bold"
                    >
                        Explore creators
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-black text-white pb-24">

            <div className="relative h-64 bg-gradient-to-br from-purple-900/70 via-zinc-900 to-black">
                {showBackButton && (
                    <button
                        onClick={() => router.back()}
                        className="absolute left-4 top-4 z-20 h-10 w-10 rounded-full bg-black/70 text-white border border-white/10 backdrop-blur flex items-center justify-center"
                        aria-label="Go back"
                    >
                        ←
                    </button>
                )}

                {creator.banner_image && (
                    <img
                        src={creator.banner_image}
                        alt={creator.display_name}
                        className="absolute inset-0 h-full w-full object-cover"
                    />
                )}
                <div className="absolute inset-0 bg-black/40" />

            </div>

            <div className="px-6 pb-20 max-w-3xl mx-auto">

                <div className="-mt-20 mb-6 relative z-10">

                    <div className="w-32 h-32 rounded-full border-4 border-black bg-zinc-800 overflow-hidden flex items-center justify-center text-5xl">

                        {creator.profile_image ? (
                            <img
                                src={creator.profile_image}
                                alt={creator.display_name}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            "👤"
                        )}

                    </div>

                </div>

                <div className="flex items-center gap-3 mb-3">

                    <h1 className="text-3xl font-bold">
                        {creator.display_name}
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">
                        @{creator.username}
                    </p>

                </div>

                <div className="mb-5">
                    <p className="text-zinc-300 leading-relaxed text-lg">
                        {showFullBio
                            ? creator.bio || creator.tagline
                            : (creator.bio || creator.tagline || "").slice(0, 130)}
                        {!showFullBio &&
                            (creator.bio || creator.tagline || "").length > 130 &&
                            "..."}
                    </p>

                    {(creator.bio || creator.tagline || "").length > 130 && (
                        <button
                            onClick={() => setShowFullBio((prev) => !prev)}
                            className="text-sm text-zinc-500 mt-2 hover:text-zinc-300 transition"
                        >
                            {showFullBio ? "Show less" : "Show more"}
                        </button>
                    )}
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 mb-6">

                    <div className="flex items-center justify-between mb-4">

                        <div>
                            <h2 className="font-semibold">
                                Voice intro 💜
                            </h2>
                        </div>

                        <div className="w-3 h-3 rounded-full bg-green-500" />

                    </div>

                    {creator.intro_audio ? (
                        <AudioPlayer audioUrl={creator.intro_audio} />
                    ) : (
                        <p className="text-sm text-zinc-500">
                            No intro yet
                        </p>
                    )}

                </div>

                <button
                    onClick={() => {
                        trackEvent({
                            eventType: "creator_profile_start_chat_clicked",
                            entityType: "creator",
                            entityId: creator.id,
                            metadata: {
                                username: creator.username,
                            },
                        });
                        router.push(`/chat/${creator.username}`);
                    }}
                    className="w-full bg-white text-black py-4 rounded-3xl font-bold text-lg shadow-2xl active:scale-[0.99] transition"
                >
                    Talk to me 💜
                </button>

                <button
                    onClick={async () => {
                        try {
                            await navigator.clipboard.writeText(window.location.href);
                            setCopyStatus("copied");
                            trackEvent({
                                eventType: "creator_profile_shared",
                                entityType: "creator",
                                entityId: creator.id,
                                metadata: {
                                    source: "public_creator_profile",
                                },
                            });
                        } catch (error) {
                            console.error("Failed to copy creator link:", error);
                            setCopyStatus("failed");
                        }

                        window.setTimeout(() => {
                            setCopyStatus("idle");
                        }, 2000);
                    }}
                    className={`w-full mt-3 border py-4 rounded-3xl font-semibold transition ${copyStatus === "copied"
                        ? "bg-green-500 border-green-500 text-black"
                        : copyStatus === "failed"
                            ? "bg-red-500 border-red-500 text-white"
                            : "bg-zinc-900 border-zinc-800 text-white"
                        }`}
                >
                    {copyStatus === "copied"
                        ? "Copied ✓"
                        : copyStatus === "failed"
                            ? "Copy failed"
                            : "Share profile"}
                </button>

            </div>
            <BottomNav />
        </main>
    );
}
