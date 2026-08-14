import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import type { SessionUser } from "@/lib/types";

export function AppShell({
  user,
  children,
  variant,
}: {
  user: SessionUser;
  children: React.ReactNode;
  variant: "admin" | "picking";
}) {
  return (
    <div className="min-h-screen">
      <header className="bg-anthracite text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href={variant === "admin" ? "/admin" : "/picking"} className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-sm bg-cat text-xs font-black text-ink">
              CAT
            </span>
            <span>
              <span className="block text-[10px] uppercase tracking-[0.18em] text-white/60">
                Finning · interno
              </span>
              <span className="block text-sm font-semibold">
                {variant === "admin" ? "Despacho / Admin" : "Picking"}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {user.role === "ADMIN" && variant === "admin" ? (
              <Link href="/picking" className="hidden text-xs text-white/70 hover:text-white sm:inline">
                Ver Picking
              </Link>
            ) : null}
            {user.role === "ADMIN" && variant === "picking" ? (
              <Link href="/admin" className="text-xs text-white/70 hover:text-white">
                Admin
              </Link>
            ) : null}
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">{user.fullName}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/50">{user.role}</p>
            </div>
            <SignOutButton />
          </div>
        </div>
        <div className="h-1 bg-cat" />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
    </div>
  );
}
