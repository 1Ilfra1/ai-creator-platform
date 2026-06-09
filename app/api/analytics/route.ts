import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BLOCKED_METADATA_KEYS = new Set([
  "message",
  "text",
  "prompt",
  "system_prompt",
  "personality_prompt",
  "email",
  "token",
]);

const MAX_METADATA_BYTES = 8000;
const EVENT_TYPE_PATTERN = /^[A-Za-z0-9_.:-]{2,80}$/;
const ENTITY_TYPE_PATTERN = /^[A-Za-z0-9_.:-]{1,80}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function sanitizeMetadata(
  value: unknown,
  depth = 0
): Record<string, unknown> | unknown[] | string | number | boolean | null {
  if (depth > 3) return null;

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 25)
      .map((item) => sanitizeMetadata(item, depth + 1));
  }

  if (!isPlainObject(value)) return null;

  return Object.entries(value).reduce<Record<string, unknown>>(
    (metadata, [key, metadataValue]) => {
      const normalizedKey = key.toLowerCase();

      if (BLOCKED_METADATA_KEYS.has(normalizedKey)) {
        return metadata;
      }

      metadata[key.slice(0, 80)] = sanitizeMetadata(
        metadataValue,
        depth + 1
      );

      return metadata;
    },
    {}
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const eventType = String(body.eventType || "").trim();
    const entityType = body.entityType
      ? String(body.entityType).trim()
      : null;
    const entityId = body.entityId ? String(body.entityId).trim() : null;
    const sessionId = body.sessionId ? String(body.sessionId).trim() : null;
    const anonymousId = body.anonymousId
      ? String(body.anonymousId).trim().slice(0, 120)
      : null;

    if (!EVENT_TYPE_PATTERN.test(eventType)) {
      return NextResponse.json(
        { error: "Invalid event type" },
        { status: 400 }
      );
    }

    if (entityType && !ENTITY_TYPE_PATTERN.test(entityType)) {
      return NextResponse.json(
        { error: "Invalid entity type" },
        { status: 400 }
      );
    }

    if (entityId && !UUID_PATTERN.test(entityId)) {
      return NextResponse.json(
        { error: "Invalid entity id" },
        { status: 400 }
      );
    }

    if (sessionId && !UUID_PATTERN.test(sessionId)) {
      return NextResponse.json(
        { error: "Invalid session id" },
        { status: 400 }
      );
    }

    if (
      body.metadata !== undefined &&
      body.metadata !== null &&
      !isPlainObject(body.metadata)
    ) {
      return NextResponse.json(
        { error: "Invalid metadata" },
        { status: 400 }
      );
    }

    const sanitizedMetadata = sanitizeMetadata(
      body.metadata || {}
    ) as Record<string, unknown>;

    if (JSON.stringify(sanitizedMetadata).length > MAX_METADATA_BYTES) {
      return NextResponse.json(
        { error: "Metadata too large" },
        { status: 400 }
      );
    }

    let userId: string | null = null;
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (token) {
      const {
        data: { user },
        error,
      } = await supabaseAdmin.auth.getUser(token);

      if (error || !user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      userId = user.id;
    }

    if (!userId && !anonymousId) {
      return NextResponse.json(
        { error: "Anonymous id required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("analytics_events")
      .insert({
        user_id: userId,
        anonymous_id: anonymousId,
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        session_id: sessionId,
        metadata: sanitizedMetadata,
      });

    if (error) {
      console.error("Analytics event insert failed:", error);

      return NextResponse.json(
        { error: "Analytics event failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true }, { status: 201 });
  } catch (error) {
    console.error("Analytics event failed:", error);

    return NextResponse.json(
      { error: "Analytics event failed" },
      { status: 500 }
    );
  }
}
