"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkUser() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (!session?.user) {
          window.location.href = "/login";
          return;
        }

        setChecked(true);
      } catch (error) {
        console.error("Protected route check failed:", error);

        if (!cancelled) {
          setChecked(true);
        }
      }
    }

    checkUser();

    const timeout = setTimeout(() => {
      if (!cancelled) {
        setChecked(true);
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  if (!checked) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </main>
    );
  }

  return <>{children}</>;
}