import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

    const { error: deactivationError } = await supabaseAdmin.rpc(
      "admin_set_creator_active",
      {
        creator_id: id,
        active: false,
      }
    );

    if (deactivationError) {
      console.error("Creator rejection deactivation failed:", deactivationError);

      return NextResponse.json(
        { error: "Failed to reject creator" },
        { status: 500 }
      );
    }

    const { error } = await supabaseAdmin
      .from("creators")
      .update({
        is_published: false,
      })
      .eq("id", id);

    if (error) {
      console.error("Creator rejection failed:", error);

      return NextResponse.json(
        { error: "Failed to reject creator" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Creator rejection failed:", error);

    return NextResponse.json(
      { error: "Creator rejection failed" },
      { status: 500 }
    );
  }
}
