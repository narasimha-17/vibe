"use client";

import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { REGISTRY_LIST } from "@/lib/registry";
import { useProjectStore } from "@/lib/store/project-store";
import { COMPONENT_ICONS, FileText, Redo2, Undo2, WandSparkles } from "./builder-icons";

export function CommandPalette({ onGenerate, onStyle }: { onGenerate: () => void; onStyle?: () => void }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const project = useProjectStore((s) => s.project);
  const addNode = useProjectStore((s) => s.addNode);
  const setActivePage = useProjectStore((s) => s.setActivePage);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const togglePreview = useProjectStore((s) => s.togglePreview);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function run(fn: () => void) {
    fn();
    setOpen(false);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Palette"
      className="fixed left-1/2 top-24 z-[200] w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"
    >
      <Command.Input
        placeholder="Search components, pages, actions..."
        className="w-full border-b border-border bg-transparent px-4 py-3.5 text-sm text-main outline-none placeholder:text-muted"
      />
      <Command.List className="max-h-96 overflow-y-auto p-2">
        <Command.Empty className="p-4 text-sm text-muted">No results found.</Command.Empty>

        <Command.Group heading="Components" className="px-2 py-1.5 text-[11px] font-bold uppercase text-muted">
          {REGISTRY_LIST.map((c) => (
            <Command.Item
              key={c.type}
              onSelect={() => run(() => addNode(c.type))}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-main aria-selected:bg-surface-hover"
            >
              {(() => {
                const Icon = COMPONENT_ICONS[c.type];
                return Icon ? <Icon aria-hidden="true" className="h-4 w-4 text-primary" /> : null;
              })()} Add {c.label}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Pages" className="px-2 py-1.5 text-[11px] font-bold uppercase text-muted">
          {project?.pages.map((p) => (
            <Command.Item
              key={p.id}
              onSelect={() => run(() => setActivePage(p.id))}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-main aria-selected:bg-surface-hover"
            >
              <FileText aria-hidden="true" className="h-4 w-4 text-muted" /> Go to {p.name}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Design">
          <Command.Item onSelect={() => run(() => onStyle?.())} className="cursor-pointer rounded-lg px-3 py-2 text-sm text-main aria-selected:bg-surface-hover">
            Open Style Studio — explore, generate &amp; apply a design system
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Actions" className="px-2 py-1.5 text-[11px] font-bold uppercase text-muted">
          <Command.Item onSelect={() => run(undo)} className="cursor-pointer rounded-lg px-3 py-2 text-sm text-main aria-selected:bg-surface-hover">
            <Undo2 aria-hidden="true" className="h-4 w-4 text-muted" /> Undo
          </Command.Item>
          <Command.Item onSelect={() => run(redo)} className="cursor-pointer rounded-lg px-3 py-2 text-sm text-main aria-selected:bg-surface-hover">
            <Redo2 aria-hidden="true" className="h-4 w-4 text-muted" /> Redo
          </Command.Item>
          <Command.Item
            onSelect={() => run(togglePreview)}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-main aria-selected:bg-surface-hover"
          >
            Toggle Preview Mode
          </Command.Item>
          <Command.Item
            onSelect={() => run(onGenerate)}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-main aria-selected:bg-surface-hover"
          >
            <WandSparkles aria-hidden="true" className="h-4 w-4 text-primary" /> Generate Code
          </Command.Item>
          <Command.Item
            onSelect={() => run(() => router.push("/dashboard/settings"))}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-main aria-selected:bg-surface-hover"
          >
            Open Settings
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
