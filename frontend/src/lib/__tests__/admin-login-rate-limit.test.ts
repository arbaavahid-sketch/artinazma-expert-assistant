import { beforeEach, describe, expect, it } from "vitest";
import {
  checkAdminLoginRateLimit,
  clearAdminLoginRateLimitForTests,
  getAdminLoginClientId,
  recordAdminLoginFailure,
  resetAdminLoginRateLimit,
} from "../admin-login-rate-limit";

describe("admin login rate limit", () => {
  beforeEach(() => {
    clearAdminLoginRateLimitForTests();
  });

  it("uses the first forwarded IP as the client id", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      "x-real-ip": "198.51.100.3",
    });

    expect(getAdminLoginClientId(headers)).toBe("203.0.113.10");
  });

  it("blocks a client after repeated failed attempts", () => {
    const clientId = "203.0.113.20";
    const now = 1_000;

    for (let i = 0; i < 4; i++) {
      expect(recordAdminLoginFailure(clientId, now + i).blocked).toBe(false);
    }

    const fifth = recordAdminLoginFailure(clientId, now + 4);
    expect(fifth.blocked).toBe(true);

    const check = checkAdminLoginRateLimit(clientId, now + 5);
    expect(check.limited).toBe(true);
    expect(check.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the bucket after a successful login", () => {
    const clientId = "203.0.113.30";

    recordAdminLoginFailure(clientId, 1_000);
    resetAdminLoginRateLimit(clientId);

    expect(checkAdminLoginRateLimit(clientId, 1_001).limited).toBe(false);
  });
});
