"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function TableroRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState<string>("Recién conectado");
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let supabase: ReturnType<typeof createBrowserSupabase>;
    try {
      supabase = createBrowserSupabase();
    } catch {
      return;
    }

    let refreshTimer: number | undefined;

    const channel = supabase
      .channel("tablero-live-stream")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deliveries",
        },
        () => {
          setFlash(true);
          window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(() => {
            startTransition(() => {
              router.refresh();
              const now = new Date();
              setLastUpdated(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`);
              setTimeout(() => setFlash(false), 1200);
            });
          }, 400);
        },
      )
      .subscribe();

    // Fallback de polling a 15 segundos
    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        startTransition(() => {
          router.refresh();
        });
      }
    }, 15000);

    return () => {
      window.clearTimeout(refreshTimer);
      window.clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [router]);

  function handleManualRefresh() {
    startTransition(() => {
      router.refresh();
      const now = new Date();
      setLastUpdated(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`);
    });
  }

  return (
    <div className="flex items-center justify-between text-xs py-2 px-3 rounded-xl border border-line/80 bg-surface/80 shadow-xs mb-4">
      <div className="flex items-center gap-2">
        <span className="flex h-2.5 w-2.5 relative">
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              flash ? "bg-cat" : "bg-ok",
            )}
          />
          <span
            className={cn(
              "relative inline-flex rounded-full h-2.5 w-2.5 transition-colors",
              flash ? "bg-cat" : "bg-ok",
            )}
          />
        </span>
        <span className="font-extrabold uppercase tracking-wider text-foreground/90">
          Tablero en vivo
        </span>
        <span className="text-muted hidden sm:inline">
          · Último cambio: <strong className="font-mono text-foreground/80">{lastUpdated}</strong>
        </span>
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={handleManualRefresh}
        className="btn btn-ghost btn-sm rounded-xl py-1 px-2.5 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
        title="Forzar actualización inmediata del tablero"
      >
        <span className={cn(isPending && "animate-spin")}>↻</span>
        <span>{isPending ? "Actualizando…" : "Actualizar"}</span>
      </button>
    </div>
  );
}
