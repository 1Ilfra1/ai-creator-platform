export default function Page() {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">
          Refund Policy
        </h1>

        <div className="space-y-4 text-zinc-400">
          <p>
            Subscription and top-up purchases are generally non-refundable once purchased.
          </p>

          <p>
            Subscriptions provide recurring access to the selected monthly voice minute allowance. Top-ups add additional voice minutes to your account.
          </p>

          <p>
            Unused voice minutes, generated AI chat replies, generated AI voice messages, and creator profile access are not guaranteed to be refundable.
          </p>

          <p>
            Payments are processed by Stripe. Billing errors, duplicate charges, failed delivery of purchased minutes, or technical issues may be reviewed on a case-by-case basis.
          </p>

          <p>
            Refund requests and billing questions should be reported as soon as possible.
          </p>

          <p>
            Support: sup1clients@gmail.com
          </p>
        </div>
      </div>
    </main>
  );
}
