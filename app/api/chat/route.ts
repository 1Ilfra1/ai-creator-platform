import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
          `,
        },

        {
          role: "user",
          content: message,
        },
      ],

      temperature: 0.9,
    });

    const reply =
      completion.choices[0].message.content ||
      "I don't know what to say.";

    return NextResponse.json({
      reply,
    });

  } catch (error) {

    console.error(error);

    const fallbackReplies = [
      "I’m here with you 💜",
      "Tell me more…",
      "That’s actually really interesting.",
      "You have my attention now.",
      "I like hearing your thoughts.",
      "Mmm… go on.",
      "That sounds emotional.",
    ];

    const randomReply =
      fallbackReplies[
      Math.floor(Math.random() * fallbackReplies.length)
      ];

    return NextResponse.json({
      reply: randomReply,
      fallback: true,
    });
  }
}