import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ADMIN_EMAIL = "frants1illia@gmail.com";

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

    if (authError || !user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const { data: objects, error: listError } =
      await supabaseAdmin.storage
        .from("voice-messages")
        .list("", {
          limit: 1000,
          sortBy: {
            column: "created_at",
            order: "asc",
          },
        });

    if (listError) {
      return NextResponse.json(
        { error: "Failed to list files" },
        { status: 500 }
      );
    }

    const oldFiles =
      objects
        ?.filter((file) => {
          if (!file.created_at) return false;

          return new Date(file.created_at) < cutoff;
        })
        .map((file) => file.name) || [];

    if (oldFiles.length === 0) {
      return NextResponse.json({
        deleted: 0,
        message: "No old voice files found.",
      });
    }

    const { error: removeError } =
      await supabaseAdmin.storage
        .from("voice-messages")
        .remove(oldFiles);

    if (removeError) {
      return NextResponse.json(
        { error: "Failed to remove files" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      deleted: oldFiles.length,
    });
  } catch (error) {
    console.error("Voice cleanup failed:", error);

    return NextResponse.json(
      { error: "Voice cleanup failed" },
      { status: 500 }
    );
  }
}