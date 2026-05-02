import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface DesktopConfig {
  apiPort: number;
  localGatewayPort: number;
}

export type PortSource = "default" | "config" | "env";

export interface CoreProcessRecord {
  pid: number;
  port: number;
  apiBase: string;
  command: string;
  managedByApp: boolean;
  recordedAt: string;
}

const DEFAULT_CONFIG: DesktopConfig = {
  apiPort: 3456,
  localGatewayPort: 3457
};

export function loadDesktopConfig(): DesktopConfig {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<DesktopConfig>;

    return {
      apiPort: normalizePort(parsed.apiPort, DEFAULT_CONFIG.apiPort),
      localGatewayPort: normalizePort(parsed.localGatewayPort, DEFAULT_CONFIG.localGatewayPort)
    };
  } catch (error) {
    console.error("[desktop-config] failed to read config:", error);
    return DEFAULT_CONFIG;
  }
}

export function saveDesktopConfig(nextConfig: DesktopConfig): DesktopConfig {
  const normalized: DesktopConfig = {
    apiPort: normalizePort(nextConfig.apiPort, DEFAULT_CONFIG.apiPort),
    localGatewayPort: normalizePort(
      nextConfig.localGatewayPort,
      DEFAULT_CONFIG.localGatewayPort
    )
  };

  mkdirSync(app.getPath("userData"), { recursive: true });
  writeFileSync(getConfigPath(), JSON.stringify(normalized, null, 2));
  return normalized;
}

export function resolveConfiguredPort(config: DesktopConfig): {
  port: number;
  source: PortSource;
} {
  return resolvePortSetting(process.env.ELECTRON_API_PORT, config.apiPort, DEFAULT_CONFIG.apiPort);
}

export function resolveConfiguredLocalGatewayPort(config: DesktopConfig): {
  port: number;
  source: PortSource;
} {
  return resolvePortSetting(
    process.env.LOCAL_GATEWAY_RUNTIME_PORT,
    config.localGatewayPort,
    DEFAULT_CONFIG.localGatewayPort
  );
}

function resolvePortSetting(
  envValue: string | undefined,
  configPort: number,
  defaultPort: number
): { port: number; source: PortSource } {
  if (envValue) {
    return {
      port: normalizePort(Number(envValue), configPort),
      source: "env"
    };
  }

  if (configPort !== defaultPort) {
    return {
      port: configPort,
      source: "config"
    };
  }

  return {
    port: defaultPort,
    source: "default"
  };
}

export function normalizePort(value: number | undefined, fallback = DEFAULT_CONFIG.apiPort) {
  if (!Number.isInteger(value) || value == null || value < 1 || value > 65535) {
    return fallback;
  }

  return value;
}

function getConfigPath() {
  return join(app.getPath("userData"), "desktop-config.json");
}

export function loadCoreProcessRecord(): CoreProcessRecord | null {
  const recordPath = getCoreProcessRecordPath();

  if (!existsSync(recordPath)) {
    return null;
  }

  try {
    const raw = readFileSync(recordPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<CoreProcessRecord>;

    if (
      !Number.isInteger(parsed.pid) ||
      !Number.isInteger(parsed.port) ||
      typeof parsed.apiBase !== "string" ||
      typeof parsed.command !== "string"
    ) {
      return null;
    }

    return {
      pid: Number(parsed.pid),
      port: Number(parsed.port),
      apiBase: parsed.apiBase,
      command: parsed.command,
      managedByApp: Boolean(parsed.managedByApp),
      recordedAt:
        typeof parsed.recordedAt === "string" ? parsed.recordedAt : new Date().toISOString()
    };
  } catch (error) {
    console.error("[desktop-config] failed to read core record:", error);
    return null;
  }
}

export function saveCoreProcessRecord(record: CoreProcessRecord) {
  mkdirSync(app.getPath("userData"), { recursive: true });
  writeFileSync(getCoreProcessRecordPath(), JSON.stringify(record, null, 2));
}

export function clearCoreProcessRecord() {
  const recordPath = getCoreProcessRecordPath();

  if (!existsSync(recordPath)) {
    return;
  }

  try {
    rmSync(recordPath);
  } catch (error) {
    console.error("[desktop-config] failed to clear core record:", error);
  }
}

function getCoreProcessRecordPath() {
  return join(app.getPath("userData"), "core-process.json");
}
