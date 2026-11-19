// src/repositories/supabase/dateOverrides.ts
// DateOverrideRepository sobre Supabase (RLS: dono via perfil).

import type { ServerSupabaseClient } from "@/lib/supabase/server";

import { toRepositoryError } from "../errors";
import { dateOverrideRow, toDateOverride } from "../mappers/schedule";
import type { DateOverrideRow } from "../mappers/schedule";
import type {
  DateOverride,
  DateOverrideFilter,
  IDateOverrideRepository,
  IsoDate,
  NewDateOverride,
} from "../types";

export function createDateOverridesRepository(
  db: ServerSupabaseClient,
): IDateOverrideRepository {
  const listByProfile = async (
    profileId: string,
    filter?: DateOverrideFilter,
  ): Promise<DateOverride[]> => {
    let query = db
      .from("date_overrides")
      .select("*")
      .eq("profile_id", profileId)
      .order("target_date", { ascending: true });

    if (filter?.fromDate !== undefined) query = query.gte("target_date", filter.fromDate);
    if (filter?.toDate !== undefined) query = query.lte("target_date", filter.toDate);

    const { data, error } = await query;
    if (error) throw toRepositoryError("dateOverrides.listByProfile", error);
    return ((data ?? []) as DateOverrideRow[]).map(toDateOverride);
  };

  const upsert = async (
    profileId: string,
    targetDate: IsoDate,
    data: NewDateOverride,
  ): Promise<DateOverride> => {
    // unique (profile_id, target_date) garante idempotência por dia.
    const { data: row, error } = await db
      .from("date_overrides")
      .upsert(dateOverrideRow(profileId, targetDate, data), {
        onConflict: "profile_id,target_date",
      })
      .select("*")
      .single();
    if (error) throw toRepositoryError("dateOverrides.upsert", error);
    return toDateOverride(row as DateOverrideRow);
  };

  const remove = async (id: string): Promise<boolean> => {
    const { data, error } = await db.from("date_overrides").delete().eq("id", id).select("id");
    if (error) throw toRepositoryError("dateOverrides.delete", error);
    return (data ?? []).length > 0;
  };

  return { listByProfile, upsert, delete: remove };
}
