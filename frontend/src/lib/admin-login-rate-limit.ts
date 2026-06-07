type LoginBucket = {
  failedAttempts: number;
  firstFailedAt: number;
  blockedUntil: number;
};

const buckets = new Map<string, LoginBucket>();

const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

export function getAdminLoginClientId(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for") || "";
  const firstForwardedIp = forwardedFor.split(",")[0]?.trim();
  return (
    firstForwardedIp ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function checkAdminLoginRateLimit(clientId: string, now = Date.now()) {
  const bucket = buckets.get(clientId);

  if (!bucket) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  if (bucket.blockedUntil > now) {
    return {
      limited: true,
      retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000),
    };
  }

  if (now - bucket.firstFailedAt > WINDOW_MS) {
    buckets.delete(clientId);
  }

  return { limited: false, retryAfterSeconds: 0 };
}

export function recordAdminLoginFailure(clientId: string, now = Date.now()) {
  const current = buckets.get(clientId);
  const bucket =
    current && now - current.firstFailedAt <= WINDOW_MS
      ? current
      : { failedAttempts: 0, firstFailedAt: now, blockedUntil: 0 };

  bucket.failedAttempts += 1;

  if (bucket.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    bucket.blockedUntil = now + BLOCK_MS;
  }

  buckets.set(clientId, bucket);

  return {
    blocked: bucket.blockedUntil > now,
    retryAfterSeconds: bucket.blockedUntil > now
      ? Math.ceil((bucket.blockedUntil - now) / 1000)
      : 0,
  };
}

export function resetAdminLoginRateLimit(clientId: string) {
  buckets.delete(clientId);
}

export function clearAdminLoginRateLimitForTests() {
  buckets.clear();
}
