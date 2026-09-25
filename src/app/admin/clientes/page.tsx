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
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/admin/ajustes" className="back-link">
        ← Volver a Ajustes
      </Link>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-cat" />
          <p className="page-kicker">Catálogo y Destinos</p>
        </div>
        <h1 className="page-title text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Clientes y Equivalencias SAP
        </h1>
        <p className="page-sub text-sm text-muted max-w-2xl">
          Administrá el maestro de clientes de bodega y las reglas automáticas de asociación con razones sociales de SAP.
        </p>
      </div>
      <ClientManager clients={clients} aliases={aliases} />
    </div>
  );
}
