import { NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";
import { requireAdminUser } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VOICE_ID_PATTERN = /^[A-Za-z0-9_-]{10,64}$/;
const PROFESSIONAL_CATEGORY = "professional";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminUser(request);

    if (!admin.user) {
      return NextResponse.json(
        { error: admin.error },
        { status: admin.status }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const voiceId = String(body.voiceId || "").trim();

    if (!VOICE_ID_PATTERN.test(voiceId)) {
      return NextResponse.json(
        { error: "Invalid Voice ID format" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ElevenLabs API key is not configured" },
        { status: 500 }
      );
    }

    const elevenlabs = new ElevenLabsClient({ apiKey });

    const voice = await elevenlabs.voices.get(voiceId);
    const category = voice.category || voice.sharing?.category || undefined;

    if (category !== PROFESSIONAL_CATEGORY) {
      return NextResponse.json(
        { error: "Voice ID must belong to a Professional Voice Clone" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("creators")
      .update({
        voice_id: voiceId,
      })
      .eq("id", id);

    if (error) {
      console.error("Admin voice ID save failed:", error);

      return NextResponse.json(
        { error: "Failed to save Voice ID" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      valid: true,
      voiceId,
      voiceName: voice.name,
      category,
    });
  } catch (error) {
    console.error("Admin voice ID validation failed:", error);

    return NextResponse.json(
      { error: "Voice ID not found or unavailable" },
      { status: 400 }
    );
  }
}
