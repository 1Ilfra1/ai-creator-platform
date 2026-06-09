"use client";

import { supabase } from "@/lib/supabase";

type AnalyticsMetadata = Record<string, unknown>;

interface TrackEventInput {
  eventType: string;
  entityType?: string;
  entityId?: string;
  sessionId?: string;
  metadata?: AnalyticsMetadata;
}

const ANONYMOUS_ID_KEY = "ai_creator_anonymous_id";

function createAnonymousId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getAnonymousId() {
  const existingId = window.localStorage.getItem(ANONYMOUS_ID_KEY);

  if (existingId) return existingId;

  const nextId = createAnonymousId();
  window.localStorage.setItem(ANONYMOUS_ID_KEY, nextId);

  return nextId;
}

async function sendEvent(input: TrackEventInput) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  await fetch("/api/analytics", {
    method: "POST",
    headers,
    body: JSON.stringify({
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      sessionId: input.sessionId,
      anonymousId: getAnonymousId(),
      metadata: input.metadata || {},
    }),
  });
}

export function trackEvent(input: TrackEventInput) {
  if (typeof window === "undefined") return;

  void sendEvent(input).catch((error) => {
    if (process.env.NODE_ENV === "development") {
      console.error("Analytics event failed:", error);
    }
  });
}
