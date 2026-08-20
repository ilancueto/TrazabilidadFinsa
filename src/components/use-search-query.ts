"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSaveData } from "@/components/use-save-data";

export function useSearchQuery(pathname: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const saveData = useSaveData();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [isPending, startTransition] = useTransition();
  const lastPushed = useRef(urlQuery);
  const paramsSnapshot = searchParams.toString();
  const paramsRef = useRef(paramsSnapshot);
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    paramsRef.current = paramsSnapshot;
  }, [paramsSnapshot]);

  useEffect(() => {
    if (urlQuery === lastPushed.current) return;
    lastPushed.current = urlQuery;
    setQuery(urlQuery);
  }, [urlQuery]);

  const commit = useCallback((nextQuery = queryRef.current) => {
    const params = new URLSearchParams(paramsRef.current);
    const trimmed = nextQuery.trim();
    if (trimmed === (params.get("q") ?? "").trim()) return;

    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    params.delete("page");
    lastPushed.current = trimmed;
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }, [pathname, router]);

  useEffect(() => {
    if (saveData) return;
    if (query.trim() === urlQuery.trim()) return;
    const timer = window.setTimeout(() => commit(query), 300);
    return () => window.clearTimeout(timer);
  }, [commit, query, saveData, urlQuery]);

  return { query, setQuery, isPending, commit, urlQuery, saveData };
}
