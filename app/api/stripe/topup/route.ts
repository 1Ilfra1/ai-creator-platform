import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
      .eq("endpoint", "stripe_topup")
      .gte("created_at", oneMinuteAgo);

    if ((count || 0) >= 5) {
      return NextResponse.json(
        { error: "Too many top-up checkout requests" },
        { status: 429 }
      );
    }

    await supabaseAdmin
      .from("api_rate_limits")
      .insert({
        user_id: user.id,
        endpoint: "stripe_topup",
      });

    const body = await request.json();

    const pack = body.pack;

    const priceMap: Record<string, string | undefined> = {
      "30": process.env.STRIPE_30_MINUTES_PRICE_ID,
      "60": process.env.STRIPE_60_MINUTES_PRICE_ID,
      "120": process.env.STRIPE_120_MINUTES_PRICE_ID,
    };

    const priceId = priceMap[pack];

    if (!priceId) {
      return NextResponse.json(
        { error: "Invalid pack" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],

      mode: "payment",

      customer_email: user.email,

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      metadata: {
        user_id: user.id,
        topup_pack: pack,
      },

      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/profile`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing`,
    });

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error("Top-up checkout failed:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
