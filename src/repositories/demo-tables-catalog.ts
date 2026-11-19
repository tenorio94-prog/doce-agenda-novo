// src/repositories/demo-tables-catalog.ts
// Repositórios de perfil, catálogo e exceções de data no IndexedDB demo.

import type { IDBPDatabase } from "idb";
import type { DemoDB } from "./demo-db";
import { uid } from "./demo-internal";
import type {
  CatalogFilter,
  CatalogItem,
  DateOverride,
  DateOverrideFilter,
  ICatalogRepository,
  IDateOverrideRepository,
  IProfileRepository,
  NewCatalogItem,
  NewDateOverride,
  NewProfile,
  Profile,
} from "./types";

type GetDb = () => Promise<IDBPDatabase<DemoDB>>;

const now = (): string => new Date().toISOString();

const normalizeMaxSlots = (value: number | null): number | null =>
  value === null ? null : Math.max(0, Math.min(10, Math.round(value)));

export const createProfileRepository = (getDb: GetDb): IProfileRepository => ({
  getById: async (id) => (await (await getDb()).get("profiles", id)) ?? null,

  getBySlug: async (slug) => {
    const db = await getDb();
    const all = await db.getAll("profiles");
    return all.find((profile) => profile.slug === slug) ?? null;
  },

  create: async (data: NewProfile) => {
    const db = await getDb();
    const profile = {
      id: uid("profile"),
      userId: data.userId,
      businessName: data.businessName ?? null,
      slug: data.slug ?? null,
      themeStyle: data.themeStyle ?? null,
      coverUrl: data.coverUrl ?? null,
      logoUrl: data.logoUrl ?? null,
      pixKey: data.pixKey ?? null,
      defaultWeeklyCapacity: data.defaultWeeklyCapacity ?? {},
      createdAt: now(),
    } satisfies Profile;
    await db.put("profiles", profile);
    return profile;
  },

  update: async (id, patch) => {
    const db = await getDb();
    const current = await db.get("profiles", id);
    if (!current) return null;
    const updated = { ...current, ...patch };
    await db.put("profiles", updated);
    return updated;
  },
});

export const createCatalogRepository = (getDb: GetDb): ICatalogRepository => ({
  listByProfile: async (profileId, filter?: CatalogFilter) => {
    const db = await getDb();
    const items = await db.getAllFromIndex("catalog", "by-profile", profileId);
    return filter?.includeInactive ? items : items.filter((item) => item.active);
  },

  create: async (data: NewCatalogItem) => {
    const db = await getDb();
    const item = {
      id: uid("cat"),
      profileId: data.profileId,
      name: data.name,
      description: data.description ?? null,
      priceCents: data.priceCents ?? 0,
      slotsRequired: Math.max(1, Math.min(10, Math.round(data.slotsRequired ?? 1))),
      photoUrl: data.photoUrl ?? null,
      active: data.active ?? true,
    } satisfies CatalogItem;
    await db.put("catalog", item);
    return item;
  },

  update: async (id, patch) => {
    const db = await getDb();
    const current = await db.get("catalog", id);
    if (!current) return null;
    const updated: CatalogItem = {
      ...current,
      ...patch,
      slotsRequired:
        patch.slotsRequired === undefined
          ? current.slotsRequired
          : Math.max(1, Math.min(10, Math.round(patch.slotsRequired))),
    };
    await db.put("catalog", updated);
    return updated;
  },

  delete: async (id) => {
    const db = await getDb();
    if (!(await db.get("catalog", id))) return false;
    await db.delete("catalog", id);
    return true;
  },
});

export const createDateOverrideRepository = (getDb: GetDb): IDateOverrideRepository => ({
  listByProfile: async (profileId, filter?: DateOverrideFilter) => {
    const db = await getDb();
    const all = await db.getAllFromIndex("dateOverrides", "by-profile", profileId);
    return all
      .filter((o) => (!filter?.fromDate || o.targetDate >= filter.fromDate) && (!filter?.toDate || o.targetDate <= filter.toDate))
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  },

  upsert: async (profileId, targetDate, data: NewDateOverride) => {
    const db = await getDb();
    const existing = await db.getFromIndex("dateOverrides", "by-date", [profileId, targetDate]);
    const override: DateOverride = {
      id: existing?.id ?? uid("ovr"),
      profileId,
      targetDate,
      maxSlots: normalizeMaxSlots(data.maxSlots),
      isClosed: data.isClosed,
      reason: data.reason ?? null,
    };
    await db.put("dateOverrides", override);
    return override;
  },

  delete: async (id) => {
    const db = await getDb();
    if (!(await db.get("dateOverrides", id))) return false;
    await db.delete("dateOverrides", id);
    return true;
  },
});
