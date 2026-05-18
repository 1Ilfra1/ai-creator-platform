import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const PREMIUM_MONTHLY_SECONDS = 3600;

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
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: "active",
          plan: "premium_basic",
          stripe_customer_id: customerId || null,
          stripe_subscription_id: subscriptionId || null,
          voice_seconds_remaining: PREMIUM_MONTHLY_SECONDS,
          voice_seconds_monthly_allowance: PREMIUM_MONTHLY_SECONDS,
        })
        .eq("id", userId);

      if (error) {
        console.error("Subscription update failed:", error);
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
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: "active",
          plan: "premium_basic",
          voice_seconds_remaining: PREMIUM_MONTHLY_SECONDS,
          voice_seconds_monthly_allowance: PREMIUM_MONTHLY_SECONDS,
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