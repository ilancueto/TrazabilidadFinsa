import { AppShell } from "@/components/shell";
import { requireRole } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["ADMIN"]);
  return <AppShell user={user} variant="admin">{children}</AppShell>;
}
