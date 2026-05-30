import OpenAI from "openai";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_MESSAGE_LENGTH = 500;
const DAILY_CHAT_LIMIT = 500;

const fallbackReplies = [
  "I’m here with you 💜",
  "Tell me more…",
  "That actually feels important.",
  "I’m listening. Go on.",
  "You have my full attention now.",
  "Mmm… tell me a little more.",
  "I like hearing what’s on your mind.",
];

function getFallbackReply() {
  return fallbackReplies[
    Math.floor(Math.random() * fallbackReplies.length)
  ];
}

export async function POST(request: Request) {
  try {
    if (process.env.EMERGENCY_MODE === "true") {
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 }
      );
    }
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
      .eq("endpoint", "chat")
      .gte("created_at", oneMinuteAgo);

    if ((count || 0) >= 10) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }


    const oneDayAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    const { count: dailyCount } = await supabaseAdmin
      .from("api_rate_limits")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("user_id", user.id)
      .eq("endpoint", "chat")
      .gte("created_at", oneDayAgo);

    if ((dailyCount || 0) >= 100) {
      return NextResponse.json(
        { error: "Daily chat limit reached" },
        { status: 429 }
      );
    }


    await supabaseAdmin
      .from("api_rate_limits")
      .insert({
        user_id: user.id,
        endpoint: "chat",
      });



    const body = await request.json();

    const rawMessage = String(body.message || "");

    const message =
      rawMessage.length > MAX_MESSAGE_LENGTH
        ? rawMessage.slice(0, MAX_MESSAGE_LENGTH)
        : rawMessage;

    const creatorName = body.creatorName || "Creator";
    const creatorTagline = body.creatorTagline || "";
    const creatorStyle = body.creatorStyle || "";
    const conversationId = body.conversationId;

    const recentMessages = Array.isArray(body.recentMessages)
      ? body.recentMessages
        .slice(-8)
        .filter(
          (msg: any) =>
            (msg.role === "user" || msg.role === "assistant") &&
            typeof msg.content === "string"
        )
        .map((msg: any) => ({
          role: msg.role,
          content: msg.content.slice(0, 500),
        }))
      : [];

    let memoryText = "";

    if (conversationId) {
      const { data: memories } = await supabaseAdmin
        .from("conversation_memories")
        .select("memory")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(5);

      memoryText =
        memories
          ?.map((item) => item.memory)
          .join("\n") || "";
    }

    if (!message) {
      return NextResponse.json(
        { error: "Message required" },
        { status: 400 }
      );
    }

    if (process.env.AI_MODE === "mock") {
      return NextResponse.json({
        reply: getFallbackReply(),
        fallback: true,
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",

      messages: [
        {
          role: "system",
          content: `
You are an AI voice presence inspired by ${creatorName}.

Creator description:
${creatorTagline}

Creator vibe & style:
${creatorStyle}

Known memory about this conversation:
${memoryText || "No long-term memory yet."}

IMPORTANT RULES:
- Never claim to be human.
- Never claim to be the real creator.
- Never pretend this is a real private relationship.
- Keep replies conversational, emotionally natural, and voice-friendly.
- Avoid sounding robotic or overly formal.
- Stay aligned with the creator's conversational vibe and energy.
- Use recent conversation context naturally when relevant.
- Use known memory naturally when relevant, but do not mention that you have a memory system.
- Short to medium replies work best.
- Keep replies under 2-4 short sentences.
- Avoid long explanations.
`,
        },
        ...recentMessages,
        {
          role: "user",
          content: message,
        },
      ],

      temperature: 0.9,
      max_completion_tokens: 120,
    });

    const reply =
      completion.choices[0].message.content ||
      getFallbackReply();

    const memoryKeywords = [
      "my name is",
      "i am",
      "i feel",
      "i like",
      "i love",
      "i hate",
      "i miss",
      "i want",
      "i need",
      "i'm scared",
      "i am scared",
      "i'm lonely",
      "i am lonely",
      "remember",
    ];

    const shouldSaveMemory =
      conversationId &&
      message.length > 20 &&
      reply.length > 20 &&
      memoryKeywords.some((keyword) =>
        message.toLowerCase().includes(keyword)
      );

    if (shouldSaveMemory) {
      const memoryCandidate =
        `User said: ${message.slice(0, 180)} | AI replied: ${reply.slice(0, 180)}`;

      const { data: existingMemories } = await supabaseAdmin
        .from("conversation_memories")
        .select("id, memory")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(10);

      const alreadySaved =
        existingMemories?.some((item) =>
          item.memory.toLowerCase().includes(message.slice(0, 60).toLowerCase())
        ) || false;

      if (!alreadySaved) {
        await supabaseAdmin
          .from("conversation_memories")
          .insert({
            conversation_id: conversationId,
            memory: memoryCandidate,
          });
      }

      if ((existingMemories?.length || 0) >= 10) {
        const memoriesToDelete =
          existingMemories
            ?.slice(9)
            .map((item) => item.id) || [];

        if (memoriesToDelete.length > 0) {
          await supabaseAdmin
            .from("conversation_memories")
            .delete()
            .in("id", memoriesToDelete);
        }
      }
    }

    return NextResponse.json({
      reply,
    });
  } catch (error) {
    console.error("AI chat failed:", error);

    return NextResponse.json({
      reply: getFallbackReply(),
      fallback: true,
    });
  }
}