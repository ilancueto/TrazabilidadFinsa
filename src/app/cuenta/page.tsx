import { AccountPasswordForm } from "@/components/account-password-form";
import { AppShell } from "@/components/shell";
import { ROLE_LABEL } from "@/lib/constants";
import { requireSession } from "@/lib/auth/session";

export const metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const user = await requireSession();
  return (
    <AppShell user={user} variant={user.role === "PICKING" ? "picking" : "admin"}>
      <div className="space-y-5">
        <div>
          <p className="page-kicker">{ROLE_LABEL[user.role]}</p>
          <h1 className="page-title">{user.fullName}</h1>
          <p className="page-sub">{user.email}</p>
        </div>
        <AccountPasswordForm />
      </div>
    </AppShell>
  );
}
