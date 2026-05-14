"use client";

import { useRouter } from "next/navigation";

export default function BottomNav() {
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-950 border-t border-zinc-800 flex items-center justify-around text-sm text-zinc-400">
      <button
        onClick={() => router.push("/")}
        className="flex flex-col items-center"
      >
        <span>🔥</span>
        <span>Creators</span>
      </button>

      <button
        onClick={() => router.push("/chats")}
        className="flex flex-col items-center"
      >
        <span>💬</span>
        <span>Chats</span>
      </button>

      <button
        onClick={() => router.push("/profile")}
        className="flex flex-col items-center"
      >
        <span>👤</span>
        <span>Profile</span>
      </button>
    </nav>
  );
}