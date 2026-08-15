"use client";

import { useActionState } from "react";
import { signInAction, type AuthState } from "@/lib/actions/auth";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(signInAction, {} as AuthState);

  return (
    <form action={action} className="panel space-y-4 p-6">
      <input type="hidden" name="next" value={nextPath} />
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" autoComplete="username" required className="field" />
      </label>
      <label className="block">
        <span className="label">Contraseña</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
        />
      </label>
      {state.error ? <p className="banner banner-danger">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="btn btn-primary btn-block btn-lg">
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
