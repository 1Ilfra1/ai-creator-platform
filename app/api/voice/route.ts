import { NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { trackServerEvent } from "@/lib/serverAnalytics";

const MAX_VOICE_TEXT_LENGTH = 500;
const DAILY_VOICE_LIMIT = 60;
const ALLOW_VOICE_MOCK = process.env.ALLOW_VOICE_MOCK === "true";
const ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
const ELEVENLABS_COST_PER_1000_CHARS_USD = Number(
  process.env.ELEVENLABS_COST_PER_1000_CHARS_USD || "0"
);

function estimateElevenLabsCost(text: string) {
  if (!Number.isFinite(ELEVENLABS_COST_PER_1000_CHARS_USD)) {
    return null;
  }

  return Number(
    ((text.length / 1000) * ELEVENLABS_COST_PER_1000_CHARS_USD).toFixed(6)
  );
}

export async function POST(request: Request) {
  let lockedUserId: string | null = null;
  let analyticsUserId: string | null = null;
  let analyticsConversationId: string | null = null;
  let analyticsCreatorId: string | null = null;

  async function trackVoiceFailed(
    reason: string,
    metadata: Record<string, unknown> = {}
  ) {
    await trackServerEvent({
      userId: analyticsUserId,
      eventType: "error_voice_generation",
      entityType: analyticsCreatorId ? "creator" : null,
      entityId: analyticsCreatorId,
      sessionId: analyticsConversationId,
      metadata: {
        reason,
        ...metadata,
      },
    });
  }

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

    analyticsUserId = user.id;

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

    const oneDayAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    const { count: dailyCount } = await supabaseAdmin
      .from("api_rate_limits")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("user_id", user.id)
      .eq("endpoint", "voice")
      .gte("created_at", oneDayAgo);

    if ((dailyCount || 0) >= DAILY_VOICE_LIMIT) {
      return NextResponse.json(
        { error: "Daily voice limit reached" },
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
    const conversationId = body.conversationId;
    analyticsConversationId =
      typeof conversationId === "string" ? conversationId : null;
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    const estimatedSeconds = Math.max(
      3,
      Math.min(60, Math.ceil(wordCount / 2.5))
    );

    if (!text) {
      return NextResponse.json(
        { error: "Text required" },
        { status: 400 }
      );
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation required" },
        { status: 400 }
      );
    }

    const { data: conversation } = await supabaseAdmin
      .from("conversations")
      .select("creator_id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (!conversation) {
      await trackVoiceFailed("invalid_conversation");

      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    analyticsCreatorId = conversation.creator_id;

    const { data: creator } = await supabaseAdmin
      .from("creators")
      .select("voice_id")
      .eq("id", conversation.creator_id)
      .single();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("voice_seconds_remaining")
      .eq("id", user.id)
      .single();

    if (!profile || profile.voice_seconds_remaining < estimatedSeconds) {
      await trackVoiceFailed("out_of_minutes");

      return NextResponse.json(
        { error: "Not enough voice minutes" },
        { status: 402 }
      );
    }

    if (!creator?.voice_id) {
      if (ALLOW_VOICE_MOCK) {
        return NextResponse.json({
          audioUrl: "/mock-voice.mp3",
          mock: true,
        });
      }

      await trackVoiceFailed("missing_voice_id");

      return NextResponse.json(
        { error: "Creator voice is not configured" },
        { status: 422 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      if (ALLOW_VOICE_MOCK) {
        return NextResponse.json({
          audioUrl: "/mock-voice.mp3",
          mock: true,
        });
      }

      await trackVoiceFailed("missing_api_key");

      return NextResponse.json(
        { error: "ElevenLabs API key is not configured" },
        { status: 500 }
      );
    }

    const { error: lockError } = await supabaseAdmin
      .from("voice_generation_locks")
      .insert({
        user_id: user.id,
      });

    if (lockError) {
      if (ALLOW_VOICE_MOCK) {
        return NextResponse.json({
          audioUrl: "/mock-voice.mp3",
          fallback: true,
        });
      }

      await trackVoiceFailed("lock_exists");

      return NextResponse.json(
        { error: "Voice generation already in progress" },
        { status: 429 }
      );
    }

    lockedUserId = user.id;

    const elevenlabs = new ElevenLabsClient({ apiKey });

    const audio = await elevenlabs.textToSpeech.convert(creator.voice_id, {
      text,
      model_id: ELEVENLABS_MODEL_ID,
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

      lockedUserId = null;

      if (ALLOW_VOICE_MOCK) {
        return NextResponse.json({
          audioUrl: "/mock-voice.mp3",
          fallback: true,
        });
      }

      await trackVoiceFailed("upload_failed");

      return NextResponse.json(
        { error: "Voice upload failed" },
        { status: 500 }
      );
    }

    const remainingAfterGeneration = Math.max(
      0,
      profile.voice_seconds_remaining - estimatedSeconds
    );

    const { error: deductionError } = await supabaseAdmin
      .from("profiles")
      .update({
        voice_seconds_remaining: remainingAfterGeneration,
      })
      .eq("id", user.id);

    if (deductionError) {
      console.error("Voice balance deduction failed:", deductionError);

      await supabaseAdmin.storage
        .from("voice-messages")
        .remove([fileName]);

      await supabaseAdmin
        .from("voice_generation_locks")
        .delete()
        .eq("user_id", user.id);

      lockedUserId = null;

      await trackVoiceFailed("deduction_failed");

      return NextResponse.json(
        { error: "Voice generation could not be charged" },
        { status: 500 }
      );
    }

    const { data } = supabaseAdmin.storage
      .from("voice-messages")
      .getPublicUrl(fileName);

    await supabaseAdmin
      .from("voice_generation_locks")
      .delete()
      .eq("user_id", user.id);

    lockedUserId = null;

    await trackServerEvent({
      userId: user.id,
      eventType: "voice_generated",
      entityType: "creator",
      entityId: conversation.creator_id,
      sessionId: conversationId,
      metadata: {
        estimated_seconds: estimatedSeconds,
        charged_seconds: estimatedSeconds,
        tts_characters: text.length,
        provider_model: ELEVENLABS_MODEL_ID,
        provider_cost_estimate: estimateElevenLabsCost(text),
        seconds_remaining: remainingAfterGeneration,
        provider: "elevenlabs",
      },
    });

    await trackServerEvent({
      userId: user.id,
      eventType: "minutes_consumed",
      entityType: "creator",
      entityId: conversation.creator_id,
      sessionId: conversationId,
      metadata: {
        seconds_consumed: estimatedSeconds,
        seconds_remaining: remainingAfterGeneration,
        provider: "elevenlabs",
        provider_model: ELEVENLABS_MODEL_ID,
      },
    });

    return NextResponse.json({
      audioUrl: data.publicUrl,
      generated: true,
      chargedSeconds: estimatedSeconds,
      secondsRemaining: remainingAfterGeneration,
    });
  } catch (error) {
    console.error("Voice generation failed:", error);

    if (lockedUserId) {
      await supabaseAdmin
        .from("voice_generation_locks")
        .delete()
        .eq("user_id", lockedUserId);
    }

    if (ALLOW_VOICE_MOCK) {
      return NextResponse.json({
        audioUrl: "/mock-voice.mp3",
        fallback: true,
      });
    }

    await trackVoiceFailed("exception");

    return NextResponse.json(
      { error: "Voice generation failed" },
      { status: 502 }
    );
  }
}
