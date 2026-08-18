import Link from "next/link";
import { ClientManager } from "@/components/admin/client-manager";
import { requireRole } from "@/lib/auth/session";
import { listClients } from "@/lib/clients/queries";

export const metadata = { title: "Clientes" };

export default async function ClientsAdminPage() {
  await requireRole(["ADMIN"]);
  const clients = await listClients();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/admin/ajustes" className="back-link">
        ← Volver a Ajustes
      </Link>
      <div>
        <p className="page-kicker">Catálogo</p>
        <h1 className="page-title">Clientes</h1>
        <p className="page-sub">
          Gestioná los clientes y bases operativas (ej: &quot;Halliburton Añelo&quot;, &quot;SLB&quot;). Se usarán para autocompletar, filtrar y agrupar entregas.
        </p>
      </div>
      <ClientManager clients={clients} />
    </div>
  );
}
