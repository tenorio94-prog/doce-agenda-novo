import { describe, it, expect } from "vitest";
import { toCents, formatBRL, sumCents, isNonNegative } from "./currency";
import { weekStartISO, weekDaysISO, isPastDate, weekdayLabel } from "./timezone";
import { consumesCapacity, isDecidable, canTransition, GROUP_LABEL } from "./orderStatus";
import { receivedCents, remainingCents } from "./payments";
import { hasCapacity, capacityStatus, validateOverrideReason, clampSlots } from "./capacity";

describe("currency", () => {
  it("converts reais to cents", () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents(0)).toBe(0);
  });
  it("formats BRL", () => {
    expect(formatBRL(1234)).toMatch(/12,34/);
  });
  it("sums cents", () => {
    expect(sumCents([100, 200, 300])).toBe(600);
  });
  it("validates non-negative integer", () => {
    expect(isNonNegative(100)).toBe(true);
    expect(isNonNegative(-1)).toBe(false);
    expect(isNonNegative(1.5)).toBe(false);
  });
});

describe("timezone", () => {
  it("weekStartISO returns monday", () => {
    // 2026-11-19 is Thursday
    expect(weekStartISO("2026-11-19")).toBe("2026-11-16");
  });
  it("weekDaysISO returns 7 days", () => {
    const days = weekDaysISO("2026-11-16");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-11-16");
    expect(days[6]).toBe("2026-11-22");
  });
  it("isPastDate", () => {
    const now = new Date("2026-11-19T12:00:00-03:00");
    expect(isPastDate("2026-11-18", now)).toBe(true);
    expect(isPastDate("2026-11-20", now)).toBe(false);
  });
  it("weekdayLabel", () => {
    expect(weekdayLabel("2026-11-19")).toBeTruthy();
  });
});

describe("orderStatus", () => {
  it("consumes capacity for confirmed statuses", () => {
    expect(consumesCapacity("confirmado")).toBe(true);
    expect(consumesCapacity("solicitacao")).toBe(false);
    expect(consumesCapacity("cancelado")).toBe(false);
  });
  it("isDecidable", () => {
    expect(isDecidable("orcamento")).toBe(true);
    expect(isDecidable("confirmado")).toBe(false);
  });
  it("canTransition blocks regression from entregue", () => {
    expect(canTransition("entregue", "confirmado")).toBe(false);
    expect(canTransition("confirmado", "entregue")).toBe(true);
  });
  it("group label", () => {
    expect(GROUP_LABEL["em_producao"]).toBe("Confirmado");
  });
});

describe("payments", () => {
  it("received only conferred", () => {
    const payments = [
      { id: "1", orderId: "o", amountCents: 10000, status: "conferido" as const, paidAt: "2026-11-19" },
      { id: "2", orderId: "o", amountCents: 5000, status: "informado" as const, paidAt: "2026-11-19" },
    ];
    expect(receivedCents(payments)).toBe(10000);
    expect(remainingCents(20000, payments)).toBe(10000);
  });
});

describe("capacity", () => {
  it("clampSlots", () => {
    expect(clampSlots(0)).toBe(1);
    expect(clampSlots(15)).toBe(10);
    expect(clampSlots(3)).toBe(3);
  });
  it("hasCapacity", () => {
    const cap = { defaultSlots: 5, overrides: {} };
    expect(hasCapacity(cap, "2026-11-19", [{ slots: 2 }, { slots: 2 }], 1)).toBe(true);
    expect(hasCapacity(cap, "2026-11-19", [{ slots: 2 }, { slots: 2 }], 2)).toBe(false);
  });
  it("day closed", () => {
    const cap = { defaultSlots: 5, overrides: { "2026-11-19": { maxSlots: 0, isClosed: true } } };
    expect(capacityStatus(cap, "2026-11-19", [])).toBe("fechado");
  });
  it("validateOverrideReason", () => {
    expect(validateOverrideReason("abc")).toBe(false);
    expect(validateOverrideReason("motivo valido")).toBe(true);
    expect(validateOverrideReason("a".repeat(301))).toBe(false);
  });
});
