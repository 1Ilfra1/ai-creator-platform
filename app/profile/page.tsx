"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/navigation/BottomNav";

export default function ProfilePage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [subscriptionStatus, setSubscriptionStatus] = useState("free");

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setEmail(user.email || "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("username, voice_seconds_remaining, subscription_status")
          .eq("id", user.id)
          .single();

        if (profile) {
          setUsername(profile.username || "");

          setSeconds(
            profile.voice_seconds_remaining || 0
          );
          setSubscriptionStatus(profile.subscription_status || "free");
        }
      }
    }

    getUser();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-black text-white p-6 pb-24">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold mb-2">Profile</h1>

          <p className="text-zinc-400">{email}</p>

          <p className="text-zinc-500 mb-8">
            @{username || "username"}
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-sm text-zinc-500">Plan</p>
              <p className="text-2xl font-bold">
                {subscriptionStatus === "active" ? "Premium 💎" : "Free"}
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-sm text-zinc-500">Voice minutes</p>
              <p className="text-xl font-bold">
                {minutes}m {remainingSeconds}s
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              window.location.href = "/dashboard";
            }}
            className="w-full bg-white text-black p-4 rounded-2xl font-bold mb-3"
          >
            Creator Studio
          </button>

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