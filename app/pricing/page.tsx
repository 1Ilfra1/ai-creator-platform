"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PricingPage() {
    const router = useRouter();

    return (
        <main className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
            <div className="max-w-md w-full">
                <button
                    onClick={() => router.back()}
                    className="text-zinc-400 mb-6"
                >
                    ← Back
                </button>

                <h1 className="text-3xl font-bold mb-2">
                    🎧 Continue the conversation
                </h1>

                <p className="text-zinc-500 mb-8">
                    Keep listening to creator voice replies
                    and stay connected 💜
                </p>

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 mb-4">
                    <p className="text-sm text-zinc-500 mb-2">
                        💜 Premium Access
                    </p>

                    <h2 className="text-4xl font-bold mb-2">
                        $9.99
                        <span className="text-base text-zinc-500 font-normal">
                            /month
                        </span>
                    </h2>

                    <p className="text-zinc-400 mb-6">
                        Includes monthly creator voice minutes.
                    </p>

                    <button
                        onClick={async () => {
                            const {
                                data: { user },
                            } = await supabase.auth.getUser();
                            
                            if (!user) {
                                router.push("/login");
                                return;
                            }

                            const response = await fetch("/api/stripe/checkout", {
                                method: "POST",

                                headers: {
                                    "Content-Type": "application/json",
                                },

                                body: JSON.stringify({
                                    userId: user.id,
                                    email: user.email,
                                }),
                            });

                            const data = await response.json();

                            if (data.url) {
                                window.location.href = data.url;
                            }
                        }}
                        className="w-full bg-green-500 text-black py-4 rounded-2xl font-bold"
                    >
                        Continue listening
                    </button>
                </div>

                <p className="text-xs text-zinc-600 text-center">
                    Payments will be securely processed by Stripe.
                </p>
            </div>
        </main>
    );
}