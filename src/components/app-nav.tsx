"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { ROLE_LABEL } from "@/lib/constants";
import type { SessionUser, UserRole } from "@/lib/types";

type NavItem = { href: string; label: string };

function NavIcon({ href }: { href: string }) {
  if (href === "/admin" || href === "/picking") {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    );
  }
  if (href === "/tablero") {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    );
  }
  if (href === "/manual") {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}

function isActive(path: string, href: string) {
  return path === href || (href !== "/admin" && href !== "/picking" && path.startsWith(`${href}/`));
}

function navItems(role: UserRole, variant: "admin" | "picking"): NavItem[] {
  return variant === "picking"
    ? [
        { href: "/picking", label: "Despachos" },
        { href: "/tablero", label: "Tablero" },
        ...(role === "ADMIN" || role === "SUPERVISOR"
          ? [{ href: "/admin", label: "Oficina" }]
          : []),
        { href: "/manual", label: "Ayuda" },
      ]
    : [
        { href: "/admin", label: "Despachos" },
        { href: "/tablero", label: "Tablero" },
        ...(role === "ADMIN"
          ? [{ href: "/picking", label: "Picking" }]
          : []),
        { href: "/manual", label: "Ayuda" },
      ];
}

function Item({ href, label, path }: NavItem & { path: string }) {
  const on = isActive(path, href);
  return (
    <Link href={href} className={on ? "nav-link nav-link-on" : "nav-link"} aria-current={on ? "page" : undefined}>
      <span className="nav-icon" aria-hidden="true"><NavIcon href={href} /></span>
      <span>{label}</span>
    </Link>
  );
}

export function AppNav({ role, variant }: { role: UserRole; variant: "admin" | "picking" }) {
  const path = usePathname();
  const items = navItems(role, variant);

  return (
    <nav className="app-nav" aria-label="Navegación principal">
      {items.map((item) => <Item key={item.href} {...item} path={path} />)}
    </nav>
  );
}

export function MobileNav({
  user,
  variant,
}: {
  user: Pick<SessionUser, "fullName" | "role">;
  variant: "admin" | "picking";
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const items = navItems(user.role, variant);
  const settingsHref = user.role === "ADMIN" ? "/admin/ajustes" : "/cuenta";

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="mobile-menu-trigger"
        aria-expanded={open}
        aria-controls="mobile-sidebar"
        onClick={() => setOpen(true)}
      >
        <span className="mobile-menu-icon" aria-hidden="true"><i /><i /><i /></span>
        <span>Menú</span>
      </button>

      <div className="mobile-drawer-layer" data-open={open} aria-hidden={!open}>
        <button
          type="button"
          className="mobile-drawer-backdrop"
          aria-label="Cerrar menú"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
        />
        <aside id="mobile-sidebar" className="mobile-drawer" aria-label="Menú principal">
          <div className="mobile-drawer-head">
            <BrandLogo size="sm" />
            <button
              ref={closeButtonRef}
              type="button"
              className="mobile-drawer-close"
              aria-label="Cerrar menú"
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <nav className="mobile-drawer-nav" aria-label="Navegación móvil">
            {items.map((item) => {
              const on = isActive(path, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={on ? "mobile-drawer-link mobile-drawer-link-on" : "mobile-drawer-link"}
                  aria-current={on ? "page" : undefined}
                  tabIndex={open ? 0 : -1}
                  onClick={() => setOpen(false)}
                >
                  <span className="nav-icon" aria-hidden="true"><NavIcon href={item.href} /></span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mobile-drawer-account">
            <div className="mobile-drawer-identity">
              <span className="sidebar-avatar" aria-hidden="true">{initials(user.fullName)}</span>
              <div className="min-w-0">
                <strong>{user.fullName}</strong>
                <small>{ROLE_LABEL[user.role]}</small>
              </div>
            </div>
            <div className="mobile-drawer-actions">
              <Link href={settingsHref} className="btn btn-ghost btn-sm" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>
                {user.role === "ADMIN" ? "Ajustes" : "Cuenta"}
              </Link>
              <SignOutButton className="btn btn-ghost btn-sm" />
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}
