const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("artinDesktop", {
  platform: process.platform,
  version: process.versions.electron,
});
