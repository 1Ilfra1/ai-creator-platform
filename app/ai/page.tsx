export default function Page() {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">
          AI Disclosure
        </h1>

        <div className="space-y-4 text-zinc-400">
          <p>
            Creator Voice uses artificial intelligence to generate replies and voice audio.
          </p>

          <p>
            AI-generated chat responses are inspired by creator profiles, creator settings, and conversation context, but they are not real-time messages from the real creator.
          </p>

          <p>
            AI-generated voice replies may use synthetic voice technology. The voice audio is generated automatically from AI text responses.
          </p>

          <p>
            Creator intro audio, uploaded creator assets, and creator profile settings may be used to shape the fan experience, but generated replies remain AI-generated.
          </p>

          <p>
            Creator Voice uses providers including OpenAI for AI-generated chat, ElevenLabs for AI-generated voice, Supabase for account data and storage, and Stripe for payments.
          </p>

          <p>
            The service is intended for entertainment and creator-fan engagement.
          </p>

          <p>
            Support: sup1clients@gmail.com
          </p>
        </div>
      </div>
    </main>
  );
}
