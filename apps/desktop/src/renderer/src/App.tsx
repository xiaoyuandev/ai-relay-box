import { useCallback, useEffect, useRef, useState } from "react";
import { ToastRegion, type ToastItem } from "./components/toast-region";
import { useI18n } from "./i18n/i18n-provider";
import { LogsPage } from "./pages/logs-page";
import { ModelsPage } from "./pages/models-page";
import { ProvidersPage } from "./pages/providers-page";
import { SettingsPage } from "./pages/settings-page";
import { ToolsPage } from "./pages/tools-page";
import { useTheme } from "./theme/theme-provider";
import type { Provider } from "./types/provider";
import { getRuntimeLabel } from "./utils/runtime-label";
import appIcon from "../../../build/icon.png";
import {
  appBackdropClass,
  appShellClass,
  buttonClass,
  eyebrowClass,
  glassPanelClass,
  heroClass,
  heroCopyClass,
  heroTitleClass,
  iconBadgeClass,
  inputClass,
  metaClass,
  navButtonClass,
  pageShellClass,
  sectionMetaClass,
  statusDotClass,
  statusPillClass
} from "./ui";

interface DesktopState {
  ok: boolean;
  runtime: string;
  platform: string;
  apiBase: string;
  config: {
    apiPort: number;
    apiPortSource: "default" | "config" | "env";
    localGatewayPort: number;
    localGatewayPortSource: "default" | "config" | "env";
  };
  updates: {
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
  };
  core: {
    managed: boolean;
    running: boolean;
    apiBase: string;
    port: number;
    pid?: number;
    logRetentionDays: number;
    logMaxRecords: number;
    lastError?: string;
    command?: string;
  };
}

