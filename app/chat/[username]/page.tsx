"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { buildCreatorSafetyPrompt } from "@/services/prompts";
import AudioPlayer from "@/components/audio/AudioPlayer";
import { motion } from "framer-motion";

interface Message {
    id: string;
    sender_type: "user" | "ai";
    text: string;
    audio_url?: string | null;
}

interface Creator {
    id: string;
    username: string;
    display_name: string;
    tagline: string | null;
    profile_image: string | null;
    personality_prompt: string | null;
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
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [expandedMessages, setExpandedMessages] = useState<string[]>([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);

    const bottomRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        async function setupConversation() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            const { data: creatorData, error: creatorError } = await supabase
                .from("creators")
                .select("id, username, display_name, tagline, profile_image, personality_prompt, intro_audio")
                .eq("username", username)
                .single();

            if (creatorError || !creatorData) {
                console.error(creatorError);
                return;
            }

            setCreator(creatorData);

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

                setMessages(existingMessages || []);
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
                    return;
                }

                return;
            }

            setConversationId(newConversation.id);

            setIsTyping(true);

            setTimeout(async () => {
                const introMessage =
                    `Hey... I'm really happy you're here 💜`;

                const { data: savedIntroMessage } = await supabase
                    .from("messages")
                    .insert({
                        conversation_id: newConversation.id,
                        sender_type: "ai",
                        text: introMessage,
                        audio_url: creatorData.intro_audio || "/mock-voice.mp3",
                    })
                    .select()
                    .single();

                if (savedIntroMessage) {
                    setMessages([savedIntroMessage]);
                    playSoftPing();
                }

                setIsTyping(false);
            }, 1200);
        }

        setupConversation();
    }, [router, username]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    async function sendMessage(prefilledText?: string) {
        const messageText =
            typeof prefilledText === "string"
                ? prefilledText.trim()
                : input.trim();

        if (!messageText || !conversationId || !creator) return;
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            router.push("/login");
            return;
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("voice_seconds_remaining")
            .eq("id", user.id)
            .single();

        if (!profile || profile.voice_seconds_remaining <= 0) {
            setShowPaywall(true);
            return;
        }

        const text = messageText;

        const moderationResponse = await fetch("/api/moderate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ text }),
        });

        const moderationData = await moderationResponse.json();

        if (!moderationData.allowed) {
            alert(moderationData.reason);
            return;
        }

        setInput("");

        const { data: savedUserMessage } = await supabase
            .from("messages")
            .insert({
                conversation_id: conversationId,
                sender_type: "user",
                text,
            })
            .select()
            .single();

        if (savedUserMessage) {
            setMessages((prev) => [...prev, savedUserMessage]);
        }

        setIsTyping(true);

        setTimeout(async () => {
            buildCreatorSafetyPrompt();

            const aiResponse = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: text,
                    creatorName: creator.display_name,
                    creatorTagline: creator.tagline,
                    creatorStyle: creator.personality_prompt,
                }),
            });

            const aiData = await aiResponse.json();
            const aiText = aiData.reply || "Tell me more.";
            const wordCount = aiText.trim().split(/\s+/).length;

            const estimatedSeconds = Math.min(
                30,
                Math.max(3, Math.ceil(wordCount / 2.5))
            );

            const voiceResponse = await fetch("/api/voice", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text: aiText,
                }),
            });

            const voiceData = await voiceResponse.json();
            const audioUrl = voiceData.audio
                ? `data:${voiceData.mimeType};base64,${voiceData.audio}`
                : voiceData.audioUrl;

            const { data: savedAiMessage } = await supabase
                .from("messages")
                .insert({
                    conversation_id: conversationId,
                    sender_type: "ai",
                    text: aiText,
                    audio_url: audioUrl,
                })
                .select()
                .single();

            if (savedAiMessage) {
                setMessages((prev) => [...prev, savedAiMessage]);
                playSoftPing();
            }

            await supabase.rpc("decrease_voice_seconds", {
                seconds_to_decrease: estimatedSeconds,
            });

            setIsTyping(false);
            inputRef.current?.focus();
        }, 900);
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

    return (
        <main className="min-h-screen bg-black text-white flex flex-col">
            <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/90 backdrop-blur p-4">
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

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
                {messages.length <= 1 && (
                    <div className="text-center mt-20">
                        <p className="text-zinc-500 mb-5">
                            Start a private conversation with {creator.display_name}.
                        </p>

                        <div className="flex flex-col gap-3 items-center">
                            {[
                                "Tell me something 💜",
                                "I missed you so much",
                                "How are you?",
                            ].map((reply) => (
                                <button
                                    key={reply}
                                    onClick={() => useSuggestedReply(reply)}
                                    className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200"
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
                                ? "bg-white text-black rounded-br-md"
                                : "bg-zinc-900 text-white rounded-bl-md border border-zinc-800"
                                }`}
                        >
                            <div>
                                <p className="text-sm text-zinc-300 leading-relaxed">
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
                                <AudioPlayer audioUrl={message.audio_url} />
                            )}
                        </div>
                    </motion.div>
                ))}

                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl rounded-bl-md px-4 py-3 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" />
                            <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:120ms]" />
                            <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:240ms]" />
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-black/95 backdrop-blur p-4">
                <div className="flex gap-3">
                    <input
                        disabled={isTyping}
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                sendMessage();
                            }
                        }}
                        placeholder={`Message ${creator.display_name}...`}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-zinc-600"
                    />

                    <button
                        disabled={isTyping}
                        onClick={() => sendMessage()}
                        className={`px-5 rounded-2xl font-semibold transition ${isTyping
                            ? "bg-zinc-700 text-zinc-400"
                            : "bg-white text-black"
                            }`}
                    >
                        Send
                    </button>
                </div>
            </div>
            {showPaywall && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full text-center">
                        <div className="text-4xl mb-4">💜</div>

                        <h2 className="text-2xl font-bold mb-2">
                            Your free voice time is over
                        </h2>

                        <p className="text-zinc-400 mb-6">
                            Continue the conversation and keep listening to creator voice replies.
                        </p>

                        <button
                            onClick={() => {
                                router.push("/pricing");
                            }}
                            className="w-full bg-green-500 text-black py-4 rounded-2xl font-bold mb-3"
                        >
                            Continue conversation
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