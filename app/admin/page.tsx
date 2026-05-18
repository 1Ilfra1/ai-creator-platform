"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "frants1illia@gmail.com";

export default function AdminPage() {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState(0);
  const [creators, setCreators] = useState(0);
  const [conversations, setConversations] = useState(0);
  const [messages, setMessages] = useState(0);
  const [premiumUsers, setPremiumUsers] = useState(0);
  const [voiceMessages, setVoiceMessages] = useState(0);

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

      setLoading(false);
    }

    loadAdminStats();
  }, []);

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
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>

        <p className="text-zinc-500 mb-8">
          Internal MVP metrics and platform activity.
        </p>

        <div className="grid grid-cols-2 gap-4">
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
      </div>
    </main>
  );
}