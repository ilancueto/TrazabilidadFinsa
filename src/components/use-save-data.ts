"use client";

import { useSyncExternalStore } from "react";

const KEY = "cat-save-data";

export type SaveDataPreference = "on" | "off" | "auto";

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

function connection(): NetworkInformation | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

export function readSaveDataPreference(): SaveDataPreference {
  if (typeof window === "undefined") return "auto";
  const value = window.localStorage.getItem(KEY);
  if (value === "1") return "on";
  if (value === "0") return "off";
  return "auto";
}

export function writeSaveDataPreference(value: SaveDataPreference) {
  if (value === "auto") window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, value === "on" ? "1" : "0");
  window.dispatchEvent(new Event("cat-save-data"));
}

export function networkWantsSaveDataFrom(conn?: NetworkInformation): boolean {
  if (!conn) return true;
  if (conn.saveData) return true;
  const type = conn.effectiveType;
  return type === "slow-2g" || type === "2g" || type === "3g";
}

export function networkWantsSaveData(): boolean {
  return networkWantsSaveDataFrom(connection());
}

function currentSaveData(): boolean {
  const pref = readSaveDataPreference();
  if (pref === "on") return true;
  if (pref === "off") return false;
  return networkWantsSaveData();
}

function subscribe(onChange: () => void) {
  window.addEventListener("cat-save-data", onChange);
  window.addEventListener("storage", onChange);
  connection()?.addEventListener?.("change", onChange);
  return () => {
    window.removeEventListener("cat-save-data", onChange);
    window.removeEventListener("storage", onChange);
    connection()?.removeEventListener?.("change", onChange);
  };
}

function subscribePreference(onChange: () => void) {
  window.addEventListener("cat-save-data", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("cat-save-data", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSaveData(): boolean {
  return useSyncExternalStore(subscribe, currentSaveData, () => true);
}

export function useSaveDataPreference(): SaveDataPreference {
  return useSyncExternalStore(subscribePreference, readSaveDataPreference, () => "auto");
}
