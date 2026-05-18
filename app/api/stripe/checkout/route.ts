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
      .eq("endpoint", "stripe_checkout")
      .gte("created_at", oneMinuteAgo);

    if ((count || 0) >= 5) {
      return NextResponse.json(
        { error: "Too many checkout requests" },
        { status: 429 }
      );
    }

    await supabaseAdmin
      .from("api_rate_limits")
      .insert({
        user_id: user.id,
        endpoint: "stripe_checkout",
      });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      payment_method_types: ["card"],

      customer_email: user.email,

      client_reference_id: user.id,

      metadata: {
        user_id: user.id,
      },

      line_items: [
        {
          price_data: {
            currency: "usd",

            product_data: {
              name: "Creator Voice Premium",
            },

            recurring: {
              interval: "month",
            },

            unit_amount: 999,
          },

          quantity: 1,
        },
      ],

      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/profile?success=true`,

      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing`,
    });

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Stripe checkout failed" },
      { status: 500 }
    );
  }
}