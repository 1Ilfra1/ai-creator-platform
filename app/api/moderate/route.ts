import { NextResponse } from "next/server";

const blockedWords = [
  "minor",
  "underage",
  "kill",
  "bomb",
];

export async function POST(request: Request) {
  const body = await request.json();
  const text = body.text || "";

  const lowered = text.toLowerCase();

  const blocked = blockedWords.some((word) =>
    lowered.includes(word)
  );

  if (blocked) {
    return NextResponse.json({
      allowed: false,
      reason: "Message blocked by safety rules.",
    });
  }

  return NextResponse.json({
    allowed: true,
  });
}