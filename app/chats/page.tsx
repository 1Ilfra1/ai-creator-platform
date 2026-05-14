import BottomNav from "@/components/navigation/BottomNav";

export default function ChatsPage() {
  return (
    <main className="min-h-screen bg-black text-white pb-24">
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-2">
          Chats
        </h1>

        <p className="text-zinc-500">
          Your conversations will appear here.
        </p>
      </div>

      <BottomNav />
    </main>
  );
}