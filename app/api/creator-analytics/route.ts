import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
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

    const { data: creator } = await supabaseAdmin
      .from("creators")
      .select("id, username, display_name, tagline, personality_prompt, voice_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      !creator?.username ||
      !creator.display_name ||
      !creator.tagline ||
      !creator.personality_prompt ||
      !creator.voice_id
    ) {
      return NextResponse.json(
        { error: "Creator profile is incomplete" },
        { status: 403 }
      );
    }

    const { data: conversations } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("creator_id", creator.id);

    const conversationIds = conversations?.map((item) => item.id) || [];
    let messageCount = 0;
    let voiceGenerations = 0;
    let voiceSeconds = 0;

    if (conversationIds.length > 0) {
      const { data: messages } = await supabaseAdmin
        .from("messages")
        .select("voice_generated, audio_duration_seconds")
        .in("conversation_id", conversationIds);

      messageCount = messages?.length || 0;
      voiceGenerations =
        messages?.filter((message) => message.voice_generated).length || 0;
      voiceSeconds =
        messages?.reduce((total, message) => {
          if (!message.voice_generated) return total;

          return total + (message.audio_duration_seconds || 0);
        }, 0) || 0;
    }

    const { count: profileViews } = await supabaseAdmin
      .from("analytics_events")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("event_type", "creator_profile_opened")
      .eq("entity_type", "creator")
      .eq("entity_id", creator.id);

    const { count: chatStarts } = await supabaseAdmin
      .from("analytics_events")
      .select("*", {
        count: "exact",
        head: true,
      })
      .in("event_type", [
        "creator_profile_start_chat_clicked",
        "start_chat_clicked",
      ])
      .eq("entity_type", "creator")
      .eq("entity_id", creator.id);

    return NextResponse.json({
      creatorId: creator.id,
      conversationCount: conversationIds.length,
      messageCount,
      voiceGenerations,
      voiceSeconds,
      profileViews: profileViews || 0,
      chatStarts: chatStarts || 0,
    });
  } catch (error) {
    console.error("Creator analytics failed:", error);

    return NextResponse.json(
      { error: "Creator analytics failed" },
      { status: 500 }
    );
  }
}
