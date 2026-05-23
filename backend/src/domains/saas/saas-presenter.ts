const BYTES_PER_MB = 1024 * 1024;

type PlanLike = {
  storageLimitBytes?: bigint | number | null;
};

type SubscriptionLike = {
  status?: string;
  expiresAt?: Date | string | null;
  plan?: PlanLike | null;
};

type TenantLike = {
  subscription?: SubscriptionLike | null;
};

export function mbToBytes(value?: number | null): bigint | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return BigInt(value) * BigInt(BYTES_PER_MB);
}

export function bytesToMb(value?: bigint | number | null): number | null {
  if (value === undefined || value === null) return null;
  return Math.floor(Number(value) / BYTES_PER_MB);
}

export function toPlanVo<T extends PlanLike>(plan: T) {
  return {
    ...plan,
    storageLimitBytes: plan.storageLimitBytes?.toString?.() ?? (plan.storageLimitBytes ?? null),
    storageLimitMb: bytesToMb(plan.storageLimitBytes),
  };
}

export function toSubscriptionVo<T extends SubscriptionLike>(subscription: T | null | undefined) {
  if (!subscription) return null;
  const expiresAt = subscription.expiresAt instanceof Date
    ? subscription.expiresAt
    : subscription.expiresAt
      ? new Date(subscription.expiresAt)
      : null;
  const status = subscription.status !== 'CANCELED' && expiresAt && expiresAt.getTime() <= Date.now()
    ? 'EXPIRED'
    : subscription.status;

  return {
    ...subscription,
    status,
    plan: subscription.plan ? toPlanVo(subscription.plan) : undefined,
  };
}

export function toTenantVo<T extends TenantLike>(tenant: T | null | undefined) {
  if (!tenant) return null;
  return {
    ...tenant,
    subscription: toSubscriptionVo(tenant.subscription),
  };
}
