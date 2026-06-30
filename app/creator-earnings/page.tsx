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
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [profileViews, setProfileViews] = useState(0);
  const [chatStarts, setChatStarts] = useState(0);

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

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const response = await fetch("/api/creator-analytics", {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        });

        if (response.status === 403) {
          router.replace("/profile");
          return;
        }

        if (!response.ok) {
          throw new Error("Creator analytics request failed");
        }

        const analytics = await response.json();

        setConversationCount(analytics.conversationCount || 0);
        setMessageCount(analytics.messageCount || 0);
        setVoiceGenerations(analytics.voiceGenerations || 0);
        setVoiceSeconds(analytics.voiceSeconds || 0);
        setProfileViews(analytics.profileViews || 0);
        setChatStarts(analytics.chatStarts || 0);
      } catch (error) {
        console.error("Failed to load creator earnings:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  const estimatedActivityValue =
    (voiceGenerations * 0.02).toFixed(2);
  const voiceMinutes = Math.floor(voiceSeconds / 60);
  const remainingVoiceSeconds = voiceSeconds % 60;

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-black text-white p-6 pb-24">
        <div className="max-w-md mx-auto">

          <button
            onClick={() => router.push("/profile")}
            className="text-sm text-zinc-400 hover:text-white transition mb-4"
          >
            ← Profile
          </button>

          <h1 className="text-3xl font-bold mb-2">
            Creator Analytics
          </h1>

          <p className="text-zinc-500 mb-8">
            Track your creator growth and early activity signals.
          </p>

          {loading ? (
            <p className="text-zinc-500">
              Loading analytics...
            </p>
          ) : (
            <div className="space-y-4">

              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
                <p className="text-sm text-zinc-500 mb-2">
                  Activity value
                </p>

                <p className="text-4xl font-bold">
                  ${estimatedActivityValue}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
                  <p className="text-sm text-zinc-500 mb-2">
                    Profile views
                  </p>

                  <p className="text-3xl font-bold">
                    {profileViews}
                  </p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
                  <p className="text-sm text-zinc-500 mb-2">
                    Chat starts
                  </p>

                  <p className="text-3xl font-bold">
                    {chatStarts}
                  </p>
                </div>

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

              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
                <p className="text-sm text-zinc-500 mb-2">
                  Voice minutes used
                </p>

                <p className="text-3xl font-bold">
                  {voiceMinutes}m {remainingVoiceSeconds}s
                </p>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5">
                <p className="text-sm text-zinc-400 leading-relaxed">
                  This is an internal MVP activity estimate, not a payout balance.
                  Creator payout rules will be defined before creator monetization launches.
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
