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

    const { error } = await supabaseAdmin.rpc(
      "admin_set_creator_active",
      {
        creator_id: id,
        active: false,
      }
    );

    if (error) {
      console.error("Creator deactivation failed:", error);

      return NextResponse.json(
        { error: "Failed to deactivate creator" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Creator deactivation failed:", error);

    return NextResponse.json(
      { error: "Creator deactivation failed" },
      { status: 500 }
    );
  }
}
