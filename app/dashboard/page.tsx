"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ProtectedRoute from "@/components/ProtectedRoute";

import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/services/analytics";

type VoiceValidationStatus = "idle" | "validating" | "valid" | "invalid";

export default function DashboardPage() {
    const router = useRouter();
    const applicationStartedTrackedRef = useRef(false);

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
    const [voiceId, setVoiceId] = useState("");
    const [voiceValidationStatus, setVoiceValidationStatus] =
        useState<VoiceValidationStatus>("idle");
    const [voiceValidationMessage, setVoiceValidationMessage] = useState("");
    const [voiceName, setVoiceName] = useState("");
    const [showVoiceGuide, setShowVoiceGuide] = useState(false);
    const [uploadingAudio, setUploadingAudio] = useState(false);
    const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
    const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState("");
    const [tagline, setTagline] = useState("");
    const [personalityPrompt, setPersonalityPrompt] = useState("");
    const usernameValid = /^[a-zA-Z0-9_-]{3,30}$/.test(username.trim());
    const profileComplete = Boolean(
        usernameValid &&
        displayName.trim() &&
        tagline.trim() &&
        personalityPrompt.trim() &&
        voiceId.trim() &&
        voiceValidationStatus === "valid"
    );
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
        "audio/mp4",
        "audio/x-m4a",
        "audio/m4a",
        "audio/aac",
        "audio/wav",
        "audio/x-wav",
    ];

    const ALLOWED_AUDIO_EXTENSIONS = [
        ".mp3",
        ".m4a",
        ".aac",
        ".wav",
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
                    setVoiceId(data.voice_id || "");
                    if (data.voice_id) {
                        setVoiceValidationStatus("idle");
                        setVoiceValidationMessage(
                            "Saved Voice ID loaded. Validate it before submitting or updating your creator profile."
                        );
                    }
                } else if (!applicationStartedTrackedRef.current) {
                    applicationStartedTrackedRef.current = true;
                    trackEvent({
                        eventType: "creator_application_started",
                        metadata: {
                            source: "creator_studio",
                        },
                    });
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

        const fileNameLower = file.name.toLowerCase();
        const isSupportedAudioFile =
            ALLOWED_AUDIO_TYPES.includes(file.type) ||
            ALLOWED_AUDIO_EXTENSIONS.some((extension) =>
                fileNameLower.endsWith(extension)
            );

        if (!isSupportedAudioFile) {
            alert("Please upload an MP3, M4A, AAC, or WAV audio file.");
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

    async function validateVoiceId() {
        const nextVoiceId = voiceId.trim();

        if (!nextVoiceId) {
            setVoiceValidationStatus("invalid");
            setVoiceValidationMessage("Voice ID is required.");
            return;
        }

        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
            setVoiceValidationStatus("invalid");
            setVoiceValidationMessage("Please log in again before validating your Voice ID.");
            return;
        }

        try {
            setVoiceValidationStatus("validating");
            setVoiceValidationMessage("Checking Voice ID...");

            const response = await fetch("/api/elevenlabs/validate-voice", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    voiceId: nextVoiceId,
                }),
            });

            const data = await response.json();

            if (response.ok && data.valid) {
                setVoiceValidationStatus("valid");
                setVoiceValidationMessage(
                    data.message ||
                    "Professional Voice Clone verified."
                );
                setVoiceName(data.voiceName || "");
                trackEvent({
                    eventType: "voice_id_validated",
                    entityType: creatorId ? "creator" : undefined,
                    entityId: creatorId || undefined,
                    metadata: {
                        category: data.category || null,
                        is_professional_clone: data.isProfessionalClone ?? null,
                    },
                });
                return;
            }

            setVoiceValidationStatus("invalid");
            setVoiceValidationMessage(
                data.message ||
                "This Voice ID could not be verified. Make sure it belongs to a Professional Voice Clone accessible from ElevenLabs."
            );
            setVoiceName("");
        } catch (error) {
            console.error("Voice ID validation failed:", error);
            setVoiceValidationStatus("invalid");
            setVoiceValidationMessage(
                "This Voice ID could not be verified. Make sure it belongs to a Professional Voice Clone accessible from ElevenLabs."
            );
            setVoiceName("");
        }
    }

    async function saveProfile() {

        if (!currentUserId) return;

        if (!profileComplete) {
            alert("Complete all required creator profile fields and validate your Professional Voice Clone ID first.");
            return;
        }

        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
            alert("Please log in again before saving your creator profile.");
            return;
        }

        const shouldSubmitForApproval = !isActive;
        const response = await fetch("/api/creator-profile", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                displayName,
                tagline,
                personalityPrompt,
                profileImage,
                bannerImage,
                introAudio,
                instagramHandle,
                voiceId,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            if (data.code === "23505" || response.status === 409) {
                alert("Your creator profile could not be updated because this username is already in use. Change it in Profile settings first.");
                return;
            }

            console.error(data);
            alert(data.error || "Failed to save creator profile.");
            return;
        }

        if (data) {
            setCreatorId(data.id);
            setIsPublished(Boolean(data.isPublished));
            setIsActive(Boolean(data.isActive));
            trackEvent({
                eventType: "creator_profile_saved",
                entityType: "creator",
                entityId: data.id,
                metadata: {
                    is_update: Boolean(creatorId),
                    has_profile_image: Boolean(profileImage),
                    has_banner_image: Boolean(bannerImage),
                    has_intro_audio: Boolean(introAudio),
                    has_voice_id: Boolean(voiceId.trim()),
                },
            });

            trackEvent({
                eventType: "creator_profile_completed",
                entityType: "creator",
                entityId: data.id,
                metadata: {
                    is_update: Boolean(creatorId),
                    submitted_for_approval: shouldSubmitForApproval,
                },
            });

            if (shouldSubmitForApproval) {
                trackEvent({
                    eventType: "creator_application_submitted",
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
                    Set up your creator profile so users can discover and interact with your AI experience after approval.
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
                            placeholder="Fitness coach helping people build simple, sustainable workout routines."
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-2">
                            Creator personality & style
                        </label>

                        <p className="text-xs text-zinc-500 mb-2">
                            Define how your AI communicates: expertise, tone, personality, vocabulary, and conversation style.
                        </p>

                        <p className="text-xs text-zinc-500 mb-2">
                            ⚠️ Fans will not see this text.
                        </p>

                        <textarea
                            value={personalityPrompt}
                            onChange={(e) => setPersonalityPrompt(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none h-40 resize-none"
                            placeholder={`Example:
                        I am a fitness coach focused on simple, practical advice.
I speak in a friendly, energetic, and encouraging way.
I keep explanations short and easy to follow.
I ask about the user's goals before giving recommendations.
I motivate users without sounding pushy.`}
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
                            Intro voice message (MP3, M4A, AAC, WAV)
                        </label>

                        <p className="text-xs text-zinc-500 mb-3">
                            This optional voice preview can be played on your public profile and creator cards.
                            Keep it warm, short, and welcoming.
                        </p>

                        <input
                            id="intro-audio-upload"
                            type="file"
                            accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/m4a,audio/aac,audio/wav,audio/x-wav,.mp3,.m4a,.aac,.wav"
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
                        <div className="flex items-start justify-between gap-4 mb-3">
                            <div>
                                <h3 className="text-lg font-semibold">
                                    Professional Voice Clone ID
                                </h3>
                                <p className="text-sm text-zinc-400 mt-1">
                                    Paste your ElevenLabs Professional Voice Clone ID and validate it before submitting.
                                </p>
                            </div>

                        </div>

                        <button
                            type="button"
                            onClick={() => setShowVoiceGuide(true)}
                            className="mb-3 text-left text-sm font-semibold text-zinc-300 underline decoration-zinc-700 underline-offset-4 hover:text-white"
                        >
                            How do I get a Professional Voice ID?
                        </button>

                        <input
                            value={voiceId}
                            onChange={(event) => {
                                setVoiceId(event.target.value);
                                setVoiceValidationStatus("idle");
                                setVoiceValidationMessage("");
                                setVoiceName("");
                            }}
                            className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 outline-none"
                            placeholder="Paste ElevenLabs Voice ID"
                        />

                        <button
                            type="button"
                            onClick={validateVoiceId}
                            disabled={voiceValidationStatus === "validating"}
                            className="mt-3 rounded-2xl bg-white text-black px-4 py-3 text-sm font-bold disabled:opacity-50"
                        >
                            {voiceValidationStatus === "validating"
                                ? "Validating..."
                                : "Validate Voice ID"}
                        </button>

                        {voiceValidationMessage && (
                            <p
                                className={`text-sm mt-3 ${voiceValidationStatus === "valid"
                                    ? "text-green-400"
                                    : voiceValidationStatus === "invalid"
                                        ? "text-red-300"
                                        : "text-zinc-500"
                                    }`}
                            >
                                {voiceValidationMessage}
                                {voiceName ? ` (${voiceName})` : ""}
                            </p>
                        )}

                        <p className="text-xs text-zinc-500 mt-4">
                            Intro voice message is separate from generated AI replies.
                        </p>
                    </div>

                    {showVoiceGuide && (
                        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-6">
                            <div className="max-w-md w-full rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <h3 className="text-xl font-bold">
                                        How to get your Professional Voice ID
                                    </h3>

                                    <button
                                        type="button"
                                        onClick={() => setShowVoiceGuide(false)}
                                        className="text-zinc-500 hover:text-white"
                                        aria-label="Close guide"
                                    >
                                        X
                                    </button>
                                </div>

                                <p className="text-sm text-zinc-400 mb-4">
                                    To publish on Creator Voice, you need a verified Professional Voice Clone from ElevenLabs.
                                </p>

                                <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-300">
                                    <li>Create an ElevenLabs account.</li>
                                    <li>Upgrade to a plan that supports Professional Voice Clone.</li>
                                    <li>Create a Professional Voice Clone.</li>
                                    <li>Upload 30-120 minutes of clean speech. Use a quiet room, no music, no heavy echo.</li>
                                    <li>Complete ElevenLabs identity verification.</li>
                                    <li>Open your voice settings in ElevenLabs and copy the Voice ID.</li>
                                    <li>Paste the Voice ID here and click Validate.</li>
                                </ol>

                                <div className="mt-5 grid gap-3">
                                    <a
                                        href="https://elevenlabs.io/"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-2xl bg-white text-black px-4 py-3 text-center text-sm font-bold"
                                    >
                                        Open ElevenLabs
                                    </a>

                                    <a
                                        href="https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/professional-voice-cloning"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-2xl border border-zinc-800 px-4 py-3 text-center text-sm font-semibold text-zinc-300"
                                    >
                                        ElevenLabs Professional Voice Clone guide
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

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
                                <p>{voiceValidationStatus === "valid" ? "✅" : "⬜"} Professional Voice Clone ID</p>

                                <p className="text-xs uppercase tracking-wide text-zinc-500 pt-3">
                                    Optional
                                </p>
                                <p>{profileImage ? "✅" : "⬜"} Profile image</p>
                                <p>{bannerImage ? "✅" : "⬜"} Banner image</p>
                                <p>{introAudio ? "✅" : "⬜"} Intro voice message</p>
                                <p>{instagramHandle.trim() ? "✅" : "⬜"} Instagram handle</p>
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
