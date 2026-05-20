"use client";

import { useState } from "react";
import { Loader2, Mail, Palette, RotateCw, Save, Server, Type } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import type { DriveSettings } from "@/lib/settings";

export function AdminSettingsClient({
  initialSettings,
  emailStatus,
  systemInfo,
}: {
  initialSettings: DriveSettings;
  emailStatus: { from: string; appUrl: string; resendApiKey: string };
  systemInfo: {
    assetRoot: string;
    cacheRoot: string;
    previewRoot: string;
    thumbnailRoot: string;
    downloadBaseUrl: string;
  };
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [to, setTo] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok && data.ok) {
      setSettings(data.settings);
      setNotice("Settings saved.");
    } else {
      setNotice(data.message || "Save failed.");
    }
  }

  async function sendTest() {
    setLoading(true);
    const res = await fetch("/api/admin/settings/email-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    setNotice(res.ok && data.ok ? "Test email sent." : data.message || "Test email failed.");
  }

  async function previewAction(endpoint: string, success: string) {
    setLoading(true);
    const res = await fetch(endpoint, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    setNotice(res.ok && data.ok ? success : data.message || "Action failed.");
  }

  return (
    <AdminShell title="Settings" subtitle="System, branding, email, storage, and preview cache settings.">
      <div className="mx-auto max-w-5xl space-y-4">
        {notice ? <p className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">{notice}</p> : null}

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-[#d7ff3f]" />
              <h2 className="font-semibold">Appearance</h2>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(["dark", "light", "system"] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => setSettings({ ...settings, appearance: { theme } })}
                  className={`rounded-2xl border px-3 py-3 text-sm font-bold capitalize ${settings.appearance.theme === theme ? "border-[#d7ff3f] bg-[#d7ff3f]/10 text-[#d7ff3f]" : "border-white/10 text-zinc-300 hover:bg-white/10"}`}
                >
                  {theme}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500">Dark remains the default. Light/system are stored and ready for global theme rollout.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <Type className="h-5 w-5 text-[#d7ff3f]" />
              <h2 className="font-semibold">Language</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ["en", "English"],
                ["id", "Indonesian"],
              ].map(([locale, label]) => (
                <button
                  key={locale}
                  onClick={() => setSettings({ ...settings, language: { locale: locale as DriveSettings["language"]["locale"] } })}
                  className={`rounded-2xl border px-3 py-3 text-sm font-bold ${settings.language.locale === locale ? "border-[#d7ff3f] bg-[#d7ff3f]/10 text-[#d7ff3f]" : "border-white/10 text-zinc-300 hover:bg-white/10"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-[#d7ff3f]" />
            <h2 className="font-semibold">Brand & Storage</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block text-sm text-zinc-300">
              App name
              <input value={settings.brand.appName} onChange={(event) => setSettings({ ...settings, brand: { ...settings.brand, appName: event.target.value } })} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-[#d7ff3f]" />
            </label>
            <label className="block text-sm text-zinc-300">
              Label
              <input value={settings.brand.label} onChange={(event) => setSettings({ ...settings, brand: { ...settings.brand, label: event.target.value } })} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-[#d7ff3f]" />
            </label>
            <Readonly label="ASSET_ROOT" value={systemInfo.assetRoot} />
            <Readonly label="CACHE_ROOT" value={systemInfo.cacheRoot} />
            <Readonly label="PREVIEW_ROOT" value={systemInfo.previewRoot} />
            <Readonly label="THUMBNAIL_ROOT" value={systemInfo.thumbnailRoot} />
            <label className="block text-sm text-zinc-300 md:col-span-2">
              DOWNLOAD_BASE_URL
              <input value={settings.storage.downloadBaseUrl || systemInfo.downloadBaseUrl} onChange={(event) => setSettings({ ...settings, storage: { ...settings.storage, downloadBaseUrl: event.target.value } })} placeholder="optional direct download base URL" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-[#d7ff3f]" />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#d7ff3f]" />
            <h2 className="font-semibold">Email / Resend</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Readonly label="RESEND_FROM" value={emailStatus.from} />
            <Readonly label="APP_URL" value={emailStatus.appUrl} />
            <Readonly label="RESEND_API_KEY" value={emailStatus.resendApiKey} />
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={to} onChange={(event) => setTo(event.target.value)} placeholder="recipient@example.com" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#d7ff3f]" />
            <button onClick={sendTest} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send test email
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2">
            <RotateCw className="h-5 w-5 text-[#d7ff3f]" />
            <h2 className="font-semibold">Preview Cache</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
              Auto Cache
              <input type="checkbox" checked={settings.previewCache.autoEnabled} onChange={(event) => setSettings({ ...settings, previewCache: { ...settings.previewCache, autoEnabled: event.target.checked } })} />
            </label>
            <label className="block text-sm text-zinc-300">
              Interval
              <select value={settings.previewCache.intervalHours} onChange={(event) => setSettings({ ...settings, previewCache: { ...settings.previewCache, intervalHours: Number(event.target.value) as DriveSettings["previewCache"]["intervalHours"] } })} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none">
                {[1, 3, 6, 12, 24].map((hours) => <option key={hours} value={hours}>Every {hours} hour{hours > 1 ? "s" : ""}</option>)}
              </select>
            </label>
            <label className="block text-sm text-zinc-300">
              Target folder
              <input value={settings.previewCache.targetPath} onChange={(event) => setSettings({ ...settings, previewCache: { ...settings.previewCache, targetPath: event.target.value } })} placeholder="empty = full ASSET_ROOT" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none" />
            </label>
            <label className="block text-sm text-zinc-300">
              Max concurrent jobs
              <input type="number" min={1} max={8} value={settings.previewCache.maxConcurrentJobs} onChange={(event) => setSettings({ ...settings, previewCache: { ...settings.previewCache, maxConcurrentJobs: Number(event.target.value) } })} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none" />
            </label>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
            <span>Last scan: {settings.previewCache.lastScanAt || "-"}</span>
            <span>Next scan: {settings.previewCache.nextScanAt || "-"}</span>
            <span>Status: {settings.previewCache.running ? "running" : "idle"}</span>
          </div>
          <p className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-500">
            Auto cache scheduler foundation ready. Use Run Scan Now for an immediate background scan.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={save} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-[#d7ff3f] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
              <Save className="h-4 w-4" />
              Save settings
            </button>
            <button onClick={() => previewAction("/api/admin/preview/scan-now", "Scan started.")} disabled={loading} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-50">
              Run Scan Now
            </button>
            <button onClick={() => previewAction("/api/admin/preview/stop", "Stop requested.")} disabled={loading} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-50">
              Stop Current Scan
            </button>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function Readonly({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 break-all text-sm font-medium text-white">{value}</p>
    </div>
  );
}
