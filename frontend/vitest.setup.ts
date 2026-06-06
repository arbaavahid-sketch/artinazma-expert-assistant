import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// پاک‌سازی DOM بعد از هر تست تا تست‌ها روی هم اثر نگذارند
afterEach(() => {
  cleanup();
});
