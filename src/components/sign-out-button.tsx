"use client";

import { signOutAction } from "@/lib/actions/auth";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className ?? "text-sm text-white/80 hover:text-white"}>
        Salir
      </button>
    </form>
  );
}
