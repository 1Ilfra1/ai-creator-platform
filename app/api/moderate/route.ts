import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_TEXT_LENGTH = 500;

const blockedWords = [
  "minor",
  "underage",
  "kill",
  "bomb",
];

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
      .eq("endpoint", "moderate")
      .gte("created_at", oneMinuteAgo);

    if ((count || 0) >= 20) {
      return NextResponse.json(
        { error: "Too many moderation requests" },
        { status: 429 }
      );
    }

    await supabaseAdmin
      .from("api_rate_limits")
      .insert({
        user_id: user.id,
        endpoint: "moderate",
      });

    const body = await request.json();

    const text = String(body.text || "").slice(0, MAX_TEXT_LENGTH);

    const lowered = text.toLowerCase();

    const blocked = blockedWords.some((word) =>
      lowered.includes(word)
    );

    if (blocked) {
      return NextResponse.json({
        allowed: false,
        reason: "Message blocked by safety rules.",
      });
    }

    return NextResponse.json({
      allowed: true,
    });
  } catch (error) {
    console.error("Moderation failed:", error);

    return NextResponse.json(
      { error: "Moderation failed" },
      { status: 500 }
    );
  }
}