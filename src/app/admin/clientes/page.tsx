import Link from "next/link";
import { ClientManager } from "@/components/admin/client-manager";
import { requireRole } from "@/lib/auth/session";
import { listClients, listClientAliases } from "@/lib/clients/queries";

export const metadata = { title: "Clientes" };

export default async function ClientsAdminPage() {
  await requireRole(["ADMIN"]);
  const [clients, aliases] = await Promise.all([
    listClients(),
    listClientAliases(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/admin/ajustes" className="back-link">
        ← Volver a Ajustes
      </Link>
      <div>
        <p className="page-kicker">Catálogo</p>
        <h1 className="page-title">Clientes y Equivalencias SAP</h1>
        <p className="page-sub">
          Gestioná los clientes y las reglas de equivalencia para asociar razones sociales de SAP con clientes de bodega.
        </p>
      </div>
      <ClientManager clients={clients} aliases={aliases} />
    </div>
  );
}
