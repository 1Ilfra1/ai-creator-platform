"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ProtectedRoute from "@/components/ProtectedRoute";

import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/services/analytics";

export default function DashboardPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [creatorId, setCreatorId] = useState<string | null>(null);
    const [isPublished, setIsPublished] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [username, setUsername] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [profileImage, setProfileImage] = useState("");
    const [bannerImage, setBannerImage] = useState("");
    const [introAudio, setIntroAudio] = useState("");
    const [instagramHandle, setInstagramHandle] = useState("");
    const [voiceSamplePath, setVoiceSamplePath] = useState("");
    const [voiceConsentAt, setVoiceConsentAt] = useState<string | null>(null);
    const [voiceConsentChecked, setVoiceConsentChecked] = useState(false);
    const [uploadingAudio, setUploadingAudio] = useState(false);
    const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
    const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
    const [uploadingVoiceSample, setUploadingVoiceSample] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState("");
    const [tagline, setTagline] = useState("");
    const [personalityPrompt, setPersonalityPrompt] = useState("");
    const usernameValid = /^[a-zA-Z0-9_-]{3,30}$/.test(username.trim());
    const profileComplete = Boolean(
        usernameValid &&
        displayName.trim() &&
        tagline.trim() &&
        personalityPrompt.trim() &&
        instagramHandle.trim() &&
        voiceSamplePath &&
        voiceConsentAt
    );
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
    const MAX_AUDIO_SIZE = 15 * 1024 * 1024;
    const MAX_VOICE_SAMPLE_SIZE = 10 * 1024 * 1024;

    const ALLOWED_IMAGE_TYPES = [
        "image/jpeg",
        "image/png",
        "image/webp",
    ];

    const ALLOWED_AUDIO_TYPES = [
        "audio/mpeg",
        "audio/mp3",
    ];

    const ALLOWED_VOICE_SAMPLE_TYPES = [
        "audio/mpeg",
        "audio/wav",
        "audio/mp4",
        "audio/x-m4a",
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

                const { data: profile } = await supabase
                    .from("profiles")
                    .select("username")
                    .eq("id", user.id)
                    .single();

                setUsername(profile?.username || "");

                const { data } = await supabase
                    .from("creators")
                    .select("*")
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (data) {

                    setCreatorId(data.id);

                    setDisplayName(data.display_name || "");
                    setTagline(data.tagline || "");
                    setPersonalityPrompt(
                        data.personality_prompt || ""
                    );
                    setIsPublished(data.is_published || false);
                    setIsActive(data.is_active || false);
                    setProfileImage(data.profile_image || "");
                    setBannerImage(data.banner_image || "");
                    setIntroAudio(data.intro_audio || "");
                    setInstagramHandle(data.instagram_handle || "");
                    setVoiceSamplePath(data.voice_sample_path || "");
                    setVoiceConsentAt(data.voice_consent_at || null);
                    setVoiceConsentChecked(Boolean(data.voice_consent_at));
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
                    upsert: false,
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
                    upsert: false,
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

    function getAudioDuration(file: File) {
        return new Promise<number>((resolve, reject) => {
            const audio = document.createElement("audio");
            const objectUrl = URL.createObjectURL(file);

            audio.preload = "metadata";
            audio.onloadedmetadata = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(audio.duration);
            };
            audio.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Could not read audio duration."));
            };
            audio.src = objectUrl;
        });
    }

    async function uploadVoiceSample(
        event: React.ChangeEvent<HTMLInputElement>
    ) {
        const file = event.target.files?.[0];

        if (!file || !currentUserId) return;

        if (file.size > MAX_VOICE_SAMPLE_SIZE) {
            alert("Voice sample file too large.");
            return;
        }

        const fileNameLower = file.name.toLowerCase();
        const isAllowedVoiceSample =
            ALLOWED_VOICE_SAMPLE_TYPES.includes(file.type) ||
            fileNameLower.endsWith(".mp3") ||
            fileNameLower.endsWith(".wav") ||
            fileNameLower.endsWith(".m4a") ||
            fileNameLower.endsWith(".mp4");

        if (!isAllowedVoiceSample) {
            alert("Please upload an MP3, WAV, M4A, or MP4 audio file.");
            return;
        }

        try {
            setUploadingVoiceSample(true);

            const duration = await getAudioDuration(file);

            if (duration < 20 || duration > 30) {
                alert("Please upload a voice sample between 20 and 30 seconds.");
                return;
            }

            const fileExt = file.name.split(".").pop();
            const fileName =
                `${currentUserId}/${creatorId || currentUserId}-${Date.now()}.${fileExt}`;

            const { error } = await supabase.storage
                .from("creator-voice-samples")
                .upload(fileName, file, {
                    upsert: false,
                });

            if (error) {
                console.error(error);
                alert("Failed to upload voice sample.");
                return;
            }

            setVoiceSamplePath(fileName);
        } catch (error) {
            console.error(error);
            alert("Voice sample upload failed.");
        } finally {
            setUploadingVoiceSample(false);
        }
    }

    async function saveProfile() {

        if (!currentUserId) return;

        if (!profileComplete) {
            alert("Complete all required creator profile fields, upload your 20-30 second voice sample, and confirm voice consent first.");
            return;
        }

        const creatorFields = {
            username: username.trim(),
            display_name: displayName.trim(),
            tagline: tagline.trim(),
            personality_prompt: personalityPrompt.trim(),
            profile_image: profileImage,
            banner_image: bannerImage,
            intro_audio: introAudio,
            instagram_handle: instagramHandle.trim(),
            voice_sample_path: voiceSamplePath,
            voice_consent_at: voiceConsentAt,
        };

        const shouldSubmitForApproval = !isActive;
        const creatorPayload = shouldSubmitForApproval
            ? {
                ...creatorFields,
                is_published: true,
            }
            : creatorFields;

        const { data, error } = creatorId
            ? await supabase
                .from("creators")
                .update(creatorPayload)
                .eq("id", creatorId)
                .select("id")
                .single()
            : await supabase
                .from("creators")
                .insert({
                    ...creatorPayload,
                    user_id: currentUserId,
                })
                .select("id")
                .single();

        if (error) {
            if (error.code === "23505") {
                alert("Your creator profile could not be updated because this username is already in use. Change it in Profile settings first.");
                return;
            }

            console.error(error);
            alert("Failed to save creator profile.");
            return;
        }

        if (data) {
            setCreatorId(data.id);
            if (shouldSubmitForApproval) {
                setIsPublished(true);
                setIsActive(false);
            }
            trackEvent({
                eventType: "creator_profile_saved",
                entityType: "creator",
                entityId: data.id,
                metadata: {
                    is_update: Boolean(creatorId),
                    has_profile_image: Boolean(profileImage),
                    has_banner_image: Boolean(bannerImage),
                    has_intro_audio: Boolean(introAudio),
                },
            });

            if (shouldSubmitForApproval) {
                trackEvent({
                    eventType: "creator_submitted",
                    entityType: "creator",
                    entityId: data.id,
                    metadata: {
                        username: username.trim(),
                    },
                });
            }
        }

        setSaveSuccess(
            shouldSubmitForApproval
                ? "Creator application submitted for approval."
                : "Creator profile updated."
        );
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center">
                Loading dashboard...
            </main>
        );
    }

    const primaryActionLabel = isActive
        ? "Update creator profile"
        : isPublished
            ? "Update application"
            : creatorId
                ? "Submit again"
                : "Submit for approval";

    return (
        <ProtectedRoute>

            <main className="min-h-screen bg-black text-white p-6 max-w-2xl mx-auto pb-24">

                <button
                    onClick={() => router.push("/profile")}
                    className="text-sm text-zinc-400 hover:text-white transition mb-4"
                >
                    ← Profile
                </button>

                <h1 className="text-3xl font-bold mb-2">
                    Creator Studio
                </h1>

                <p className="text-zinc-500 mb-8">
                    Set up your creator profile so fans can find you after approval.
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

                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3">
                            <p className="font-semibold">
                                @{username || "username"}
                            </p>

                            {usernameValid ? (
                                <p className="text-xs text-zinc-500 mt-2">
                                    Used for your public creator link: /creator/{username}
                                </p>
                            ) : (
                                <p className="text-xs text-yellow-300 mt-2">
                                    Set your username in Profile before publishing your creator profile.
                                </p>
                            )}
                        </div>
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
                            Instagram handle
                        </label>

                        <input
                            value={instagramHandle}
                            onChange={(e) => setInstagramHandle(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none"
                            placeholder="@yourhandle"
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
                            AI voice onboarding
                        </h3>

                        <p className="text-sm text-zinc-400 mb-4">
                            Upload a clear voice sample between 20 and 30 seconds. Use a quiet room, no music, no background noise.
                        </p>

                        <input
                            id="voice-sample-upload"
                            type="file"
                            accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a,.mp4"
                            onChange={uploadVoiceSample}
                            className="sr-only"
                        />
                        <label
                            htmlFor="voice-sample-upload"
                            className="inline-flex bg-black border border-zinc-800 rounded-2xl px-4 py-3 font-semibold cursor-pointer"
                        >
                            Choose voice sample
                        </label>

                        {uploadingVoiceSample && (
                            <p className="text-sm text-zinc-500 mt-2">
                                Uploading voice sample...
                            </p>
                        )}

                        {voiceSamplePath && (
                            <p className="text-sm text-green-400 mt-2">
                                Voice sample uploaded
                            </p>
                        )}

                        <label className="flex items-start gap-3 mt-5 text-sm text-zinc-300">
                            <input
                                type="checkbox"
                                checked={voiceConsentChecked}
                                onChange={(event) => {
                                    const checked = event.target.checked;
                                    setVoiceConsentChecked(checked);
                                    setVoiceConsentAt(
                                        checked ? new Date().toISOString() : null
                                    );
                                }}
                                className="mt-1"
                            />
                            <span>
                                I confirm this is my own voice and I allow this platform to create and use an AI voice clone for my creator profile.
                            </span>
                        </label>

                        <div className="space-y-2 text-xs text-zinc-500 mt-5">
                            <p>Admin will manually create and review your AI voice clone.</p>
                            <p>Fans will not access your uploaded voice sample.</p>
                            <p>Intro voice message is separate from generated AI replies.</p>
                        </div>
                    </div>

                    <button
                        onClick={saveProfile}
                        disabled={!profileComplete}
                        className="w-full bg-white text-black py-4 rounded-2xl font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {primaryActionLabel}
                    </button>

                    {saveSuccess && (
                        <div className="border border-green-900 bg-green-950/30 rounded-3xl p-5">
                            <p className="font-semibold text-green-300">
                                {saveSuccess}
                            </p>
                        </div>
                    )}

                    {!profileComplete && (
                        <div className="border border-yellow-900 bg-yellow-950/30 rounded-3xl p-5">
                            <h3 className="font-semibold text-yellow-300 mb-3">
                                Complete your creator setup
                            </h3>

                            <div className="space-y-2 text-sm">
                                <p className="text-xs uppercase tracking-wide text-yellow-300">
                                    Required
                                </p>
                                <p>{usernameValid ? "✅" : "⬜"} Username</p>
                                <p>{displayName.trim() ? "✅" : "⬜"} Display name</p>
                                <p>{tagline.trim() ? "✅" : "⬜"} Creator description</p>
                                <p>{personalityPrompt.trim() ? "✅" : "⬜"} Personality setup</p>
                                <p>{instagramHandle.trim() ? "✅" : "⬜"} Instagram handle</p>
                                <p>{voiceSamplePath ? "✅" : "⬜"} 20-30 second voice sample</p>
                                <p>{voiceConsentAt ? "✅" : "⬜"} Voice consent</p>

                                <p className="text-xs uppercase tracking-wide text-zinc-500 pt-3">
                                    Optional
                                </p>
                                <p>{profileImage ? "✅" : "⬜"} Profile image</p>
                                <p>{bannerImage ? "✅" : "⬜"} Banner image</p>
                                <p>{introAudio ? "✅" : "⬜"} Intro voice message</p>
                            </div>
                        </div>
                    )}

                    {!isPublished && profileComplete && (
                        <div className="border border-green-900 bg-green-950/30 rounded-3xl p-5">
                            <h3 className="font-semibold text-green-300 mb-2">
                                Ready to submit
                            </h3>

                            <p className="text-sm text-zinc-400">
                                Use the primary button above to submit your creator application for approval.
                            </p>
                        </div>
                    )}

                    {isPublished && isActive && (
                        <div className="border border-green-900 bg-green-950/30 rounded-3xl p-5">
                            <div className="flex items-center gap-2 text-sm text-green-400">
                                <div className="w-2 h-2 rounded-full bg-green-400" />

                                <span>Published and live</span>
                            </div>
                        </div>
                    )}

                    {isPublished && !isActive && (
                        <div className="border border-yellow-900 bg-yellow-950/30 rounded-3xl p-5">
                            <div className="flex items-center gap-2 text-sm text-yellow-300">
                                <div className="w-2 h-2 rounded-full bg-yellow-300" />

                                <span>Submitted / waiting for approval</span>
                            </div>
                        </div>
                    )}
                </div>

            </main>

        </ProtectedRoute>
    );
}
