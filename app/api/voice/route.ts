import { NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_VOICE_TEXT_LENGTH = 500;

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

    const oneMinuteAgo = new Date(
      Date.now() - 60 * 1000
    ).toISOString();

    const { count } = await supabaseAdmin
      .from("api_rate_limits")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("user_id", user.id)
      .eq("endpoint", "voice")
      .gte("created_at", oneMinuteAgo);

    if ((count || 0) >= 10) {
      return NextResponse.json(
        { error: "Too many voice requests" },
        { status: 429 }
      );
    }

    await supabaseAdmin
      .from("api_rate_limits")
      .insert({
        user_id: user.id,
        endpoint: "voice",
      });

    const body = await request.json();

    const text = String(body.text || "").slice(0, MAX_VOICE_TEXT_LENGTH);
    const voiceId = body.voiceId;
    const estimatedSeconds = Math.max(
      1,
      Math.min(60, Number(body.estimatedSeconds || 3))
    );

    if (!text) {
      return NextResponse.json(
        { error: "Text required" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("voice_seconds_remaining")
      .eq("id", user.id)
      .single();

    if (!profile || profile.voice_seconds_remaining <= 0) {
      return NextResponse.json(
        { error: "Out of voice minutes" },
        { status: 402 }
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

    const { error: lockError } = await supabaseAdmin
      .from("voice_generation_locks")
      .insert({
        user_id: user.id,
      });

    if (lockError) {
      return NextResponse.json(
        { error: "Voice generation already in progress" },
        { status: 429 }
      );
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
    const fileName = `voice-${user.id}-${Date.now()}.mp3`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("voice-messages")
      .upload(fileName, audioBuffer, {
        contentType: "audio/mpeg",
      });

    if (uploadError) {
      console.error("Voice upload failed:", uploadError);

      await supabaseAdmin
        .from("voice_generation_locks")
        .delete()
        .eq("user_id", user.id);

      return NextResponse.json({
        audioUrl: "/mock-voice.mp3",
        fallback: true,
      });
    }

    const remainingAfterGeneration = Math.max(
      0,
      profile.voice_seconds_remaining - estimatedSeconds
    );

    await supabaseAdmin
      .from("profiles")
      .update({
        voice_seconds_remaining: remainingAfterGeneration,
      })
      .eq("id", user.id);

    const { data } = supabaseAdmin.storage
      .from("voice-messages")
      .getPublicUrl(fileName);

    await supabaseAdmin
      .from("voice_generation_locks")
      .delete()
      .eq("user_id", user.id);

    return NextResponse.json({
      audioUrl: data.publicUrl,
      generated: true,
      secondsRemaining: remainingAfterGeneration,
    });
  } catch (error) {
    console.error("Voice generation failed:", error);

    return NextResponse.json({
      audioUrl: "/mock-voice.mp3",
      fallback: true,
    });
  }
}