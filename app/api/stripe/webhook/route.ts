import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const webhookSecret =
    process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
    const body = await req.text();

    const signature = (await headers()).get(
        "stripe-signature"
    );

    if (!signature) {
        return NextResponse.json(
            { error: "No signature" },
            { status: 400 }
        );
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            webhookSecret
        );
    } catch (error) {
        console.error(error);

        return NextResponse.json(
            { error: "Webhook error" },
            { status: 400 }
        );
    }

    if (
        event.type ===
        "checkout.session.completed"
    ) {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.user_id;

        if (userId) {
            const { error } = await supabaseAdmin
                .from("profiles")
                .update({
                    subscription_status: "active",
                    voice_seconds_remaining: 3600,
                })
                .eq("id", userId);

            if (error) {
                console.error("Subscription update failed:", error);
            }
        }
    }

    return NextResponse.json({
        received: true,
    });
}