export default function App() {
  const { locale, localeLabels, setLocale, t } = useI18n();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [desktopState, setDesktopState] = useState<DesktopState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [view, setView] = useState<"providers" | "tools" | "models" | "logs" | "settings">(
    "providers"
  );
  const [bootError, setBootError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [dismissedUpdateReminderKey, setDismissedUpdateReminderKey] = useState<string | null>(null);
  const autoUpdateCheckStartedRef = useRef(false);
  const lastUpdateToastKeyRef = useRef<string | null>(null);
  const runtimeLabel = getRuntimeLabel(desktopState?.runtime, {
    desktopApp: t("settings.value.desktopApp"),
    browser: t("settings.value.browser"),
    unknown: t("settings.value.unknown")
  });
  const navItems = [
    {
      id: "providers",
      label: t("app.nav.providers"),
      icon: (
        <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5zM6.5 7a.5.5 0 0 0-.5.5V10h12V7.5a.5.5 0 0 0-.5-.5zM18 12H6v4.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5z" />
        </svg>
      )
    },
    {
      id: "tools",
      label: t("app.nav.tools"),
      icon: (
        <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13.4 3.4a2 2 0 0 1 2.8 0l4.4 4.4a2 2 0 0 1 0 2.8l-2.1 2.1-7.2-7.2zM10.1 6.7 3 13.8V21h7.2l7.1-7.1zM6 18H5v-1l7.4-7.4 1 1z" />
        </svg>
      )
    },
    {
      id: "models",
      label: t("app.nav.models"),
      icon: (
        <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 4 7v10l8 4 8-4V7zm0 2.2L17.8 8 12 10.8 6.2 8zM6 9.6l5 2.5v6.2l-5-2.5zm7 8.7v-6.2l5-2.5v6.2z" />
        </svg>
      )
    },
    {
      id: "logs",
      label: t("app.nav.logs"),
      icon: (
        <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 5h14v2H5zm0 6h14v2H5zm0 6h9v2H5z" />
        </svg>
      )
    },
    {
      id: "settings",
      label: t("app.nav.settings"),
      icon: (
        <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m19.4 13 .1-1-.1-1 2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a8 8 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5" />
        </svg>
      )
    }
  ] as const;

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const updates = desktopState?.updates ?? null;
  const updateReminderKey =
    updates?.status === "available" && updates.availableVersion
      ? `available:${updates.availableVersion}`
      : updates?.status === "downloaded" && (updates.downloadedVersion ?? updates.availableVersion)
        ? `downloaded:${updates.downloadedVersion ?? updates.availableVersion}`
        : null;
  const showUpdateReminder =
    updateReminderKey !== null && updateReminderKey !== dismissedUpdateReminderKey;

  useEffect(() => {
    if (!window.desktopBridge) {
      return;
    }

    let cancelled = false;

    async function syncDesktopState() {
      try {
        const state = await window.desktopBridge.ping();
        if (cancelled) {
          return;
        }
        setDesktopState(state);
        setBootError(state.core.lastError ?? null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setBootError(error instanceof Error ? error.message : t("app.failedLoadState"));
      }
    }

    void syncDesktopState();
    const intervalId = window.setInterval(() => {
      void syncDesktopState();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!window.desktopBridge || !desktopState || autoUpdateCheckStartedRef.current) {
      return;
    }

    if (desktopState.updates.status === "unsupported") {
      autoUpdateCheckStartedRef.current = true;
      return;
    }

    autoUpdateCheckStartedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void window.desktopBridge.checkUpdates().catch(() => undefined);
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [desktopState]);

  useEffect(() => {
    if (!updates) {
      return;
    }

    const key =
      updates.status === "available" && updates.availableVersion
        ? `available:${updates.availableVersion}`
        : updates.status === "downloaded" && (updates.downloadedVersion ?? updates.availableVersion)
          ? `downloaded:${updates.downloadedVersion ?? updates.availableVersion}`
          : updates.status === "error" && updates.message
            ? `error:${updates.message}`
            : null;

    if (!key || key === lastUpdateToastKeyRef.current) {
      return;
    }

    lastUpdateToastKeyRef.current = key;
    setToasts((current) => [
      ...current,
      {
        id: `${Date.now()}-${key}`,
        tone: updates.status === "error" ? "error" : "default",
        message:
          updates.status === "available" && updates.availableVersion
            ? t("updates.toast.available", { version: updates.availableVersion })
            : updates.status === "downloaded"
              ? t("updates.toast.downloaded", {
                  version: updates.downloadedVersion ?? updates.availableVersion ?? ""
                })
              : t("updates.toast.error", {
                  message: updates.message ?? t("updates.status.error")
                })
      }
    ]);
  }, [t, updates]);

  async function handleCheckUpdates() {
    if (!window.desktopBridge) {
      return;
    }

    const nextUpdates = await window.desktopBridge.checkUpdates();
    setDesktopState((current) => (current ? { ...current, updates: nextUpdates } : current));
    setView("settings");
  }

  async function handleDownloadUpdate() {
    if (!window.desktopBridge) {
      return;
    }

    const nextUpdates = await window.desktopBridge.downloadUpdate();
    setDesktopState((current) => (current ? { ...current, updates: nextUpdates } : current));
  }

  async function handleQuitAndInstallUpdate() {
    if (!window.desktopBridge) {
      return;
    }

    const nextUpdates = await window.desktopBridge.quitAndInstallUpdate();
    setDesktopState((current) => (current ? { ...current, updates: nextUpdates } : current));
  }

  if (!desktopState && window.desktopBridge) {
    return (
      <main className={pageShellClass}>
        <section className={heroClass}>
          <div>
            <p className={eyebrowClass}>Clash for AI</p>
            <h1 className={heroTitleClass}>{t("app.desktopBoot")}</h1>
            <p className={heroCopyClass}>{bootError ?? t("app.waitingRuntime")}</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className={appShellClass}>
      <ToastRegion items={toasts} onDismiss={dismissToast} />
      <div className={appBackdropClass} />
      <div className="relative mx-auto flex h-screen w-full max-w-[1600px] flex-row gap-3 overflow-hidden px-3 py-3 sm:px-4 sm:py-4 xl:gap-4 xl:px-6">
        <aside
          className={`${glassPanelClass} flex h-[calc(100vh-1.5rem)] w-[248px] min-w-[248px] flex-col gap-4 overflow-y-auto px-3 py-4 sm:h-[calc(100vh-2rem)] sm:w-[260px] sm:min-w-[260px] sm:px-4 xl:h-[calc(100vh-3rem)]`}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <img
                src={appIcon}
                alt="Clash for AI"
                className="h-11 w-11 rounded-xl shadow-[0_10px_22px_rgba(15,23,42,0.16)]"
              />
              <div className="min-w-0">
                <p className={`${eyebrowClass} mb-1`}>AI Gateway</p>
                <h2 className="truncate bg-[linear-gradient(135deg,var(--accent-strong),#a5f3fc)] bg-clip-text text-[24px] font-semibold tracking-[-0.05em] text-transparent">
                  Clash for AI
                </h2>
              </div>
            </div>
            <p className={metaClass}>
              {selectedProvider
                ? t("app.currentProvider", { name: selectedProvider.name })
                : t("app.selectProviderHint")}
            </p>
          </div>

          <nav className="grid gap-2">
            {navItems.map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                className={navButtonClass(view === id)}
                onClick={() => {
                  setView(id as typeof view);
                }}
              >
                <span className="flex items-center gap-3">
                  <span className={iconBadgeClass}>{icon}</span>
                  <span>{label}</span>
                </span>
              </button>
            ))}
          </nav>

          <div className="grid gap-2 rounded-[16px] border [border-color:var(--border-soft)] [background:var(--panel-solid)] p-2.5">
            <div className="flex items-center justify-between gap-3">
              <label className="min-w-0 flex-1">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-subtle)]">
                  {t("app.language")}
                </span>
                <select
                  className={inputClass}
                  value={locale}
                  onChange={(event) => setLocale(event.target.value as typeof locale)}
                >
                  {Object.entries(localeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="shrink-0">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-subtle)]">
                  {t("app.theme")}
                </span>
                <button
                  type="button"
                  className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-xl border [border-color:var(--border-soft)] [background:var(--panel-solid)] text-[color:var(--color-text)] transition hover:[border-color:var(--border-strong)] hover:[background:var(--panel-soft)]"
                  onClick={() => toggleTheme()}
                  aria-label={resolvedTheme === "dark" ? t("app.themeLight") : t("app.themeDark")}
                  title={resolvedTheme === "dark" ? t("app.themeLight") : t("app.themeDark")}
                >
                  {resolvedTheme === "dark" ? (
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6.8 5.4 5.4 4l-1.4 1.4 1.4 1.4zM12 2h-1v3h2V2zm6.6 3.4L20 4l-1.4-1.4-1.4 1.4zM19 11v2h3v-2zm-7 10h1v-3h-2v3zm6.6-2.4 1.4 1.4 1.4-1.4-1.4-1.4zM2 11v2h3v-2zm3.4 7.6L4 20l1.4 1.4 1.4-1.4zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M20 14.2A8 8 0 0 1 9.8 4 8 8 0 1 0 20 14.2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-auto grid gap-3">
            {updates && showUpdateReminder ? (
              <div className="rounded-[16px] border [border-color:var(--success-border)] [background:var(--panel-solid)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-[color:var(--color-text)]">
                      <span className={statusDotClass("warning")} />
                      {updates.status === "downloaded"
                        ? t("updates.card.installReady")
                        : t("updates.card.availableCompact")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-lg text-[color:var(--color-subtle)] transition hover:[background:var(--panel-soft)] hover:text-[color:var(--color-text)]"
                    onClick={() => setDismissedUpdateReminderKey(updateReminderKey)}
                    aria-label={t("common.close")}
                    title={t("common.close")}
                  >
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" />
                    </svg>
                  </button>
                </div>
                <div className="mt-2">
                  <button
                    type="button"
                    className={buttonClass(updates.status === "downloaded" ? "primary" : "secondary")}
                    onClick={() =>
                      void (updates.status === "downloaded"
                        ? handleQuitAndInstallUpdate()
                        : handleDownloadUpdate())
                    }
                  >
                    {updates.status === "downloaded"
                      ? t("settings.button.installUpdate")
                      : t("settings.button.downloadUpdate")}
                  </button>
                </div>
              </div>
            ) : null}
            <span
              className={statusPillClass(
                desktopState?.core.running ? "success" : "danger"
              )}
            >
              {t("app.runtimeChip", {
                status: desktopState?.core.running ? t("app.coreRunning") : t("app.coreStopped"),
                port: desktopState?.core.port ?? "-"
              })}
            </span>
            <div className="rounded-[16px] border [border-color:var(--border-soft)] [background:var(--panel-solid)] p-3.5">
              <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-subtle)]">
                <span
                  className={statusDotClass(
                    desktopState?.core.running ? "success" : "danger"
                  )}
                />
                Runtime
              </p>
              <p className="text-sm text-[color:var(--color-text)]">
                {runtimeLabel} · {desktopState?.platform ?? "-"}
              </p>
              <p className={sectionMetaClass}>{desktopState?.apiBase ?? "-"}</p>
            </div>
          </div>
        </aside>

        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {view === "providers" ? (
            <ProvidersPage
              desktopState={desktopState}
              apiBase={desktopState?.apiBase}
              selectedProviderId={selectedProvider?.id ?? null}
              onSelectedProviderChange={setSelectedProvider}
            />
          ) : view === "models" ? (
            <ModelsPage apiBase={desktopState?.apiBase} />
          ) : view === "tools" ? (
            <ToolsPage
              desktopState={desktopState}
              onCopyText={async (text) => {
                if (!window.desktopBridge) {
                  return;
                }

                await window.desktopBridge.copyText(text);
              }}
            />
          ) : view === "logs" ? (
            <LogsPage apiBase={desktopState?.apiBase} />
          ) : (
            <SettingsPage
              desktopState={desktopState}
              onUpdateCorePort={async (port) => {
                if (!window.desktopBridge) {
                  return;
                }

                const response = await window.desktopBridge.updateCorePort(port);
                setDesktopState((current) =>
                  current
                    ? {
                        ...current,
                        config: response.config,
                        updates: response.updates,
                        apiBase: response.core.apiBase,
                        core: response.core
                      }
                    : null
                );
              }}
              onUpdateLocalGatewayPort={async (port) => {
                if (!window.desktopBridge) {
                  return;
                }

                const response = await window.desktopBridge.updateLocalGatewayPort(port);
                setDesktopState((current) =>
                  current
                    ? {
                        ...current,
                        config: response.config,
                        updates: response.updates,
                        apiBase: response.core.apiBase,
                        core: response.core
                      }
                    : null
                );
              }}
              onCheckUpdates={async () => {
                await handleCheckUpdates();
              }}
              onDownloadUpdate={async () => {
                await handleDownloadUpdate();
              }}
              onQuitAndInstallUpdate={async () => {
                await handleQuitAndInstallUpdate();
              }}
              onCoreRestart={async () => {
                if (!window.desktopBridge) {
                  return;
                }

                const response = await window.desktopBridge.restartCore();
                setDesktopState((current) =>
                  current
                    ? {
                        ...current,
                        config: response.config,
                        updates: response.updates,
                        apiBase: response.core.apiBase,
                        core: response.core
                      }
                    : null
                );
              }}
            />
          )}
        </section>
      </div>
    </div>
  );
}
