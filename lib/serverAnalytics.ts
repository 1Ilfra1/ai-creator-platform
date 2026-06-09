import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface ServerAnalyticsEvent {
  userId?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function trackServerEvent(event: ServerAnalyticsEvent) {
  try {
    const { error } = await supabaseAdmin
      .from("analytics_events")
      .insert({
        user_id: event.userId || null,
        event_type: event.eventType,
        entity_type: event.entityType || null,
        entity_id: event.entityId || null,
        session_id: event.sessionId || null,
        metadata: event.metadata || {},
      });

    if (error) {
      console.error("Server analytics event failed:", error);
    }
  } catch (error) {
    console.error("Server analytics event failed:", error);
  }
}
