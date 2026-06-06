"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/navigation/BottomNav";

interface ChatItem {
  id: string;
  creator: {
    username: string;
    display_name: string;
    profile_image: string | null;
  } | null;
  last_message: string;
}

export default function ChatsPage() {
  const router = useRouter();

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadChats() {

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: conversations } = await supabase
        .from("conversations")
        .select(`
          id,
          creator_id
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!conversations) {
        setLoading(false);
        return;
      }

      const creatorIds = conversations
        .map((conversation: any) => conversation.creator_id)
        .filter(Boolean);

      const { data: creators } = creatorIds.length > 0
        ? await supabase
          .from("public_creators")
          .select("id, username, display_name, profile_image")
          .in("id", creatorIds)
        : { data: [] };

      const creatorsById = new Map(
        (creators || []).map((creator: any) => [creator.id, creator])
      );

      const formattedChats = await Promise.all(
        conversations.map(async (conversation: any) => {

          const { data: message } = await supabase
            .from("messages")
            .select("text")
            .eq("conversation_id", conversation.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          return {
            id: conversation.id,
            creator: creatorsById.get(conversation.creator_id) || null,
            last_message:
              message?.text || "Start your conversation",
          };
        })
      );

      setChats(formattedChats);
      setLoading(false);
    }

    loadChats();
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white pb-24">
      <div className="p-6">

        <h1 className="text-3xl font-bold mb-2">
          Chats
        </h1>

        <p className="text-zinc-500 mb-8">
          Your creator conversations
        </p>

        {loading && (
          <p className="text-zinc-500">
            Loading chats...
          </p>
        )}

        {!loading && chats.length === 0 && (
          <div className="text-center mt-24">
            <p className="text-zinc-400 mb-4">
              No conversations yet
            </p>

            <button
              onClick={() => router.push("/")}
              className="bg-white text-black px-5 py-3 rounded-2xl font-semibold"
            >
              Explore creators
            </button>
          </div>
        )}

        <div className="space-y-3">

          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => {
                if (chat.creator) {
                  router.push(`/chat/${chat.creator.username}`);
                }
              }}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-4 flex items-center gap-4 text-left"
            >

              <div className="w-14 h-14 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center text-xl shrink-0">
                {chat.creator?.profile_image ? (
                  <img
                    src={chat.creator.profile_image}
                    alt={chat.creator.display_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  "👤"
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold truncate">
                    {chat.creator?.display_name || "Creator unavailable"}
                  </h2>

                  <span className="text-zinc-500 text-sm truncate">
                    {chat.creator ? `@${chat.creator.username}` : "Not public"}
                  </span>
                </div>

                <p className="text-zinc-400 text-sm truncate mt-1">
                  {chat.last_message}
                </p>
              </div>

              <div className="text-zinc-600">
                ›
              </div>

            </button>
          ))}

        </div>

      </div>

      <BottomNav />
    </main>
  );
}
