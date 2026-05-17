import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    const body = await request.json();

    const message = body.message;
    const creatorName = body.creatorName || "Creator";
    const creatorTagline = body.creatorTagline || "";
    const creatorStyle = body.creatorStyle || "";

    if (!message) {
      return NextResponse.json(
        {
          error: "Message required",
        },
        {
          status: 400,
        }
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

IMPORTANT RULES:
- Never claim to be human.
- Never claim to be the real creator.
- Never pretend this is a real private relationship.
- Keep replies conversational, emotionally natural, and voice-friendly.
- Avoid sounding robotic or overly formal.
- Stay aligned with the creator's conversational vibe and energy.
- Short to medium replies work best.
- Keep replies under 2-4 short sentences.
- Avoid long explanations.
`,
        },
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