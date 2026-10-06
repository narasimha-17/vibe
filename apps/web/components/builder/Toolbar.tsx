"use client";

import Link from "next/link";
import { VibeLogo } from "@/components/marketing/VibeLogo";
import { CircleHelp, Monitor, Palette, Redo2, Rocket, Smartphone, Tablet, Undo2, WandSparkles } from "lucide-react";
import { ChecklistChip } from "./ChecklistPanel";
import { startTour } from "./Tour";
import { useProjectStore } from "@/lib/store/project-store";

export function Toolbar({ saveStatus, onGenerate, onColor, onPublish, checklistSignal }: { saveStatus: "saved" | "saving" | "dirty"; onGenerate: () => void; onColor: () => void; onPublish: () => void; checklistSignal: number }) {
  const project = useProjectStore((s) => s.project);
  const renameProject = useProjectStore((s) => s.renameProject);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const past = useProjectStore((s) => s.past);
  const future = useProjectStore((s) => s.future);
  const breakpoint = useProjectStore((s) => s.breakpoint);
  const setBreakpoint = useProjectStore((s) => s.setBreakpoint);
  const previewMode = useProjectStore((s) => s.previewMode);
  const togglePreview = useProjectStore((s) => s.togglePreview);
  const breakpoints = ["desktop", "tablet", "mobile"] as const;
  const breakpointIndex = breakpoints.indexOf(breakpoint);
  const nextBreakpoint = breakpoints[(breakpointIndex + 1) % breakpoints.length];

  const statusLabel = saveStatus === "saving" ? "Saving…" : saveStatus === "dirty" ? "Unsaved changes" : "All changes saved";

  return (
    <header className="builder-toolbar flex h-16 items-center gap-4 border-b border-border bg-panel/80 px-6 backdrop-blur-xl">
      <Link href="/dashboard" aria-label="VIBE dashboard">
        <VibeLogo />
      </Link>
      <input
        value={project?.name || ""}
        onChange={(e) => renameProject(e.target.value)}
        className="toolbar-title ml-2 w-48 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium text-main hover:border-border-light hover:bg-surface focus:border-border-light focus:bg-surface focus:outline-none"
      />
      <span className="toolbar-status text-xs text-muted">{statusLabel}</span>

      <div className="ml-auto flex items-center gap-2">
        <button className="btn-ghost btn h-9 w-9 justify-center px-0" disabled={!past.length} onClick={undo} title="Undo">
          <Undo2 className="h-4 w-4" />
        </button>
        <button className="btn-ghost btn h-9 w-9 justify-center px-0" disabled={!future.length} onClick={redo} title="Redo">
          <Redo2 className="h-4 w-4" />
        </button>
        <div className="mx-1 h-6 w-px bg-border-light" />
        <button
          onClick={() => setBreakpoint(nextBreakpoint)}
          className="btn h-9 w-10 justify-center px-0 border-primary text-primary"
          title={`Viewport: ${breakpoint}. Click to switch to ${nextBreakpoint}.`}
          aria-label={`Viewport ${breakpoint}. Switch to ${nextBreakpoint}.`}
        >
          {breakpoint === "desktop" ? <Monitor className="h-4 w-4" /> : breakpoint === "tablet" ? <Tablet className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
        </button>
        <div className="mx-1 h-6 w-px bg-border-light" />
        <button className={`btn h-9 ${previewMode ? "border-primary text-primary" : ""}`} onClick={togglePreview}>
          {previewMode ? "Exit Preview" : "Preview"}
        </button>
        <ChecklistChip saveStatus={saveStatus} openSignal={checklistSignal} />
        <button className="btn h-9" onClick={onPublish} title="Put your site on the web" data-tour="publish">
          <Rocket className="h-4 w-4" /> Publish
        </button>
        <button className="btn h-9" onClick={onColor} title="Color theory: harmonies, 60-30-10 and contrast">
          <Palette className="h-4 w-4" /> Color theory
        </button>
        <button className="btn-ghost btn h-9 w-9 justify-center px-0" onClick={startTour} title="Take the tour" aria-label="Take the tour">
          <CircleHelp className="h-4 w-4" />
        </button>
        <button className="btn btn-primary h-9" onClick={onGenerate}>
          <WandSparkles className="h-4 w-4" /> Generate Code
        </button>
      </div>
    </header>
  );
}
