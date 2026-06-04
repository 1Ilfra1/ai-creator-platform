export default function Page() {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">
          Privacy Policy
        </h1>

        <div className="space-y-4 text-zinc-400">
          <p>
            Creator Voice collects the information needed to provide accounts, creator profiles, AI chat, voice replies, subscriptions, and top-ups.
          </p>

          <p>
            Account data may include your email address, username, subscription status, voice minute balance, and billing identifiers needed to connect your account with Stripe.
          </p>

          <p>
            Creator profile data may include display names, usernames, descriptions, personality settings, uploaded profile images, banner images, intro audio, and voice configuration.
          </p>

          <p>
            User content may include chat messages, conversation history, generated AI replies, generated voice audio, and uploaded creator assets.
          </p>

          <p>
            Payments are processed by Stripe. Creator Voice does not store full payment card details.
          </p>

          <p>
            We use service providers including Supabase for authentication, database, and storage; Stripe for payments; OpenAI for AI-generated chat; and ElevenLabs for AI-generated voice.
          </p>

          <p>
            For privacy questions, deletion requests, or account data requests, contact: sup1clients@gmail.com
          </p>
        </div>
      </div>
    </main>
  );
}
