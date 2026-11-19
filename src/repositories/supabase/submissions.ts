// src/repositories/supabase/submissions.ts
// PublicSubmissionRepository sobre Supabase.
// - `create` roda com a chave anon (RLS: insert liberado na vitrine pública).
// - `acceptPublicSubmission` confere capacidade e gera o pedido confirmado.

import { clampSlots } from "@/domain/capacity";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

import { reserveDayCapacity } from "../capacity-guard";
import { RepositoryError, toRepositoryError } from "../errors";
import { newId, newPublicCode } from "../ids";
import { asInt, asString } from "../mappers/core";
import type { CatalogItemRow } from "../mappers/catalog";
import { toPublicSubmission } from "../mappers/schedule";
import type { PublicSubmissionRow } from "../mappers/schedule";
import type {
  AcceptedSubmission,
  CapacityOverrideInput,
  IAcceptingSubmissionRepository,
  NewPublicSubmission,
  OrderItem,
  PublicSubmission,
  PublicSubmissionStatus,
  SubmissionFilter,
  SubmissionPayload,
} from "../types";
import { createOrdersRepository } from "./orders";

export function createSubmissionsRepository(
  db: ServerSupabaseClient,
): IAcceptingSubmissionRepository {
  const orders = createOrdersRepository(db);

  /** Resolve itens do catálogo para nome/preço/vagas do momento do aceite. */
  const resolveItems = async (payload: SubmissionPayload): Promise<OrderItem[]> => {
    const wanted = payload.items ?? [];
    if (wanted.length === 0) {
      throw new RepositoryError("Submissão sem itens.", "SUBMISSION_INCOMPLETE");
    }

    const ids = [...new Set(wanted.map((item) => item.catalogItemId))];
    const { data, error } = await db
      .from("catalog_items")
      .select("id,name,price_cents,slots_required")
      .in("id", ids);
    if (error) throw toRepositoryError("submissions.accept.catalog", error);

    const byId = new Map<string, CatalogItemRow>();
    for (const row of (data ?? []) as CatalogItemRow[]) byId.set(asString(row.id), row);

    return wanted.map((item) => {
      const found = byId.get(item.catalogItemId);
      if (!found) {
        throw new RepositoryError(
          `Item do catálogo não encontrado: ${item.catalogItemId}`,
          "CATALOG_ITEM_NOT_FOUND",
        );
      }
      return {
        catalogItemId: asString(found.id),
        name: asString(found.name),
        quantity: Math.max(1, Math.round(item.quantity)),
        unitPriceCents: Math.max(0, asInt(found.price_cents)),
        slotsRequired: clampSlots(asInt(found.slots_required, 1)),
      };
    });
  };

  const create = async (data: NewPublicSubmission): Promise<PublicSubmission> => {
    // O id é gerado aqui porque a RLS anon permite insert, mas não o retorno.
    const row = {
      id: newId(),
      profile_id: data.profileId,
      payload: data.payload,
      status: data.status ?? "pendente",
      created_at: new Date().toISOString(),
      anonymize_after: data.anonymizeAfter ?? null,
    };

    const { error } = await db.from("public_submissions").insert(row);
    if (error) throw toRepositoryError("submissions.create", error);
    return toPublicSubmission(row as PublicSubmissionRow);
  };

  const listByProfile = async (
    profileId: string,
    filter?: SubmissionFilter,
  ): Promise<PublicSubmission[]> => {
    let query = db
      .from("public_submissions")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    if (filter?.status !== undefined) query = query.eq("status", filter.status);
    if (filter?.limit !== undefined && filter.limit > 0) query = query.limit(filter.limit);

    const { data, error } = await query;
    if (error) throw toRepositoryError("submissions.listByProfile", error);
    return ((data ?? []) as PublicSubmissionRow[]).map(toPublicSubmission);
  };

  const updateStatus = async (
    id: string,
    status: PublicSubmissionStatus,
  ): Promise<PublicSubmission | null> => {
    const { data, error } = await db
      .from("public_submissions")
      .update({ status })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw toRepositoryError("submissions.updateStatus", error);
    return data ? toPublicSubmission(data as PublicSubmissionRow) : null;
  };

  const acceptPublicSubmission = async (
    id: string,
    options?: CapacityOverrideInput,
  ): Promise<AcceptedSubmission | null> => {
    const { data, error } = await db
      .from("public_submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw toRepositoryError("submissions.accept", error);
    if (data === null) return null;

    const submission = toPublicSubmission(data as PublicSubmissionRow);
    if (submission.status !== "pendente") return null;

    const { payload } = submission;
    if (payload.scheduledDate === undefined || payload.scheduledTime === undefined) {
      throw new RepositoryError(
        "Submissão sem data e horário não pode virar pedido.",
        "SUBMISSION_INCOMPLETE",
      );
    }

    const items = await resolveItems(payload);
    const overrideReason = await reserveDayCapacity({
      db,
      profileId: submission.profileId,
      date: payload.scheduledDate,
      items,
      overrideReason: options?.overrideReason,
    });

    const totalCents = items.reduce(
      (acc, item) => acc + item.unitPriceCents * item.quantity,
      0,
    );

    // Pedido e submissão não são gravados na mesma transação. O fluxo previsto é
    // uma única confeiteira decidindo a fila, sem concorrência no mesmo registro.
    const order = await orders.create({
      profileId: submission.profileId,
      publicCode: newPublicCode(),
      customerName: payload.customerName ?? "Cliente da vitrine",
      customerWhatsapp: payload.customerWhatsapp ?? "",
      items,
      deliveryType: payload.deliveryType ?? "retirada",
      deliveryAddress: payload.deliveryAddress ?? null,
      scheduledDate: payload.scheduledDate,
      scheduledTime: payload.scheduledTime,
      status: "confirmado",
      totalCents,
      notes: payload.notes ?? null,
      capacityOverrideReason: overrideReason,
    });

    const { data: accepted, error: markError } = await db
      .from("public_submissions")
      .update({ status: "aceito" })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (markError) throw toRepositoryError("submissions.accept.mark", markError);

    return {
      submission: accepted
        ? toPublicSubmission(accepted as PublicSubmissionRow)
        : { ...submission, status: "aceito" },
      order,
    };
  };

  return { create, listByProfile, updateStatus, acceptPublicSubmission };
}
