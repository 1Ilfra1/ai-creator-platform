export default function Footer() {
    return (
        <footer className="bg-black border-t border-zinc-900 px-6 py-6 text-center text-xs text-zinc-600">
            <div className="flex flex-wrap justify-center gap-4 mb-3">
                <a href="/privacy" className="hover:text-zinc-300">
                    Privacy Policy
                </a>

                <a href="/terms" className="hover:text-zinc-300">
                    Terms
                </a>

                <a href="/refund-policy" className="hover:text-zinc-300">
                    Refund Policy
                </a>

                <a href="/ai" className="hover:text-zinc-300">
                    AI Disclosure
                </a>
            </div>

            <p>
                Support:{" "}
                <a
                    href="mailto:sup1clients@gmail.com"
                    className="hover:text-zinc-300"
                >
                    sup1clients@gmail.com
                </a>
            </p>
        </footer>
    );
}