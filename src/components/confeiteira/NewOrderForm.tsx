"use client";

import { useState } from "react";
import { useOrders } from "@/hooks/useOrders";
import { CapacityDialog } from "./CapacityDialog";
import type { CreateOrderInput } from "@/hooks/useOrders";

export function NewOrderForm() {
  const { createOrder, submitting, error, capacityError, clearCapacityError } = useOrders();
  const [customerName, setCustomerName] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isBudget, setIsBudget] = useState(false);
  const [lastInput, setLastInput] = useState<CreateOrderInput | null>(null);

  const buildInput = (): CreateOrderInput => ({
    customerName,
    customerWhatsapp,
    items: [{ catalogItemId: "", name: title, quantity: 1, unitPriceCents: Math.round(parseFloat(total || "0") * 100), slotsRequired: 1 }],
    deliveryType: "retirada",
    scheduledDate: date,
    scheduledTime: time || "00:00",
    status: isBudget ? "orcamento" : "confirmado",
    totalCents: Math.round(parseFloat(total || "0") * 100),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = buildInput();
    setLastInput(input);
    try {
      await createOrder(input);
      setCustomerName("");
      setCustomerWhatsapp("");
      setTitle("");
      setTotal("");
      setDate("");
      setTime("");
      setIsBudget(false);
      setLastInput(null);
    } catch {
      // capacity error handled by dialog
    }
  };

  const handleAcceptCapacity = async (reason: string) => {
    if (!lastInput) return;
    try {
      await createOrder({ ...lastInput, capacityOverrideReason: reason });
      setCustomerName("");
      setCustomerWhatsapp("");
      setTitle("");
      setTotal("");
      setDate("");
      setTime("");
      setIsBudget(false);
      setLastInput(null);
    } catch {
      // ignore
    } finally {
      clearCapacityError();
    }
  };

  return (
    <div className="max-w-[428px] mx-auto px-4 pt-20 pb-28">
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-4">Novo pedido</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Quem pediu?"
          className="h-12 rounded-xl bg-surface-container-low px-3 font-body-md outline-none focus:ring-2 focus:ring-primary/20"
          required
        />
        <input
          value={customerWhatsapp}
          onChange={(e) => setCustomerWhatsapp(e.target.value)}
          placeholder="WhatsApp (opcional)"
          className="h-12 rounded-xl bg-surface-container-low px-3 font-body-md outline-none focus:ring-2 focus:ring-primary/20"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="O quê? (ex.: Bolo de cenoura)"
          className="h-12 rounded-xl bg-surface-container-low px-3 font-body-md outline-none focus:ring-2 focus:ring-primary/20"
          required
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-12 rounded-xl bg-surface-container-low px-3 font-body-md outline-none focus:ring-2 focus:ring-primary/20"
          required
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="h-12 rounded-xl bg-surface-container-low px-3 font-body-md outline-none focus:ring-2 focus:ring-primary/20"
        />
        <input
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          placeholder="Valor total (R$)"
          className="h-12 rounded-xl bg-surface-container-low px-3 font-body-md outline-none focus:ring-2 focus:ring-primary/20"
        />
        <label className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
          <input
            type="checkbox"
            checked={isBudget}
            onChange={(e) => setIsBudget(e.target.checked)}
            className="w-5 h-5 accent-primary"
          />
          Ainda é orçamento
        </label>
        {error && <p className="text-error font-body-sm">{error.message}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-12 rounded-xl bg-primary text-on-primary font-title-sm text-title-sm min-h-[44px] disabled:opacity-60"
        >
          {submitting ? "Salvando..." : "Salvar pedido"}
        </button>
      </form>
      <CapacityDialog
        open={!!capacityError}
        onClose={clearCapacityError}
        onAccept={handleAcceptCapacity}
        error={capacityError}
      />
    </div>
  );
}

