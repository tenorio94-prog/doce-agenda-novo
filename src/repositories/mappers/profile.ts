// src/repositories/mappers/profile.ts
// profiles ↔ Profile

import { THEME_STYLES } from "../types";
import type { NewProfile, Profile, ProfilePatch, ThemeStyle } from "../types";
import { asNullableString, asString, asTimestamp, parseWeeklyCapacity } from "./core";

export interface ProfileRow {
  id: string;
  user_id: string;
  business_name: string | null;
  slug: string | null;
  theme_style: string | null;
  cover_url: string | null;
  logo_url: string | null;
  pix_key: string | null;
  default_weekly_capacity: unknown;
  created_at: string | null;
}

const THEME_SET: ReadonlySet<string> = new Set(THEME_STYLES);

export const toThemeStyle = (value: unknown): ThemeStyle | null =>
  typeof value === "string" && THEME_SET.has(value) ? (value as ThemeStyle) : null;

export const toProfile = (row: ProfileRow): Profile => ({
  id: asString(row.id),
  userId: asString(row.user_id),
  businessName: asNullableString(row.business_name),
  slug: asNullableString(row.slug),
  themeStyle: toThemeStyle(row.theme_style),
  coverUrl: asNullableString(row.cover_url),
  logoUrl: asNullableString(row.logo_url),
  pixKey: asNullableString(row.pix_key),
  defaultWeeklyCapacity: parseWeeklyCapacity(row.default_weekly_capacity),
  createdAt: asTimestamp(row.created_at),
});

export const profileRow = (data: NewProfile): Record<string, unknown> => ({
  user_id: data.userId,
  business_name: data.businessName ?? null,
  slug: data.slug ?? null,
  theme_style: data.themeStyle ?? null,
  cover_url: data.coverUrl ?? null,
  logo_url: data.logoUrl ?? null,
  pix_key: data.pixKey ?? null,
  default_weekly_capacity: data.defaultWeeklyCapacity ?? {},
});

/** Só envia as chaves presentes no patch (undefined nunca vira null). */
export const profilePatchRow = (patch: ProfilePatch): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  if (patch.businessName !== undefined) row.business_name = patch.businessName;
  if (patch.slug !== undefined) row.slug = patch.slug;
  if (patch.themeStyle !== undefined) row.theme_style = patch.themeStyle;
  if (patch.coverUrl !== undefined) row.cover_url = patch.coverUrl;
  if (patch.logoUrl !== undefined) row.logo_url = patch.logoUrl;
  if (patch.pixKey !== undefined) row.pix_key = patch.pixKey;
  if (patch.defaultWeeklyCapacity !== undefined) {
    row.default_weekly_capacity = patch.defaultWeeklyCapacity;
  }
  return row;
};
