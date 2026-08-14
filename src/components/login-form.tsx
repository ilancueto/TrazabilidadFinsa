"use client";

import { useActionState } from "react";
import { signInAction, type AuthState } from "@/lib/actions/auth";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(signInAction, {} as AuthState);

  return (
    <form action={action} className="space-y-4 rounded-md border border-line bg-white p-5">
      <input type="hidden" name="next" value={nextPath} />
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Email
        </span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="w-full rounded-md border border-line px-3 py-3 outline-none focus:border-anthracite"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Contraseña
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-md border border-line px-3 py-3 outline-none focus:border-anthracite"
        />
      </label>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-anthracite py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
