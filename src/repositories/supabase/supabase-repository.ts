// src/repositories/supabase/supabase-repository.ts
// Implementação de `IDoceRepository` sobre Supabase, independente do runtime:
// recebe um client já criado (navegador, servidor ou client de teste/administrativo).
// Quem escolhe o client é a borda:
//   - `../supabase-repository.ts` → client do servidor (sessão nos cookies);
//   - `../factory.ts`             → client do navegador (`@/lib/supabase/client`).
// Manter este módulo livre de `next/headers` é o que permite importá-lo em
// Client Components.

import type { SupabaseClient } from "@supabase/supabase-js";

import { createCatalogRepository } from "./catalog";
import { createDateOverridesRepository } from "./dateOverrides";
import { createOrdersRepository } from "./orders";
import { createPaymentsRepository } from "./payments";
import { createProfilesRepository } from "./profiles";
import { selectPublicOrderStatus } from "./publicStatus";
import { createSubmissionsRepository } from "./submissions";
import type {
  IAcceptingSubmissionRepository,
  ICatalogRepository,
  IConfirmableOrderRepository,
  IDateOverrideRepository,
  IDoceRepository,
  IPaymentRepository,
  IProfileRepository,
  PublicOrderStatus,
} from "../types";

export class SupabaseRepository implements IDoceRepository {
  readonly profiles: IProfileRepository;
  readonly orders: IConfirmableOrderRepository;
  readonly payments: IPaymentRepository;
  readonly dateOverrides: IDateOverrideRepository;
  readonly catalog: ICatalogRepository;
  readonly submissions: IAcceptingSubmissionRepository;

  private constructor(private readonly db: SupabaseClient) {
    this.profiles = createProfilesRepository(db);
    this.orders = createOrdersRepository(db);
    this.payments = createPaymentsRepository(db);
    this.dateOverrides = createDateOverridesRepository(db);
    this.catalog = createCatalogRepository(db);
    this.submissions = createSubmissionsRepository(db);
  }

  /** Cria o repositório a partir de um client Supabase já configurado. */
  static fromClient(client: SupabaseClient): SupabaseRepository {
    return new SupabaseRepository(client);
  }

  /** Consulta pública por código: projeção mínima, sem dados pessoais. */
  async getPublicOrderStatus(publicCode: string): Promise<PublicOrderStatus | null> {
    return selectPublicOrderStatus(this.db, publicCode);
  }
}
