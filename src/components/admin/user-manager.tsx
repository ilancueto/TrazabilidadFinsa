"use client";

import { useActionState, useState } from "react";
import {
  createUserAction,
  deleteUserAction,
  reactivateUserAction,
  resetUserPasswordAction,
  updateUserRoleAction,
  type UserActionState,
} from "@/lib/actions/users";
import { Dialog } from "@/components/ui-dialog";
import { ROLE_LABEL } from "@/lib/constants";
import type { ManagedUser } from "@/lib/deliveries/queries";
import type { UserRole } from "@/lib/types";

export function UserManager({ users }: { users: ManagedUser[] }) {
  return (
    <div className="space-y-5">
      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">Nuevo usuario</h2>
        </header>
        <div className="p-4">
          <p className="mb-4 text-sm text-muted">
            Creá el acceso y pasale la contraseña temporal. Deberá reemplazarla en su primer ingreso.
          </p>
          <CreateUserForm />
        </div>
      </section>

      <section className="panel overflow-hidden">
        <header className="panel-head">
          <h2 className="panel-title">Quiénes tienen acceso</h2>
        </header>
        {users.length === 0 ? (
          <p className="empty">Todavía no hay usuarios.</p>
        ) : (
          <ul className="divide-y divide-line">
            {users.map((user) => (
              <li key={user.id} className="px-4 py-4">
                <UserRow user={user} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, {} as UserActionState);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <label className="block">
        <span className="label">Nombre</span>
        <input name="fullName" required className="field" placeholder="Nombre y apellido" />
      </label>
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" required className="field" placeholder="rachel.c@example.org" />
      </label>
      <label className="block">
        <span className="label">Contraseña</span>
        <input name="password" type="password" required minLength={8} className="field" />
      </label>
      <label className="block">
        <span className="label">Acceso</span>
        <select name="role" defaultValue="PICKING" className="field">
          <option value="PICKING">{ROLE_LABEL.PICKING}</option>
          <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
          <option value="SUPERVISOR">{ROLE_LABEL.SUPERVISOR}</option>
        </select>
      </label>
      <div className="md:col-span-2">
        {state.error ? <p className="mb-2 banner banner-danger">{state.error}</p> : null}
        {state.success ? <p className="mb-2 banner banner-ok">{state.success}</p> : null}
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Creando…" : "Dar acceso"}
        </button>
      </div>
    </form>
  );
}

function UserRow({ user }: { user: ManagedUser }) {
  const [dialog, setDialog] = useState<"reset" | "delete" | null>(null);
  const [roleState, roleAction, rolePending] = useActionState(
    updateUserRoleAction,
    {} as UserActionState,
  );
  const [passState, passAction, passPending] = useActionState(async (previous: UserActionState, formData: FormData) => {
    const result = await resetUserPasswordAction(previous, formData);
    if (result.success) setDialog(null);
    return result;
  }, {} as UserActionState);
  const [deleteState, deleteAction, deletePending] = useActionState(async (previous: UserActionState, formData: FormData) => {
    const result = await deleteUserAction(previous, formData);
    if (result.success) setDialog(null);
    return result;
  }, {} as UserActionState);
  const [reactivateState, reactivateAction, reactivatePending] = useActionState(
    reactivateUserAction,
    {} as UserActionState,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {user.fullName}
            {user.disabled ? (
              <span className="ml-2 bg-line px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-muted">
                sin acceso
              </span>
            ) : null}
            {!user.disabled && user.mustChangePassword ? (
              <span className="ml-2 rounded-full bg-cat/15 px-2 py-1 text-[10px] font-extrabold uppercase text-cat">
                cambio de clave pendiente
              </span>
            ) : null}
          </p>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <form action={roleAction} className="flex items-end gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <label>
            <span className="label">Acceso</span>
            <select name="role" defaultValue={user.role} className="field !w-auto py-2">
              {(Object.keys(ROLE_LABEL) as UserRole[]).map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={rolePending} className="btn btn-ghost">
            {rolePending ? "…" : "Guardar"}
          </button>
        </form>
      </div>
      {roleState.error ? <p className="banner banner-danger">{roleState.error}</p> : null}
      {roleState.success ? <p className="banner banner-ok">{roleState.success}</p> : null}

      <div className="flex flex-wrap gap-4">
        <button type="button" onClick={() => setDialog("reset")} className="btn-text">
          Cambiar contraseña
        </button>
        {user.disabled ? (
          <form action={reactivateAction}>
            <input type="hidden" name="userId" value={user.id} />
            <button type="submit" disabled={reactivatePending} className="btn-text">
              {reactivatePending ? "Reactivando…" : "Reactivar acceso"}
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setDialog("delete")} className="btn-text btn-text-danger">
            Eliminar usuario
          </button>
        )}
      </div>

      {passState.error ? <p className="banner banner-danger">{passState.error}</p> : null}
      {passState.success ? <p className="banner banner-ok">{passState.success}</p> : null}
      {deleteState.error ? <p className="banner banner-danger">{deleteState.error}</p> : null}
      {deleteState.success ? <p className="banner banner-ok">{deleteState.success}</p> : null}
      {reactivateState.error ? <p className="banner banner-danger">{reactivateState.error}</p> : null}
      {reactivateState.success ? <p className="banner banner-ok">{reactivateState.success}</p> : null}

      <Dialog
        open={dialog === "reset"}
        title="Cambiar contraseña"
        description={`Nueva clave para ${user.fullName}.`}
        onClose={() => setDialog(null)}
      >
        <form action={passAction} className="space-y-3">
          <input type="hidden" name="userId" value={user.id} />
          <label className="block">
            <span className="label">Nueva contraseña</span>
            <input name="password" type="password" required minLength={8} className="field" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={passPending} className="btn btn-primary">
              {passPending ? "Guardando…" : "Cambiar"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>
              Cancelar
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={dialog === "delete"}
        title="Eliminar usuario"
        description={`Para confirmar, escribí ${user.email}.`}
        tone="danger"
        onClose={() => setDialog(null)}
      >
        <form action={deleteAction} className="space-y-3">
          <input type="hidden" name="userId" value={user.id} />
          <label className="block">
            <span className="label">Email de confirmación</span>
            <input
              name="confirmEmail"
              type="email"
              required
              autoComplete="off"
              placeholder={user.email}
              className="field"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={deletePending} className="btn btn-danger">
              {deletePending ? "Eliminando…" : "Eliminar"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>
              Cancelar
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
