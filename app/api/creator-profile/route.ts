import { NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VOICE_ID_PATTERN = /^[A-Za-z0-9_-]{10,64}$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,30}$/;
const PROFESSIONAL_CATEGORY = "professional";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

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

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    const username = cleanText(profile?.username);

    if (!USERNAME_PATTERN.test(username)) {
      return NextResponse.json(
        { error: "Set a valid username in Profile before submitting." },
        { status: 400 }
      );
    }

    const voiceId = cleanText(body.voiceId);

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

    const { data: existingCreator, error: existingCreatorError } =
      await supabaseAdmin
        .from("creators")
        .select("id, is_active")
        .eq("user_id", user.id)
        .maybeSingle();

    if (existingCreatorError) {
      console.error("Creator profile lookup failed:", existingCreatorError);

      return NextResponse.json(
        { error: "Failed to save creator profile" },
        { status: 500 }
      );
    }

    const displayName = cleanText(body.displayName);
    const tagline = cleanText(body.tagline);
    const personalityPrompt = cleanText(body.personalityPrompt);

    if (!displayName || !tagline || !personalityPrompt) {
      return NextResponse.json(
        { error: "Complete all required creator profile fields first." },
        { status: 400 }
      );
    }

    const shouldSubmitForApproval = !existingCreator?.is_active;
    const creatorFields = {
      username,
      display_name: displayName,
      tagline,
      personality_prompt: personalityPrompt,
      profile_image: cleanText(body.profileImage),
      banner_image: cleanText(body.bannerImage),
      intro_audio: cleanText(body.introAudio),
      instagram_handle: cleanText(body.instagramHandle),
      voice_id: voiceId,
    };

    const creatorPayload = shouldSubmitForApproval
      ? {
          ...creatorFields,
          is_published: true,
        }
      : creatorFields;

    const { data: savedCreator, error: saveError } = existingCreator?.id
      ? await supabaseAdmin
          .from("creators")
          .update(creatorPayload)
          .eq("id", existingCreator.id)
          .eq("user_id", user.id)
          .select("id, is_published, is_active")
          .single()
      : await supabaseAdmin
          .from("creators")
          .insert({
            ...creatorPayload,
            user_id: user.id,
          })
          .select("id, is_published, is_active")
          .single();

    if (saveError) {
      if (saveError.code === "23505") {
        return NextResponse.json(
          {
            error:
              "Your creator profile could not be updated because this username is already in use. Change it in Profile settings first.",
            code: "23505",
          },
          { status: 409 }
        );
      }

      console.error("Creator profile save failed:", saveError);

      return NextResponse.json(
        { error: "Failed to save creator profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: savedCreator.id,
      isPublished: savedCreator.is_published,
      isActive: savedCreator.is_active,
      submittedForApproval: shouldSubmitForApproval,
      voiceName: voice.name,
      category,
    });
  } catch (error) {
    console.error("Creator profile save failed:", error);

    return NextResponse.json(
      { error: "Failed to save creator profile" },
      { status: 500 }
    );
  }
}
