export default function BottomNav() {

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-zinc-950 border-t border-zinc-800 flex items-center justify-around text-sm text-zinc-400">

      <button className="flex flex-col items-center">
        <span>🔥</span>
        <span>Creators</span>
      </button>

      <button className="flex flex-col items-center">
        <span>💬</span>
        <span>Chats</span>
      </button>

      <button className="flex flex-col items-center">
        <span>👤</span>
        <span>Profile</span>
      </button>

    </nav>
  );
}