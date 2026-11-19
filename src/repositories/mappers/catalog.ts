// src/repositories/mappers/catalog.ts
// catalog_items ↔ CatalogItem

import { clampSlots } from "@/domain/capacity";

import type { CatalogItem, CatalogItemPatch, NewCatalogItem } from "../types";
import { asBoolean, asInt, asNullableString, asString } from "./core";

export interface CatalogItemRow {
  id: string;
  profile_id: string;
  name: string | null;
  description: string | null;
  price_cents: number | null;
  slots_required: number | null;
  photo_url: string | null;
  active: boolean | null;
}

export const toCatalogItem = (row: CatalogItemRow): CatalogItem => ({
  id: asString(row.id),
  profileId: asString(row.profile_id),
  name: asString(row.name),
  description: asNullableString(row.description),
  priceCents: Math.max(0, asInt(row.price_cents)),
  slotsRequired: clampSlots(asInt(row.slots_required, 1)),
  photoUrl: asNullableString(row.photo_url),
  active: asBoolean(row.active, true),
});

export const catalogItemRow = (data: NewCatalogItem): Record<string, unknown> => ({
  profile_id: data.profileId,
  name: data.name,
  description: data.description ?? null,
  price_cents: data.priceCents ?? 0,
  slots_required: clampSlots(data.slotsRequired ?? 1),
  photo_url: data.photoUrl ?? null,
  active: data.active ?? true,
});

export const catalogPatchRow = (patch: CatalogItemPatch): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.priceCents !== undefined) row.price_cents = patch.priceCents;
  if (patch.slotsRequired !== undefined) row.slots_required = clampSlots(patch.slotsRequired);
  if (patch.photoUrl !== undefined) row.photo_url = patch.photoUrl;
  if (patch.active !== undefined) row.active = patch.active;
  return row;
};
