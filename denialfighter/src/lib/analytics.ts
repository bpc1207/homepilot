import { prisma } from "./db";
import { keyedHash } from "./crypto";

/** Funnel events. First-party table only; props are restricted to this allowlist. */
export type FunnelEvent =
  | "checker_uploaded" | "email_captured" | "account_created" | "case_created"
  | "packet_purchased" | "case_marked_approved";

const PROP_ALLOWLIST = new Set(["denialType", "plan", "priceCents", "source"]);

export async function track(
  name: FunnelEvent,
  opts: { anonId?: string; userId?: string; props?: Record<string, string | number | boolean> } = {},
) {
  const props = Object.fromEntries(Object.entries(opts.props ?? {}).filter(([k]) => PROP_ALLOWLIST.has(k)));
  await prisma.analyticsEvent.create({
    data: {
      name,
      anonId: opts.anonId ?? null,
      userIdHash: opts.userId ? keyedHash(opts.userId) : null,
      props,
    },
  });
}
