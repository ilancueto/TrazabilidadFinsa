import { redirect } from "next/navigation";
import { AccountPasswordForm } from "@/components/account-password-form";
import { BrandLogo } from "@/components/brand";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Crear contraseña" };

export default async function ChangePasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect(user.role === "PICKING" ? "/picking" : "/admin");

  return (
    <main className="password-setup-shell">
      <section className="password-setup-card">
        <BrandLogo size="md" />
        <div>
          <p className="page-kicker">Primer ingreso</p>
          <h1 className="page-title">Creá tu contraseña</h1>
          <p className="page-sub">Hola, {user.fullName}. Reemplazá la clave temporal para continuar a Bodega Neuquén.</p>
        </div>
        <AccountPasswordForm forced />
      </section>
    </main>
  );
}
