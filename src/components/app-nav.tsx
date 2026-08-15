"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";

type NavItem = { href: string; label: string; icon: string };

function Item({ href, label, icon, path }: NavItem & { path: string }) {
  const on = path === href || (href !== "/admin" && path.startsWith(`${href}/`));
  return (
    <Link href={href} className={on ? "nav-link nav-link-on" : "nav-link"} aria-current={on ? "page" : undefined}>
      <span className="nav-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export function AppNav({ role, variant }: { role: UserRole; variant: "admin" | "picking" }) {
  const path = usePathname();
  const items: NavItem[] = variant === "picking"
    ? [
        { href: "/picking", label: "Entregas", icon: "▣" },
        { href: "/tablero", label: "Tablero", icon: "▦" },
        ...(role === "ADMIN" || role === "SUPERVISOR" ? [{ href: "/admin", label: "Oficina", icon: "⇄" }] : []),
        { href: "/manual", label: "Ayuda", icon: "?" },
      ]
    : [
        { href: "/admin", label: "Entregas", icon: "▣" },
        { href: "/admin/revision", label: "Revisión", icon: "✓" },
        ...(role === "ADMIN" ? [{ href: "/admin/deliveries/new", label: "Nueva", icon: "+" }] : []),
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

  return (
    <nav className="app-nav" aria-label="Navegación principal">
      {items.map((item) => <Item key={item.href} {...item} path={path} />)}
    </nav>
  );
}

export function MobileNav({ role, variant }: { role: UserRole; variant: "admin" | "picking" }) {
  const path = usePathname();
  const items =
    variant === "picking"
      ? [
          ["/picking", "Entregas"],
          ["/tablero", "Tablero"],
          ...(role === "ADMIN" || role === "SUPERVISOR" ? [["/admin", "Oficina"]] : []),
          ["/manual", "Ayuda"],
        ]
      : role === "ADMIN"
      ? [
          ["/admin", "Entregas"],
          ["/admin/revision", "Revisión"],
          ["/admin/deliveries/new", "Nueva"],
          ["/admin/dia", "Día"],
          ["/tablero", "Tablero"],
          ["/picking", "Picking"],
          ["/manual", "Ayuda"],
        ]
      : role === "SUPERVISOR"
        ? [
            ["/admin", "Entregas"],
            ["/admin/revision", "Revisión"],
            ["/admin/dia", "Día"],
            ["/tablero", "Tablero"],
            ["/manual", "Ayuda"],
          ]
        : [
            ["/picking", "Entregas"],
            ["/tablero", "Tablero"],
            ["/cuenta", "Cuenta"],
            ["/manual", "Ayuda"],
          ];

  return (
    <nav className="mobile-nav" aria-label="Navegación móvil">
      {items.map(([href, label]) => {
        const on = path === href || (href !== "/admin" && path.startsWith(`${href}/`));
        return (
          <Link key={href} href={href} className={on ? "tab tab-on shrink-0" : "tab shrink-0"}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
