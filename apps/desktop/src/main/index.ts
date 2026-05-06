import { app, BrowserWindow, clipboard, ipcMain, Menu, nativeImage, shell, Tray } from "electron";
import { join } from "path";
import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { loadWorkspaceEnvLocal } from "./dev-env";
import { startCoreProcess, type CoreRuntimeHandle } from "./core-process";
import {
  applyToolIntegration,
  buildCherryStudioImportUrl,
  listToolIntegrations,
  restoreToolIntegration,
  type ToolIntegrationId
} from "./tool-integrations";
import {
  loadDesktopConfig,
  normalizePort,
  resolveConfiguredPort,
  resolveConfiguredLocalGatewayPort,
  saveDesktopConfig,
  type DesktopConfig,
  type PortSource
} from "./app-config";

loadWorkspaceEnvLocal();

interface UpdateState {
  currentVersion: string;
  status:
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "error"
    | "unsupported";
  availableVersion?: string;
  downloadedVersion?: string;
  progressPercent?: number;
  message?: string;
}

type AutoUpdaterType = typeof import("electron-updater").autoUpdater;

let coreRuntime: CoreRuntimeHandle = {
  state: {
    managed: false,
    running: false,
    apiBase: process.env.ELECTRON_API_BASE ?? "http://127.0.0.1:3456",
    port: Number(process.env.ELECTRON_API_PORT || 3456),
    logRetentionDays: Number(process.env.LOG_RETENTION_DAYS || 30),
    logMaxRecords: Number(process.env.LOG_MAX_RECORDS || 10000)
  },
  stop() {}
};
let desktopConfig: DesktopConfig = {
  apiPort: 3456,
  localGatewayPort: 3457,
  launchAtLogin: false,
  launchHidden: false,
  closeToTray: true
};
let configuredPortSource: PortSource = "default";
let configuredLocalGatewayPortSource: PortSource = "default";
let isBootstrapped = false;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let autoUpdater: AutoUpdaterType | null = null;
let launchHiddenOnStartup = false;
let isQuitting = false;
let updateState: UpdateState = {
  currentVersion: app.getVersion(),
  status: app.isPackaged ? "idle" : "unsupported",
  message: app.isPackaged
    ? undefined
    : "Update checks are only available in packaged builds."
};

function resolveIconPath() {
  const iconFile = process.platform === "win32" ? "icon.ico" : "icon.png";
  return join(app.getAppPath(), "build", iconFile);
}

function resolveReleaseURL() {
  const version = updateState.availableVersion ?? updateState.downloadedVersion;
  if (version) {
    return `https://github.com/xiaoyuandev/clash-for-ai/releases/tag/v${version}`;
  }

  return "https://github.com/xiaoyuandev/clash-for-ai/releases/latest";
}

function shouldStartHidden() {
  if (desktopConfig.launchHidden) {
    return true;
  }

  if (process.argv.includes("--hidden") || process.argv.includes("--silent")) {
    return true;
  }

  if (process.platform === "darwin") {
    return app.getLoginItemSettings().wasOpenedAsHidden;
  }

  return false;
}

function applyLaunchSettings() {
  app.setLoginItemSettings({
    openAtLogin: desktopConfig.launchAtLogin,
    openAsHidden: desktopConfig.launchHidden,
    args: desktopConfig.launchHidden ? ["--hidden"] : []
  });
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow(true);
    return;
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.focus();
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show Clash for AI",
        click: () => showMainWindow()
      },
      {
        label: mainWindow?.isVisible() ? "Hide Window" : "Open Settings",
        click: () => {
          if (mainWindow?.isVisible()) {
            mainWindow.hide();
            return;
          }
          showMainWindow();
        }
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => app.quit()
      }
    ])
  );
}

function createTray() {
  if (tray) {
    return;
  }

  const icon = nativeImage.createFromPath(resolveIconPath());
  tray = new Tray(icon);
  tray.setToolTip("Clash for AI");
  tray.on("click", () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      showMainWindow();
    }
    updateTrayMenu();
  });
  updateTrayMenu();
}

async function bootstrapCoreRuntime() {
  const portInfo = resolveConfiguredPort(desktopConfig);
  const localGatewayPortInfo = resolveConfiguredLocalGatewayPort(desktopConfig);
  configuredPortSource = portInfo.source;
  configuredLocalGatewayPortSource = localGatewayPortInfo.source;

  try {
    coreRuntime = await startCoreProcess({
      desiredPort: portInfo.port,
      desiredLocalGatewayPort: localGatewayPortInfo.port
    });
  } catch (error) {
    coreRuntime = {
      state: {
        managed: false,
        running: false,
        apiBase: process.env.ELECTRON_API_BASE ?? `http://127.0.0.1:${portInfo.port}`,
        port: portInfo.port,
        logRetentionDays: Number(process.env.LOG_RETENTION_DAYS || 30),
        logMaxRecords: Number(process.env.LOG_MAX_RECORDS || 10000),
        lastError: error instanceof Error ? error.message : "failed to start core"
      },
      stop() {}
    };
  }
}

