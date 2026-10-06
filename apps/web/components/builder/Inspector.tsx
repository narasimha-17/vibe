"use client";

import { useState } from "react";
import { useProjectStore, useSelectedNode } from "@/lib/store/project-store";
import { getByPath } from "@/lib/registry/types";
import type { EditableField } from "@/lib/registry/types";
import { REGISTRY } from "@/lib/registry";
import { api } from "@/lib/api-client";
import type { Asset } from "@/lib/types";
import { toast } from "@/lib/toast";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";

function TextField({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div className="field">
      <label className="label-field">{label}</label>
      {multiline ? (
        <textarea className="input-field" rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input-field" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}


const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Upload-or-paste image field. Stores a public URL string. */
function ImageField({ label, value, onChange, compact }: { label?: string; value: string; onChange: (v: string) => void; compact?: boolean }) {
  const project = useProjectStore((s) => s.project);
  const [busy, setBusy] = useState(false);

  /** Clears the image and, when no other section uses it, deletes the uploaded file too. */
  async function remove() {
    const url = value;
    onChange("");
    if (!project || !url) return;
    const uses = JSON.stringify(project.pages).split(url).length - 1;
    if (uses > 1) return; // still used elsewhere
    try {
      const assets = await api.get<Asset[]>(`projects/${project.id}/assets`);
      const hit = assets.find((a) => url.endsWith(a.url));
      if (hit) await api.delete(`projects/${project.id}/assets/${hit.id}`);
    } catch {
      /* the reference is already cleared; a leftover file is harmless */
    }
  }

  async function upload(file: File) {
    if (!project) return;
    setBusy(true);
    try {
      const asset = await api.upload<Asset>(`projects/${project.id}/assets`, file, { folder: "/images" });
      onChange(`${API_BASE}${asset.url}`);
      toast("Image added.");
    } catch {
      toast("Could not upload that image (PNG, JPG, WebP or GIF).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "" : "field"}>
      {label && <label className="label-field">{label}</label>}
      {value ? (
        <div className="relative mb-2 overflow-hidden rounded-lg border border-border-light">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-24 w-full object-cover" />
          <button type="button" onClick={() => void remove()} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80" aria-label="Remove image" title="Remove image">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <label className="btn w-full cursor-pointer justify-center text-xs">
        <ImagePlus className="h-4 w-4" /> {busy ? "Uploading…" : value ? "Replace image" : "Upload image"}
        <input
          type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.currentTarget.value = "";
          }}
        />
      </label>
      <input className="input-field mt-2" placeholder="…or paste an image URL" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Upload-or-paste video field (mp4 / webm). */
function VideoField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const project = useProjectStore((s) => s.project);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (!project) return;
    setBusy(true);
    try {
      const asset = await api.upload<Asset>(`projects/${project.id}/assets`, file, { folder: "/videos" });
      onChange(`${API_BASE}${asset.url}`);
      toast("Video added.");
    } catch {
      toast("Could not upload that video (MP4 or WebM, up to 60MB).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <label className="label-field">{label}</label>
      {value ? (
        <div className="relative mb-2 overflow-hidden rounded-lg border border-border-light bg-black">
          <video src={value} muted loop playsInline autoPlay className="h-24 w-full object-cover" />
          <button type="button" onClick={() => onChange("")} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80" aria-label="Remove video">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <label className="btn w-full cursor-pointer justify-center text-xs">
        <ImagePlus className="h-4 w-4" /> {busy ? "Uploading…" : value ? "Replace video" : "Upload video"}
        <input
          type="file" accept="video/mp4,video/webm" className="hidden" disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.currentTarget.value = "";
          }}
        />
      </label>
      <input className="input-field mt-2" placeholder="…or paste a video URL (.mp4 / .webm)" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value || "#6b4d9a"} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-border-light bg-transparent p-0.5" aria-label={label} />
      <span className="flex-1 text-xs text-muted">{label}: {value || "theme default"}</span>
      {value && (
        <button type="button" onClick={() => onChange("")} className="text-[11px] font-semibold text-primary hover:underline">Reset</button>
      )}
    </div>
  );
}

function ArrayField({ field, value, onChange }: { field: EditableField; value: any[]; onChange: (v: any[]) => void }) {
  const items = value || [];
  const isSimple = field.itemFields?.length === 1 && field.itemFields[0].path === "";

  function update(idx: number, next: any) {
    const copy = [...items];
    copy[idx] = next;
    onChange(copy);
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }
  function add() {
    if (isSimple) onChange([...items, ""]);
    else {
      const blank: Record<string, string> = {};
      for (const f of field.itemFields || []) blank[f.path] = f.type === "select" ? f.options?.[0] || "" : "";
      onChange([...items, blank]);
    }
  }

  return (
    <div className="field">
      <label className="label-field">{field.label}</label>
      <div className="flex flex-col gap-2">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-lg border border-border-light bg-app p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted">
                {field.itemLabel} {idx + 1}
              </span>
              <button className="inline-flex items-center gap-1 text-xs text-muted hover:text-red-400" onClick={() => remove(idx)}>
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
            {isSimple ? (
              <input className="input-field" value={item} onChange={(e) => update(idx, e.target.value)} />
            ) : (
              <div className="flex flex-col gap-2">
                {(field.itemFields || []).map((f) =>
                  f.type === "image" ? (
                    <ImageField key={f.key} label={f.label} compact value={item[f.path] ?? ""} onChange={(v) => update(idx, { ...item, [f.path]: v })} />
                  ) : f.type === "select" ? (
                    <select
                      key={f.key}
                      className="input-field"
                      value={item[f.path] || f.options?.[0] || ""}
                      onChange={(e) => update(idx, { ...item, [f.path]: e.target.value })}
                      aria-label={f.label}
                    >
                      {(f.options || []).map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : f.type === "color" ? (
                    <ColorInput key={f.key} label={f.label} value={item[f.path] ?? ""} onChange={(v) => update(idx, { ...item, [f.path]: v })} />
                  ) : (
                    <input
                      key={f.key}
                      className="input-field"
                      placeholder={f.label}
                      value={item[f.path] ?? ""}
                      onChange={(e) => update(idx, { ...item, [f.path]: e.target.value })}
                    />
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <button className="btn mt-2 w-full justify-center" onClick={add}>
        <Plus className="h-4 w-4" /> Add {field.itemLabel}
      </button>
    </div>
  );
}

function ComponentInspector() {
  const node = useSelectedNode();
  const project = useProjectStore((s) => s.project);
  const updateNodeField = useProjectStore((s) => s.updateNodeField);
  const renameNode = useProjectStore((s) => s.renameNode);

  if (!node) {
    return <p className="p-5 text-sm text-muted">Select a section on the canvas to edit its content.</p>;
  }

  const def = REGISTRY[node.type];
  const custom = node.props?.custom as { html: string; css: string; description?: string } | undefined;

  /** A custom (AI-designed) section stores its own static HTML, so the normal per-field editors below have no effect
   * on it. Swap the first <img> it has for a newly uploaded one, directly in that HTML. */
  async function replaceCustomImage(file: File) {
    if (!project || !node || !custom) return;
    try {
      const asset = await api.upload<Asset>(`projects/${project.id}/assets`, file, { folder: "/sections" });
      const hasImg = /<img\b[^>]*\bsrc="[^"]*"/i.test(custom.html);
      const html = hasImg
        ? custom.html.replace(/(<img\b[^>]*\bsrc=")[^"]*(")/i, `$1${asset.url}$2`)
        : custom.html; // no <img> tag to replace (the section is built from CSS shapes/icons only)
      updateNodeField(node.id, "custom", { ...custom, html });
      toast(hasImg ? "Image replaced." : "This section has no photo to replace — it's built from shapes and icons.");
    } catch {
      toast("Could not upload that image.");
    }
  }

  async function uploadHeroImage(file: File) {
    if (!project || !node) return;
    const nodeId = node.id;
    try {
      const asset = await api.upload<Asset>(`projects/${project.id}/assets`, file, { folder: "/hero" });
      const publicUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${asset.url}`;
      updateNodeField(nodeId, "visualImage", publicUrl);
      toast("Hero image uploaded.");
    } catch {
      toast("Could not upload that image.");
    }
  }

  return (
    <div className="p-5">
      <div className="mb-4 text-base font-bold text-main">{node.name} Settings</div>
      <TextField label="Section Name" value={node.name} onChange={(v) => renameNode(node.id, v)} />
      {custom && (
        <div className="mb-4 rounded-xl border border-border-light bg-surface p-3">
          <p className="mb-1 text-xs font-semibold text-main">Custom AI design</p>
          <p className="mb-3 text-xs text-muted">
            This section was designed from your own description, so the fields below have no effect on it — they belong to
            the {node.type} style underneath. You can still swap its photo, or describe further changes in the Design step.
          </p>
          <label className="btn mb-2 w-full cursor-pointer justify-center text-xs">
            <ImagePlus className="h-3.5 w-3.5" /> Replace photo
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void replaceCustomImage(f); e.target.value = ""; }} />
          </label>
          <button className="btn w-full justify-center text-xs text-red-600" onClick={() => updateNodeField(node.id, "custom", undefined)}>
            <Trash2 className="h-3.5 w-3.5" /> Remove custom design (use a normal style)
          </button>
        </div>
      )}
      {def?.editableFields.map((field) => {
        const value = getByPath(node.props, field.path);
        if (field.type === "color") {
          return (
            <div key={field.key} className="mb-4">
              <label className="label-field">{field.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={value || "#000000"}
                  onChange={(e) => updateNodeField(node.id, field.path, e.target.value)}
                  className="h-9 w-11 cursor-pointer rounded border border-border-light bg-transparent p-0.5"
                />
                <span className="text-xs text-muted">{value || "#000000"}</span>
              </div>
            </div>
          );
        }
        if (field.type === "image") {
          return <ImageField key={field.key} label={field.label} value={value ?? ""} onChange={(v) => updateNodeField(node.id, field.path, v)} />;
        }
        if (field.type === "array") {
          return <ArrayField key={field.key} field={field} value={value} onChange={(v) => updateNodeField(node.id, field.path, v)} />;
        }
        return (
          <TextField
            key={field.key}
            label={field.label}
            value={value}
            multiline={field.type === "textarea"}
            onChange={(v) => updateNodeField(node.id, field.path, v)}
          />
        );
      })}
      {node.type === "hero" && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Video</div>
          <VideoField
            label="Background video (plays behind the text)"
            value={node.props.bgVideo ?? ""}
            onChange={(v) => updateNodeField(node.id, "bgVideo", v)}
            hint="Autoplays muted and loops. Keep clips short (under 10 s) and compressed. The hero image shows until it loads."
          />
          {node.props.bgVideo && (
            <div className="field">
              <label className="label-field">Darken video: {Math.round((node.props.videoDim ?? 0.45) * 100)}%</label>
              <input
                type="range" min={0} max={0.85} step={0.05} className="w-full"
                value={node.props.videoDim ?? 0.45}
                onChange={(e) => updateNodeField(node.id, "videoDim", Number(e.target.value))}
                aria-label="Video darkness"
              />
              <p className="mt-1 text-[11px] text-muted">Higher values keep white text readable over bright footage.</p>
            </div>
          )}
          <VideoField
            label="Video inside the hero image box (Split layout)"
            value={node.props.visualVideo ?? ""}
            onChange={(v) => updateNodeField(node.id, "visualVideo", v)}
          />
        </div>
      )}
      {node.type === "hero" && (
        <div className="mt-5 border-t border-border pt-4">
          <ImageField label="Hero Image" value={node.props.visualImage ?? ""} onChange={(v) => updateNodeField(node.id, "visualImage", v)} />
        </div>
      )}
      {!def && <p className="text-sm text-muted">No editable fields for this component type yet.</p>}
    </div>
  );
}

const COLOR_GROUPS: { title: string; hint: string; keys: { key: string; label: string }[] }[] = [
  { title: "Brand", hint: "Buttons, links and highlights", keys: [{ key: "primary", label: "Primary" }, { key: "secondary", label: "Secondary" }, { key: "accent", label: "Accent" }] },
  { title: "Surfaces", hint: "Page and card backgrounds", keys: [{ key: "background", label: "Background" }, { key: "surface", label: "Surface" }, { key: "border", label: "Border" }] },
  { title: "Text", hint: "Headings and body copy", keys: [{ key: "text", label: "Text" }, { key: "muted", label: "Muted text" }] },
  { title: "Status", hint: "Success, warnings and errors", keys: [{ key: "success", label: "Success" }, { key: "warning", label: "Warning" }, { key: "error", label: "Error" }] },
];

const FONT_CHOICES = ["Plus Jakarta Sans", "Inter", "Manrope", "DM Sans", "Poppins", "Space Grotesk", "Sora", "Outfit", "Playfair Display", "Fraunces", "Lora", "Merriweather", "Bricolage Grotesque", "Syne", "Roboto", "Georgia"];

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const valid = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-light bg-surface px-2.5 py-2 transition hover:border-primary">
      <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border-light shadow-sm" style={{ background: valid ? value : "#000" }}>
        <input type="color" aria-label={`${label} colour`} value={valid ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </label>
      <span className="min-w-0 flex-1 text-[13px] font-semibold text-main">{label}</span>
      <input
        aria-label={`${label} hex value`}
        defaultValue={value}
        key={value}
        spellCheck={false}
        maxLength={7}
        onBlur={(e) => { const v = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v.toLowerCase()); else e.target.value = value; }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="w-[76px] rounded-md border border-transparent bg-app px-2 py-1 text-center font-mono text-[11.5px] uppercase text-muted outline-none focus:border-primary"
      />
    </div>
  );
}

function FontPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const options = FONT_CHOICES.includes(value) ? FONT_CHOICES : [value, ...FONT_CHOICES];
  return (
    <div className="rounded-xl border border-border-light bg-surface p-3">
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field mb-2.5" aria-label={label}>
        {options.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <div className="truncate text-[22px] leading-tight text-main" style={{ fontFamily: `"${value}", system-ui, sans-serif` }}>Aa Quick brown fox</div>
    </div>
  );
}

function DesignSystemPanel() {
  const project = useProjectStore((s) => s.project);
  const updateTheme = useProjectStore((s) => s.updateTheme);
  if (!project) return null;
  const colors = project.theme.colors || {};
  const mode = project.theme.mode || "light";
  const swatches = ["primary", "secondary", "accent", "background", "surface", "text"];

  return (
    <div className="space-y-6 p-5">
      <div>
        <div className="text-base font-extrabold text-main">Design System</div>
        <p className="mt-0.5 text-xs text-muted">Colours and fonts for the whole site. Changes apply everywhere at once.</p>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full border border-border-light" aria-hidden>
          {swatches.map((k) => <i key={k} className="flex-1" style={{ background: colors[k] || "#ccc" }} />)}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Theme mode</div>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-app p-1">
          {(["light", "dark"] as const).map((m) => (
            <button key={m} type="button" onClick={() => updateTheme({ mode: m })} className={`rounded-lg px-3 py-2 text-xs font-bold capitalize transition ${mode === m ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-surface hover:text-main"}`}>{m}</button>
          ))}
        </div>
      </div>

      {COLOR_GROUPS.map((g) => (
        <div key={g.title}>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{g.title}</span>
            <span className="text-[11px] text-muted/70">{g.hint}</span>
          </div>
          <div className="space-y-2">
            {g.keys.map(({ key, label }) => (
              <ColorRow key={key} label={label} value={colors[key] || "#000000"} onChange={(v) => updateTheme({ colors: { [key]: v } })} />
            ))}
          </div>
        </div>
      ))}

      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Typography</div>
        <div className="space-y-2">
          <FontPicker label="Headings" value={project.theme.heading_font} onChange={(v) => updateTheme({ heading_font: v })} />
          <FontPicker label="Body text" value={project.theme.body_font} onChange={(v) => updateTheme({ body_font: v })} />
        </div>
      </div>
    </div>
  );
}

export function Inspector() {
  const [tab, setTab] = useState<"component" | "design">("component");
  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-2 border-b border-border p-3">
        <button
          className={`flex-1 rounded-md py-1.5 text-xs font-semibold ${tab === "component" ? "bg-surface-hover text-main" : "text-muted"}`}
          onClick={() => setTab("component")}
        >
          Component
        </button>
        <button
          className={`flex-1 rounded-md py-1.5 text-xs font-semibold ${tab === "design" ? "bg-surface-hover text-main" : "text-muted"}`}
          onClick={() => setTab("design")}
        >
          Design System
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{tab === "component" ? <ComponentInspector /> : <DesignSystemPanel />}</div>
    </div>
  );
}
