import { useEffect, useState } from "react";
import { useI18n } from "./i18n/i18n-provider";
import { LogsPage } from "./pages/logs-page";
import { ModelsPage } from "./pages/models-page";
import { ProvidersPage } from "./pages/providers-page";
import { SettingsPage } from "./pages/settings-page";
import { useTheme } from "./theme/theme-provider";
import type { Provider } from "./types/provider";
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
  labelClass,
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
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [desktopState, setDesktopState] = useState<DesktopState | null>(null);
  const [view, setView] = useState<"providers" | "models" | "logs" | "settings">("providers");
  const [bootError, setBootError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
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
      <div className={appBackdropClass} />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1680px] flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 xl:flex-row xl:gap-6 xl:px-8">
        <aside
          className={`${glassPanelClass} flex w-full flex-col gap-5 px-4 py-5 sm:px-5 xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)] xl:w-[290px] xl:min-w-[290px] xl:self-start xl:overflow-y-auto`}
        >
          <div className="space-y-3">
            <p className={eyebrowClass}>Clash for AI</p>
            <div className="space-y-2">
              <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-[color:var(--color-heading)]">
                {t("app.desktopGateway")}
              </h2>
              <p className={metaClass}>
                {selectedProvider
                  ? t("app.currentProvider", { name: selectedProvider.name })
                  : t("app.selectProviderHint")}
              </p>
            </div>
          </div>

          <nav className="grid gap-2">
            {navItems.map(({ id, label, icon }, index) => (
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
                <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-subtle)]">
                  0{index + 1}
                </span>
              </button>
            ))}
          </nav>

          <div className="grid gap-2 rounded-3xl border [border-color:var(--border-soft)] [background:var(--panel-solid)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-subtle)]">
              {t("app.theme")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className={buttonClass(theme === "system" ? "primary" : "secondary")}
                onClick={() => setTheme("system")}
              >
                {t("app.themeSystem")}
              </button>
              <button
                type="button"
                className={buttonClass(theme === "light" ? "primary" : "secondary")}
                onClick={() => setTheme("light")}
              >
                {t("app.themeLight")}
              </button>
              <button
                type="button"
                className={buttonClass(theme === "dark" ? "primary" : "secondary")}
                onClick={() => setTheme("dark")}
              >
                {t("app.themeDark")}
              </button>
            </div>
            <p className="text-xs text-[color:var(--color-muted)]">
              {theme === "system"
                ? t("app.themeSystemHint", {
                    theme: resolvedTheme === "dark" ? t("app.themeDark") : t("app.themeLight")
                  })
                : t("app.themeActive", {
                    theme: theme === "dark" ? t("app.themeDark") : t("app.themeLight")
                  })}
            </p>
          </div>

          <label className={labelClass}>
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-subtle)]">
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

          <div className="mt-auto grid gap-3">
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
            <div className="rounded-3xl border [border-color:var(--border-soft)] [background:var(--panel-solid)] p-4">
              <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-subtle)]">
                <span
                  className={statusDotClass(
                    desktopState?.core.running ? "success" : "danger"
                  )}
                />
                Runtime
              </p>
              <p className="text-sm text-[color:var(--color-text)]">
                {desktopState?.runtime ?? "-"} · {desktopState?.platform ?? "-"}
              </p>
              <p className={sectionMetaClass}>{desktopState?.apiBase ?? "-"}</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          {view === "providers" ? (
            <ProvidersPage
              desktopState={desktopState}
              apiBase={desktopState?.apiBase}
              selectedProviderId={selectedProvider?.id ?? null}
              onSelectedProviderChange={setSelectedProvider}
            />
          ) : view === "models" ? (
            <ModelsPage
              apiBase={desktopState?.apiBase}
              selectedProvider={selectedProvider}
              onSelectedProviderChange={setSelectedProvider}
            />
          ) : view === "logs" ? (
            <LogsPage apiBase={desktopState?.apiBase} />
          ) : (
            <SettingsPage
              desktopState={desktopState}
              onCopyText={async (text) => {
                if (!window.desktopBridge) {
                  return;
                }

                await window.desktopBridge.copyText(text);
              }}
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
              onCheckUpdates={async () => {
                if (!window.desktopBridge) {
                  return;
                }

                const updates = await window.desktopBridge.checkUpdates();
                setDesktopState((current) => (current ? { ...current, updates } : current));
              }}
              onDownloadUpdate={async () => {
                if (!window.desktopBridge) {
                  return;
                }

                const updates = await window.desktopBridge.downloadUpdate();
                setDesktopState((current) => (current ? { ...current, updates } : current));
              }}
              onQuitAndInstallUpdate={async () => {
                if (!window.desktopBridge) {
                  return;
                }

                const updates = await window.desktopBridge.quitAndInstallUpdate();
                setDesktopState((current) => (current ? { ...current, updates } : current));
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
