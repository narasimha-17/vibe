"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Loader2, MessageSquarePlus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { REGISTRY } from "@/lib/registry";
import { FLOATING_CHAT } from "@/lib/registry/chatbot";
import { ScaledFrame } from "@/components/style/PreviewSite";
import { useSiteFrame, type SiteFrame } from "@/lib/style/site-frame";
import { toast } from "@/lib/toast";
import type { Node, PageData, ProjectDetail } from "@/lib/types";
import { CustomSectionFrame, type CustomSection } from "./CustomSectionFrame";

/** Sections shared by every page: styled once, on the first page they appear, and applied everywhere. */
const SHARED = new Set(["navbar", "footer"]);

interface Step {
  pageId: string;
  nodeId: string;
}

function designable(node: Node): boolean {
  if (node.hidden || !REGISTRY[node.type]) return false;
  return !(node.type === "chatbot" && FLOATING_CHAT.has(node.variant));
}

/** The styles offered for a section. Login / account sections only offer styles of the same kind (sign-in styles for a
 * sign-in page), because switching kind would change what the page does. */
function variantsFor(node: Node) {
  const def = REGISTRY[node.type];
  if (node.type !== "auth") return def.variants;
  const kind = node.variant.split("-")[0];
  const same = def.variants.filter((v) => v.id.split("-")[0] === kind);
  return same.length ? same : def.variants;
}

function buildSteps(pages: PageData[]): Step[] {
  const steps: Step[] = [];
  const sharedDone = new Set<string>();
  for (const page of pages) {
    for (const node of page.tree) {
      if (!designable(node)) continue;
      if (SHARED.has(node.type)) {
        if (sharedDone.has(node.type)) continue;
        sharedDone.add(node.type);
      }
      steps.push({ pageId: page.id, nodeId: node.id });
    }
  }
  return steps;
}

function Themed({ frame, children }: { frame: SiteFrame; children: React.ReactNode }) {
  return (
    <div className={`${frame.className} relative bg-white`} {...frame.attrs} style={frame.style}>
      {children}
    </div>
  );
}

function VariantCard({ node, variantId, label, selected, frame, onPick }: { node: Node; variantId: string; label: string; selected: boolean; frame: SiteFrame; onPick: () => void }) {
  const def = REGISTRY[node.type];
  const variant = def.variants.find((v) => v.id === variantId)!;
  return (
    <button
      onClick={onPick}
      aria-pressed={selected}
      className={`group overflow-hidden rounded-3xl border bg-white text-left transition duration-200 hover:-translate-y-1 ${
        selected ? "border-[#6b4d9a] ring-4 ring-[#6b4d9a]/15 shadow-[0_20px_40px_rgba(107,77,154,0.22)]" : "border-slate-200 shadow-sm hover:border-[#b79be6] hover:shadow-lg"
      }`}
    >
      <div className="pointer-events-none overflow-hidden bg-slate-50">
        <ScaledFrame width={1100} maxHeight={300}>
          <Themed frame={frame}>{variant.render({ ...def.defaultProps, ...node.props })}</Themed>
        </ScaledFrame>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
        <span className="text-sm font-bold text-slate-900">{label}</span>
        {selected ? (
          <span className="flex items-center gap-1 rounded-full bg-[#6b4d9a] px-2.5 py-1 text-[11px] font-bold text-white"><Check className="h-3 w-3" /> Chosen</span>
        ) : (
          <span className="text-[11px] font-semibold text-slate-400 group-hover:text-[#6b4d9a]">Choose</span>
        )}
      </div>
    </button>
  );
}

