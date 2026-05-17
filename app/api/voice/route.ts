import { NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const text = body.text || "";
    const voiceId = body.voiceId;

    if (!text) {
      return NextResponse.json(
        { error: "Text required" },
        { status: 400 }
      );
    }

    if (!voiceId) {
      return NextResponse.json({
        audioUrl: "/mock-voice.mp3",
        mock: true,
      });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        audioUrl: "/mock-voice.mp3",
        mock: true,
      });
    }

    const elevenlabs = new ElevenLabsClient({ apiKey });

    const audio = await elevenlabs.textToSpeech.convert(voiceId, {
      text,
      model_id: "eleven_multilingual_v2",
    });

    const chunks: Buffer[] = [];

    for await (const chunk of audio) {
      chunks.push(chunk);
    }

    const audioBuffer = Buffer.concat(chunks);
    const fileName = `voice-${Date.now()}.mp3`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("voice-messages")
      .upload(fileName, audioBuffer, {
        contentType: "audio/mpeg",
      });

    if (uploadError) {
      console.error("Voice upload failed:", uploadError);

      return NextResponse.json({
        audioUrl: "/mock-voice.mp3",
        fallback: true,
      });
    }

    const { data } = supabaseAdmin.storage
      .from("voice-messages")
      .getPublicUrl(fileName);

    return NextResponse.json({
      audioUrl: data.publicUrl,
      generated: true,
    });
  } catch (error) {
    console.error("Voice generation failed:", error);

    return NextResponse.json({
      audioUrl: "/mock-voice.mp3",
      fallback: true,
    });
  }
}