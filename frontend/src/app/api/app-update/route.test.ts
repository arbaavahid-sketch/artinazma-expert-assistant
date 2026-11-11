import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

it.each([
  ["", null],
  ["1.8", null],
  ["99999999999999", null],
  ["9", 9],
])("returns an uncached response for release code %j", async (configured, expected) => {
  vi.stubEnv("BAZAAR_LATEST_VERSION_CODE", configured);
  const response = GET();
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({ latestVersionCode: expected });
});