function CustomPanel({ projectId, node, fonts, onUse, onCancel }: { projectId: string; node: Node; fonts: string[]; onUse: (c: CustomSection) => void; onCancel: () => void }) {
  const existing = node.props?.custom as CustomSection | undefined;
  const [description, setDescription] = useState(existing?.description || "");
  const [draft, setDraft] = useState<CustomSection | null>(existing?.html ? existing : null);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);

  async function generate(refine: boolean) {
    const text = refine ? instruction.trim() : description.trim();
    if (!text) return;
    setBusy(true);
    try {
      const { custom: _old, ...content } = node.props || {};
      const res = await api.post<{ html: string; css: string; scope: string }>(`agents/projects/${projectId}/custom-section`, {
        section_type: node.type,
        content,
        description: refine ? `${description}\nThen: ${text}` : text,
        previous: refine && draft ? draft : null,
        instruction: refine ? text : "",
      });
      setDraft({ description: refine ? `${description}\nThen: ${text}` : text, ...res });
      if (refine) {
        setDescription((d) => `${d}\nThen: ${text}`);
        setInstruction("");
      }
    } catch (e) {
      const detail = e instanceof ApiError && typeof (e.detail as any)?.detail === "string" ? (e.detail as any).detail : "Couldn't design that section. Try again.";
      toast(detail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-[#6b4d9a]/25 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#6b4d9a] text-white"><Wand2 className="h-5 w-5" /></span>
        <div>
          <h3 className="text-base font-extrabold text-slate-900">Describe your own {REGISTRY[node.type]?.label.toLowerCase() || "section"}</h3>
          <p className="text-sm text-slate-500">Say how it should look and feel. The AI designs it in your colours, with this section&apos;s text, and you can keep refining it.</p>
        </div>
      </div>
      {!draft ? (
        <>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            autoFocus
            placeholder="For example: a full-width photo banner with the headline on the left in big serif letters, a translucent card with the two buttons, and a soft gradient overlay."
            className="w-full rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:border-[#6b4d9a] focus:ring-4 focus:ring-[#6b4d9a]/10"
          />
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary h-10" onClick={() => void generate(false)} disabled={busy || !description.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {busy ? "Designing…" : "Design it"}
            </button>
            <button className="btn h-10" onClick={onCancel}>Back to styles</button>
          </div>
        </>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <ScaledFrame width={1100} maxHeight={520}>
              <CustomSectionFrame section={draft} fonts={fonts} />
            </ScaledFrame>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && void generate(true)}
              placeholder="Refine it: “make the headline bigger”, “use a dark background”, “add three icons below”…"
              className="h-10 min-w-[260px] flex-1 rounded-full border border-slate-200 px-4 text-sm outline-none focus:border-[#6b4d9a] focus:ring-4 focus:ring-[#6b4d9a]/10"
            />
            <button className="btn h-10" onClick={() => void generate(true)} disabled={busy || !instruction.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />} {busy ? "Updating…" : "Update"}
            </button>
            <button className="btn btn-primary h-10" onClick={() => onUse(draft)} disabled={busy}><Check className="h-4 w-4" /> Use this design</button>
            <button className="btn h-10" onClick={onCancel} disabled={busy}>Back to styles</button>
          </div>
        </>
      )}
    </div>
  );
}

interface UploadedAsset { id: string; url: string; filename: string; content_type: string }

/** First screen of the wizard: an optional logo (used on every navbar) and any photos/videos, assigned to the first
 * hero and offered for the pages that follow. Skippable; the site works fine with placeholder visuals. */
function MediaStep({ project, onSave, onDone }: { project: ProjectDetail; onSave: (p: ProjectDetail) => void; onDone: () => void }) {
  const [logo, setLogo] = useState<UploadedAsset | null>(null);
  const [media, setMedia] = useState<UploadedAsset[]>([]);
  const [busy, setBusy] = useState<"logo" | "media" | null>(null);
  const mediaHint = String((project.settings as any)?.requirements?.media || "").trim();

  async function uploadOne(file: File): Promise<UploadedAsset | null> {
    try {
      return await api.upload<UploadedAsset>(`projects/${project.id}/assets`, file);
    } catch {
      toast(`Couldn't upload ${file.name}.`);
      return null;
    }
  }

  async function pickLogo(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy("logo");
    const asset = await uploadOne(file);
    setBusy(null);
    if (!asset) return;
    setLogo(asset);
    const pages = project.pages.map((p) => ({ ...p, tree: p.tree.map((n) => (n.type === "navbar" ? { ...n, props: { ...n.props, logoUrl: asset.url } } : n)) }));
    onSave({ ...project, pages });
  }

  async function pickMedia(files: FileList | null) {
    if (!files?.length) return;
    setBusy("media");
    const uploaded = (await Promise.all(Array.from(files).map(uploadOne))).filter((a): a is UploadedAsset => Boolean(a));
    setBusy(null);
    if (!uploaded.length) return;
    setMedia((m) => [...m, ...uploaded]);
    // The first photo becomes the home hero's visual when it has none yet; a video (if any) becomes the hero's background.
    const photo = uploaded.find((a) => a.content_type.startsWith("image/"));
    const video = uploaded.find((a) => a.content_type.startsWith("video/"));
    if (!photo && !video) return;
    let used = false;
    const pages = project.pages.map((p) => {
      if (!p.is_home || used) return p;
      return {
        ...p,
        tree: p.tree.map((n) => {
          if (n.type !== "hero" || n.props?.visualImage || used) return n;
          used = true;
          return { ...n, props: { ...n.props, ...(photo ? { visualImage: photo.url } : {}), ...(video ? { bgVideo: video.url } : {}) } };
        }),
      };
    });
    onSave({ ...project, pages });
  }

  function removeMedia(id: string) {
    setMedia((m) => m.filter((a) => a.id !== id));
  }

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b4d9a]">Before we start</div>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Logo &amp; media</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add your logo and any photos or videos you have. They&apos;ll be used across the site as you design each section — you can skip this and use placeholders instead.
        </p>
        {mediaHint && <p className="mt-3 rounded-2xl bg-[#f6f2fd] px-4 py-3 text-sm text-[#5a3f86]">You told OORA: &ldquo;{mediaHint}&rdquo;</p>}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-extrabold text-slate-900">Logo</h2>
          <p className="mt-1 text-sm text-slate-500">Shown in the navbar on every page, in place of your brand name.</p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {logo ? <img src={logo.url} alt="Logo" className="max-h-full max-w-full object-contain" /> : <ImagePlus className="h-5 w-5 text-slate-300" />}
            </div>
            <label className="btn h-10 cursor-pointer">
              {busy === "logo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {logo ? "Replace logo" : "Upload logo"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => void pickLogo(e.target.files)} disabled={busy === "logo"} />
            </label>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-extrabold text-slate-900">Photos &amp; videos</h2>
          <p className="mt-1 text-sm text-slate-500">The first photo becomes your home page&apos;s hero image; everything else stays ready to add to any section as you go.</p>
          <label className="btn mt-4 h-10 w-fit cursor-pointer">
            {busy === "media" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            Upload photos or videos
            <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => void pickMedia(e.target.files)} disabled={busy === "media"} />
          </label>
          {media.length > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {media.map((a) => (
                <div key={a.id} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {a.content_type.startsWith("video/") ? <video src={a.url} className="h-full w-full object-cover" muted /> : <img src={a.url} alt={a.filename} className="h-full w-full object-cover" />}
                  <button onClick={() => removeMedia(a.id)} className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white group-hover:flex" title="Remove">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 mt-8 flex items-center gap-3 border-t border-slate-200 bg-white/90 py-4 backdrop-blur">
        <div className="flex-1" />
        <button className="btn h-11" onClick={onDone}>{logo || media.length ? "Continue" : "Skip, use placeholders"}</button>
        {(logo || media.length > 0) && (
          <button className="btn btn-primary h-11 px-6" onClick={onDone}>Continue <ArrowRight className="h-4 w-4" /></button>
        )}
      </div>
    </div>
  );
}

export function DesignWizard({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [mediaDone, setMediaDone] = useState(false);
  const [index, setIndex] = useState(0);
  const [custom, setCustom] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const frame = useSiteFrame(project?.theme as Record<string, any> | undefined);

  useEffect(() => {
    api.get<ProjectDetail>(`projects/${projectId}`).then((p) => setProject({ ...p, pages: [...p.pages].sort((a, b) => a.order - b.order) })).catch(() => toast("Couldn't load the project."));
  }, [projectId]);

  const steps = useMemo(() => (project ? buildSteps(project.pages) : []), [project]);
  const step = steps[index];
  const page = project?.pages.find((p) => p.id === step?.pageId);
  const node = page?.tree.find((n) => n.id === step?.nodeId);
  const fonts = useMemo(() => [String((project?.theme as any)?.heading_font || ""), String((project?.theme as any)?.body_font || "")], [project]);

  const save = useCallback((next: ProjectDetail, now = false) => {
    clearTimeout(saveTimer.current);
    const run = () => api.put(`projects/${projectId}/sync`, { name: next.name, theme: next.theme, pages: next.pages }).catch(() => toast("Couldn't save your choice. It will retry on the next change."));
    if (now) return run();
    saveTimer.current = setTimeout(run, 600);
    return Promise.resolve();
  }, [projectId]);

  /** Sets this section's style (or custom design); navbar and footer choices apply to every page. */
  function choose(variant: string, customDesign?: CustomSection) {
    if (!project || !node) return;
    const apply = (n: Node): Node => {
      const { custom: _drop, ...rest } = n.props || {};
      return { ...n, variant, props: customDesign ? { ...rest, custom: customDesign } : rest };
    };
    const pages = project.pages.map((p) => ({
      ...p,
      tree: p.tree.map((n) => (n.id === node.id || (SHARED.has(node.type) && n.type === node.type) ? apply(n) : n)),
    }));
    const next = { ...project, pages };
    setProject(next);
    void save(next);
  }

  async function finish() {
    if (!project) return;
    setFinishing(true);
    await save(project, true);
    router.push(`/builder/${projectId}?welcome=1`);
  }

  function go(to: number) {
    setCustom(false);
    setIndex(Math.max(0, Math.min(steps.length - 1, to)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!project) {
    return <div className="grid h-screen place-items-center bg-[#f7f4fc] text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!mediaDone) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f3edfb] via-[#faf8fd] to-white text-slate-900">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <MediaStep project={project} onSave={(p) => { setProject(p); void save(p); }} onDone={() => setMediaDone(true)} />
        </div>
      </div>
    );
  }
  if (!steps.length || !node || !page) {
    return (
      <div className="grid h-screen place-items-center bg-[#f7f4fc]">
        <button className="btn btn-primary" onClick={() => void finish()}>Open the builder</button>
      </div>
    );
  }

  const def = REGISTRY[node.type];
  const isCustom = Boolean(node.props?.custom?.html);
  const last = index === steps.length - 1;
  const nextStep = steps[index + 1];
  const nextPage = nextStep && nextStep.pageId !== step.pageId ? project.pages.find((p) => p.id === nextStep.pageId) : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3edfb] via-[#faf8fd] to-white text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <div className="text-base font-extrabold">Design your site</div>
          <div className="hidden h-2 flex-1 overflow-hidden rounded-full bg-slate-100 sm:block">
            <div className="h-full rounded-full bg-gradient-to-r from-[#6b4d9a] to-[#ff5b7f] transition-all" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
          </div>
          <span className="text-xs font-semibold text-slate-500">{index + 1} / {steps.length}</span>
          <button className="btn h-9" onClick={() => void finish()} disabled={finishing}>Skip to builder</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Pages and sections" className="hidden lg:block">
          <div className="sticky top-20 space-y-4">
            {project.pages.map((p) => {
              const own = steps.map((s, i) => ({ s, i })).filter(({ s }) => s.pageId === p.id);
              if (!own.length) return null;
              return (
                <div key={p.id}>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{p.name}</div>
                  {own.map(({ s, i }) => {
                    const n = p.tree.find((x) => x.id === s.nodeId);
                    const base = REGISTRY[n?.type || ""]?.label || n?.name || "Section";
                    // When a page has more than one section of the same type (two CTAs, two feature blocks), tell
                    // them apart by the section's own heading, or by number if it has none.
                    const sameType = own.filter(({ s: os }) => p.tree.find((x) => x.id === os.nodeId)?.type === n?.type);
                    const heading = n?.props?.heading || n?.props?.title;
                    const label = sameType.length > 1 ? (heading ? `${base}: ${heading}` : `${base} (${sameType.findIndex((x) => x.s.nodeId === s.nodeId) + 1})`) : base;
                    return (
                      <button key={s.nodeId} onClick={() => go(i)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition ${i === index ? "bg-white font-bold text-[#5a3f86] shadow-sm" : "text-slate-600 hover:bg-white/70"}`}>
                        <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] ${i < index ? "bg-emerald-500 text-white" : i === index ? "bg-[#6b4d9a] text-white" : "bg-slate-200"}`}>{i < index ? "✓" : ""}</span>
                        <span className="truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </nav>

        <main>
          <div className="mb-6">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b4d9a]">{SHARED.has(node.type) ? "Every page" : page.name}</div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Which {def.label.toLowerCase()} style do you like?</h1>
            <p className="mt-1 text-sm text-slate-500">
              Previews use your colours and your real text. Pick one, or describe your own.{SHARED.has(node.type) ? " This choice applies to every page." : ""}
            </p>
          </div>

          {custom ? (
            <CustomPanel
              projectId={projectId}
              node={node}
              fonts={fonts}
              onCancel={() => setCustom(false)}
              onUse={(c) => {
                choose(node.variant, c);
                setCustom(false);
                if (!last) go(index + 1);
              }}
            />
          ) : (
            <div className="grid items-start gap-5 md:grid-cols-2">
              {variantsFor(node).map((v) => (
                <VariantCard key={v.id} node={node} variantId={v.id} label={v.label} frame={frame} selected={!isCustom && node.variant === v.id} onPick={() => choose(v.id)} />
              ))}
              <button
                onClick={() => setCustom(true)}
                className={`flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-6 text-center transition hover:-translate-y-1 ${isCustom ? "border-[#6b4d9a] bg-[#f6f2fd]" : "border-slate-300 bg-white hover:border-[#6b4d9a]"}`}
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#6b4d9a] text-white"><Wand2 className="h-6 w-6" /></span>
                <span className="text-base font-extrabold">{isCustom ? "Your custom design (chosen)" : "Custom: describe it"}</span>
                <span className="max-w-xs text-sm text-slate-500">{isCustom ? "Open it to see or refine it." : "Tell the AI what you want and it designs this section for you."}</span>
              </button>
              {isCustom && (
                <div className="md:col-span-2 overflow-hidden rounded-3xl border border-[#6b4d9a]/30 bg-white">
                  <div className="border-b border-slate-100 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#6b4d9a]">Your custom design</div>
                  <ScaledFrame width={1100} maxHeight={420}>
                    <CustomSectionFrame section={node.props.custom} fonts={fonts} />
                  </ScaledFrame>
                </div>
              )}
            </div>
          )}

          <div className="sticky bottom-0 mt-8 flex items-center gap-3 border-t border-slate-200 bg-white/90 py-4 backdrop-blur">
            <button className="btn h-11" onClick={() => go(index - 1)} disabled={index === 0}><ArrowLeft className="h-4 w-4" /> Back</button>
            <div className="flex-1" />
            {last ? (
              <button className="btn btn-primary h-11 px-6" onClick={() => void finish()} disabled={finishing}>
                {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Build my site
              </button>
            ) : (
              <button className="btn btn-primary h-11 px-6" onClick={() => go(index + 1)}>
                {nextPage ? `Next page: ${nextPage.name}` : "Next section"} <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
