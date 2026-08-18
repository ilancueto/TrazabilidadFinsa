import Link from "next/link";
import { requireRole } from "@/lib/auth/session";

export const metadata = { title: "Ajustes" };

const settings = [
  {
    href: "/admin/clientes",
    icon: "🏢",
    title: "Clientes",
    description: "Catálogo de clientes y bases operativas (ej: Halliburton Añelo, SLB).",
  },
  {
    href: "/admin/requisitos",
    icon: "≡",
    title: "Requisitos",
    description: "Fotos obligatorias y plantillas para cada modalidad de entrega.",
  },
  {
    href: "/admin/usuarios",
    icon: "♙",
    title: "Usuarios",
    description: "Altas, roles, contraseñas, accesos y eliminación de cuentas.",
  },
  {
    href: "/cuenta",
    icon: "⚙",
    title: "Mi cuenta",
    description: "Datos de tu usuario y cambio de contraseña.",
  },
];

export default async function SettingsPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/admin" className="back-link">← Volver a Entregas</Link>
      <div>
        <p className="page-kicker">Administración</p>
        <h1 className="page-title">Ajustes</h1>
        <p className="page-sub">Configuración del sistema y de los accesos.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {settings.map((item) => (
          <Link key={item.href} href={item.href} className="panel group p-5 no-underline transition hover:border-cat">
            <span className="nav-icon mb-5 text-xl" aria-hidden="true">{item.icon}</span>
            <h2 className="text-lg font-semibold text-white transition-colors group-hover:text-cat">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
            <span className="mt-5 inline-block text-sm font-bold text-cat">Abrir →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
