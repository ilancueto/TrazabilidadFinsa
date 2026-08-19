import Link from "next/link";
import { AccountPasswordForm } from "@/components/account-password-form";
import { DataSaverToggle } from "@/components/data-saver-toggle";
import { AppShell } from "@/components/shell";
import { ROLE_LABEL } from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";

export const metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const user = await requireSession();
  const backHref = user.role === "ADMIN" ? "/admin/ajustes" : user.role === "PICKING" ? "/picking" : "/admin";
  const backLabel = user.role === "ADMIN" ? "Ajustes" : "la operación";
  return (
    <AppShell user={user} variant={user.role === "PICKING" ? "picking" : "admin"}>
      <div className="space-y-5">
        <Link href={backHref} className="back-link">← Volver a {backLabel}</Link>
        <div>
          <p className="page-kicker">{ROLE_LABEL[user.role]}</p>
          <h1 className="page-title">{user.fullName}</h1>
          <p className="page-sub">{user.email}</p>
        </div>
        <DataSaverToggle />
        <AccountPasswordForm />
      </div>
    </AppShell>
  );
}
