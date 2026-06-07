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
  const [plan, setPlan] = useState("free");
  const [creatorUsername, setCreatorUsername] = useState("");
  const [creatorReadyUnpublished, setCreatorReadyUnpublished] = useState(false);
  const [creatorWaitingApproval, setCreatorWaitingApproval] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

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
            "username, voice_seconds_remaining, subscription_status, plan"
          )
          .eq("id", user.id)
          .single();

        if (profile) {
          setUsername(profile.username || "");
          setUsernameDraft(profile.username || "");
          setSeconds(profile.voice_seconds_remaining || 0);
          setSubscriptionStatus(profile.subscription_status || "free");
          setPlan(profile.plan || "free");
        }

        const { data: creator } = await supabase
          .from("creators")
          .select(
            "username, display_name, tagline, personality_prompt, voice_id, is_published, is_active"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        const creatorComplete = Boolean(
          creator?.username &&
          creator.display_name &&
          creator.tagline &&
          creator.personality_prompt &&
          creator.voice_id
        );

        if (creator && creatorComplete && creator.is_published && creator.is_active) {
          setCreatorUsername(creator.username || "");
          setCreatorReadyUnpublished(false);
          setCreatorWaitingApproval(false);
        } else if (creator && creatorComplete && creator.is_published) {
          setCreatorUsername("");
          setCreatorReadyUnpublished(false);
          setCreatorWaitingApproval(true);
        } else if (creatorComplete) {
          setCreatorUsername("");
          setCreatorReadyUnpublished(true);
          setCreatorWaitingApproval(false);
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
    const usernameValid = /^[a-zA-Z0-9_-]{3,30}$/.test(nextUsername);

    if (!usernameValid) {
      alert("Username must be 3-30 characters and use only letters, numbers, underscores, or dashes.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: creator } = await supabase
      .from("creators")
      .select("id, display_name, tagline, personality_prompt, voice_id, is_published, is_active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (creator?.id) {
      const { error: creatorSyncError } = await supabase
        .from("creators")
        .update({
          username: nextUsername,
        })
        .eq("id", creator.id);

      if (creatorSyncError) {
        console.error(creatorSyncError);
        alert("Failed to sync your creator username. Please try again.");
        return;
      }
    }

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

    const creatorComplete = Boolean(
      creator?.id &&
      creator.display_name &&
      creator.tagline &&
      creator.personality_prompt &&
      creator.voice_id
    );

    if (creatorComplete && creator?.is_published && creator.is_active) {
      setCreatorUsername(nextUsername);
      setCreatorReadyUnpublished(false);
      setCreatorWaitingApproval(false);
    } else if (creatorComplete && creator?.is_published) {
      setCreatorUsername("");
      setCreatorReadyUnpublished(false);
      setCreatorWaitingApproval(true);
    } else if (creatorComplete) {
      setCreatorUsername("");
      setCreatorReadyUnpublished(true);
      setCreatorWaitingApproval(false);
    }
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

    try {
      await navigator.clipboard.writeText(link);
      setCopyStatus("copied");
    } catch (error) {
      console.error("Failed to copy creator link:", error);
      setCopyStatus("failed");
    }

    window.setTimeout(() => {
      setCopyStatus("idle");
    }, 2000);
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const isPremium = subscriptionStatus === "active";
  const isOutOfMinutes = seconds <= 0;
  const isCanceled = subscriptionStatus === "canceled";
  const isPastDue = subscriptionStatus === "past_due";
  const formattedPlan =
    plan === "starter"
      ? "Starter"
      : plan === "premium"
        ? "Premium"
        : plan === "vip"
          ? "VIP"
          : plan === "free" || !plan
            ? "Free"
            : plan.charAt(0).toUpperCase() + plan.slice(1);
  const isPaidPlan =
    plan === "starter" ||
    plan === "premium" ||
    plan === "vip";

  const primaryBillingLabel = isPremium
    ? isOutOfMinutes
      ? "Add minutes & Upgrade plan"
      : "Add minutes & Manage plan"
    : isPastDue
      ? "Fix billing & Manage plan"
      : isCanceled
        ? "Reactivate & Add minutes"
        : isOutOfMinutes
          ? "View plans & Add minutes"
          : "Choose plan & Add minutes";

  function runPrimaryBillingAction() {
    if (isPremium) {
      router.push("/pricing?mode=topup");
      return;
    }

    if (isPastDue) {
      openBillingPortal();
      return;
    }

    router.push("/pricing");
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-black text-white p-6 pb-24">
        <div className="max-w-md mx-auto space-y-7">
          <h1 className="text-3xl font-bold">Profile</h1>

          <section>
            <h2 className="text-xs uppercase tracking-wide text-zinc-500 mb-3">
              Account
            </h2>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 mb-3">
              <p className="text-zinc-400 mb-4">{email}</p>

            {editingUsername ? (
              <div className="flex gap-2">
                <input
                  value={usernameDraft}
                  onChange={(event) => setUsernameDraft(event.target.value)}
                  className="flex-1 bg-black border border-zinc-800 rounded-2xl px-4 py-3 outline-none"
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

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-center min-h-[110px]">
                <p className="text-sm text-zinc-500">Plan</p>
                <p className="text-2xl font-bold flex items-center gap-2 mt-2 whitespace-nowrap">
                  {isPaidPlan ? (
                    <>
                      {formattedPlan} <span>💎</span>
                    </>
                  ) : (
                    formattedPlan
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
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-wide text-zinc-500 mb-3">
              Creator
            </h2>

            <div className="space-y-3">
              <button
                onClick={() => {
                  router.push("/dashboard");
                }}
                className="w-full bg-white text-black p-4 rounded-2xl font-bold"
              >
                Creator Studio
              </button>

              {creatorUsername && (
                <button
                  onClick={() => {
                    router.push("/creator-earnings");
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white p-4 rounded-2xl font-semibold"
                >
                  Creator Analytics
                </button>
              )}

          {creatorUsername && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-sm text-zinc-500 mb-3">
                Share your creator profile
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={copyCreatorLink}
                  className={`p-3 rounded-2xl font-bold transition ${copyStatus === "copied"
                    ? "bg-green-500 text-black"
                    : copyStatus === "failed"
                      ? "bg-red-500 text-white"
                      : "bg-white text-black"
                    }`}
                >
                  {copyStatus === "copied"
                    ? "Copied ✓"
                    : copyStatus === "failed"
                      ? "Copy failed"
                      : "Copy link"}
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

          {creatorReadyUnpublished && (
            <div className="bg-yellow-950/30 border border-yellow-900 rounded-2xl p-4">
              <p className="text-sm text-yellow-300 font-semibold mb-2">
                Your creator profile is ready to submit for approval.
              </p>

              <button
                onClick={() => {
                  router.push("/dashboard");
                }}
                className="w-full bg-white text-black p-3 rounded-2xl font-bold"
              >
                Submit your creator profile for approval
              </button>
            </div>
          )}

          {creatorWaitingApproval && (
            <div className="bg-yellow-950/30 border border-yellow-900 rounded-2xl p-4">
              <p className="text-sm text-yellow-300 font-semibold">
                Your creator profile has been submitted and is waiting for approval.
              </p>
            </div>
          )}
            </div>
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-wide text-zinc-500 mb-3">
              Billing
            </h2>

          <div>
            <button
              onClick={runPrimaryBillingAction}
              className="w-full bg-white text-black p-4 rounded-2xl font-bold"
            >
              {primaryBillingLabel}
            </button>
          </div>
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-wide text-zinc-500 mb-3">
              Support
            </h2>

          <div className="border border-zinc-900 rounded-3xl p-5 text-sm text-zinc-500">
            <p className="mb-4">
              Support:{" "}
              <a
                href="mailto:sup1clients@gmail.com"
                className="text-zinc-300 hover:text-white transition"
              >
                sup1clients@gmail.com
              </a>
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => router.push("/privacy")}
                className="text-left hover:text-white transition"
              >
                Privacy Policy
              </button>

              <button
                onClick={() => router.push("/terms")}
                className="text-left hover:text-white transition"
              >
                Terms
              </button>

              <button
                onClick={() => router.push("/refund-policy")}
                className="text-left hover:text-white transition"
              >
                Refund Policy
              </button>

              <button
                onClick={() => router.push("/ai")}
                className="text-left hover:text-white transition"
              >
                AI Disclosure
              </button>
            </div>
          </div>
          </section>

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
