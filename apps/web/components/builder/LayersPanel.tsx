"use client";

import { useActivePage, useProjectStore } from "@/lib/store/project-store";
import { Eye, EyeOff } from "./builder-icons";
import { useState } from "react";
import { ChevronDown, Layers3 } from "lucide-react";

export function LayersPanel() {
  const page = useActivePage();
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId);
  const selectNode = useProjectStore((s) => s.selectNode);
  const [open, setOpen] = useState(true);
  const layerCount = page?.tree.length || 0;

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-5 py-4 text-left transition hover:bg-surface"
        aria-expanded={open}
      >
        <Layers3 className="h-4 w-4 text-primary" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Page Layers</span>
        <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted">{layerCount}</span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-[max-height,opacity] duration-200 ${open ? "max-h-[26vh] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="max-h-[26vh] overflow-y-auto pb-3">
          {(page?.tree || []).map((node, idx) => (
            <div
              key={node.id}
              onClick={() => selectNode(node.id)}
              className={`flex cursor-pointer items-center gap-2.5 border-l-[3px] px-5 py-2.5 text-sm transition ${
                node.id === selectedNodeId
                  ? "border-primary bg-primary/10 text-main"
                  : "border-transparent text-muted hover:bg-surface hover:text-main"
              }`}
            >
              {node.hidden ? <EyeOff className="h-4 w-4 text-muted" /> : <Eye className="h-4 w-4 text-primary" />}
              {node.name}
              <small className="ml-auto rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted">Sec {idx + 1}</small>
            </div>
          ))}
          {!page?.tree.length && <p className="px-5 py-3 text-xs text-muted">No sections yet.</p>}
        </div>
      </div>
    </div>
  );
}
