"use client";

import { useEffect, useState } from "react";

import { Creator } from "@/types/creator";
import { getCreators } from "@/services/creators";

import CreatorCard from "@/components/creator/CreatorCard";
import BottomNav from "@/components/navigation/BottomNav";

export default function HomePage() {

  const [creators, setCreators] = useState<Creator[]>([]);

  useEffect(() => {

    async function loadCreators() {

      const data = await getCreators();
      setCreators(data);
    }

    loadCreators();

  }, []);

  return (
    <main className="min-h-screen bg-black text-white pb-24">

      <div className="p-5">

        <h1 className="text-3xl font-bold mb-2">
          Discover Creators
        </h1>

        <p className="text-zinc-400 mb-6">
          Emotional AI voice companions.
        </p>

        <div className="space-y-5">

          {creators.map((creator) => (
            <CreatorCard
              key={creator.id}
              creator={creator}
            />
          ))}

        </div>

      </div>

      <BottomNav />

    </main>
  );
}