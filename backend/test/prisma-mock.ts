// Minimal Prisma mock for vitest tests
// This avoids the @prisma/client sub-path import issue

class Decimal {
  private value: number;
  constructor(v: number | string | Decimal) {
    if (v instanceof Decimal) this.value = v.value;
    else this.value = typeof v === "string" ? parseFloat(v) : v;
  }
  toNumber() { return this.value; }
  toString() { return String(this.value); }
  toJSON() { return this.value; }
  equals(other: Decimal) { return this.value === other.value; }
  gt(other: Decimal) { return this.value > other.value; }
  lt(other: Decimal) { return this.value < other.value; }
  gte(other: Decimal) { return this.value >= other.value; }
  lte(other: Decimal) { return this.value <= other.value; }
}

export const Prisma = { Decimal };

// Stub PrismaClient - tests mock it anyway
export class PrismaClient {
  user: any = {};
  auction: any = {};
  bid: any = {};
  payment: any = {};
  $transaction: any = vi.fn();
}

// Re-export types (simplified)
import type { vi } from "vitest";
export type * from "@prisma/client/runtime/library";
