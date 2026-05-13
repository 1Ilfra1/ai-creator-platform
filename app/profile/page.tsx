"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function ProfilePage() {
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setEmail(user.email || "");
      }
    }

    getUser();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="bg-zinc-900 p-6 rounded-2xl w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-4">
            Profile
          </h1>

          <p className="text-zinc-400 mb-6">
            {email}
          </p>

          <button
            onClick={logout}
            className="w-full bg-white text-black p-3 rounded-xl font-semibold"
          >
            Logout
          </button>
        </div>
      </main>
    </ProtectedRoute>
  );
}