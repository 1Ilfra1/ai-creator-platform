import { NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";


export async function POST(request: Request) {

  try {

    const body = await request.json();

    const text = body.text || "";
    const voiceId = body.voiceId;

    if (!text) {
      return NextResponse.json(
        {
          error: "Text required",
        },
        {
          status: 400,
        }
      );
    }

    // fallback if no voice id

    if (!voiceId) {

      return NextResponse.json({
        audioUrl: "/mock-voice.mp3",
        mock: true,
      });
    }
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        audioUrl: "/mock-voice.mp3",
        mock: true,
      });
    }

    const elevenlabs = new ElevenLabsClient({
      apiKey,
    });
    const audio = await elevenlabs.textToSpeech.convert(
      voiceId,
      {
        text,
        model_id: "eleven_multilingual_v2",
      }
    );

    const chunks: Buffer[] = [];

    for await (const chunk of audio) {
      chunks.push(chunk);
    }

    const audioBuffer = Buffer.concat(chunks);

    const base64Audio =
      audioBuffer.toString("base64");

    return NextResponse.json({
      audio: base64Audio,
      mimeType: "audio/mpeg",
      generated: true,
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json({
      audioUrl: "/mock-voice.mp3",
      fallback: true,
    });
  }
}