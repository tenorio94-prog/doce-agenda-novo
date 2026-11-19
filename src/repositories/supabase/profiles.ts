// src/repositories/supabase/profiles.ts
// ProfileRepository sobre Supabase (RLS: dono via auth.uid()).

import type { ServerSupabaseClient } from "@/lib/supabase/server";

import { toRepositoryError } from "../errors";
import { profilePatchRow, profileRow, toProfile } from "../mappers/profile";
import type { ProfileRow } from "../mappers/profile";
import type { IProfileRepository, NewProfile, Profile, ProfilePatch } from "../types";

export function createProfilesRepository(db: ServerSupabaseClient): IProfileRepository {
  const getById = async (id: string): Promise<Profile | null> => {
    const { data, error } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw toRepositoryError("profiles.getById", error);
    return data ? toProfile(data as ProfileRow) : null;
  };

  const getBySlug = async (slug: string): Promise<Profile | null> => {
    const { data, error } = await db.from("profiles").select("*").eq("slug", slug).maybeSingle();
    if (error) throw toRepositoryError("profiles.getBySlug", error);
    return data ? toProfile(data as ProfileRow) : null;
  };

  const create = async (data: NewProfile): Promise<Profile> => {
    const { data: row, error } = await db
      .from("profiles")
      .insert(profileRow(data))
      .select("*")
      .single();
    if (error) throw toRepositoryError("profiles.create", error);
    return toProfile(row as ProfileRow);
  };

  const update = async (id: string, patch: ProfilePatch): Promise<Profile | null> => {
    const row = profilePatchRow(patch);
    if (Object.keys(row).length === 0) return getById(id);

    const { data, error } = await db
      .from("profiles")
      .update(row)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw toRepositoryError("profiles.update", error);
    return data ? toProfile(data as ProfileRow) : null;
  };

  return { getById, getBySlug, create, update };
}
