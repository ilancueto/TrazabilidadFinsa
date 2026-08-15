"use client";

import { useActionState } from "react";
import { changePasswordAction, type AuthState } from "@/lib/actions/auth";

export function AccountPasswordForm({ forced = false }: { forced?: boolean }) {
  const [state, action, pending] = useActionState(changePasswordAction, {} as AuthState);
  return (
    <form action={action} className={forced ? "password-setup-form" : "panel max-w-md"}>
      {!forced ? (
        <header className="panel-head">
          <h2 className="panel-title">Cambiar mi contraseña</h2>
        </header>
      ) : null}
      <div className="space-y-4 p-5">
        <label className="block">
          <span className="label">Nueva contraseña</span>
          <input name="password" type="password" required minLength={8} className="field" />
        </label>
        <label className="block">
          <span className="label">Repetila</span>
          <input name="confirm" type="password" required minLength={8} className="field" />
        </label>
        {state.error ? <p className="banner banner-danger">{state.error}</p> : null}
        {state.success ? <p className="banner banner-ok">{state.success}</p> : null}
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Guardando…" : forced ? "Guardar y continuar" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
