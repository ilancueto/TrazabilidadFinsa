"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { ROLE_LABEL } from "@/lib/constants";
import type { SessionUser, UserRole } from "@/lib/types";

type NavItem = { href: string; label: string; icon: string };

function isActive(path: string, href: string) {
  return path === href || (href !== "/admin" && path.startsWith(`${href}/`));
}

function navItems(role: UserRole, variant: "admin" | "picking"): NavItem[] {
  return variant === "picking"
    ? [
        { href: "/picking", label: "Entregas", icon: "▣" },
        { href: "/tablero", label: "Tablero", icon: "▦" },
        ...(role === "ADMIN" || role === "SUPERVISOR"
          ? [{ href: "/admin", label: "Oficina", icon: "⇄" }]
          : []),
        { href: "/manual", label: "Ayuda", icon: "?" },
      ]
    : [
        { href: "/admin", label: "Entregas", icon: "▣" },
        { href: "/admin/revision", label: "Revisión", icon: "✓" },
        ...(role === "ADMIN"
          ? [{ href: "/admin/deliveries/new", label: "Nueva", icon: "+" }]
          : []),
        { href: "/admin/dia", label: "Día", icon: "◫" },
        { href: "/tablero", label: "Tablero", icon: "▦" },
        ...(role === "ADMIN"
          ? [
              { href: "/admin/requisitos", label: "Requisitos", icon: "≡" },
              { href: "/admin/usuarios", label: "Usuarios", icon: "♙" },
              { href: "/picking", label: "Picking", icon: "⇄" },
            ]
          : []),
        { href: "/manual", label: "Ayuda", icon: "?" },
      ];
}

function Item({ href, label, icon, path }: NavItem & { path: string }) {
  const on = isActive(path, href);
  return (
    <Link href={href} className={on ? "nav-link nav-link-on" : "nav-link"} aria-current={on ? "page" : undefined}>
      <span className="nav-icon" aria-hidden="true">{icon}</span>
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
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
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
              <Link href="/cuenta" className="btn btn-ghost btn-sm" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>
                Cuenta
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
