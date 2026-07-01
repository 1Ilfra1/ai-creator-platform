import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { trackServerEvent } from "@/lib/serverAnalytics";

const MAX_MESSAGE_LENGTH = 500;

const blockedWords = [
  "minor",
  "underage",
  "kill",
  "bomb",
];

function voiceFailureMessage(status: number) {
  if (status === 402) {
    return "You're out of voice minutes.";
  }

  if (status === 429) {
    return "Voice limit reached. Try again later.";
  }

  if (status === 401 || status === 403) {
    return "Could not generate voice. Please refresh and try again.";
  }

  return "Text reply was created, but voice could not be generated.";
}

export async function POST(request: Request) {
  let userId: string | null = null;
  let creatorId: string | null = null;
  let conversationId: string | null = null;

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

    userId = user.id;

    const body = await request.json();
    const message = String(body.message || "")
      .trim()
      .slice(0, MAX_MESSAGE_LENGTH);
    conversationId =
      typeof body.conversationId === "string"
        ? body.conversationId
        : null;

    if (!message) {
      return NextResponse.json(
        { error: "Message required" },
        { status: 400 }
      );
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation required" },
        { status: 400 }
      );
    }

    const lowered = message.toLowerCase();
    const blocked = blockedWords.some((word) =>
      lowered.includes(word)
    );

    if (blocked) {
      return NextResponse.json(
        {
          error: "Message blocked by safety rules.",
          reason: "Message blocked by safety rules.",
        },
        { status: 400 }
      );
    }

    const { data: conversation } = await supabaseAdmin
      .from("conversations")
      .select("id, creator_id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (!conversation) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    creatorId = conversation.creator_id;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("voice_seconds_remaining")
      .eq("id", user.id)
      .single();

    if (!profile || profile.voice_seconds_remaining <= 0) {
      return NextResponse.json(
        { error: "Not enough voice minutes" },
        { status: 402 }
      );
    }

    const { count: previousUserMessages } = await supabaseAdmin
      .from("messages")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("conversation_id", conversationId)
      .eq("sender_type", "user");

    const { data: savedUserMessage, error: userMessageError } =
      await supabaseAdmin
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_type: "user",
          text: message,
        })
        .select()
        .single();

    if (userMessageError || !savedUserMessage) {
      console.error("Server chat user message save failed:", userMessageError);

      return NextResponse.json(
        { error: "Could not save message" },
        { status: 500 }
      );
    }

    const source =
      body.source === "suggested_reply" ? "suggested_reply" : "typed";

    await trackServerEvent({
      userId: user.id,
      eventType: "message_sent",
      entityType: "creator",
      entityId: conversation.creator_id,
      sessionId: conversationId,
      metadata: {
        source,
        message_length: message.length,
      },
    });

    if ((previousUserMessages || 0) === 0) {
      await trackServerEvent({
        userId: user.id,
        eventType: "first_user_message",
        entityType: "creator",
        entityId: conversation.creator_id,
        sessionId: conversationId,
        metadata: {
          source,
          message_length: message.length,
        },
      });
    }

    const origin = new URL(request.url).origin;
    const recentMessages = Array.isArray(body.recentMessages)
      ? body.recentMessages
      : [];

    const aiResponse = await fetch(`${origin}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message,
        conversationId,
        recentMessages,
      }),
    });

    const aiData = await aiResponse.json();

    if (!aiResponse.ok) {
      return NextResponse.json(
        {
          error: aiData.error || "Could not generate reply",
          userMessage: savedUserMessage,
        },
        { status: aiResponse.status }
      );
    }

    const aiText = String(aiData.reply || "Tell me more.");
    const voiceText =
      aiText.length > 500
        ? `${aiText.slice(0, 500)}...`
        : aiText;

    const voiceResponse = await fetch(`${origin}/api/voice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: voiceText,
        conversationId,
      }),
    });

    const voiceData = await voiceResponse.json();
    let audioUrl: string | null = null;
    let voiceGenerated = false;
    let voiceFallback = false;
    let chargedSeconds: number | null = null;
    let voiceNotice: string | null = null;
    let paywallReason: string | null = null;

    if (voiceResponse.ok) {
      audioUrl = voiceData.audio
        ? `data:${voiceData.mimeType};base64,${voiceData.audio}`
        : voiceData.audioUrl || null;

      if (audioUrl) {
        voiceGenerated = voiceData.generated || false;
        voiceFallback = voiceData.fallback || false;
        chargedSeconds =
          typeof voiceData.chargedSeconds === "number"
            ? voiceData.chargedSeconds
            : null;
      } else {
        voiceFallback = true;
        voiceNotice =
          "Text reply was created, but voice could not be generated.";
      }
    } else {
      voiceFallback = true;
      voiceNotice = voiceFailureMessage(voiceResponse.status);

      if (voiceResponse.status === 402) {
        paywallReason = "voice_minutes_exhausted";
      }
    }

    const { data: savedAiMessage, error: aiMessageError } =
      await supabaseAdmin
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_type: "ai",
          text: aiText,
          audio_url: audioUrl,
          audio_duration_seconds: chargedSeconds,
          is_fallback: aiData.fallback || false,
          voice_generated: voiceGenerated,
          voice_fallback: voiceFallback,
        })
        .select()
        .single();

    if (aiMessageError || !savedAiMessage) {
      console.error("Server chat AI message save failed:", aiMessageError);

      return NextResponse.json(
        {
          error: "Could not save AI reply",
          userMessage: savedUserMessage,
        },
        { status: 500 }
      );
    }

    await trackServerEvent({
      userId: user.id,
      eventType: "chat_completed",
      entityType: "creator",
      entityId: conversation.creator_id,
      sessionId: conversationId,
      metadata: {
        voice_generated: voiceGenerated,
        voice_fallback: voiceFallback,
        charged_seconds: chargedSeconds,
      },
    });

    return NextResponse.json({
      userMessage: savedUserMessage,
      aiMessage: savedAiMessage,
      voiceNotice,
      paywallReason,
      secondsRemaining:
        typeof voiceData.secondsRemaining === "number"
          ? voiceData.secondsRemaining
          : null,
    });
  } catch (error) {
    console.error("Server chat response failed:", error);

    await trackServerEvent({
      userId,
      eventType: "ai_reply_failed",
      entityType: creatorId ? "creator" : null,
      entityId: creatorId,
      sessionId: conversationId,
      metadata: {
        reason: "respond_exception",
      },
    });

    return NextResponse.json(
      { error: "Could not generate reply" },
      { status: 500 }
    );
  }
}
