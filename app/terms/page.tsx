export default function Page() {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">
          Terms of Service
        </h1>

        <div className="space-y-4 text-zinc-400">
          <p>
            Creator Voice provides AI-generated creator-style conversations and voice replies.
          </p>

          <p>
            AI-generated chat replies and AI-generated voice messages are not real-time messages from the creator unless explicitly stated.
          </p>

          <p>
            Users are responsible for the messages, profile information, creator settings, and uploaded creator assets they provide.
          </p>

          <p>
            Creator profiles, images, audio, voice settings, names, and descriptions must be content you own, control, or have permission to use.
          </p>

          <p>
            Paid subscriptions and top-ups provide access to voice minutes according to the selected plan or package. Payments are processed by Stripe.
          </p>

          <p>
            The service uses third-party providers including Supabase, Stripe, OpenAI, and ElevenLabs to operate authentication, storage, payments, AI chat, and AI voice features.
          </p>

          <p>
            Abuse, illegal activity, harassment, fraud, impersonation without rights, and misuse of AI voice or creator profiles are prohibited.
          </p>

          <p>
            Support: sup1clients@gmail.com
          </p>
        </div>
      </div>
    </main>
  );
}
