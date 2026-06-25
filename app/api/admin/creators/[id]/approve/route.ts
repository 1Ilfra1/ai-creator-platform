import { NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";
import { requireAdminUser } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { trackServerEvent } from "@/lib/serverAnalytics";

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

    const { data: creator, error: creatorError } = await supabaseAdmin
      .from("creators")
      .select("voice_id")
      .eq("id", id)
      .single();

    if (creatorError || !creator?.voice_id) {
      return NextResponse.json(
        { error: "Save a valid ElevenLabs voice ID before approving creator" },
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
    const voice = await elevenlabs.voices.get(creator.voice_id);
    const category = voice.category || voice.sharing?.category || undefined;

    if (category !== PROFESSIONAL_CATEGORY) {
      return NextResponse.json(
        { error: "Voice ID must belong to a Professional Voice Clone before approval" },
        { status: 400 }
      );
    }

    const { error: publishError } = await supabaseAdmin
      .from("creators")
      .update({
        is_published: true,
      })
      .eq("id", id);

    if (publishError) {
      console.error("Creator publish update failed:", publishError);

      return NextResponse.json(
        { error: "Failed to approve creator" },
        { status: 500 }
      );
    }

    const { error: approvalError } = await supabaseAdmin.rpc(
      "admin_set_creator_active",
      {
        creator_id: id,
        active: true,
      }
    );

    if (approvalError) {
      console.error("Creator approval failed:", approvalError);

      return NextResponse.json(
        { error: "Failed to approve creator" },
        { status: 500 }
      );
    }

    await trackServerEvent({
      userId: admin.user.id,
      eventType: "creator_approved",
      entityType: "creator",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Creator approval failed:", error);

    return NextResponse.json(
      { error: "Creator approval failed" },
      { status: 500 }
    );
  }
}
