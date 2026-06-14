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
  instagram_handle: string | null;
  voice_sample_path: string | null;
  voice_sample_url: string | null;
  voice_id: string | null;
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
  const [voiceInputs, setVoiceInputs] = useState<Record<string, string>>({});
  const [voiceStatuses, setVoiceStatuses] = useState<Record<string, string>>({});

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

    const nextVoiceInputs: Record<string, string> = {};
    [...(data.pending || []), ...(data.live || [])].forEach(
      (creator: CreatorReview) => {
        nextVoiceInputs[creator.id] = creator.voice_id || "";
      }
    );
    setVoiceInputs(nextVoiceInputs);
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

  async function validateCreatorVoiceId(creatorId: string) {
    const token = await getAccessToken();
    const voiceId = voiceInputs[creatorId]?.trim();

    if (!token || !voiceId) return;

    try {
      setVoiceStatuses((prev) => ({
        ...prev,
        [creatorId]: "Checking voice ID...",
      }));

      const response = await fetch("/api/elevenlabs/validate-voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          voiceId,
        }),
      });

      const data = await response.json();

      setVoiceStatuses((prev) => ({
        ...prev,
        [creatorId]:
          response.ok && data.valid
            ? "Voice ID valid"
            : data.error || "Voice ID not found or unavailable",
      }));
    } catch (error) {
      console.error("Voice ID validation failed:", error);
      setVoiceStatuses((prev) => ({
        ...prev,
        [creatorId]: "Voice ID not found or unavailable",
      }));
    }
  }

  async function saveCreatorVoiceId(creatorId: string) {
    const token = await getAccessToken();
    const voiceId = voiceInputs[creatorId]?.trim();

    if (!token || !voiceId) return;

    try {
      setActionLoading(`voice-${creatorId}`);

      const response = await fetch(`/api/admin/creators/${creatorId}/voice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          voiceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setVoiceStatuses((prev) => ({
          ...prev,
          [creatorId]: data.error || "Failed to save Voice ID",
        }));
        return;
      }

      setVoiceStatuses((prev) => ({
        ...prev,
        [creatorId]: "Voice ID saved",
      }));
      await loadCreatorReviews();
    } catch (error) {
      console.error("Voice ID save failed:", error);
      setVoiceStatuses((prev) => ({
        ...prev,
        [creatorId]: "Failed to save Voice ID",
      }));
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
          voiceInputs={voiceInputs}
          voiceStatuses={voiceStatuses}
          onVoiceInputChange={(creatorId, value) => {
            setVoiceInputs((prev) => ({
              ...prev,
              [creatorId]: value,
            }));
            setVoiceStatuses((prev) => ({
              ...prev,
              [creatorId]: "",
            }));
          }}
          onValidateVoiceId={validateCreatorVoiceId}
          onSaveVoiceId={saveCreatorVoiceId}
          actions={(creator) => (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => runCreatorAction(creator.id, "approve")}
                disabled={Boolean(actionLoading) || !creator.voice_id}
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
          voiceInputs={voiceInputs}
          voiceStatuses={voiceStatuses}
          onVoiceInputChange={(creatorId, value) => {
            setVoiceInputs((prev) => ({
              ...prev,
              [creatorId]: value,
            }));
            setVoiceStatuses((prev) => ({
              ...prev,
              [creatorId]: "",
            }));
          }}
          onValidateVoiceId={validateCreatorVoiceId}
          onSaveVoiceId={saveCreatorVoiceId}
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
  voiceInputs,
  voiceStatuses,
  onVoiceInputChange,
  onValidateVoiceId,
  onSaveVoiceId,
  actions,
}: {
  title: string;
  emptyText: string;
  creators: CreatorReview[];
  actionLoading: string;
  voiceInputs: Record<string, string>;
  voiceStatuses: Record<string, string>;
  onVoiceInputChange: (creatorId: string, value: string) => void;
  onValidateVoiceId: (creatorId: string) => void;
  onSaveVoiceId: (creatorId: string) => void;
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

                  {creator.instagram_handle && (
                    <p className="text-sm text-zinc-400 mt-2">
                      Instagram: {creator.instagram_handle}
                    </p>
                  )}

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

                  {creator.voice_sample_url ? (
                    <div className="mt-4 rounded-2xl border border-zinc-800 bg-black p-3">
                      <p className="text-xs text-zinc-500 mb-2">
                        Private voice sample
                      </p>
                      <audio
                        src={creator.voice_sample_url}
                        controls
                        className="w-full"
                      />
                      <a
                        href={creator.voice_sample_url}
                        download
                        className="mt-3 inline-flex text-sm text-zinc-300 underline"
                      >
                        Download voice sample
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-red-300 mt-4">
                      No voice sample uploaded.
                    </p>
                  )}

                  <div className="mt-4 rounded-2xl border border-zinc-800 bg-black p-3">
                    <label className="block text-xs text-zinc-500 mb-2">
                      ElevenLabs Voice ID
                    </label>
                    <input
                      value={voiceInputs[creator.id] || ""}
                      onChange={(event) =>
                        onVoiceInputChange(creator.id, event.target.value)
                      }
                      placeholder="Paste admin-created voice ID"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm outline-none"
                    />
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => onValidateVoiceId(creator.id)}
                        className="rounded-xl bg-zinc-800 border border-zinc-700 py-2 text-sm font-semibold"
                      >
                        Validate Voice ID
                      </button>
                      <button
                        type="button"
                        onClick={() => onSaveVoiceId(creator.id)}
                        disabled={actionLoading === `voice-${creator.id}`}
                        className="rounded-xl bg-white text-black py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        Save Voice ID
                      </button>
                    </div>
                    {voiceStatuses[creator.id] && (
                      <p
                        className={`text-xs mt-2 ${
                          voiceStatuses[creator.id].toLowerCase().includes("valid") ||
                          voiceStatuses[creator.id].toLowerCase().includes("saved")
                            ? "text-green-400"
                            : "text-red-300"
                        }`}
                      >
                        {voiceStatuses[creator.id]}
                      </p>
                    )}
                    {creator.voice_id && (
                      <p className="text-xs text-green-400 mt-2">
                        Saved voice ID is ready for approval.
                      </p>
                    )}
                  </div>

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
