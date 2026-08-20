"use client";

import { useActionState, useMemo, useState } from "react";
import {
  deleteRequirementTypeAction,
  saveRequirementTypeAction,
  saveTemplateAction,
  type CatalogActionState,
} from "@/lib/actions/catalog";
import { Dialog } from "@/components/ui-dialog";
import { MODALITY_LABEL } from "@/lib/constants";
import type { CatalogTemplate } from "@/lib/deliveries/queries";
import type { RequirementType } from "@/lib/types";

type TemplateDraftItem = {
  typeId: string;
  included: boolean;
  required: boolean;
  applicable: boolean;
  displayOrder: number;
};

function draftsFromTemplate(template: CatalogTemplate, types: RequirementType[]): TemplateDraftItem[] {
  const included = new Map(template.requirements.map((req) => [req.typeId, req]));
  return types.map((type, index) => {
    const current = included.get(type.id);
    return {
      typeId: type.id,
      included: Boolean(current),
      required: current?.required ?? true,
      applicable: current?.applicable ?? true,
      displayOrder: current?.displayOrder ?? (index + 1) * 10,
    };
  });
}

export function CatalogManager({
  types,
  templates,
}: {
  types: RequirementType[];
  templates: CatalogTemplate[];
}) {
  return (
    <div className="space-y-5">
      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Tipos de foto</h2>
        </header>
        <div className="p-4">
          <p className="mb-4 text-sm text-muted">Estos nombres se ven al cargar fotos y en el informe.</p>
          <ul className="divide-y divide-line">
            {types.map((type) => (
              <li key={type.id} className="py-3">
                <TypeRow type={type} />
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-line pt-4">
            <p className="label">Nuevo requisito</p>
            <NewTypeForm />
          </div>
        </div>
      </section>

      {templates.map((template) => (
        <TemplateEditor key={template.id} template={template} types={types} />
      ))}
    </div>
  );
}

function TypeRow({ type }: { type: RequirementType }) {
  const [state, action, pending] = useActionState(saveRequirementTypeAction, {} as CatalogActionState);
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteRequirementTypeAction,
    {} as CatalogActionState,
  );
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="space-y-2">
      <form action={action} className="grid gap-2 md:grid-cols-[140px_1fr_1fr_8rem_auto]">
        <input type="hidden" name="id" value={type.id} />
        <input type="hidden" name="code" value={type.code} />
        <p className="self-center font-mono text-xs text-muted">{type.code}</p>
        <input name="label" aria-label={`Nombre de ${type.code}`} defaultValue={type.label} required className="field py-2 text-sm" />
        <input
          name="guidance"
          aria-label={`Guía para ${type.label}`}
          defaultValue={type.guidance ?? ""}
          placeholder="Qué tiene que verse en la foto"
          className="field py-2 text-sm"
        />
        <select name="stage" aria-label={`Etapa de ${type.label}`} defaultValue={type.stage ?? "FLOOR"} className="field py-2 text-sm">
          <option value="FLOOR">Piso</option>
          <option value="DISPATCH">Etiquetas</option>
        </select>
        <input type="hidden" name="description" value={type.description ?? ""} />
        <button type="submit" disabled={pending} className="btn btn-ghost">
          {pending ? "…" : "Guardar"}
        </button>
      </form>
      <button type="button" onClick={() => setConfirm(true)} className="btn-text btn-text-danger">
        Eliminar
      </button>
      {state.error || deleteState.error ? (
        <p className="banner banner-danger">{state.error || deleteState.error}</p>
      ) : null}
      {state.success || deleteState.success ? (
        <p className="banner banner-ok">{state.success || deleteState.success}</p>
      ) : null}

      <Dialog
        open={confirm}
        title="Eliminar requisito"
        description={`Se saca “${type.label}” del catálogo. Las entregas ya publicadas no cambian.`}
        tone="danger"
        onClose={() => setConfirm(false)}
      >
        <form action={deleteAction} className="flex gap-2">
          <input type="hidden" name="id" value={type.id} />
          <button type="submit" disabled={deleting} className="btn btn-danger">
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setConfirm(false)}>
            Cancelar
          </button>
        </form>
      </Dialog>
    </div>
  );
}

function NewTypeForm() {
  const [state, action, pending] = useActionState(saveRequirementTypeAction, {} as CatalogActionState);
  return (
    <form action={action} className="grid gap-2 md:grid-cols-[1fr_1fr_8rem_auto]">
      <input name="code" aria-label="Código del requisito" required placeholder="CODIGO" className="field font-mono uppercase" />
      <input name="label" aria-label="Nombre del requisito" required placeholder="Nombre" className="field" />
      <select name="stage" aria-label="Etapa" defaultValue="FLOOR" className="field">
        <option value="FLOOR">Piso</option>
        <option value="DISPATCH">Etiquetas</option>
      </select>
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Creando…" : "Crear requisito"}
      </button>
      {state.error ? <p className="banner banner-danger md:col-span-3">{state.error}</p> : null}
      {state.success ? <p className="banner banner-ok md:col-span-3">{state.success}</p> : null}
    </form>
  );
}

function TemplateEditor({
  template,
  types,
}: {
  template: CatalogTemplate;
  types: RequirementType[];
}) {
  const [items, setItems] = useState(() => draftsFromTemplate(template, types));
  const [state, action, pending] = useActionState(saveTemplateAction, {} as CatalogActionState);
  const payload = useMemo(() => JSON.stringify(items), [items]);

  function update(typeId: string, patch: Partial<TemplateDraftItem>) {
    setItems((current) => current.map((item) => (item.typeId === typeId ? { ...item, ...patch } : item)));
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">{template.label}</h2>
      </header>
      <div className="p-4">
        <p className="mb-3 text-sm text-muted">
          Qué se pide cuando la entrega es {MODALITY_LABEL[template.modality]}.
        </p>
        <form action={action} className="space-y-3">
          <input type="hidden" name="templateId" value={template.id} />
          <input type="hidden" name="requirements" value={payload} />
          <ul className="divide-y divide-line">
            {types.map((type) => {
              const item = items.find((row) => row.typeId === type.id);
              if (!item) return null;
              return (
                <li key={type.id} className="check-row py-3">
                  <label className="check min-w-48 flex-1 font-medium">
                    <input
                      type="checkbox"
                      checked={item.included}
                      onChange={(event) =>
                        update(type.id, {
                          included: event.target.checked,
                          applicable: event.target.checked,
                        })
                      }
                    />
                    {type.label}
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={item.applicable}
                      disabled={!item.included}
                      onChange={(event) =>
                        update(type.id, {
                          applicable: event.target.checked,
                          required: event.target.checked ? item.required : false,
                        })
                      }
                    />
                    Aplica
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={item.required}
                      disabled={!item.included || !item.applicable}
                      onChange={(event) => update(type.id, { required: event.target.checked })}
                    />
                    Obligatorio
                  </label>
                </li>
              );
            })}
          </ul>
          {state.error ? <p className="banner banner-danger">{state.error}</p> : null}
          {state.success ? <p className="banner banner-ok">{state.success}</p> : null}
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Guardando…" : "Guardar plantilla"}
          </button>
        </form>
      </div>
    </section>
  );
}
