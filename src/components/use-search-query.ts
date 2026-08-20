"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSaveData } from "@/components/use-save-data";

function isCoarsePointer() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

export function useSearchQuery(pathname: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const saveData = useSaveData();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [waiting, setWaiting] = useState(false);
  const lastPushed = useRef(urlQuery);
  const paramsSnapshot = searchParams.toString();
  const paramsRef = useRef(paramsSnapshot);
  const queryRef = useRef(query);

  useEffect(() => {
    paramsRef.current = paramsSnapshot;
    queryRef.current = query;
  }, [paramsSnapshot, query]);

  useEffect(() => {
    if (urlQuery === lastPushed.current) {
      setWaiting(false);
      return;
    }
    lastPushed.current = urlQuery;
    setQuery(urlQuery);
    setWaiting(false);
  }, [urlQuery]);

  const commit = useCallback((nextQuery = queryRef.current) => {
    const params = new URLSearchParams(paramsRef.current);
    const trimmed = nextQuery.trim();
    if (trimmed === (params.get("q") ?? "").trim()) return;

    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    params.delete("page");
    lastPushed.current = trimmed;
    setWaiting(true);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    if (saveData || isCoarsePointer()) return;
    if (query.trim() === urlQuery.trim()) return;
    const timer = window.setTimeout(() => commit(query), 300);
    return () => window.clearTimeout(timer);
  }, [commit, query, saveData, urlQuery]);

  return { query, setQuery, isPending: waiting, commit, urlQuery, saveData };
}
