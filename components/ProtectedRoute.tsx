"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkUser() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (!session?.user) {
          setAllowed(false);
          setChecking(false);
          router.replace("/login");
          return;
        }

        setAllowed(true);
        setChecking(false);
      } catch (error) {
        console.error("Protected route check failed:", error);

        if (!cancelled) {
          setAllowed(false);
          setChecking(false);
          router.replace("/login");
        }
      }
    }

    checkUser();

    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </main>
    );
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
