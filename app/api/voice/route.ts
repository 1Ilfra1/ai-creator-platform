import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const text = body.text || "";

  if (!text) {
    return NextResponse.json(
      { error: "Text required" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    audioUrl: "/mock-voice.mp3",
    mock: true,
  });
}