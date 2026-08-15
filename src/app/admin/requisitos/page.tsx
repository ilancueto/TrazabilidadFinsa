import { CatalogManager } from "@/components/admin/catalog-manager";
import { requireRole } from "@/lib/auth/session";
import { listCatalogTemplates, listRequirementTypes } from "@/lib/deliveries/queries";

export const metadata = { title: "Requisitos" };

export default async function RequirementsAdminPage() {
  await requireRole(["ADMIN"]);
  const [types, templates] = await Promise.all([listRequirementTypes(), listCatalogTemplates()]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <p className="page-kicker">Administración</p>
        <h1 className="page-title">Requisitos</h1>
        <p className="page-sub">
          Definí qué fotos pide cada tipo de entrega. Las que ya están publicadas no cambian solas.
        </p>
      </div>
      <CatalogManager types={types} templates={templates} />
    </div>
  );
}
