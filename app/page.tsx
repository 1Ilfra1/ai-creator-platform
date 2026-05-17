"use client";

import { useEffect, useState } from "react";

import { Creator } from "@/types/creator";
import { getCreators } from "@/services/creators";

import CreatorCard from "@/components/creator/CreatorCard";
import BottomNav from "@/components/navigation/BottomNav";

export default function HomePage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadCreators() {
      const data = await getCreators();
      setCreators(data);
    }

    loadCreators();
  }, []);

  const filteredCreators = creators.filter((creator) => {
    const query = search.toLowerCase();

    return (
      creator.username.toLowerCase().includes(query) ||
      creator.display_name.toLowerCase().includes(query)
    );
  });

  return (
    <main className="min-h-screen bg-black text-white pb-24">
      <div className="p-5 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">
          Discover Creators
        </h1>

        <p className="text-zinc-400 mb-6">
          Emotional AI voice companions.
        </p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search creators"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 mb-6 outline-none focus:border-zinc-600"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCreators.map((creator) => (
            <CreatorCard
              key={creator.id}
              creator={creator}
            />
          ))}
        </div>

        {filteredCreators.length === 0 && (
          <div className="text-center mt-20">
            <p className="text-zinc-300 font-semibold text-lg">
              💜 No creators found 💜
            </p>

            <p className="text-zinc-600 text-sm mt-2">
              Try searching another username.
            </p>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}