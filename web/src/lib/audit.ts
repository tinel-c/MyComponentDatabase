import { prisma } from "@/lib/prisma";
import type { Category, Part, PartPurchaseLink, StorageLocation, User } from "@prisma/client";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

/** Part row + purchase links — used for UPDATE/DELETE audit and revert. */
export type PartAuditPayload = {
  part: SerializedPart;
  purchaseLinks: SerializedPurchaseLink[];
};

export type SerializedPart = {
  id: string;
  partNumber: number;
  internalSku: string | null;
  name: string;
  mpn: string | null;
  manufacturer: string | null;
  description: string | null;
  imageUrl: string | null;
  quantityOnHand: number;
  reorderMin: number | null;
  unit: string;
  categoryId: string | null;
  defaultLocationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedPurchaseLink = {
  id: string;
  partId: string;
  label: string;
  url: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type UserAuditPayload = {
  user: SerializedUser;
  categoryIds: string[];
};

export type SerializedUser = {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: string | null;
  image: string | null;
  role: string;
};

function iso(d: Date): string {
  return d.toISOString();
}

export function serializePart(
  p: Part & { purchaseLinks: PartPurchaseLink[] },
): PartAuditPayload {
  return {
    part: {
      id: p.id,
      partNumber: p.partNumber,
      internalSku: p.internalSku,
      name: p.name,
      mpn: p.mpn,
      manufacturer: p.manufacturer,
      description: p.description,
      imageUrl: p.imageUrl,
      quantityOnHand: p.quantityOnHand,
      reorderMin: p.reorderMin,
      unit: p.unit,
      categoryId: p.categoryId,
      defaultLocationId: p.defaultLocationId,
      createdAt: iso(p.createdAt),
      updatedAt: iso(p.updatedAt),
    },
    purchaseLinks: p.purchaseLinks.map((l) => ({
      id: l.id,
      partId: l.partId,
      label: l.label,
      url: l.url,
      sortOrder: l.sortOrder,
      createdAt: iso(l.createdAt),
      updatedAt: iso(l.updatedAt),
    })),
  };
}

export function serializeCategory(c: Category): Record<string, unknown> {
  return {
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

export function serializeStorageLocation(l: StorageLocation): Record<string, unknown> {
  return {
    id: l.id,
    name: l.name,
    parentId: l.parentId,
    createdAt: iso(l.createdAt),
    updatedAt: iso(l.updatedAt),
  };
}

export function serializeUserForAudit(
  u: User & { categoryAccess?: { categoryId: string }[] },
): UserAuditPayload {
  return {
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      emailVerified: u.emailVerified ? iso(u.emailVerified) : null,
      image: u.image,
      role: u.role,
    },
    categoryIds: u.categoryAccess?.map((a) => a.categoryId) ?? [],
  };
}

/**
 * Append an audit row. Never throws — failures are logged to console only
 * so mutations are not blocked by audit DB issues.
 */
export async function logAudit(opts: {
  userId: string | null;
  action: AuditAction;
  model: string;
  recordId: string;
  recordName?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.userId ?? undefined,
        action: opts.action,
        model: opts.model,
        recordId: opts.recordId,
        recordName: opts.recordName ?? undefined,
        before: opts.before === undefined ? undefined : (opts.before as object),
        after: opts.after === undefined ? undefined : (opts.after as object),
      },
    });
  } catch (e) {
    console.error("[audit] logAudit failed:", e);
  }
}
