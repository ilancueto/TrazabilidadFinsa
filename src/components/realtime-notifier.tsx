"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { pickingDeliveryPath } from "@/lib/deliveries/paths";

type RealtimeAlert = {
  id: string;
  number: string;
  message: string;
  type: "urgent" | "rejected" | "info";
  href: string;
};

export function RealtimeNotifier({ role }: { role: "ADMIN" | "PICKING" | "SUPERVISOR" }) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<RealtimeAlert[]>([]);

  const addAlert = useCallback((newAlert: RealtimeAlert) => {
    setAlerts((prev) => [newAlert, ...prev.slice(0, 3)]);
    setTimeout(() => {
      setAlerts((prev) => prev.filter((a) => a.id !== newAlert.id));
    }, 8000);
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
    let supabase: ReturnType<typeof createBrowserSupabase>;
    try {
      supabase = createBrowserSupabase();
    } catch {
      return;
    }

    let refreshTimer: number | undefined;
    const channel = supabase
      .channel("delivery-realtime-alerts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deliveries",
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            number?: string;
            status?: string;
            priority?: string;
            has_open_observation?: boolean;
            observations?: string;
          } | null;
          const oldRow = payload.old as {
            priority?: string;
            has_open_observation?: boolean;
            status?: string;
          } | null;

          if (!row || !row.number) return;

          // Si es urgente recién creada o actualizada
          if (row.priority === "URGENT" && (payload.eventType === "INSERT" || oldRow?.priority !== "URGENT")) {
            if ("vibrate" in navigator) {
              try {
                navigator.vibrate([150, 80, 150]);
              } catch {}
            }
            addAlert({
              id: `${Date.now()}-urgent-${row.number}`,
              number: row.number,
              message: `🚨 Entrega ${row.number} URGENTE publicada`,
              type: "urgent",
              href: role === "ADMIN" ? `/admin/deliveries/${row.number}` : pickingDeliveryPath(row.number),
            });
          }

          // Si una foto fue rechazada o se abrió una observación
          if (
            row.has_open_observation &&
            row.status === "IN_PICKING" &&
            (!oldRow?.has_open_observation || oldRow?.status === "READY")
          ) {
            if ("vibrate" in navigator) {
              try {
                navigator.vibrate([200, 100, 200]);
              } catch {}
            }
            addAlert({
              id: `${Date.now()}-obs-${row.number}`,
              number: row.number,
              message: `⚠️ Entrega ${row.number}: Foto rechazada / observación devuelta`,
              type: "rejected",
              href: role === "ADMIN" ? `/admin/deliveries/${row.number}` : pickingDeliveryPath(row.number),
            });
          }

          window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(() => {
            if (document.visibilityState === "visible") router.refresh();
          }, 4000);
        },
      )
      .subscribe();

    return () => {
      window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [addAlert, role, router]);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-3 right-3 left-3 z-50 mx-auto flex max-w-md flex-col gap-2 pointer-events-none">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`pointer-events-auto flex items-center justify-between gap-3 rounded-lg p-3 text-sm shadow-xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-2 ${
            alert.type === "urgent"
              ? "bg-danger text-white border-2 border-white/20"
              : alert.type === "rejected"
                ? "bg-cat text-black font-semibold border-2 border-black/20"
                : "bg-surface text-foreground border border-line"
          }`}
        >
          <Link
            href={alert.href}
            onClick={() => dismissAlert(alert.id)}
            className="flex-1 hover:underline font-bold"
          >
            {alert.message}
          </Link>
          <button
            type="button"
            onClick={() => dismissAlert(alert.id)}
            aria-label="Cerrar notificación"
            className="rounded p-1 opacity-80 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
