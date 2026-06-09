import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { trackServerEvent } from "@/lib/serverAnalytics";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const PLAN_SECONDS: Record<string, number> = {
  starter: 1200,
  premium: 3600,
  vip: 10800,
};

const TOPUP_SECONDS: Record<string, number> = {
  "30": 1800,
  "60": 3600,
  "120": 7200,
};

export async function POST(req: Request) {
  const body = await req.text();

  const signature = (await headers()).get("stripe-signature");

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
    console.error("Stripe webhook signature failed:", error);

    return NextResponse.json(
      { error: "Webhook error" },
      { status: 400 }
    );
  }

  const { error: eventInsertError } = await supabaseAdmin
    .from("stripe_events")
    .insert({
      id: event.id,
      type: event.type,
    });

  if (eventInsertError) {
    if (eventInsertError.code === "23505") {
      return NextResponse.json({
        received: true,
        duplicate: true,
      });
    }

    console.error(
      "Stripe event idempotency insert failed:",
      eventInsertError
    );

    return NextResponse.json(
      { error: "Webhook idempotency failed" },
      { status: 500 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const userId =
      session.metadata?.user_id || session.client_reference_id;

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;

    if (userId) {
      const topupPack = session.metadata?.topup_pack;

      if (topupPack) {
        const topupSeconds = TOPUP_SECONDS[topupPack];

        if (!topupSeconds) {
          return NextResponse.json(
            { error: "Invalid top-up pack" },
            { status: 400 }
          );
        }

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("voice_seconds_remaining")
          .eq("id", userId)
          .single();

        const currentSeconds =
          profile?.voice_seconds_remaining || 0;

        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            stripe_customer_id: customerId || null,
            voice_seconds_remaining:
              currentSeconds + topupSeconds,
            has_paid_before: true,
          })
          .eq("id", userId);

        if (error) {
          console.error("Top-up update failed:", error);
        } else {
          await trackServerEvent({
            userId,
            eventType: "purchase_completed",
            metadata: {
              purchase_type: "topup",
              topup_pack: topupPack,
              seconds_added: topupSeconds,
              stripe_event_id: event.id,
            },
          });
        }

        return NextResponse.json({
          received: true,
        });
      }

      const plan = session.metadata?.plan || "premium";
      const monthlySeconds = PLAN_SECONDS[plan] || PLAN_SECONDS.premium;

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: "active",
          plan,
          stripe_customer_id: customerId || null,
          stripe_subscription_id: subscriptionId || null,
          voice_seconds_remaining: monthlySeconds,
          voice_seconds_monthly_allowance: monthlySeconds,
          has_paid_before: true,
        })
        .eq("id", userId);

      if (error) {
        console.error("Subscription update failed:", error);
      } else {
        await trackServerEvent({
          userId,
          eventType: "purchase_completed",
          metadata: {
            purchase_type: "subscription",
            plan,
            seconds_granted: monthlySeconds,
            stripe_event_id: event.id,
          },
        });
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;

    const subscriptionId = subscription.id;

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        subscription_status: "canceled",
        plan: "free",
        stripe_subscription_id: null,
      })
      .eq("stripe_subscription_id", subscriptionId);

    if (error) {
      console.error("Subscription cancellation update failed:", error);
    }
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as any;

    const subscriptionId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;

    if (subscriptionId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("plan")
        .eq("stripe_subscription_id", subscriptionId)
        .single();

      const plan = profile?.plan || "premium";
      const monthlySeconds = PLAN_SECONDS[plan] || PLAN_SECONDS.premium;

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: "active",
          plan,
          voice_seconds_remaining: monthlySeconds,
          voice_seconds_monthly_allowance: monthlySeconds,
          has_paid_before: true,
        })
        .eq("stripe_subscription_id", subscriptionId);

      if (error) {
        console.error("Monthly refill update failed:", error);
      }
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as any;

    const subscriptionId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;

    if (subscriptionId) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: "past_due",
        })
        .eq("stripe_subscription_id", subscriptionId);

      if (error) {
        console.error("Payment failed update failed:", error);
      }
    }
  }

  return NextResponse.json({
    received: true,
  });
}
