"use client";

import { useEffect, useState } from "react";

import ProtectedRoute from "@/components/ProtectedRoute";

import { supabase } from "@/lib/supabase";

export default function DashboardPage() {

    const [loading, setLoading] = useState(true);

    const [creatorId, setCreatorId] = useState<string | null>(null);
    const [isPublished, setIsPublished] = useState(false);
    const [username, setUsername] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [profileImage, setProfileImage] = useState("");
    const [bannerImage, setBannerImage] = useState("");
    const [introAudio, setIntroAudio] = useState("");
    const [uploadingAudio, setUploadingAudio] = useState(false);
    const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
    const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
    const [tagline, setTagline] = useState("");
    const [personalityPrompt, setPersonalityPrompt] = useState("");

    useEffect(() => {

        async function loadCreator() {

            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) return;

            const { data } = await supabase
                .from("creators")
                .select("*")
                .eq("user_id", user.id)
                .maybeSingle();

            let creator = data;

            if (!creator) {

                const emailPrefix =
                    user.email?.split("@")[0] || "creator";

                const generatedUsername =
                    `${emailPrefix}-${Math.floor(Math.random() * 10000)}`;

                const { data: newCreator, error } = await supabase
                    .from("creators")
                    .insert({
                        user_id: user.id,
                        username: generatedUsername,
                        display_name: "New Creator",
                        tagline: "Creator description",
                    })
                    .select()
                    .single();

                if (error) {
                    console.error(error);
                    return;
                }

                creator = newCreator;
            }

            if (creator) {

                setCreatorId(creator.id);

                setUsername(creator.username || "");
                setDisplayName(creator.display_name || "");
                setTagline(creator.tagline || "");
                setPersonalityPrompt(
                    creator.personality_prompt || ""
                );
                setIsPublished(creator.is_published || false);
                setProfileImage(creator.profile_image || "");
                setBannerImage(creator.banner_image || "");
                setIntroAudio(creator.intro_audio || "");
            }

            if (data) {
                setCreatorId(data.id);

                setUsername(data.username || "");
                setDisplayName(data.display_name || "");
                setTagline(data.tagline || "");
                setPersonalityPrompt(data.personality_prompt || "");
            }

            setLoading(false);
        }

        loadCreator();

    }, []);

    async function uploadIntroAudio(
        event: React.ChangeEvent<HTMLInputElement>
    ) {
        const file = event.target.files?.[0];

        if (!file || !creatorId) return;

        try {
            setUploadingAudio(true);

            const fileExt = file.name.split(".").pop();

            const fileName =
                `${creatorId}-${Date.now()}.${fileExt}`;

            const { error } = await supabase.storage
                .from("creator-intros")
                .upload(fileName, file, {
                    upsert: true,
                });

            if (error) {
                console.error(error);
                alert("Failed to upload audio.");
                return;
            }

            const { data } = supabase.storage
                .from("creator-intros")
                .getPublicUrl(fileName);

            setIntroAudio(data.publicUrl);

        } catch (error) {
            console.error(error);
            alert("Upload failed.");
        } finally {
            setUploadingAudio(false);
        }
    }

    async function uploadCreatorAsset(
        event: React.ChangeEvent<HTMLInputElement>,
        type: "profile" | "banner"
    ) {
        const file = event.target.files?.[0];

        if (!file || !creatorId) return;

        try {
            if (type === "profile") {
                setUploadingProfileImage(true);
            } else {
                setUploadingBannerImage(true);
            }

            const fileExt = file.name.split(".").pop();
            const fileName = `${creatorId}-${type}-${Date.now()}.${fileExt}`;

            const { error } = await supabase.storage
                .from("creator-assets")
                .upload(fileName, file, {
                    upsert: true,
                });

            if (error) {
                console.error(error);
                alert("Failed to upload image.");
                return;
            }

            const { data } = supabase.storage
                .from("creator-assets")
                .getPublicUrl(fileName);

            if (type === "profile") {
                setProfileImage(data.publicUrl);
            } else {
                setBannerImage(data.publicUrl);
            }
        } catch (error) {
            console.error(error);
            alert("Upload failed.");
        } finally {
            setUploadingProfileImage(false);
            setUploadingBannerImage(false);
        }
    }

    async function publishProfile() {

        if (!creatorId) return;

        const { error } = await supabase
            .from("creators")
            .update({
                is_published: true,
            })
            .eq("id", creatorId);

        if (error) {
            console.error(error);
            alert("Failed to publish profile.");
            return;
        }

        setIsPublished(true);

        alert("Profile published!");
    }

    async function saveProfile() {

        if (!creatorId) return;

        const { error } = await supabase
            .from("creators")
            .update({
                username,
                display_name: displayName,
                tagline,
                personality_prompt: personalityPrompt,
                profile_image: profileImage,
                banner_image: bannerImage,
                intro_audio: introAudio,
            })
            .eq("id", creatorId);

        if (error) {
            console.error(error);
            alert("Failed to save profile.");
            return;
        }

        alert("Profile updated!");
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center">
                Loading dashboard...
            </main>
        );
    }

    return (
        <ProtectedRoute>

            <main className="min-h-screen bg-black text-white p-6 max-w-2xl mx-auto pb-24">

                <h1 className="text-3xl font-bold mb-2">
                    Creator Dashboard
                </h1>

                <p className="text-zinc-500 mb-8">
                    Manage your creator identity and AI presence.
                </p>

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden mb-8">
                    <div className="h-40 bg-gradient-to-br from-purple-900/60 via-zinc-800 to-black relative">
                        {bannerImage && (
                            <img
                                src={bannerImage}
                                alt="Banner preview"
                                className="absolute inset-0 h-full w-full object-cover"
                            />
                        )}
                    </div>

                    <div className="p-5">
                        <div className="-mt-12 mb-4 relative z-10">
                            <div className="w-24 h-24 rounded-full bg-zinc-800 border-4 border-zinc-900 overflow-hidden flex items-center justify-center text-3xl">
                                {profileImage ? (
                                    <img
                                        src={profileImage}
                                        alt="Profile preview"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    "👤"
                                )}
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold">
                            {displayName || "New Creator"}
                        </h2>

                        <p className="text-zinc-500 text-sm mt-1">
                            @{username || "username"}
                        </p>

                        <p className="text-zinc-300 text-sm mt-4">
                            {tagline || "Your creator description will appear here."}
                        </p>

                        {introAudio && (
                            <button
                                onClick={() => {
                                    const audio = new Audio(introAudio);
                                    audio.play();
                                }}
                                className="mt-5 rounded-2xl bg-white text-black px-4 py-3 text-sm font-semibold"
                            >
                                ▶ Preview intro audio
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-6">

                    <div>
                        <label className="block text-sm mb-2">
                            Username
                        </label>

                        <input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none"
                            placeholder="luna"
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-2">
                            Display name
                        </label>

                        <input
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none"
                            placeholder="Luna"
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-2">
                            Creator description
                        </label>

                        <textarea
                            value={tagline}
                            onChange={(e) => setTagline(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none h-28 resize-none"
                            placeholder="Voice notes, cozy chats, and meaningful conversations."
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-2">
                            Creator vibe & style
                            <span className="text-zinc-500 font-normal">
                                {" "}— hidden from fans
                            </span>
                        </label>

                        <p className="text-xs text-zinc-500 mb-2">
                            Shape how your AI presence talks: tone, catchphrases, fan nicknames, energy, and conversation style.
                        </p>

                        <p className="text-xs text-zinc-500 mb-2">
                            ⚠️ This shapes how your AI starts conversations. Fans will not see this text.
                        </p>

                        <textarea
                            value={personalityPrompt}
                            onChange={(e) => setPersonalityPrompt(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none h-40 resize-none"
                            placeholder={`Example:
                        I call my community “sloniki”.
                        I speak warmly and casually.
                        I like playful teasing and cozy conversations.
                        I often say “stay cozy”.
                        Make people feel comfortable and emotionally heard.`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm mb-2">
                            Profile image
                        </label>

                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => uploadCreatorAsset(e, "profile")}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none"
                        />

                        {uploadingProfileImage && (
                            <p className="text-sm text-zinc-500 mt-2">
                                Uploading profile image...
                            </p>
                        )}

                        {profileImage && (
                            <p className="text-sm text-green-400 mt-2">
                                Profile image uploaded
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm mb-2">
                            Banner image
                        </label>

                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => uploadCreatorAsset(e, "banner")}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none"
                        />

                        {uploadingBannerImage && (
                            <p className="text-sm text-zinc-500 mt-2">
                                Uploading banner image...
                            </p>
                        )}

                        {bannerImage && (
                            <p className="text-sm text-green-400 mt-2">
                                Banner image uploaded
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm mb-2">
                            Intro voice message
                        </label>

                        <p className="text-xs text-zinc-500 mb-3">
                            This is the first voice message fans hear when opening your chat.
                            Keep it warm, short, and welcoming.
                        </p>

                        <input
                            type="file"
                            accept="audio/*"
                            onChange={uploadIntroAudio}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none"
                        />

                        {uploadingAudio && (
                            <p className="text-sm text-zinc-500 mt-2">
                                Uploading audio...
                            </p>
                        )}

                        {introAudio && (
                            <p className="text-sm text-green-400 mt-2">
                                Intro audio uploaded
                            </p>
                        )}
                    </div>


                    <div className="border border-zinc-800 rounded-3xl p-5 bg-zinc-900/60">

                        <h3 className="text-lg font-semibold mb-2">
                            AI Voice Setup
                        </h3>

                        <p className="text-sm text-zinc-400 mb-4">
                            Connect a voice that your AI creator will use for generated replies.
                        </p>

                        <div className="space-y-2 text-xs text-zinc-500 mb-5">
                            <p>• Record in a quiet room</p>
                            <p>• Avoid music and background noise</p>
                            <p>• Speak naturally and clearly</p>
                            <p>• 30–60 seconds works best</p>
                        </div>

                        <input
                            type="text"
                            placeholder="ElevenLabs voice ID"
                            className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 outline-none"
                        />

                        <p className="text-xs text-zinc-600 mt-3">
                            Voice cloning automation will be added later.
                        </p>

                    </div>

                    <button
                        onClick={saveProfile}
                        className="w-full bg-white text-black py-4 rounded-2xl font-bold"
                    >
                        Save profile
                    </button>

                    {!isPublished && (
                        <button
                            onClick={publishProfile}
                            className="w-full bg-zinc-800 text-white py-4 rounded-2xl font-bold mt-3"
                        >
                            Publish profile
                        </button>
                    )}

                    {isPublished && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-green-400">
                            <div className="w-2 h-2 rounded-full bg-green-400" />

                            <span>Ready</span>
                        </div>
                    )}
                </div>

            </main>

        </ProtectedRoute>
    );
}