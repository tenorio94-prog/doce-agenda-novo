"use client";

import { useState } from "react";
import { useAgenda } from "@/hooks/useAgenda";
import { TopBar } from "./TopBar";
import { BottomBar } from "./BottomBar";
import { PendingBanner } from "./PendingBanner";
import { AgendaCard } from "./AgendaCard";
import { OrderDrawer } from "./OrderDrawer";
import { CapacityDialog } from "./CapacityDialog";
import type { Order } from "@/repositories/types";
import type { OrderStatus } from "@/domain/orderStatus";

export function AgendaPage({ basePath }: { basePath: "/app" | "/demo" }) {
  const {
    dayOrders,
    loading,
    pendingId,
    error,
    capacityError,
    confirmOrder,
    advanceStatus,
    markPaymentReceived,
    clearCapacityError,
  } = useAgenda();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSelect = (order: Order) => {
    setSelectedOrder(order);
    setDrawerOpen(true);
  };

  const handleAdvance = async (orderId: string, next: string) => {
    await advanceStatus(orderId, next as OrderStatus);
    setDrawerOpen(false);
  };

  const handleReceive = async (orderId: string) => {
    await markPaymentReceived(orderId);
  };

  const handleAcceptCapacity = async (reason: string) => {
    if (pendingId) {
      await confirmOrder(pendingId, reason);
    }
    clearCapacityError();
  };

  return (
    <div className="min-h-screen bg-surface">
      <TopBar title="Agenda" onShareLink={() => {}} />
      <main className="max-w-[428px] mx-auto px-4 pt-20 pb-28">
        {error && <p className="text-error font-body-sm mb-3">{error.message}</p>}
        <PendingBanner count={pendingId ? 1 : 0} onView={() => {}} />
        <div className="flex flex-col gap-3 mt-3">
          {loading && <p className="font-body-sm text-body-sm text-on-surface-variant">Carregando...</p>}
          {dayOrders.map((order) => (
            <AgendaCard key={order.id} order={order} onSelect={handleSelect} />
          ))}
          {!loading && dayOrders.length === 0 && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">Nada marcado hoje.</p>
          )}
        </div>
      </main>
      <BottomBar basePath={basePath} />
      <OrderDrawer
        order={selectedOrder}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onReceive={handleReceive}
        onAdvance={handleAdvance}
      />
      <CapacityDialog
        open={!!capacityError}
        onClose={clearCapacityError}
        onAccept={handleAcceptCapacity}
        error={capacityError}
      />
    </div>
  );
}
