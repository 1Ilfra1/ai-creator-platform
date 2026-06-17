"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/services/analytics";

type Plan = "starter" | "premium" | "vip";

const ACTIVE_PAID_PLANS = ["starter", "premium", "vip"];
const TOPUP_SUBSCRIBER_ONLY_ERROR =
  "Top-up purchases are available only for active subscribers.";

export default function PricingPage() {
  const router = useRouter();
  const topupRef = useRef<HTMLDivElement | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState("free");
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    trackEvent({
      eventType: "pricing_viewed",
      metadata: {
        mode: params.get("mode") || "plans",
      },
    });

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_status, plan")
        .eq("id", user.id)
        .single();

      if (profile) {
        setSubscriptionStatus(
          profile.subscription_status || "free"
        );
        setPlan(profile.plan || null);
      }
    }

    loadProfile();

    if (params.get("mode") === "topup") {
      setTimeout(() => {
        topupRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, []);

  async function buyPlan(plan: Plan) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    trackEvent({
      eventType: "checkout_started",
      metadata: {
        plan,
      },
    });

    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        plan,
      }),
    });

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
    }
  }

  async function buyTopup(pack: "30" | "60") {
    if (!canBuyTopups) {
      alert(TOPUP_SUBSCRIBER_ONLY_ERROR);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    trackEvent({
      eventType: "topup_checkout_started",
      metadata: {
        pack,
      },
    });

    const response = await fetch("/api/stripe/topup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        pack,
      }),
    });

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
    }
  }

  const pricingContext =
    subscriptionStatus === "active"
      ? "Add extra minutes if your monthly plan is active, or manage your plan from Profile."
      : subscriptionStatus === "canceled" ||
        subscriptionStatus === "past_due"
        ? "Reactivate a plan to add extra minutes."
        : "Choose a monthly plan first. Top-ups are available for active subscribers.";

  const canBuyTopups =
    subscriptionStatus === "active" &&
    ACTIVE_PAID_PLANS.includes(plan || "");

  const topupButtonClass = canBuyTopups
    ? "w-full bg-zinc-900 border border-zinc-700 p-4 rounded-2xl text-left hover:border-zinc-500 transition"
    : "w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl text-left opacity-50 cursor-not-allowed";

  return (
    <main className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
      <div className="max-w-md w-full">
        <button
          onClick={() => router.back()}
          className="text-zinc-400 mb-6"
        >
          ← Back
        </button>

        <h1 className="text-3xl font-bold mb-2">
          🎧 Continue the conversation
        </h1>

        <p className="text-zinc-500 mb-8">
          {pricingContext}
        </p>

        <div className="space-y-4 mb-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <p className="text-sm text-zinc-500 mb-2">🚀 Starter</p>

            <h2 className="text-4xl font-bold mb-2">
              $9.99
              <span className="text-base text-zinc-500 font-normal">
                /month
              </span>
            </h2>

            <div className="space-y-3 text-zinc-300 mb-6">
              <p>✅ 20 voice minutes every month</p>
              <p>✅ Voice replies from AI creators</p>
              <p>✅ Private creator conversations</p>
              <p>✅ Add more minutes anytime</p>
            </div>

            <button
              onClick={() => buyPlan("starter")}
              className="w-full bg-zinc-200 text-black py-4 rounded-2xl font-bold"
            >
              Start Starter
            </button>
          </div>

          <div className="bg-zinc-900 border border-green-500 rounded-3xl p-6">
            <p className="text-sm text-green-400 mb-2">
              💜 Premium · Most popular
            </p>

            <h2 className="text-4xl font-bold mb-2">
              $24.99
              <span className="text-base text-zinc-500 font-normal">
                /month
              </span>
            </h2>

            <div className="space-y-3 text-zinc-300 mb-6">
              <p>✅ 60 voice minutes every month</p>
              <p>✅ Better continuity and private chat history</p>
              <p>✅ Voice replies from AI creators</p>
              <p>✅ Add more minutes anytime</p>
            </div>

            <button
              onClick={() => buyPlan("premium")}
              className="w-full bg-green-500 text-black py-4 rounded-2xl font-bold"
            >
              Start Premium
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <p className="text-sm text-zinc-500 mb-2">👑 VIP</p>

            <h2 className="text-4xl font-bold mb-2">
              $49.99
              <span className="text-base text-zinc-500 font-normal">
                /month
              </span>
            </h2>

            <div className="space-y-3 text-zinc-300 mb-6">
              <p>✅ 180 voice minutes every month</p>
              <p>✅ Extended creator conversations</p>
              <p>✅ Best value for heavy listeners</p>
              <p>✅ Add more minutes anytime</p>
            </div>

            <button
              onClick={() => buyPlan("vip")}
              className="w-full bg-white text-black py-4 rounded-2xl font-bold"
            >
              Go VIP
            </button>
          </div>
        </div>

        <div
          ref={topupRef}
          className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 mb-4 scroll-mt-6"
        >
          <h3 className="font-semibold mb-4">
            Need more voice minutes?
          </h3>

          {!canBuyTopups && (
            <p className="text-sm text-zinc-500 mb-4">
              {TOPUP_SUBSCRIBER_ONLY_ERROR}
            </p>
          )}

          <div className="space-y-3">
            <button
              onClick={() => buyTopup("30")}
              disabled={!canBuyTopups}
              className={topupButtonClass}
            >
              <div className="flex items-center justify-between">
                <span>+30 minutes</span>
                <span>$11.99</span>
              </div>
            </button>

            <button
              onClick={() => buyTopup("60")}
              disabled={!canBuyTopups}
              className={topupButtonClass}
            >
              <div className="flex items-center justify-between">
                <span>+60 minutes</span>
                <span>$21.99</span>
              </div>
            </button>
          </div>
        </div>

        <p className="text-xs text-zinc-600 text-center">
          Payments are securely processed by Stripe. Support:
          sup1clients@gmail.com
        </p>
      </div>
    </main>
  );
}
