"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, ExternalLink, Globe, GitBranch, Rocket, X } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useProjectStore } from "@/lib/store/project-store";
import { toast } from "@/lib/toast";

interface DnsRecord { type: string; name: string; value: string; note: string }
interface Status {
  published: boolean;
  slug?: string;
  url?: string;
  path_url?: string;
  published_at?: string | null;
  files?: number;
  warnings?: string[];
  custom_domain?: { domain: string; verified: boolean; records: DnsRecord[]; https: string } | null;
  message?: string;
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "my-site";
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={() => { void navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
    >
      {done ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

/** One-click publish to a VIBE address, plus connecting your own domain. */
export function PublishModal({ onClose, onGithub }: { onClose: () => void; onGithub: () => void }) {
  const project = useProjectStore((s) => s.project);
  const [status, setStatus] = useState<Status | null>(null);
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [domain, setDomain] = useState("");
  const [verifyMsg, setVerifyMsg] = useState("");

  useEffect(() => {
    if (!project) return;
    api.get<Status>(`publish/${project.id}`).then((s) => { setStatus(s); setSlug(s.slug || slugify(project.name)); }).catch(() => setStatus({ published: false }));
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return null;
  const projectId = project.id;
  const host = status?.url ? new URL(status.url).host.split(".").slice(1).join(".") : "vibe.localhost:8000";

  async function publish() {
    setBusy(true);
    try {
      const p = useProjectStore.getState().project!;
      await api.put(`projects/${projectId}/sync`, { name: p.name, theme: p.theme, pages: p.pages }); // publish exactly what is on screen
      const s = await api.post<Status>(`publish/${projectId}`, { slug });
      setStatus(s);
      toast(status?.published ? "Your site is updated." : "Your site is live.");
    } catch (e) {
      toast(e instanceof ApiError ? String(e.detail) : "Couldn't publish. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!confirm("Take this site offline? Visitors will see a 404. You can publish again any time.")) return;
    await api.delete(`publish/${projectId}`);
    setStatus({ published: false });
    toast("Your site is offline.");
  }

  async function addDomain() {
    try {
      setStatus(await api.post<Status>(`publish/${projectId}/domain`, { domain }));
      setDomain("");
    } catch (e) {
      toast(e instanceof ApiError ? String(e.detail) : "Couldn't add that domain.");
    }
  }

  async function verify() {
    setBusy(true);
    try {
      const s = await api.post<Status>(`publish/${projectId}/domain/verify`);
      setStatus(s);
      setVerifyMsg(s.message || "");
    } finally {
      setBusy(false);
    }
  }

  async function removeDomain() {
    await api.delete(`publish/${projectId}/domain`);
    setStatus(await api.get<Status>(`publish/${projectId}`));
    setVerifyMsg("");
  }

  const live = status?.published;
  return createPortal(
    <div className="fixed inset-0 z-[2000] grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Publish your site" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white text-slate-900 shadow-2xl">
        <div className="flex items-center gap-4 border-b border-slate-100 px-7 py-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#6b4d9a] to-[#ff5b7f] text-white"><Rocket className="h-5 w-5" /></span>
          <div className="flex-1">
            <h2 className="text-lg font-extrabold">Publish your site</h2>
            <p className="text-sm text-slate-500">One click puts it on the web. No servers to set up.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-7 px-7 py-6">
          {live && status?.url && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-800"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Live</div>
              <div className="mt-2 flex items-center gap-2">
                <a href={status.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[15px] font-semibold text-emerald-900 underline-offset-2 hover:underline">{status.url}</a>
                <CopyButton value={status.url} label="site address" />
                <a href={status.url} target="_blank" rel="noreferrer" aria-label="Open the site" className="grid h-8 w-8 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-100"><ExternalLink className="h-4 w-4" /></a>
              </div>
              {status.published_at && <p className="mt-1 text-xs text-emerald-800/70">Last published {new Date(status.published_at.endsWith("Z") ? status.published_at : status.published_at + "Z").toLocaleString()} · {status.files} files</p>}
            </div>
          )}

          <section>
            <label className="text-sm font-bold" htmlFor="site-address">Site address</label>
            <div className="mt-2 flex items-stretch overflow-hidden rounded-xl border border-slate-200 focus-within:border-[#6b4d9a] focus-within:ring-4 focus-within:ring-[#6b4d9a]/10">
              <span className="grid place-items-center bg-slate-50 px-3 text-sm text-slate-400">http://</span>
              <input id="site-address" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} className="min-w-0 flex-1 px-2 py-3 text-sm font-semibold outline-none" />
              <span className="grid place-items-center bg-slate-50 px-3 text-sm text-slate-400">.{host}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={() => void publish()} disabled={busy || slug.length < 3} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#6b4d9a] px-6 text-sm font-bold text-white shadow-[0_8px_24px_rgba(107,77,154,0.35)] transition hover:bg-[#5a3f86] disabled:opacity-50">
                <Rocket className="h-4 w-4" /> {busy ? "Publishing…" : live ? "Publish changes" : "Publish now"}
              </button>
              {live && <button onClick={() => void unpublish()} className="h-11 rounded-full px-4 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-rose-600">Take offline</button>}
            </div>
            {status?.warnings && status.warnings.length > 0 && (
              <ul className="mt-4 space-y-1.5 rounded-xl bg-amber-50 p-4 text-[13px] text-amber-900">
                {status.warnings.map((w) => <li key={w}>• {w}</li>)}
              </ul>
            )}
          </section>

          <section className="border-t border-slate-100 pt-6">
            <div className="flex items-center gap-2 text-sm font-bold"><Globe className="h-4 w-4 text-[#6b4d9a]" /> Your own domain</div>
            {!live && <p className="mt-2 text-sm text-slate-500">Publish first, then connect a domain such as www.yourbrand.com.</p>}
            {live && !status?.custom_domain && (
              <div className="mt-3 flex gap-2">
                <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="www.yourbrand.com" aria-label="Custom domain" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#6b4d9a] focus:ring-4 focus:ring-[#6b4d9a]/10" />
                <button onClick={() => void addDomain()} disabled={domain.trim().length < 4} className="rounded-xl border border-slate-200 px-5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">Connect</button>
              </div>
            )}
            {status?.custom_domain && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-semibold">{status.custom_domain.domain}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.custom_domain.verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{status.custom_domain.verified ? "Connected" : "Waiting for DNS"}</span>
                </div>
                {!status.custom_domain.verified && (
                  <>
                    <p className="text-sm text-slate-500">Add these two records at your domain provider, then press Verify. DNS can take a few minutes to an hour.</p>
                    <div className="overflow-hidden rounded-xl border border-slate-200 text-[13px]">
                      {status.custom_domain.records.map((r) => (
                        <div key={r.type} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                          <span className="w-14 shrink-0 rounded-md bg-slate-100 px-2 py-1 text-center text-xs font-bold">{r.type}</span>
                          <div className="min-w-0 flex-1"><div className="truncate font-mono text-xs text-slate-500">{r.name}</div><div className="truncate font-mono text-[13px] font-semibold">{r.value}</div></div>
                          <CopyButton value={r.value} label={`${r.type} value`} />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400">{status.custom_domain.https}</p>
                    {verifyMsg && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{verifyMsg}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => void verify()} disabled={busy} className="rounded-full bg-[#6b4d9a] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#5a3f86] disabled:opacity-50">{busy ? "Checking…" : "Verify"}</button>
                      <button onClick={() => void removeDomain()} className="rounded-full px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">Remove</button>
                    </div>
                  </>
                )}
                {status.custom_domain.verified && <button onClick={() => void removeDomain()} className="text-sm font-semibold text-slate-500 hover:text-rose-600">Disconnect this domain</button>}
              </div>
            )}
          </section>

          <section className="flex items-center justify-between gap-4 border-t border-slate-100 pt-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold"><GitBranch className="h-4 w-4 text-[#6b4d9a]" /> Keep the code on GitHub</div>
              <p className="mt-1 text-sm text-slate-500">Push the generated project to a repository so your team can work on it.</p>
            </div>
            <button onClick={() => { onClose(); onGithub(); }} className="shrink-0 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold hover:bg-slate-50">Push to GitHub</button>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
