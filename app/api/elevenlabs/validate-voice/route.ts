import { NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VOICE_ID_PATTERN = /^[A-Za-z0-9_-]{10,64}$/;
const PROFESSIONAL_CATEGORY = "professional";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const voiceId = String(body.voiceId || "").trim();

    if (!voiceId) {
      return NextResponse.json({
        valid: false,
        message: "Voice ID is required",
      });
    }

    if (!VOICE_ID_PATTERN.test(voiceId)) {
      return NextResponse.json({
        valid: false,
        message: "Invalid Voice ID format",
      });
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
    const isProfessionalClone = category === PROFESSIONAL_CATEGORY;

    if (!isProfessionalClone) {
      return NextResponse.json({
        valid: false,
        isProfessionalClone: false,
        voiceName: voice.name,
        category,
        message:
          "This Voice ID could not be verified as a Professional Voice Clone.",
      });
    }

    return NextResponse.json({
      valid: true,
      isProfessionalClone: true,
      voiceName: voice.name,
      category,
      message: "Professional Voice Clone verified.",
    });
  } catch (error) {
    console.error("Voice ID validation failed:", error);

    return NextResponse.json({
      valid: false,
      message:
        "This Voice ID could not be verified. Make sure it belongs to a Professional Voice Clone accessible from ElevenLabs.",
    });
  }
}
