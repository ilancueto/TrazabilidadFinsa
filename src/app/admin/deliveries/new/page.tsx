import { DeliveryForm } from "@/components/admin/delivery-form";
import { requireRole } from "@/lib/auth/session";
import { listClients } from "@/lib/clients/queries";
import {
  listCatalogTemplates,
  listPickingProfiles,
  listRequirementTypes,
  templatesToDrafts,
} from "@/lib/deliveries/queries";

export const metadata = { title: "Nueva entrega" };

export default async function NewDeliveryPage() {
  await requireRole(["ADMIN"]);
  const [types, pickers, templates, clients] = await Promise.all([
    listRequirementTypes(),
    listPickingProfiles(),
    listCatalogTemplates(),
    listClients({ activeOnly: true }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="page-kicker">Alta</p>
        <h1 className="page-title">Nueva entrega</h1>
        <p className="page-sub">Completá los datos. Cuando la publiques, Picking la va a ver en el celular.</p>
      </div>
      <DeliveryForm
        pickers={pickers}
        clients={clients}
        templates={templatesToDrafts(templates, types)}
      />
    </div>
  );
}
