"use client";

import { useRouter } from "next/navigation";

export default function BottomNav() {
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-zinc-950 border-t border-zinc-800 flex text-sm text-zinc-400 z-50">
      <button
        onClick={() => router.push("/")}
        className="w-full h-full flex-1 flex flex-col items-center justify-center gap-1"
      >
        <span>🔥</span>
        <span>Creators</span>
      </button>

      <button
        onClick={() => router.push("/chats")}
        className="w-full h-full flex-1 flex flex-col items-center justify-center gap-1"
      >
        <span>💬</span>
        <span>Chats</span>
      </button>

      <button
        onClick={() => router.push("/profile")}
        className="w-full h-full flex-1 flex flex-col items-center justify-center gap-1"
      >
        <span>👤</span>
        <span>Profile</span>
      </button>
    </nav>
  );
}