function createWindow(forceShow = false): void {
  const iconPath = resolveIconPath();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#171310",
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });

  mainWindow.on("ready-to-show", () => {
    if (forceShow || !launchHiddenOnStartup) {
      mainWindow?.show();
    }
    updateTrayMenu();
  });

  mainWindow.on("show", () => {
    updateTrayMenu();
  });

  mainWindow.on("hide", () => {
    updateTrayMenu();
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting && desktopConfig.closeToTray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    updateTrayMenu();
  });

  if (is.dev) {
    mainWindow.webContents.once("did-frame-finish-load", () => {
      mainWindow?.webContents.openDevTools({ mode: "detach", activate: true });
    });
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

const singleInstanceLock = app.requestSingleInstanceLock();

  if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });
}

function configureAutoUpdater() {
  if (!app.isPackaged) {
    return;
  }

  try {
    autoUpdater = require("electron-updater").autoUpdater as AutoUpdaterType;
  } catch (error) {
    updateState = {
      currentVersion: app.getVersion(),
      status: "unsupported",
      message: error instanceof Error ? error.message : "Failed to load auto updater."
    };
    return;
  }

  const updater = autoUpdater;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  updater.on("checking-for-update", () => {
    updateState = {
      currentVersion: app.getVersion(),
      status: "checking"
    };
  });

  updater.on("update-available", (info) => {
    updateState = {
      currentVersion: app.getVersion(),
      status: "available",
      availableVersion: info.version,
      message: info.releaseName ?? "Update available"
    };
  });

  updater.on("update-not-available", () => {
    updateState = {
      currentVersion: app.getVersion(),
      status: "not-available",
      message: "You are on the latest version."
    };
  });

  updater.on("download-progress", (progress) => {
    updateState = {
      currentVersion: app.getVersion(),
      status: "downloading",
      availableVersion: updateState.availableVersion,
      progressPercent: progress.percent,
      message: `Downloading update: ${Math.round(progress.percent)}%`
    };
  });

  updater.on("update-downloaded", (info) => {
    updateState = {
      currentVersion: app.getVersion(),
      status: "downloaded",
      downloadedVersion: info.version,
      message: "Update downloaded. Restart to install."
    };
  });

  updater.on("error", (error) => {
    updateState = {
      currentVersion: app.getVersion(),
      status: "error",
      message: error == null ? "Unknown update error" : error.message
    };
  });
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.xiaoyuandev.clash-for-ai");
  configureAutoUpdater();
  desktopConfig = loadDesktopConfig();
  launchHiddenOnStartup = shouldStartHidden();
  applyLaunchSettings();
  createTray();

  if (process.platform === "darwin" && app.dock) {
    const dockIcon = nativeImage.createFromPath(resolveIconPath());
    if (!dockIcon.isEmpty()) {
      app.dock.setIcon(dockIcon);
    }
  }

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  ipcMain.handle("app:ping", async () => ({
    ok: true,
    runtime: "desktop",
    platform: process.platform,
    apiBase: coreRuntime.state.apiBase,
    config: {
      apiPort: desktopConfig.apiPort,
      apiPortSource: configuredPortSource,
      localGatewayPort: desktopConfig.localGatewayPort,
      localGatewayPortSource: configuredLocalGatewayPortSource,
      launchAtLogin: desktopConfig.launchAtLogin,
      launchHidden: desktopConfig.launchHidden,
      closeToTray: desktopConfig.closeToTray
    },
    updates: updateState,
    core: coreRuntime.state
  }));

  ipcMain.handle("app:restart-core", async () => {
    coreRuntime.stop();
    await bootstrapCoreRuntime();
    return {
      ok: true,
      config: {
        apiPort: desktopConfig.apiPort,
        apiPortSource: configuredPortSource,
        localGatewayPort: desktopConfig.localGatewayPort,
        localGatewayPortSource: configuredLocalGatewayPortSource,
        launchAtLogin: desktopConfig.launchAtLogin,
        launchHidden: desktopConfig.launchHidden,
        closeToTray: desktopConfig.closeToTray
      },
      updates: updateState,
      core: coreRuntime.state
    };
  });

  ipcMain.handle("app:update-core-port", async (_, nextPort: number) => {
    if (process.env.ELECTRON_API_PORT) {
      throw new Error("Core port is controlled by ELECTRON_API_PORT and cannot be changed in-app.");
    }

    desktopConfig = saveDesktopConfig({
      ...desktopConfig,
      apiPort: normalizePort(Number(nextPort))
    });

    coreRuntime.stop();
    await bootstrapCoreRuntime();

    return {
      ok: true,
      config: {
        apiPort: desktopConfig.apiPort,
        apiPortSource: configuredPortSource,
        localGatewayPort: desktopConfig.localGatewayPort,
        localGatewayPortSource: configuredLocalGatewayPortSource,
        launchAtLogin: desktopConfig.launchAtLogin,
        launchHidden: desktopConfig.launchHidden,
        closeToTray: desktopConfig.closeToTray
      },
      updates: updateState,
      core: coreRuntime.state
    };
  });

  ipcMain.handle("app:update-local-gateway-port", async (_, nextPort: number) => {
    if (process.env.LOCAL_GATEWAY_RUNTIME_PORT) {
      throw new Error(
        "Local gateway port is controlled by LOCAL_GATEWAY_RUNTIME_PORT and cannot be changed in-app."
      );
    }

    desktopConfig = saveDesktopConfig({
      ...desktopConfig,
      localGatewayPort: normalizePort(Number(nextPort), 3457)
    });

    coreRuntime.stop();
    await bootstrapCoreRuntime();

    return {
      ok: true,
      config: {
        apiPort: desktopConfig.apiPort,
        apiPortSource: configuredPortSource,
        localGatewayPort: desktopConfig.localGatewayPort,
        localGatewayPortSource: configuredLocalGatewayPortSource,
        launchAtLogin: desktopConfig.launchAtLogin,
        launchHidden: desktopConfig.launchHidden,
        closeToTray: desktopConfig.closeToTray
      },
      updates: updateState,
      core: coreRuntime.state
    };
  });

  ipcMain.handle("app:copy-text", async (_, text: string) => {
    clipboard.writeText(text);
    return { ok: true };
  });

  ipcMain.handle(
    "app:update-launch-settings",
    async (_, nextSettings: { launchAtLogin?: boolean; launchHidden?: boolean; closeToTray?: boolean }) => {
      desktopConfig = saveDesktopConfig({
        ...desktopConfig,
        launchAtLogin: nextSettings.launchAtLogin ?? desktopConfig.launchAtLogin,
        launchHidden: nextSettings.launchHidden ?? desktopConfig.launchHidden,
        closeToTray: nextSettings.closeToTray ?? desktopConfig.closeToTray
      });
      applyLaunchSettings();

      return {
        ok: true,
        config: {
          apiPort: desktopConfig.apiPort,
          apiPortSource: configuredPortSource,
          localGatewayPort: desktopConfig.localGatewayPort,
          localGatewayPortSource: configuredLocalGatewayPortSource,
          launchAtLogin: desktopConfig.launchAtLogin,
          launchHidden: desktopConfig.launchHidden,
          closeToTray: desktopConfig.closeToTray
        },
        updates: updateState,
        core: coreRuntime.state
      };
    }
  );

  ipcMain.handle("tools:list", async () => listToolIntegrations(coreRuntime.state.port));

  ipcMain.handle("tools:configure", async (_, toolId: ToolIntegrationId) =>
    applyToolIntegration(toolId, coreRuntime.state.port)
  );

  ipcMain.handle("tools:restore", async (_, toolId: ToolIntegrationId) =>
    restoreToolIntegration(toolId, coreRuntime.state.port)
  );

  ipcMain.handle("tools:open-cherry-studio-import", async () => {
    const url = buildCherryStudioImportUrl(coreRuntime.state.port);
    await shell.openExternal(url);
    return { ok: true, url };
  });

  ipcMain.handle("app:check-updates", async () => {
    if (!app.isPackaged) {
      return updateState;
    }

    if (!autoUpdater) {
      return updateState;
    }

    await autoUpdater.checkForUpdates();
    return updateState;
  });

  ipcMain.handle("app:download-update", async () => {
    if (!app.isPackaged) {
      return updateState;
    }

    if (!autoUpdater) {
      return updateState;
    }

    await autoUpdater.downloadUpdate();
    return updateState;
  });

  ipcMain.handle("app:quit-and-install-update", async () => {
    if (!app.isPackaged) {
      return updateState;
    }

    if (!autoUpdater) {
      return updateState;
    }

    autoUpdater.quitAndInstall();
    return updateState;
  });

  ipcMain.handle("app:open-release-page", async () => {
    const url = resolveReleaseURL();
    await shell.openExternal(url);
    return { ok: true, url };
  });

  void bootstrapCoreRuntime()
    .finally(() => {
      isBootstrapped = true;
      createWindow();
    });

  app.on("activate", function () {
    if (isBootstrapped && BrowserWindow.getAllWindows().length === 0) createWindow(true);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  tray?.destroy();
  tray = null;
  coreRuntime?.stop();
});
