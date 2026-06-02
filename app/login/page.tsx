"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function getSafeNextPath() {
    if (typeof window === "undefined") {
      return "/profile";
    }

    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");

    if (next && next.startsWith("/") && !next.startsWith("//")) {
      return next;
    }

    return "/profile";
  }

  useEffect(() => {
    async function redirectIfLoggedIn() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        router.replace(getSafeNextPath());
      }
    }

    redirectIfLoggedIn();
  }, [router]);

  async function signUp() {

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Account created!");
  }

  async function signIn() {

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    router.replace(getSafeNextPath());
  }

  async function signInWithGoogle() {
    const nextPath = getSafeNextPath();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (error) {
      alert(error.message);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">

      <div className="w-full max-w-sm bg-zinc-900 p-6 rounded-2xl">

        <h1 className="text-2xl font-bold mb-6">
          Login
        </h1>

        <div className="space-y-4">

          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 rounded-xl bg-zinc-800"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 rounded-xl bg-zinc-800"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            onClick={signIn}
            className="w-full bg-white text-black p-3 rounded-xl font-semibold"
          >
            Login
          </button>

          <button
            onClick={signInWithGoogle}
            className="w-full bg-zinc-100 text-black p-3 rounded-xl font-semibold"
          >
            Continue with Google
          </button>

          <button
            onClick={signUp}
            className="w-full bg-zinc-700 p-3 rounded-xl"
          >
            Create account
          </button>

        </div>

      </div>

    </main>
  );
}
