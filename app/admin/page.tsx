"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "frants1illia@gmail.com";

interface CreatorReview {
  id: string;
  username: string | null;
  display_name: string | null;
  tagline: string | null;
  bio: string | null;
  profile_image: string | null;
  banner_image: string | null;
  intro_audio: string | null;
  is_published: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
}

export default function AdminPage() {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");

  const [users, setUsers] = useState(0);
  const [creators, setCreators] = useState(0);
  const [conversations, setConversations] = useState(0);
  const [messages, setMessages] = useState(0);
  const [premiumUsers, setPremiumUsers] = useState(0);
  const [voiceMessages, setVoiceMessages] = useState(0);
  const [pendingCreators, setPendingCreators] = useState<CreatorReview[]>([]);
  const [liveCreators, setLiveCreators] = useState<CreatorReview[]>([]);

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token;
  }

  async function loadCreatorReviews() {
    const token = await getAccessToken();

    if (!token) return;

    const response = await fetch("/api/admin/creators", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to load creator reviews");
      return;
    }

    const data = await response.json();

    setPendingCreators(data.pending || []);
    setLiveCreators(data.live || []);
  }

  useEffect(() => {
    async function loadAdminStats() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || user.email !== ADMIN_EMAIL) {
        setAllowed(false);
        setLoading(false);
        return;
      }

      setAllowed(true);

      const [{ count: usersCount }, { count: creatorsCount }, { count: conversationsCount }, { count: messagesCount }, { count: premiumCount }, { count: voiceCount }] =
        await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("creators").select("*", { count: "exact", head: true }),
          supabase.from("conversations").select("*", { count: "exact", head: true }),
          supabase.from("messages").select("*", { count: "exact", head: true }),
          supabase.from("profiles").select("*", { count: "exact", head: true }).eq("subscription_status", "active"),
          supabase.from("messages").select("*", { count: "exact", head: true }).eq("voice_generated", true),
        ]);

      setUsers(usersCount || 0);
      setCreators(creatorsCount || 0);
      setConversations(conversationsCount || 0);
      setMessages(messagesCount || 0);
      setPremiumUsers(premiumCount || 0);
      setVoiceMessages(voiceCount || 0);

      await loadCreatorReviews();

      setLoading(false);
    }

    loadAdminStats();
  }, []);

  async function runCreatorAction(
    creatorId: string,
    action: "approve" | "reject" | "deactivate"
  ) {
    const token = await getAccessToken();

    if (!token) return;

    try {
      setActionLoading(`${action}-${creatorId}`);

      const response = await fetch(
        `/api/admin/creators/${creatorId}/${action}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();

        alert(data.error || "Creator moderation action failed.");
        return;
      }

      await loadCreatorReviews();
    } catch (error) {
      console.error("Creator moderation action failed:", error);
      alert("Creator moderation action failed.");
    } finally {
      setActionLoading("");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading admin...
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Access denied</h1>
          <p className="text-zinc-500">This page is only for internal admin use.</p>
        </div>
      </main>
    );
  }

  const stats = [
    ["Users", users],
    ["Creators", creators],
    ["Conversations", conversations],
    ["Messages", messages],
    ["Premium users", premiumUsers],
    ["Voice generations", voiceMessages],
  ];

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>

        <p className="text-zinc-500 mb-8">
          Internal MVP metrics and creator moderation.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          {stats.map(([label, value]) => (
            <div
              key={label}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5"
            >
              <p className="text-sm text-zinc-500 mb-2">{label}</p>
              <p className="text-3xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        <CreatorReviewSection
          title="Pending Creator Reviews"
          emptyText="No pending creators"
          creators={pendingCreators}
          actionLoading={actionLoading}
          actions={(creator) => (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => runCreatorAction(creator.id, "approve")}
                disabled={Boolean(actionLoading)}
                className="bg-green-500 text-black rounded-2xl py-3 font-bold disabled:opacity-50"
              >
                Approve
              </button>

              <button
                onClick={() => runCreatorAction(creator.id, "reject")}
                disabled={Boolean(actionLoading)}
                className="bg-red-500 text-white rounded-2xl py-3 font-bold disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          )}
        />

        <CreatorReviewSection
          title="Live Creators"
          emptyText="No live creators"
          creators={liveCreators}
          actionLoading={actionLoading}
          actions={(creator) => (
            <button
              onClick={() => runCreatorAction(creator.id, "deactivate")}
              disabled={Boolean(actionLoading)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-2xl py-3 font-bold disabled:opacity-50"
            >
              Deactivate
            </button>
          )}
        />
      </div>
    </main>
  );
}

function CreatorReviewSection({
  title,
  emptyText,
  creators,
  actionLoading,
  actions,
}: {
  title: string;
  emptyText: string;
  creators: CreatorReview[];
  actionLoading: string;
  actions: (creator: CreatorReview) => ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold mb-4">{title}</h2>

      {creators.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-5 text-zinc-500">
          {emptyText}
        </div>
      ) : (
        <div className="grid gap-4">
          {creators.map((creator) => (
            <div
              key={creator.id}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4"
            >
              {creator.banner_image && (
                <img
                  src={creator.banner_image}
                  alt={`${creator.display_name || "Creator"} banner`}
                  className="w-full h-28 object-cover rounded-2xl mb-4"
                />
              )}

              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
                  {creator.profile_image ? (
                    <img
                      src={creator.profile_image}
                      alt={creator.display_name || "Creator"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">👤</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold">
                    {creator.display_name || "Untitled creator"}
                  </h3>

                  <p className="text-sm text-zinc-500">
                    @{creator.username || "username"}
                  </p>

                  <p className="text-sm text-zinc-300 mt-3">
                    {creator.tagline || creator.bio || "No description provided."}
                  </p>

                  {creator.intro_audio && (
                    <audio
                      src={creator.intro_audio}
                      controls
                      className="w-full mt-4"
                    />
                  )}

                  <p className="text-xs text-zinc-600 mt-3">
                    Submitted:{" "}
                    {creator.created_at
                      ? new Date(creator.created_at).toLocaleString()
                      : "Unknown"}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                {actionLoading.endsWith(creator.id) ? (
                  <p className="text-sm text-zinc-500">Updating creator...</p>
                ) : (
                  actions(creator)
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
