// src/repositories/supabase/catalog.ts
// CatalogRepository sobre Supabase (RLS: dono via perfil).

import type { ServerSupabaseClient } from "@/lib/supabase/server";

import { toRepositoryError } from "../errors";
import { catalogItemRow, catalogPatchRow, toCatalogItem } from "../mappers/catalog";
import type { CatalogItemRow } from "../mappers/catalog";
import type {
  CatalogFilter,
  CatalogItem,
  CatalogItemPatch,
  ICatalogRepository,
  NewCatalogItem,
} from "../types";

export function createCatalogRepository(db: ServerSupabaseClient): ICatalogRepository {
  const listByProfile = async (
    profileId: string,
    filter?: CatalogFilter,
  ): Promise<CatalogItem[]> => {
    let query = db.from("catalog_items").select("*").eq("profile_id", profileId);
    if (filter?.includeInactive !== true) query = query.eq("active", true);

    const { data, error } = await query.order("name", { ascending: true });
    if (error) throw toRepositoryError("catalog.listByProfile", error);
    return ((data ?? []) as CatalogItemRow[]).map(toCatalogItem);
  };

  const create = async (data: NewCatalogItem): Promise<CatalogItem> => {
    const { data: row, error } = await db
      .from("catalog_items")
      .insert(catalogItemRow(data))
      .select("*")
      .single();
    if (error) throw toRepositoryError("catalog.create", error);
    return toCatalogItem(row as CatalogItemRow);
  };

  const update = async (id: string, patch: CatalogItemPatch): Promise<CatalogItem | null> => {
    const row = catalogPatchRow(patch);
    if (Object.keys(row).length === 0) {
      const { data, error } = await db
        .from("catalog_items")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw toRepositoryError("catalog.update", error);
      return data ? toCatalogItem(data as CatalogItemRow) : null;
    }

    const { data, error } = await db
      .from("catalog_items")
      .update(row)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw toRepositoryError("catalog.update", error);
    return data ? toCatalogItem(data as CatalogItemRow) : null;
  };

  const remove = async (id: string): Promise<boolean> => {
    const { data, error } = await db.from("catalog_items").delete().eq("id", id).select("id");
    if (error) throw toRepositoryError("catalog.delete", error);
    return (data ?? []).length > 0;
  };

  return { listByProfile, create, update, delete: remove };
}
