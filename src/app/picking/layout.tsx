import { AppShell } from "@/components/shell";
import { requireRole } from "@/lib/auth/session";

export default async function PickingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["PICKING", "ADMIN"]);
  return <AppShell user={user} variant="picking">{children}</AppShell>;
}
