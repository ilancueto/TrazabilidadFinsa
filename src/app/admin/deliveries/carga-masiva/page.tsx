import Link from "next/link";
import { BulkImportForm } from "@/components/admin/bulk-import-form";
import { requireRole } from "@/lib/auth/session";
import { listClients, listClientAliases } from "@/lib/clients/queries";
import { listDeliveries } from "@/lib/deliveries/queries";

export const metadata = { title: "Carga masiva SAP" };

export default async function BulkImportPage() {
  await requireRole(["ADMIN"]);

  const [clients, aliases, deliveries] = await Promise.all([
    listClients({ activeOnly: true }),
    listClientAliases(),
    listDeliveries({ limit: 500, hideClosed: false }),
  ]);

  const existingNumbers = deliveries.map((d) => d.number);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href="/admin" className="back-link">
            ← Volver a Despachos
          </Link>
          <p className="page-kicker">Importador automático</p>
          <h1 className="page-title">Carga masiva desde SAP</h1>
          <p className="page-sub">
            Subí el HTML o pegá los datos. Excluye automáticamente la ruta ARRETI y aprende equivalencias de clientes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/clientes" className="btn btn-ghost btn-sm rounded-xl">
            ⚙ Gestionar alias de clientes
          </Link>
        </div>
      </div>

      <BulkImportForm
        clients={clients}
        aliases={aliases}
        existingNumbers={existingNumbers}
      />
    </div>
  );
}
