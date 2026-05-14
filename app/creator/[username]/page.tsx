"use client";

import { use, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

import AudioPlayer from "@/components/audio/AudioPlayer";

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

    const [creator, setCreator] = useState<Creator | null>(null);

    useEffect(() => {

        async function loadCreator() {

            const { data } = await supabase
                .from("creators")
                .select("*")
                .eq("username", username)
                .single();

            setCreator(data);
        }

        loadCreator();

    }, [username]);

    if (!creator) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center">
                Loading creator...
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-black text-white">

            <div className="relative h-64 bg-gradient-to-br from-purple-900/70 via-zinc-900 to-black">

                {creator.banner_image && (
                    <img
                        src={creator.banner_image}
                        alt={creator.display_name}
                        className="absolute inset-0 h-full w-full object-cover"
                    />
                )}

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

                <p className="text-zinc-300 leading-relaxed mb-4 text-lg">
                    {creator.tagline}
                </p>



                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 mb-6">

                    <div className="flex items-center justify-between mb-4">

                        <div>
                            <h2 className="font-semibold">
                                Voice Preview
                            </h2>

                            <p className="text-sm text-zinc-500">
                                Listen before chatting
                            </p>
                        </div>

                        <div className="w-3 h-3 rounded-full bg-green-500" />

                    </div>

                    <AudioPlayer
                        audioUrl={creator.intro_audio || "/mock-voice.mp3"}
                    />

                </div>

                <button
                    onClick={() => {
                        window.location.href = `/chat/${creator.username}`;
                    }}
                    className="w-full bg-white text-black py-4 rounded-3xl font-bold text-lg"
                >
                    Start chatting
                </button>

            </div>

        </main>
    );
}