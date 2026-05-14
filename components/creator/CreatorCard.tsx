import { Creator } from "@/types/creator";

export default function CreatorCard({
  creator,
}: {
  creator: Creator;
}) {

  return (
    <div className="bg-zinc-900 rounded-3xl overflow-hidden">

      <div className="h-40 bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center">

        <div className="w-24 h-24 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center text-3xl">
          👤
        </div>

      </div>

      <div className="p-5">

        <h2 className="text-2xl font-bold mb-2">
          {creator.display_name}
        </h2>

        <p className="text-zinc-400 text-sm mb-4">
          {creator.bio}
        </p>

        <div className="flex flex-wrap gap-2">

          {creator.tags?.map((tag) => (
            <span
              key={tag}
              className="bg-zinc-800 px-3 py-1 rounded-full text-xs text-zinc-300"
            >
              #{tag}
            </span>
          ))}

        </div>

      </div>

    </div>
  );
}