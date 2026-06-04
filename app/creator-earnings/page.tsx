"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/navigation/BottomNav";

import { supabase } from "@/lib/supabase";

export default function CreatorEarningsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [conversationCount, setConversationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [voiceGenerations, setVoiceGenerations] = useState(0);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data: creator } = await supabase
          .from("creators")
          .select("id, username, display_name, tagline, personality_prompt, voice_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (
          !creator?.username ||
          !creator.display_name ||
          !creator.tagline ||
          !creator.personality_prompt ||
          !creator.voice_id
        ) {
          router.replace("/profile");
          return;
        }

        const { data: conversations } = await supabase
          .from("conversations")
          .select("id")
          .eq("creator_id", creator.id);

        const conversationIds =
          conversations?.map((c) => c.id) || [];

        setConversationCount(conversationIds.length);

        if (conversationIds.length > 0) {
          const { data: messages } = await supabase
            .from("messages")
            .select("voice_generated")
            .in("conversation_id", conversationIds);

          setMessageCount(messages?.length || 0);

          const generatedVoices =
            messages?.filter(
              (m) => m.voice_generated
            ).length || 0;

          setVoiceGenerations(generatedVoices);
        }

      } catch (error) {
        console.error("Failed to load creator earnings:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  const estimatedEarnings =
    (voiceGenerations * 0.02).toFixed(2);

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-black text-white p-6 pb-24">
        <div className="max-w-md mx-auto">

          <h1 className="text-3xl font-bold mb-2">
            Creator Earnings
          </h1>

          <p className="text-zinc-500 mb-8">
            Track your creator growth and estimated earnings.
          </p>

          {loading ? (
            <p className="text-zinc-500">
              Loading analytics...
            </p>
          ) : (
            <div className="space-y-4">

              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
                <p className="text-sm text-zinc-500 mb-2">
                  Estimated earnings
                </p>

                <p className="text-4xl font-bold">
                  ${estimatedEarnings}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
                  <p className="text-sm text-zinc-500 mb-2">
                    Conversations
                  </p>

                  <p className="text-3xl font-bold">
                    {conversationCount}
                  </p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
                  <p className="text-sm text-zinc-500 mb-2">
                    Messages
                  </p>

                  <p className="text-3xl font-bold">
                    {messageCount}
                  </p>
                </div>

              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
                <p className="text-sm text-zinc-500 mb-2">
                  Voice generations
                </p>

                <p className="text-3xl font-bold">
                  {voiceGenerations}
                </p>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5">
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Creator payouts are currently handled manually.
                  Automated payouts and creator revenue sharing
                  are coming in a future update.
                </p>
              </div>

            </div>
          )}

        </div>

        <BottomNav />
      </main>
    </ProtectedRoute>
  );
}
