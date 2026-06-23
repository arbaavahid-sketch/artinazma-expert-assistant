import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "net.artinazma.expertassistant",
  appName: "Artin",
  webDir: "capacitor-web",
  server: {
    url: process.env.CAPACITOR_SERVER_URL || "https://assistant.artinazma.net",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1400,
      backgroundColor: "#1d4ed8",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#1d4ed8",
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
};

export default config;
