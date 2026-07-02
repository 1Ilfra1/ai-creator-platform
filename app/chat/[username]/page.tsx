"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/services/analytics";
import AudioPlayer from "@/components/audio/AudioPlayer";
import { motion } from "framer-motion";

interface Message {
    id: string;
    conversation_id?: string;
    sender_type: "user" | "ai";
    text: string;
    audio_url?: string | null;
    created_at?: string;
    is_fallback?: boolean;
}

interface Creator {
    id: string;
    username: string;
    display_name: string;
    tagline: string | null;
    profile_image: string | null;
    intro_audio: string | null;
}

export default function ChatPage({
    params,
}: {
    params: Promise<{ username: string }>;
}) {
    const { username } = use(params);
    const router = useRouter();

    const [creator, setCreator] = useState<Creator | null>(null);
    const [creatorUnavailable, setCreatorUnavailable] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [expandedMessages, setExpandedMessages] = useState<string[]>([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [subscriptionStatus, setSubscriptionStatus] = useState("free");
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [hasPaidBefore, setHasPaidBefore] = useState(false);
    const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
    const MAX_MESSAGE_LENGTH = 500;

    const bottomRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const sendingRef = useRef(false);
    const greetingGenerationRef = useRef<string | null>(null);
    const pendingReplyRef = useRef<string | null>(null);

    function openPaywall(reason: string) {
        setShowPaywall(true);

        trackEvent({
            eventType: "paywall_opened",
            entityType: creator ? "creator" : undefined,
            entityId: creator?.id,
            sessionId: conversationId || undefined,
            metadata: {
                reason,
            },
        });
    }

    useEffect(() => {
        async function setupConversation() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push(`/login?next=${encodeURIComponent(`/chat/${username}`)}`);
                return;
            }

            let availableVoiceSeconds = 0;

            const { data: profile } = await supabase
                .from("profiles")
                .select("subscription_status, voice_seconds_remaining, has_paid_before")
                .eq("id", user.id)
                .single();

            if (profile) {
                setSubscriptionStatus(
                    profile.subscription_status || "free"
                );

                availableVoiceSeconds = profile.voice_seconds_remaining || 0;

                setRemainingSeconds(availableVoiceSeconds);

                setHasPaidBefore(profile.has_paid_before || false);
            }

            const { data: creatorData, error: creatorError } = await supabase
                .from("public_creators")
                .select("id, username, display_name, tagline, profile_image, intro_audio")
                .eq("username", username)
                .single();

            if (creatorError || !creatorData) {
                console.error(creatorError);
                setCreatorUnavailable(true);
                return;
            }

            setCreator(creatorData);
            setCreatorUnavailable(false);

            const { data: existingConversation } = await supabase
                .from("conversations")
                .select("*")
                .eq("user_id", user.id)
                .eq("creator_id", creatorData.id)
                .maybeSingle();

            if (existingConversation) {
                setConversationId(existingConversation.id);

                const { data: existingMessages } = await supabase
                    .from("messages")
                    .select("*")
                    .eq("conversation_id", existingConversation.id)
                    .order("created_at", { ascending: true });

                const loadedMessages = existingMessages || [];
                setMessages(loadedMessages);

                if (loadedMessages.length === 0) {
                    await generateFirstGreeting(
                        existingConversation.id,
                        creatorData,
                        availableVoiceSeconds
                    );
                } else {
                    const lastMessage = loadedMessages[loadedMessages.length - 1];

                    if (lastMessage?.sender_type === "user") {
                        completeSavedUserMessage(lastMessage, {
                            source: "recovery",
                            recentMessages: loadedMessages
                                .slice(0, -1)
                                .slice(-8)
                                .map((message) => ({
                                    role:
                                        message.sender_type === "user"
                                            ? "user"
                                            : "assistant",
                                    content: message.text,
                                })),
                        });
                    }
                }

                return;
            }

            const { data: newConversation, error } = await supabase
                .from("conversations")
                .upsert(
                    {
                        user_id: user.id,
                        creator_id: creatorData.id,
                    },
                    {
                        onConflict: "user_id,creator_id",
                        ignoreDuplicates: true,
                    }
                )
                .select()
                .maybeSingle();

            if (error) {
                console.error(error);
                return;
            }

            if (!newConversation) {
                const { data: existingConversation } = await supabase
                    .from("conversations")
                    .select("*")
                    .eq("user_id", user.id)
                    .eq("creator_id", creatorData.id)
                    .single();

                if (existingConversation) {
                    setConversationId(existingConversation.id);
                    const { data: existingMessages } = await supabase
                        .from("messages")
                        .select("*")
                        .eq("conversation_id", existingConversation.id)
                        .order("created_at", { ascending: true });

                    const loadedMessages = existingMessages || [];
                    setMessages(loadedMessages);

                    if (loadedMessages.length === 0) {
                        await generateFirstGreeting(
                            existingConversation.id,
                            creatorData,
                            availableVoiceSeconds
                        );
                    } else {
                        const lastMessage = loadedMessages[loadedMessages.length - 1];

                        if (lastMessage?.sender_type === "user") {
                            completeSavedUserMessage(lastMessage, {
                                source: "recovery",
                                recentMessages: loadedMessages
                                    .slice(0, -1)
                                    .slice(-8)
                                    .map((message) => ({
                                        role:
                                            message.sender_type === "user"
                                                ? "user"
                                                : "assistant",
                                        content: message.text,
                                    })),
                            });
                        }
                    }

                    return;
                }

                return;
            }

            setConversationId(newConversation.id);

            trackEvent({
                eventType: "chat_started",
                entityType: "creator",
                entityId: creatorData.id,
                sessionId: newConversation.id,
                metadata: {
                    username: creatorData.username,
                },
            });

            await generateFirstGreeting(
                newConversation.id,
                creatorData,
                availableVoiceSeconds
            );
        }

        setupConversation();
    }, [router, username]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    async function generateFirstGreeting(
        targetConversationId: string,
        targetCreator: Creator,
        availableVoiceSeconds: number
    ) {
        if (greetingGenerationRef.current === targetConversationId) {
            return;
        }

        greetingGenerationRef.current = targetConversationId;

        const { count } = await supabase
            .from("messages")
            .select("*", {
                count: "exact",
                head: true,
            })
            .eq("conversation_id", targetConversationId);

        if ((count || 0) > 0) {
            greetingGenerationRef.current = null;
            return;
        }

        if (availableVoiceSeconds <= 0) {
            openPaywall("first_greeting_minutes_exhausted");
            greetingGenerationRef.current = null;
            return;
        }

        setIsTyping(true);
        setVoiceNotice(`${targetCreator.display_name} is recording a voice message...`);

        try {
            const {
                data: { session: chatSession },
            } = await supabase.auth.getSession();

            const aiResponse = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${chatSession?.access_token}`,
                },
                body: JSON.stringify({
                    message: "Start this new chat with a short warm first greeting.",
                    conversationId: targetConversationId,
                    recentMessages: [],
                    isGreeting: true,
                }),
            });

            const aiData = await aiResponse.json();

            if (!aiResponse.ok) {
                if (aiResponse.status === 401) {
                    setVoiceNotice("Please log in again.");
                } else if (aiResponse.status === 403) {
                    setVoiceNotice("Chat session expired. Please refresh and try again.");
                } else if (aiResponse.status === 429) {
                    setVoiceNotice("Message limit reached. Try again later.");
                } else {
                    setVoiceNotice("Could not start the chat. Please try again.");
                }

                return;
            }

            const aiText = aiData.reply || `Hey, I'm really happy you're here. How's your day going?`;
            const voiceText =
                aiText.length > 500
                    ? `${aiText.slice(0, 500)}...`
                    : aiText;

            const {
                data: { session: voiceSession },
            } = await supabase.auth.getSession();

            const voiceResponse = await fetch("/api/voice", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${voiceSession?.access_token}`,
                },
                body: JSON.stringify({
                    text: voiceText,
                    conversationId: targetConversationId,
                }),
            });

            const voiceData = await voiceResponse.json();
            let audioUrl: string | null = null;
            let voiceGenerated = false;
            let voiceFallback = false;
            let chargedSeconds: number | null = null;

            if (voiceResponse.ok) {
                audioUrl = voiceData.audio
                    ? `data:${voiceData.mimeType};base64,${voiceData.audio}`
                    : voiceData.audioUrl || null;

                if (audioUrl) {
                    voiceGenerated = voiceData.generated || false;
                    voiceFallback = voiceData.fallback || false;
                    chargedSeconds =
                        typeof voiceData.chargedSeconds === "number"
                            ? voiceData.chargedSeconds
                            : null;
                    setVoiceNotice(null);
                } else {
                    voiceFallback = true;
                    setVoiceNotice("Greeting text was created, but voice could not be generated.");
                }
            } else {
                voiceFallback = true;

                if (voiceResponse.status === 402) {
                    openPaywall("first_greeting_voice_minutes_exhausted");
                    setVoiceNotice("You're out of voice minutes.");
                    return;
                }

                if (voiceResponse.status === 429) {
                    setVoiceNotice("Voice limit reached. Try again later.");
                } else if (
                    voiceResponse.status === 401 ||
                    voiceResponse.status === 403
                ) {
                    setVoiceNotice("Could not generate voice. Please refresh and try again.");
                } else {
                    setVoiceNotice("Greeting text was created, but voice could not be generated.");
                }
            }

            const { data: savedGreeting } = await supabase
                .from("messages")
                .insert({
                    conversation_id: targetConversationId,
                    sender_type: "ai",
                    text: aiText,
                    audio_url: audioUrl,
                    audio_duration_seconds: chargedSeconds,
                    is_fallback: aiData.fallback || false,
                    voice_generated: voiceGenerated,
                    voice_fallback: voiceFallback,
                })
                .select()
                .single();

            if (typeof voiceData.secondsRemaining === "number") {
                setRemainingSeconds(voiceData.secondsRemaining);
            }

            if (savedGreeting) {
                setMessages((prev) =>
                    prev.some((message) => message.id === savedGreeting.id)
                        ? prev
                        : [...prev, savedGreeting]
                );
                trackEvent({
                    eventType: "first_ai_greeting_generated",
                    entityType: "creator",
                    entityId: targetCreator.id,
                    sessionId: targetConversationId,
                    metadata: {
                        voice_generated: voiceGenerated,
                        voice_fallback: voiceFallback,
                        charged_seconds: chargedSeconds,
                    },
                });
                playSoftPing();
            }
        } catch (error) {
            console.error("Failed to generate first greeting:", error);
            setVoiceNotice("Could not start the chat. Please try again.");
        } finally {
            setIsTyping(false);
            greetingGenerationRef.current = null;
        }
    }

    async function completeSavedUserMessage(
        savedUserMessage: Message,
        options: {
            source: "typed" | "suggested_reply" | "recovery";
            recentMessages?: { role: string; content: string }[];
            trackMessageEvents?: boolean;
        }
    ) {
        const targetConversationId =
            savedUserMessage.conversation_id || conversationId;

        if (!targetConversationId) return;

        if (pendingReplyRef.current === savedUserMessage.id) {
            return;
        }

        pendingReplyRef.current = savedUserMessage.id;
        setIsTyping(true);

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            const response = await fetch("/api/chat/respond", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({
                    conversationId: targetConversationId,
                    userMessageId: savedUserMessage.id,
                    recentMessages: options.recentMessages || [],
                    source:
                        options.source === "suggested_reply"
                            ? "suggested_reply"
                            : "typed",
                    trackMessageEvents: options.trackMessageEvents === true,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    setVoiceNotice("Please log in again.");
                } else if (response.status === 402) {
                    openPaywall("voice_minutes_exhausted");
                    setVoiceNotice("You're out of voice minutes.");
                } else if (response.status === 403) {
                    setVoiceNotice(
                        "Chat session expired. Please refresh and try again."
                    );
                } else if (response.status === 429) {
                    setVoiceNotice("Message limit reached. Try again later.");
                } else {
                    setVoiceNotice(
                        data.reason ||
                        data.error ||
                        "Could not generate reply. Please try again."
                    );
                }

                return;
            }

            setMessages((prev) => {
                const nextMessages = prev.map((message) =>
                    message.id === savedUserMessage.id && data.userMessage
                        ? data.userMessage
                        : message
                );

                if (
                    data.aiMessage &&
                    !nextMessages.some((message) => message.id === data.aiMessage.id)
                ) {
                    nextMessages.push(data.aiMessage);
                }

                return nextMessages;
            });

            if (typeof data.secondsRemaining === "number") {
                setRemainingSeconds(data.secondsRemaining);
            }

            setVoiceNotice(data.voiceNotice || null);

            if (data.paywallReason) {
                openPaywall(data.paywallReason);
            }

            if (data.aiMessage && !data.alreadyCompleted) {
                playSoftPing();
            }

            inputRef.current?.focus();
        } catch (error) {
            console.error("Failed to complete saved user message:", error);
            setVoiceNotice("Could not generate reply. Please try again.");
        } finally {
            pendingReplyRef.current = null;
            sendingRef.current = false;
            setIsTyping(false);
        }
    }

    async function sendMessage(prefilledText?: string) {
        const messageText =
            typeof prefilledText === "string"
                ? prefilledText.trim()
                : input.trim();

        if (
            !messageText ||
            !conversationId ||
            !creator ||
            isTyping ||
            sendingRef.current
        ) {
            return;
        }

        if (
            remainingSeconds <= 0 &&
            subscriptionStatus !== "active"
        ) {
            openPaywall("free_minutes_exhausted");
            return;
        }

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            router.push(`/login?next=${encodeURIComponent(`/chat/${username}`)}`);
            return;
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("voice_seconds_remaining")
            .eq("id", user.id)
            .single();

        if (!profile || profile.voice_seconds_remaining <= 0) {
            openPaywall("minutes_exhausted");
            return;
        }

        if (messageText.length > MAX_MESSAGE_LENGTH) {
            return;
        }

        sendingRef.current = true;
        setIsTyping(true);

        const text = messageText;
        const recentMessages = messages
            .slice(-8)
            .map((message) => ({
                role: message.sender_type === "user" ? "user" : "assistant",
                content: message.text,
            }));
        try {
            const {
                data: { session: moderationSession },
            } = await supabase.auth.getSession();

            const moderationResponse = await fetch("/api/moderate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${moderationSession?.access_token}`,
                },
                body: JSON.stringify({ text }),
            });

            const moderationData = await moderationResponse.json();

            if (!moderationResponse.ok || !moderationData.allowed) {
                alert(moderationData.reason || "Message blocked by safety rules.");
                return;
            }

            setInput("");

            const { data: savedUserMessage, error: saveError } = await supabase
                .from("messages")
                .insert({
                    conversation_id: conversationId,
                    sender_type: "user",
                    text,
                })
                .select()
                .single();

            if (saveError || !savedUserMessage) {
                console.error("Failed to save user message:", saveError);
                setInput(text);
                setVoiceNotice("Could not send message. Please try again.");
                return;
            }

            setMessages((prev) => [...prev, savedUserMessage]);

            await completeSavedUserMessage(savedUserMessage, {
                source: prefilledText ? "suggested_reply" : "typed",
                recentMessages,
                trackMessageEvents: true,
            });

            inputRef.current?.focus();
        } catch (error) {
            console.error("Failed to send message:", error);
            setInput(text);
            setVoiceNotice("Could not generate reply. Please try again.");
        } finally {
            if (!pendingReplyRef.current) {
                sendingRef.current = false;
                setIsTyping(false);
            }
        }
    }

    if (creatorUnavailable) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
                <div className="max-w-sm text-center">
                    <h1 className="text-2xl font-bold mb-3">
                        Creator chat is not available.
                    </h1>
                    <button
                        onClick={() => router.push("/")}
                        className="w-full bg-white text-black py-3 rounded-2xl font-semibold"
                    >
                        Explore creators
                    </button>
                </div>
            </main>
        );
    }

    if (!creator) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center">
                Loading chat...
            </main>
        );
    }

    async function useSuggestedReply(text: string) {
        await sendMessage(text);
    }

    function playSoftPing() {
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = 620;

        gain.gain.setValueAtTime(0.03, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + 0.15
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.15);
    }

    function formatVoiceTime(seconds: number) {
        const safeSeconds = Math.max(0, Math.floor(seconds));

        if (safeSeconds < 60) {
            return `${safeSeconds} sec left`;
        }

        return `${Math.floor(safeSeconds / 60)} min left`;
    }

    const hasUserMessages = messages.some(
        (message) => message.sender_type === "user"
    );
    const isWaitingForReply =
        isTyping;
    const canReplayAudio =
        subscriptionStatus === "active" ||
        remainingSeconds > 0 ||
        hasPaidBefore;

    return (
        <main className="min-h-screen bg-black text-white flex flex-col">
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/90 backdrop-blur p-4">
                <div className="px-4 py-2 border-b border-zinc-900 bg-zinc-950/60">
                    <div className="flex items-center justify-between text-xs text-zinc-500">

                        <p>{formatVoiceTime(remainingSeconds)}</p>

                        <p>
                            {subscriptionStatus === "active"
                                ? "Premium"
                                : "Free"}
                        </p>

                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push("/chats")}
                        className="text-zinc-400"
                    >
                        ←
                    </button>

                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
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

                    <div>
                        <h1 className="font-bold leading-tight">
                            {creator.display_name}
                        </h1>
                        <p className="text-xs text-zinc-500">
                            @{creator.username}
                        </p>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-36">
                {!hasUserMessages && (
                    <div className="text-center mt-20">
                        <p className="text-zinc-500 mb-5">
                            Start a private conversation with {creator.display_name}.
                        </p>

                        <div className="flex flex-col gap-3 items-center">
                            {[
                                "Call me daddy 😏",
                                "Say meow 🐱",
                                "Tell me you missed me ❤️",
                            ].map((reply) => (
                                <button
                                    key={reply}
                                    disabled={isWaitingForReply}
                                    onClick={() => useSuggestedReply(reply)}
                                    className={`bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200 ${isWaitingForReply ? "opacity-50 cursor-not-allowed" : ""
                                        }`}
                                >
                                    💬 {reply}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((message) => (
                    <motion.div
                        key={message.id}
                        initial={{
                            opacity: 0,
                            y: 10,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        transition={{
                            duration: 0.25,
                        }}
                        className={`flex ${message.sender_type === "user" ? "justify-end" : "justify-start"
                            }`}
                    >
                        <div
                            className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-relaxed ${message.sender_type === "user"
                                ? "chat-message-user bg-white text-black rounded-br-md"
                                : "bg-zinc-900 text-white rounded-bl-md border border-zinc-800"
                                }`}
                        >
                            <div>
                                {message.is_fallback && (
                                    <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                                        offline mode
                                    </div>
                                )}

                                <p
                                    className={`text-sm leading-relaxed ${message.sender_type === "user"
                                        ? "chat-message-user-text text-black"
                                        : "text-zinc-300"
                                        }`}
                                >
                                    {expandedMessages.includes(message.id)
                                        ? message.text
                                        : message.text.length > 140
                                            ? `${message.text.slice(0, 140)}...`
                                            : message.text}
                                </p>
                            </div>

                            {message.text.length > 140 &&
                                !expandedMessages.includes(message.id) && (
                                    <button
                                        onClick={() => {
                                            setExpandedMessages((prev) => [
                                                ...prev,
                                                message.id,
                                            ]);
                                        }}
                                        className="text-xs text-zinc-400 mt-2 hover:text-zinc-200 transition"
                                    >
                                        Show more
                                    </button>
                                )}

                            {message.audio_url && (
                                canReplayAudio ? (
                                    <AudioPlayer audioUrl={message.audio_url} />
                                ) : (
                                    <button
                                        onClick={() => openPaywall("audio_replay_locked")}
                                        className="w-[230px] max-w-full bg-zinc-950/80 border border-zinc-800 rounded-3xl px-3 py-3 mt-3 text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-full w-10 h-10 bg-zinc-800 text-zinc-400 flex items-center justify-center">
                                                🔒
                                            </div>

                                            <div>
                                                <p className="text-sm font-semibold text-zinc-300">
                                                    Voice locked
                                                </p>
                                                <p className="text-xs text-zinc-500">
                                                    Upgrade to keep listening
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                )
                            )}

                            {message.created_at && (
                                <p
                                    className={`text-[10px] mt-2 ${message.sender_type === "user"
                                        ? "chat-message-user-time text-black/50"
                                        : "text-zinc-500"
                                        }`}
                                >
                                    {new Date(message.created_at).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </p>
                            )}
                        </div>
                    </motion.div>
                ))}

                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl rounded-bl-md px-4 py-3">
                            {messages.length === 0 && (
                                <p className="text-sm text-zinc-400 mb-2">
                                    {creator.display_name} is recording a voice message...
                                </p>
                            )}

                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" />
                                <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:120ms]" />
                                <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:240ms]" />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-black/95 backdrop-blur p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                {voiceNotice && (
                    <div className="mb-3 rounded-2xl border border-yellow-900 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-200">
                        {voiceNotice}
                    </div>
                )}

                <div className="flex gap-3">
                    <input
                        disabled={isWaitingForReply}
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !isWaitingForReply) {
                                sendMessage();
                            }
                        }}
                        placeholder={`Message ${creator.display_name}...`}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-zinc-600"
                    />

                    <button
                        disabled={isWaitingForReply}
                        onClick={() => sendMessage()}
                        className={`px-5 rounded-2xl font-semibold transition ${isWaitingForReply
                            ? "bg-zinc-700 text-zinc-400"
                            : "bg-white text-black"
                            }`}
                    >
                        Send
                    </button>
                </div>
                <div className="mt-2 flex justify-end">
                    <p
                        className={`text-xs ${input.length > MAX_MESSAGE_LENGTH
                            ? "text-red-500"
                            : "text-zinc-500"
                            }`}
                    >
                        {input.length}/{MAX_MESSAGE_LENGTH}
                    </p>
                </div>
            </div>



            {showPaywall && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full text-center">
                        <div className="text-4xl mb-4">💜</div>

                        <h2 className="text-2xl font-bold mb-2">
                            You're out of voice minutes.
                        </h2>

                        <p className="text-zinc-400 mb-6">
                            Choose a plan or add more voice minutes to keep chatting.
                        </p>

                        <button
                            onClick={() => {
                                router.push("/pricing");
                            }}
                            className="w-full bg-green-500 text-black py-4 rounded-2xl font-bold mb-3"
                        >
                            View plans & minutes
                        </button>

                        <button
                            onClick={() => {
                                setShowPaywall(false);
                            }}
                            className="w-full bg-zinc-800 text-white py-3 rounded-2xl font-semibold"
                        >
                            Maybe later
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
