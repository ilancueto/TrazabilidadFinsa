"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function TableroRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 30000);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}
