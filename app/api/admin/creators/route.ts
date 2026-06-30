import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CREATOR_REVIEW_FIELDS =
  "id, username, display_name, tagline, bio, profile_image, banner_image, intro_audio, instagram_handle, voice_sample_path, voice_id, is_demo, is_published, is_active, created_at";

async function attachVoiceSampleUrls(creators: any[] = []) {
  return Promise.all(
    creators.map(async (creator) => {
      if (!creator.voice_sample_path) {
        return {
          ...creator,
          voice_sample_url: null,
        };
      }

      const { data, error } = await supabaseAdmin.storage
        .from("creator-voice-samples")
        .createSignedUrl(creator.voice_sample_path, 60 * 15);

      if (error) {
        console.error("Failed to create voice sample signed URL:", error);
      }

      return {
        ...creator,
        voice_sample_url: data?.signedUrl || null,
      };
    })
  );
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdminUser(request);

    if (!admin.user) {
      return NextResponse.json(
        { error: admin.error },
        { status: admin.status }
      );
    }

    const [pendingResult, liveResult] = await Promise.all([
      supabaseAdmin
        .from("creators")
        .select(CREATOR_REVIEW_FIELDS)
        .eq("is_published", true)
        .eq("is_active", false)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("creators")
        .select(CREATOR_REVIEW_FIELDS)
        .eq("is_published", true)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
    ]);

    if (pendingResult.error || liveResult.error) {
      console.error("Admin creator review query failed:", {
        pendingError: pendingResult.error,
        liveError: liveResult.error,
      });

      return NextResponse.json(
        {
          error: "Failed to load creators",
          details: {
            pending: pendingResult.error,
            live: liveResult.error,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      pending: await attachVoiceSampleUrls(pendingResult.data || []),
      live: await attachVoiceSampleUrls(liveResult.data || []),
    });
  } catch (error) {
    console.error("Admin creator list failed:", error);

    return NextResponse.json(
      { error: "Admin creator list failed" },
      { status: 500 }
    );
  }
}
