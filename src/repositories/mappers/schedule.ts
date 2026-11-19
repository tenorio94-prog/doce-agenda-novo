// src/repositories/mappers/schedule.ts
// date_overrides / public_submissions ↔ DateOverride / PublicSubmission

import type {
  DateOverride,
  IsoDate,
  NewDateOverride,
  PublicSubmission,
  PublicSubmissionStatus,
} from "../types";
import {
  asBoolean,
  asIsoDate,
  asNullableString,
  asString,
  asTimestamp,
  parseSubmissionPayload,
} from "./core";

// ------------------------------------------------------------ DateOverride

export interface DateOverrideRow {
  id: string;
  profile_id: string;
  target_date: string;
  max_slots: number | null;
  is_closed: boolean | null;
  reason: string | null;
}

export const toDateOverride = (row: DateOverrideRow): DateOverride => ({
  id: asString(row.id),
  profileId: asString(row.profile_id),
  targetDate: asIsoDate(row.target_date) ?? asString(row.target_date),
  maxSlots: row.max_slots === null ? null : Math.max(0, Math.round(Number(row.max_slots))),
  isClosed: asBoolean(row.is_closed),
  reason: asNullableString(row.reason),
});

export const dateOverrideRow = (
  profileId: string,
  targetDate: IsoDate,
  data: NewDateOverride,
): Record<string, unknown> => ({
  profile_id: profileId,
  target_date: targetDate,
  max_slots: data.maxSlots,
  is_closed: data.isClosed,
  reason: data.reason ?? null,
});

// ------------------------------------------------------- PublicSubmission

export interface PublicSubmissionRow {
  id: string;
  profile_id: string;
  payload: unknown;
  status: string | null;
  created_at: string | null;
  anonymize_after: string | null;
}

const SUBMISSION_STATUSES: ReadonlySet<string> = new Set(["pendente", "aceito", "recusado"]);

export const toSubmissionStatus = (value: unknown): PublicSubmissionStatus =>
  typeof value === "string" && SUBMISSION_STATUSES.has(value)
    ? (value as PublicSubmissionStatus)
    : "pendente";

export const toPublicSubmission = (row: PublicSubmissionRow): PublicSubmission => ({
  id: asString(row.id),
  profileId: asString(row.profile_id),
  payload: parseSubmissionPayload(row.payload),
  status: toSubmissionStatus(row.status),
  createdAt: asTimestamp(row.created_at),
  anonymizeAfter: asNullableString(row.anonymize_after),
});
