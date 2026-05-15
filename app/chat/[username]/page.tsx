"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { buildCreatorSafetyPrompt } from "@/services/prompts";
import AudioPlayer from "@/components/audio/AudioPlayer";

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
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    const bottomRef = useRef<HTMLDivElement | null>(null);

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
                .select("id, username, display_name, tagline, profile_image, personality_prompt")
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
                .insert({
                    user_id: user.id,
                    creator_id: creatorData.id,
                })
                .select()
                .single();

            if (error) {
                console.error(error);
                return;
            }

            setConversationId(newConversation.id);
        }

        setupConversation();
    }, [router, username]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    async function sendMessage() {
        if (!input.trim() || !conversationId || !creator) return;

        const text = input.trim();

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
            }

            setIsTyping(false);
        }, 900);
    }

    if (!creator) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center">
                Loading chat...
            </main>
        );
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
                {messages.length === 0 && (
                    <div className="text-center text-zinc-500 mt-20">
                        Start a private conversation with {creator.display_name}.
                    </div>
                )}

                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.sender_type === "user" ? "justify-end" : "justify-start"
                            }`}
                    >
                        <div
                            className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-relaxed ${message.sender_type === "user"
                                ? "bg-white text-black rounded-br-md"
                                : "bg-zinc-900 text-white rounded-bl-md border border-zinc-800"
                                }`}
                        >
                            <p>{message.text}</p>

                            {message.audio_url && (
                                <AudioPlayer audioUrl={message.audio_url} />
                            )}
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl rounded-bl-md px-4 py-3 text-zinc-400 text-sm">
                            {creator.display_name} is typing...
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-black/95 backdrop-blur p-4">
                <div className="flex gap-3">
                    <input
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
                        onClick={sendMessage}
                        className="bg-white text-black px-5 rounded-2xl font-semibold"
                    >
                        Send
                    </button>
                </div>
            </div>
        </main>
    );
}