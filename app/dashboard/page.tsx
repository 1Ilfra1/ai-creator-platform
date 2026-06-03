"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ProtectedRoute from "@/components/ProtectedRoute";

import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [creatorId, setCreatorId] = useState<string | null>(null);
    const [isPublished, setIsPublished] = useState(false);
    const [username, setUsername] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [profileImage, setProfileImage] = useState("");
    const [bannerImage, setBannerImage] = useState("");
    const [introAudio, setIntroAudio] = useState("");
    const [voiceId, setVoiceId] = useState("");
    const [uploadingAudio, setUploadingAudio] = useState(false);
    const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
    const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
    const [tagline, setTagline] = useState("");
    const [personalityPrompt, setPersonalityPrompt] = useState("");
    const usernameValid = /^[a-zA-Z0-9_-]{3,30}$/.test(username.trim());
    const profileComplete =
        usernameValid &&
        displayName.trim() &&
        tagline.trim() &&
        personalityPrompt.trim() &&
        profileImage &&
        bannerImage &&
        introAudio &&
        voiceId.trim();
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
    const MAX_AUDIO_SIZE = 15 * 1024 * 1024;

    const ALLOWED_IMAGE_TYPES = [
        "image/jpeg",
        "image/png",
        "image/webp",
    ];

    const ALLOWED_AUDIO_TYPES = [
        "audio/mpeg",
        "audio/mp3",
    ];

    useEffect(() => {

        async function loadCreator() {
            try {

                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                    router.replace("/login");
                    return;
                }

                setCurrentUserId(user.id);

                const { data } = await supabase
                    .from("creators")
                    .select("*")
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (data) {

                    setCreatorId(data.id);

                    setUsername(data.username || "");
                    setDisplayName(data.display_name || "");
                    setTagline(data.tagline || "");
                    setPersonalityPrompt(
                        data.personality_prompt || ""
                    );
                    setIsPublished(data.is_published || false);
                    setProfileImage(data.profile_image || "");
                    setBannerImage(data.banner_image || "");
                    setIntroAudio(data.intro_audio || "");
                    setVoiceId(data.voice_id || "");
                }
            } catch (error) {
                console.error("Failed to load creator:", error);
            } finally {
                setLoading(false);
            }
        }

        loadCreator();

    }, []);

    async function uploadIntroAudio(
        event: React.ChangeEvent<HTMLInputElement>
    ) {
        const file = event.target.files?.[0];

        if (!file || !currentUserId) return;

        if (file.size > MAX_AUDIO_SIZE) {
            alert("Audio file too large.");
            return;
        }

        const isMp3File =
            ALLOWED_AUDIO_TYPES.includes(file.type) ||
            file.name.toLowerCase().endsWith(".mp3");

        if (!isMp3File) {
            alert("Please upload an MP3 file.");
            return;
        }

        try {
            setUploadingAudio(true);

            const fileExt = file.name.split(".").pop();

            const fileName =
                `${creatorId || currentUserId}-${Date.now()}.${fileExt}`;

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

        if (!file || !currentUserId) return;

        if (file.size > MAX_IMAGE_SIZE) {
            alert("Image file too large.");
            return;
        }

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            alert("Unsupported image format.");
            return;
        }

        try {
            if (type === "profile") {
                setUploadingProfileImage(true);
            } else {
                setUploadingBannerImage(true);
            }

            const fileExt = file.name.split(".").pop();
            const fileName = `${creatorId || currentUserId}-${type}-${Date.now()}.${fileExt}`;

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

        if (!currentUserId) return;

        if (!profileComplete) {
            alert("Complete all required creator profile fields first.");
            return;
        }

        const creatorPayload = {
            user_id: currentUserId,
            username: username.trim(),
            display_name: displayName.trim(),
            tagline: tagline.trim(),
            personality_prompt: personalityPrompt.trim(),
            profile_image: profileImage,
            banner_image: bannerImage,
            intro_audio: introAudio,
            voice_id: voiceId.trim(),
        };

        const { data, error } = creatorId
            ? await supabase
                .from("creators")
                .update(creatorPayload)
                .eq("id", creatorId)
                .select("id")
                .single()
            : await supabase
                .from("creators")
                .insert(creatorPayload)
                .select("id")
                .single();

        if (error) {
            console.error(error);
            alert("Failed to save creator profile.");
            return;
        }

        if (data) {
            setCreatorId(data.id);
        }

        alert("Creator profile saved!");
        router.push("/profile");
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
                    Creator Studio
                </h1>

                <p className="text-zinc-500 mb-8">
                    Set up your creator profile so fans can find you and start chatting.
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
                        <p className="text-xs text-zinc-500 mt-2">
                            3-30 characters. Use letters, numbers, underscores, or dashes.
                        </p>
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
                        </label>

                        <p className="text-xs text-zinc-500 mb-2">
                            Shape how your AI presence talks: tone, catchphrases, fan nicknames, energy, and conversation style.
                        </p>

                        <p className="text-xs text-zinc-500 mb-2">
                            ⚠️ Fans will not see this text.
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
                            Profile image (JPG, PNG, WebP)
                        </label>

                        <input
                            id="profile-image-upload"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => uploadCreatorAsset(e, "profile")}
                            className="sr-only"
                        />
                        <label
                            htmlFor="profile-image-upload"
                            className="inline-flex bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 font-semibold cursor-pointer"
                        >
                            Choose file
                        </label>

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
                            Banner image (JPG, PNG, WebP)
                        </label>

                        <input
                            id="banner-image-upload"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => uploadCreatorAsset(e, "banner")}
                            className="sr-only"
                        />
                        <label
                            htmlFor="banner-image-upload"
                            className="inline-flex bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 font-semibold cursor-pointer"
                        >
                            Choose file
                        </label>

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
                            Intro voice message (MP3)
                        </label>

                        <p className="text-xs text-zinc-500 mb-3">
                            This is the first voice message fans hear when opening your chat.
                            Keep it warm, short, and welcoming.
                        </p>

                        <input
                            id="intro-audio-upload"
                            type="file"
                            accept="audio/mpeg,.mp3"
                            onChange={uploadIntroAudio}
                            className="sr-only"
                        />
                        <label
                            htmlFor="intro-audio-upload"
                            className="inline-flex bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 font-semibold cursor-pointer"
                        >
                            Choose file
                        </label>

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
                            Paste the ElevenLabs voice ID your AI creator will use for generated replies.
                        </p>

                        <input
                            value={voiceId}
                            onChange={(e) => setVoiceId(e.target.value)}
                            type="text"
                            placeholder="ElevenLabs voice ID"
                            className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 outline-none"
                        />

                        {voiceId && (
                            <p className="text-sm text-green-400 mt-2">
                                Voice ID connected
                            </p>
                        )}

                        <div className="space-y-2 text-xs text-zinc-500 mt-5">
                            <p>• Use a voice you own or have permission to use</p>
                            <p>• This voice will generate AI replies</p>
                            <p>• Intro voice message is separate from AI reply voice</p>
                        </div>
                    </div>

                    <button
                        onClick={saveProfile}
                        disabled={!profileComplete}
                        className="w-full bg-white text-black py-4 rounded-2xl font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {creatorId ? "Update creator profile" : "Create creator profile"}
                    </button>

                    {!profileComplete && (
                        <div className="border border-yellow-900 bg-yellow-950/30 rounded-3xl p-5">
                            <h3 className="font-semibold text-yellow-300 mb-3">
                                Complete your creator setup
                            </h3>

                            <div className="space-y-2 text-sm">
                                <p>{usernameValid ? "✅" : "⬜"} Username</p>
                                <p>{displayName.trim() ? "✅" : "⬜"} Display name</p>
                                <p>{tagline.trim() ? "✅" : "⬜"} Creator description</p>
                                <p>{personalityPrompt.trim() ? "✅" : "⬜"} Personality setup</p>
                                <p>{profileImage ? "✅" : "⬜"} Profile image</p>
                                <p>{bannerImage ? "✅" : "⬜"} Banner image</p>
                                <p>{introAudio ? "✅" : "⬜"} Intro voice message</p>
                                <p>{voiceId.trim() ? "✅" : "⬜"} ElevenLabs voice ID</p>
                            </div>
                        </div>
                    )}

                    {!isPublished && profileComplete && (
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
