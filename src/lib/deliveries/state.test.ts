import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  nextStatusAfterFirstEvidence,
  statusAfterIncompleteReady,
} from "@/lib/deliveries/state";

describe("state machine", () => {
  it("permite publicar un borrador sólo a Admin", () => {
    expect(canTransition("DRAFT", "PUBLISHED", "ADMIN")).toBe(true);
    expect(canTransition("DRAFT", "PUBLISHED", "PICKING")).toBe(false);
  });

  it("permite que Picking pase a IN_PICKING y READY", () => {
    expect(canTransition("PUBLISHED", "IN_PICKING", "PICKING")).toBe(true);
    expect(canTransition("IN_PICKING", "READY", "PICKING")).toBe(true);
    expect(canTransition("READY", "CLOSED", "PICKING")).toBe(false);
  });

  it("reserva CLOSED y REOPEN a Admin", () => {
    expect(canTransition("READY", "CLOSED", "ADMIN")).toBe(true);
    expect(canTransition("CLOSED", "IN_PICKING", "ADMIN")).toBe(true);
    expect(canTransition("CLOSED", "IN_PICKING", "PICKING")).toBe(false);
  });

  it("lanza si la transición es ilegal", () => {
    expect(() => assertTransition("DRAFT", "CLOSED", "ADMIN")).toThrow(/Transición no permitida/);
  });

  it("inicia picking al primer upload", () => {
    expect(nextStatusAfterFirstEvidence("PUBLISHED")).toBe("IN_PICKING");
    expect(nextStatusAfterFirstEvidence("IN_PICKING")).toBe("IN_PICKING");
  });

  it("revierte READY si queda incompleta", () => {
    expect(statusAfterIncompleteReady("READY")).toBe("IN_PICKING");
    expect(statusAfterIncompleteReady("IN_PICKING")).toBe("IN_PICKING");
  });
});
