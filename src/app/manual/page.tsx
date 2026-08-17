import Link from "next/link";
import { AppShell } from "@/components/shell";
import { requireSession } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/constants";

export const metadata = { title: "Manual del sistema" };

const statuses = [
  ["Borrador", "La entrega todavía se está preparando en Administración."],
  ["Publicada", "Ya está disponible para que Picking la tome."],
  ["En Picking", "La preparación y la carga de fotos están en curso."],
  ["Lista", "Picking terminó; Administración debe revisar y cerrar."],
  ["Cerrada", "El circuito terminó y ya no admite nuevas fotos."],
];

export default async function ManualPage() {
  const user = await requireSession();
  const variant = user.role === "PICKING" ? "picking" : "admin";

  return (
    <AppShell user={user} variant={variant}>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="page-head">
          <div>
            <p className="page-kicker">Ayuda · {ROLE_LABEL[user.role]}</p>
            <h1 className="page-title">Manual del sistema</h1>
            <p className="page-sub">Guía rápida de la operación diaria para Administración, Picking y Supervisión.</p>
          </div>
          <a href="/manual/manual-trazabilidad.pdf" download className="btn btn-primary">
            Descargar manual PDF
          </a>
        </header>

        <nav className="panel flex flex-wrap gap-2 p-3" aria-label="Secciones del manual">
          <a className="btn btn-ghost btn-sm" href="#inicio">Inicio</a>
          <a className="btn btn-ghost btn-sm" href="#administracion">Administración</a>
          <a className="btn btn-ghost btn-sm" href="#picking">Picking</a>
          <a className="btn btn-ghost btn-sm" href="#supervision">Supervisión</a>
          <a className="btn btn-ghost btn-sm" href="#problemas">Problemas frecuentes</a>
        </nav>

        <Section id="inicio" kicker="Para todos" title="Ingreso y conceptos básicos">
          <Steps items={[
            "Ingresá con el email y la contraseña asignados.",
            "En el primer ingreso, el sistema te pedirá crear una contraseña propia.",
            "Usá Cuenta para cambiar tu clave y Salir cuando termines en un equipo compartido.",
            "El número de entrega es la referencia principal: también aparece en la dirección del navegador.",
          ]} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {statuses.map(([name, description]) => (
              <div key={name} className="border border-line bg-paper p-3">
                <strong className="text-sm text-cat">{name}</strong>
                <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="administracion" kicker="Rol Administración" title="Crear, controlar y cerrar entregas">
          <Steps items={[
            "Desde Entregas, tocá Nueva entrega y completá número, modalidad, destino, bultos, prioridad y requisitos.",
            "Guardá como borrador si todavía faltan datos o publicá para enviarla a Picking.",
            "Desde el detalle podés asignar responsable, editar, duplicar o resolver observaciones.",
            "Cuando figure Lista, abrí Revisar fotos: aceptá las correctas o rechazá indicando el motivo.",
            "Si hay que corregir algo, usá Devolver. Cuando todo esté correcto, cerrá la entrega.",
            "Usá Informe para descargar el PDF con datos, checklist, evidencias e historial.",
          ]} />
          <Callout title="Eliminar una entrega">
            Dentro del detalle, en Acciones, tocá <strong>Eliminar entrega</strong>. Escribí el número para confirmar. Se quita de la operación, pero conserva fotos e historial y puede recuperarse desde la base si fuera necesario.
          </Callout>
          <p className="mt-4 text-sm leading-6 text-muted">
            Desde Ajustes podés administrar Requisitos y Usuarios. El botón Cierre de día, dentro de Entregas, resume la operación histórica y permite exportar Excel.
          </p>
        </Section>

        <Section id="picking" kicker="Rol Picking" title="Preparar y documentar la entrega">
          <Steps items={[
            "Abrí Entregas y elegí el número que vas a preparar.",
            "Si no tiene responsable, tocá La tomo yo.",
            "Entrá al requisito pendiente, elegí o sacá la foto y esperá el mensaje de carga completada.",
            "Repetí el proceso hasta completar todos los requisitos obligatorios.",
            "Si encontrás un problema, agregá una observación clara para Administración.",
            "Cuando no queden fotos obligatorias pendientes, tocá Marcar lista.",
          ]} />
          <Callout title="Consejo para las fotos">
            Encuadrá todo el documento o bulto, evitá reflejos y verificá la vista previa. La aplicación optimiza la imagen antes de subirla; no cierres la pantalla mientras indique que está preparando o cargando.
          </Callout>
        </Section>

        <Section id="supervision" kicker="Rol Supervisor" title="Consultar sin modificar la operación">
          <Steps items={[
            "Entregas muestra el estado, responsable, prioridad y avance de cada operación.",
            "Revisión permite consultar las evidencias y su resultado.",
            "Día muestra métricas históricas y entregas que continúan abiertas.",
            "Tablero ofrece una vista resumida para seguimiento operativo.",
            "Desde el detalle podés descargar el Informe PDF; el rol no modifica ni elimina datos.",
          ]} />
        </Section>

        <Section id="problemas" kicker="Resolución rápida" title="Problemas frecuentes">
          <div className="grid gap-3 md:grid-cols-2">
            <Faq q="No aparece una entrega" a="Buscala por número y revisá los filtros. Los borradores sólo son visibles para Administración y las eliminadas dejan de aparecer en la operación." />
            <Faq q="No aparece Eliminar entrega" a="La acción sólo se muestra a Administración y está dentro del detalle de la entrega, en el panel Acciones." />
            <Faq q="No puedo marcar como lista" a="Todavía queda al menos una foto obligatoria pendiente. El aviso superior indica cuál falta." />
            <Faq q="La foto no sube" a="Comprobá la conexión, elegí nuevamente la imagen y esperá sin cerrar la pantalla. Si persiste, avisá a Administración indicando el número." />
            <Faq q="La contraseña no funciona" a="Verificá el email. Administración puede restablecer la clave desde Usuarios; en el siguiente ingreso puede exigir un cambio." />
            <Faq q="Necesito corregir una cerrada" a="Administración puede usar Reabrir, dejando un motivo registrado en el historial." />
          </div>
        </Section>

        <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted">Finning CAT · Bodega Neuquén · Manual operativo</p>
          <Link href={variant === "picking" ? "/picking" : "/admin"} className="btn btn-ghost">Volver a la operación</Link>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="panel scroll-mt-4 p-5 sm:p-6">
      <p className="page-kicker">{kicker}</p>
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="grid gap-3 md:grid-cols-2">
      {items.map((item, index) => (
        <li key={item} className="flex gap-3 border border-line bg-paper p-3 text-sm leading-6">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-cat font-mono text-xs font-black text-ink">{index + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-l-4 border-cat bg-paper p-4">
      <strong className="text-sm text-cat">{title}</strong>
      <p className="mt-1 text-sm leading-6 text-muted">{children}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="border border-line bg-paper p-4">
      <h3 className="text-sm font-bold">{q}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{a}</p>
    </div>
  );
}
