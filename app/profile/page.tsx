"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/navigation/BottomNav";

export default function ProfilePage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [subscriptionStatus, setSubscriptionStatus] = useState("free");
  const [creatorUsername, setCreatorUsername] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setEmail(user.email || "");

        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "username, voice_seconds_remaining, subscription_status"
          )
          .eq("id", user.id)
          .single();

        if (profile) {
          setUsername(profile.username || "");
          setUsernameDraft(profile.username || "");
          setSeconds(profile.voice_seconds_remaining || 0);
          setSubscriptionStatus(profile.subscription_status || "free");
        }

        const { data: creator } = await supabase
          .from("creators")
          .select(
            "username, display_name, tagline, personality_prompt, profile_image, banner_image, intro_audio, voice_id"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (
          creator?.username &&
          creator.display_name &&
          creator.tagline &&
          creator.personality_prompt &&
          creator.profile_image &&
          creator.banner_image &&
          creator.intro_audio &&
          creator.voice_id
        ) {
          setCreatorUsername(creator.username || "");
        }
      }
    }

    getUser();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function saveUsername() {
    const nextUsername = usernameDraft.trim();

    if (nextUsername.length < 3) {
      alert("Username must be at least 3 characters.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        username: nextUsername,
      })
      .eq("id", user.id);

    if (error) {
      console.error(error);
      alert("Failed to update username.");
      return;
    }

    setUsername(nextUsername);
    setEditingUsername(false);
  }

  async function openBillingPortal() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
    });

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
      return;
    }

    router.push("/pricing");
  }

  async function copyCreatorLink() {
    if (!creatorUsername) return;

    const link = `${window.location.origin}/creator/${creatorUsername}`;

    await navigator.clipboard.writeText(link);

    alert("Profile link copied!");
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const isPremium = subscriptionStatus === "active";
  const isOutOfMinutes = seconds <= 0;
  const isCanceledOrPastDue =
    subscriptionStatus === "canceled" ||
    subscriptionStatus === "past_due";

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-black text-white p-6 pb-24">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold mb-2">Profile</h1>

          <p className="text-zinc-400">{email}</p>

          <div className="mb-8">
            {editingUsername ? (
              <div className="flex gap-2">
                <input
                  value={usernameDraft}
                  onChange={(event) => setUsernameDraft(event.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none"
                  placeholder="username"
                />

                <button
                  onClick={saveUsername}
                  className="bg-white text-black px-4 rounded-2xl font-bold"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-zinc-500">
                <p>@{username || "username"}</p>

                <button
                  onClick={() => {
                    setUsernameDraft(username);
                    setEditingUsername(true);
                  }}
                  className="text-zinc-400"
                  aria-label="Edit username"
                >
                  ✎
                </button>
              </div>
            )}
          </div>

          {creatorUsername && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4">
              <p className="text-sm text-zinc-500 mb-3">
                Share your creator profile
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={copyCreatorLink}
                  className="bg-white text-black p-3 rounded-2xl font-bold"
                >
                  Copy link
                </button>

                <button
                  onClick={() => {
                    router.push(`/creator/${creatorUsername}`);
                  }}
                  className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-2xl font-semibold"
                >
                  View profile
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-center min-h-[110px]">
              <p className="text-sm text-zinc-500">Plan</p>
              <p className="text-2xl font-bold flex items-center gap-2 mt-2 whitespace-nowrap">
                {subscriptionStatus === "active" ? (
                  <>
                    Premium <span>💎</span>
                  </>
                ) : (
                  "Free"
                )}
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-center min-h-[110px]">
              <p className="text-sm text-zinc-500">Voice minutes</p>
              <p className="text-3xl font-bold mt-2">
                {minutes}m {remainingSeconds}s
              </p>
            </div>
          </div>


          <button
            onClick={() => {
              router.push("/dashboard");
            }}
            className="w-full bg-white text-black p-4 rounded-2xl font-bold mb-3"
          >
            Creator Studio
          </button>

          {creatorUsername && (
            <button
              onClick={() => {
                router.push("/creator-earnings");
              }}
              className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-2xl font-semibold mb-3"
            >
              Creator Earnings
            </button>
          )}

          {!isPremium && !isCanceledOrPastDue && (
            <>
              <button
                onClick={() => {
                  router.push("/pricing");
                }}
                className="w-full bg-white text-black p-4 rounded-2xl font-bold mb-3"
              >
                Choose a plan
              </button>

              <button
                onClick={() => {
                  router.push("/pricing?mode=topup");
                }}
                className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-2xl font-semibold mb-3"
              >
                Add voice minutes
              </button>
            </>
          )}

          {isPremium && (
            <>
              <button
                onClick={() => {
                  router.push("/pricing?mode=topup");
                }}
                className="w-full bg-white text-black p-4 rounded-2xl font-bold mb-3"
              >
                Add voice minutes
              </button>

              <button
                onClick={openBillingPortal}
                className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-2xl font-semibold mb-3"
              >
                {isOutOfMinutes
                  ? "Upgrade or manage plan"
                  : "Manage subscription"}
              </button>
            </>
          )}

          {isCanceledOrPastDue && (
            <>
              <button
                onClick={() => {
                  router.push("/pricing");
                }}
                className="w-full bg-white text-black p-4 rounded-2xl font-bold mb-3"
              >
                Reactivate subscription
              </button>

              <button
                onClick={() => {
                  router.push("/pricing?mode=topup");
                }}
                className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-2xl font-semibold mb-3"
              >
                Add voice minutes
              </button>
            </>
          )}

          <button
            onClick={logout}
            className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-2xl font-semibold"
          >
            Logout
          </button>
        </div>

        <BottomNav />
      </main>
    </ProtectedRoute>
  );
}
