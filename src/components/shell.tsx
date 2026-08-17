import Link from "next/link";
import { AppNav, MobileNav } from "@/components/app-nav";
import { BrandLogo } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { ROLE_LABEL } from "@/lib/constants";
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
  const home = variant === "admin" ? "/admin" : "/picking";
  const settingsHref = user.role === "ADMIN" ? "/admin/ajustes" : "/cuenta";
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link href={home} className="sidebar-brand" aria-label="Inicio">
          <BrandLogo size="sm" />
        </Link>
        <AppNav role={user.role} variant={variant} />
        <div className="sidebar-account">
          <span className="sidebar-avatar" aria-hidden="true">{initials(user.fullName)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{ROLE_LABEL[user.role]}</p>
          </div>
          <Link href={settingsHref} className="account-link" aria-label={user.role === "ADMIN" ? "Ajustes" : "Configuración de cuenta"}>⚙</Link>
        </div>
      </aside>
      <div className="app-workspace">
        <header className="app-topbar">
          <Link href={home} className="mobile-brand" aria-label="Inicio"><BrandLogo size="sm" /></Link>
          <div className="live-indicator"><span /> Operación en vivo</div>
          <MobileNav user={user} variant={variant} />
          <div className="topbar-account">
            <span className="topbar-avatar" aria-hidden="true">{initials(user.fullName)}</span>
            <div><strong>{user.fullName}</strong><small>{ROLE_LABEL[user.role]}</small></div>
            <Link href={settingsHref} className="topbar-link">{user.role === "ADMIN" ? "Ajustes" : "Cuenta"}</Link>
            <SignOutButton className="btn btn-ghost btn-sm" />
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
