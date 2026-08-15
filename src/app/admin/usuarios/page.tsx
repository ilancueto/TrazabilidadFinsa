import { UserManager } from "@/components/admin/user-manager";
import { requireRole } from "@/lib/auth/session";
import { listManagedUsers } from "@/lib/deliveries/queries";

export const metadata = { title: "Usuarios" };

export default async function UsersAdminPage() {
  await requireRole(["ADMIN"]);
  const users = await listManagedUsers();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <p className="page-kicker">Administración</p>
        <h1 className="page-title">Usuarios</h1>
        <p className="page-sub">Administración ve el tablero. Picking carga las fotos desde el celular.</p>
      </div>
      <UserManager users={users} />
    </div>
  );
}
