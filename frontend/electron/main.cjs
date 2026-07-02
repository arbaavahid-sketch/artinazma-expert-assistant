const { app, BrowserWindow, Menu, shell, session } = require("electron");
const path = require("path");

const APP_URL = process.env.ARTIN_DESKTOP_URL || "https://assistant.artinazma.net";
const APP_ORIGIN = new URL(APP_URL).origin;

function isInternalUrl(url) {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: "ArtinAzma Expert Assistant",
    icon: path.join(__dirname, "assets", "icon.ico"),
    autoHideMenuBar: true,
    backgroundColor: "#f7f7f8",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url)) {
      window.loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  window.loadURL(APP_URL);
}

app.setAppUserModelId("net.artinazma.expertassistant.desktop");

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents.getURL();
    const allowedPermissions = new Set(["media", "notifications"]);
    callback(isInternalUrl(url) && allowedPermissions.has(permission));
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
