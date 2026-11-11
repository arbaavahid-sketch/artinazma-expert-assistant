import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BazaarUpdateNotice from "../BazaarUpdateNotice";

const device = vi.hoisted(() => ({
  native: true,
  id: "net.artinazma.expertassistant",
  build: "8",
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => device.native, getPlatform: () => "android" },
}));

vi.mock("@capacitor/app", () => ({
  App: { getInfo: async () => ({ id: device.id, build: device.build }) },
}));

const checkUpdate = vi.fn();

beforeEach(() => {
  window.localStorage.clear();
  device.native = true;
  device.id = "net.artinazma.expertassistant";
  device.build = "8";
  checkUpdate.mockReset().mockResolvedValue(Response.json({ latestVersionCode: 9 }));
  vi.stubGlobal("fetch", checkUpdate);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openApp() {
  const view = render(<BazaarUpdateNotice en />);
  await act(async () => {});
  return view;
}

it("announces a newer release to version 1.7 and links to the Bazaar listing", async () => {
  await openApp();
  expect(await screen.findByRole("link", { name: "Update in Bazaar" })).toHaveAttribute(
    "href",
    "https://cafebazaar.ir/app/net.artinazma.expertassistant",
  );
});

it("remembers dismissal for the current release and shows a subsequent release", async () => {
  const view = await openApp();
  fireEvent.click(await screen.findByRole("button", { name: "Later" }));
  expect(screen.queryByRole("status")).toBeNull();
  view.unmount();

  const reopened = await openApp();
  expect(screen.queryByRole("status")).toBeNull();
  reopened.unmount();

  checkUpdate.mockResolvedValue(Response.json({ latestVersionCode: 10 }));
  await openApp();
  expect(await screen.findByRole("status")).toBeVisible();
});

it("stays hidden when the server has not announced an update or the build is current", async () => {
  checkUpdate.mockResolvedValueOnce(Response.json({ latestVersionCode: null }));
  const view = await openApp();
  expect(screen.queryByRole("status")).toBeNull();
  view.unmount();

  device.build = "9";
  await openApp();
  expect(screen.queryByRole("status")).toBeNull();
});

it("skips the update request outside the published Android package", async () => {
  device.native = false;
  const web = await openApp();
  web.unmount();
  device.native = true;
  device.id += ".filesqa";
  await openApp();
  expect(checkUpdate).not.toHaveBeenCalled();
});
