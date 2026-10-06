"use client";

import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { useActivePage, useProjectStore } from "@/lib/store/project-store";
import type { ProjectDetail } from "@/lib/types";
import { toast } from "@/lib/toast";
import { Toolbar } from "./Toolbar";
import { Palette } from "./Palette";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { LayersPanel } from "./LayersPanel";
import { PagesBar } from "./PagesBar";
import { AIPanel } from "./AIPanel";
import { CodegenModal } from "./CodegenModal";
import { AgentBuildChip } from "./AgentBuildPanel";
import { PublishModal } from "./PublishModal";
import { Tour } from "./Tour";
import { StylePickerModal } from "./StylePickerModal";
import { CommandPalette } from "./CommandPalette";
import { StyleStudio } from "@/components/style/StyleStudio";
import { ColorTheoryPanel } from "@/components/style/ColorTheoryPanel";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

export function BuilderClient({ projectId }: { projectId: string }) {
  const project = useProjectStore((s) => s.project);
  const loadProject = useProjectStore((s) => s.loadProject);
  const dirty = useProjectStore((s) => s.dirty);
  const markSaved = useProjectStore((s) => s.markSaved);
  const moveNode = useProjectStore((s) => s.moveNode);
  const addNode = useProjectStore((s) => s.addNode);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const deleteNode = useProjectStore((s) => s.deleteNode);
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId);
  const page = useActivePage();

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [checklistSignal, setChecklistSignal] = useState(0);
  const [autoBuild, setAutoBuild] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("welcome") === "1");

  // Arriving from the OORA conversation: show the checklist that was just agreed.
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("welcome") === "1") {
      const t = setTimeout(() => setChecklistSignal((n) => n + 1), 600);
      window.history.replaceState(null, "", window.location.pathname);
      return () => clearTimeout(t);
    }
  }, []);
  const [styleOpen, setStyleOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [stylePickerType, setStylePickerType] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "dirty">("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    document.documentElement.classList.add("builder-scroll-locked");
    document.body.classList.add("builder-scroll-locked");
    return () => {
      document.documentElement.classList.remove("builder-scroll-locked");
      document.body.classList.remove("builder-scroll-locked");
    };
  }, []);

  useEffect(() => {
    api
      .get<ProjectDetail>(`projects/${projectId}`)
      .then(loadProject)
      .catch(() => toast("Couldn't load this project."))
      .finally(() => setLoading(false));
  }, [projectId, loadProject]);

  useEffect(() => {
    if (!dirty || !project) return;
    setSaveStatus("dirty");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await api.put(`projects/${projectId}/sync`, { name: project.name, theme: project.theme, pages: project.pages });
        markSaved();
        setSaveStatus("saved");
      } catch {
        setSaveStatus("dirty");
      }
    }, 1200);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, project?.pages, project?.theme, project?.name]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const inField = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName);
      if (inField) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedNodeId) {
        e.preventDefault();
        deleteNode(selectedNodeId);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, deleteNode, selectedNodeId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !page) return;

    if (active.data.current?.source === "palette") {
      const componentType = active.data.current.componentType as string;
      const overIndex = page.tree.findIndex((n) => n.id === over.id);
      addNode(componentType, undefined, overIndex === -1 ? page.tree.length : overIndex);
      return;
    }

    if (active.id !== over.id) {
      const oldIndex = page.tree.findIndex((n) => n.id === active.id);
      const newIndex = page.tree.findIndex((n) => n.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(page.tree, oldIndex, newIndex);
        moveNode(active.id as string, reordered.findIndex((n) => n.id === active.id));
      }
    }
  }

  if (loading) {
    return <div className="grid h-screen place-items-center text-muted">Loading project…</div>;
  }
  if (!project) {
    return <div className="grid h-screen place-items-center text-muted">Project not found.</div>;
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid h-screen min-h-0 grid-rows-[64px_auto_1fr] overflow-hidden">
        <Toolbar saveStatus={saveStatus} onGenerate={() => setGenerateOpen(true)} onColor={() => setColorOpen(true)} onPublish={() => setPublishOpen(true)} checklistSignal={checklistSignal} />
        <PagesBar />
        <div
          className="builder-layout grid min-h-0 overflow-hidden"
          style={{
            gridTemplateColumns: inspectorOpen ? "260px minmax(0, 1fr) 300px" : "260px minmax(0, 1fr)",
          }}
        >
          <aside data-tour="palette" className="builder-sidebar flex flex-col overflow-y-auto border-r border-border bg-panel">
            <Palette onPick={(type) => setStylePickerType(type)} search={search} setSearch={setSearch} />
            <LayersPanel />
          </aside>
          <div data-tour="canvas" className="relative min-h-0 min-w-0 overflow-hidden">
            <Canvas />
            {!inspectorOpen && (
              <button
                type="button"
                onClick={() => setInspectorOpen(true)}
                className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-lg border border-border-light bg-panel/95 text-muted shadow-sm backdrop-blur transition hover:border-primary hover:text-primary"
                title="Open inspector"
                aria-label="Open inspector"
              >
                <PanelRightOpen className="h-4 w-4" />
              </button>
            )}
          </div>
          {inspectorOpen && (
            <div data-tour="inspector" className="builder-inspector relative min-h-0 min-w-0 border-l border-border bg-panel">
              <button
                type="button"
                onClick={() => setInspectorOpen(false)}
                className="absolute -left-4 top-3 z-30 grid h-8 w-8 place-items-center rounded-lg border border-border-light bg-panel text-muted shadow-sm transition hover:border-primary hover:text-primary"
                title="Collapse inspector"
                aria-label="Collapse inspector"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
              <aside className="h-full overflow-y-auto">
                <Inspector />
              </aside>
            </div>
          )}
        </div>
      </div>
      <AIPanel />
      <Tour ready={!loading && !!project} />
      {generateOpen ? <CodegenModal onClose={() => setGenerateOpen(false)} /> : <AgentBuildChip projectId={projectId} autoStart={autoBuild} onAutoStarted={() => setAutoBuild(false)} onOpen={() => setGenerateOpen(true)} />}
      {publishOpen && <PublishModal onClose={() => setPublishOpen(false)} onGithub={() => setGenerateOpen(true)} />}
      {stylePickerType && <StylePickerModal componentType={stylePickerType} onClose={() => setStylePickerType(null)} />}
      {styleOpen && <StyleStudio onClose={() => setStyleOpen(false)} />}
      {colorOpen && <ColorTheoryPanel onClose={() => setColorOpen(false)} />}
      <CommandPalette onGenerate={() => setGenerateOpen(true)} onStyle={() => setStyleOpen(true)} />
    </DndContext>
  );
}
