"use client";

import { useDraggable } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { REGISTRY_LIST } from "@/lib/registry";
import { COMPONENT_ICONS } from "./builder-icons";

/** Whole-page features. They are added from the page bar (+ > Shop, Track order, ...) instead of as loose blocks. */
const PAGE_ONLY = new Set(["shop", "tracking"]);

function PaletteItem({ type, label, category, onClick }: { type: string; label: string; category: string; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { source: "palette", componentType: type },
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-xl border border-border-light bg-surface px-2 py-3 text-xs font-medium text-main transition hover:border-primary hover:bg-surface-hover hover:-translate-y-0.5 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted/70">{category}</span>
      {(() => {
        const Icon = COMPONENT_ICONS[type];
        return Icon ? <Icon aria-hidden="true" className="h-5 w-5 text-primary" strokeWidth={1.8} /> : null;
      })()}
      {label}
    </button>
  );
}

export function Palette({ onPick, search, setSearch }: { onPick: (type: string) => void; search: string; setSearch: (s: string) => void }) {
  const filtered = useMemo(
    () => REGISTRY_LIST.filter((c) => !PAGE_ONLY.has(c.type) && c.label.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  return (
    <div>
      <div className="panel-title">Add Components</div>
      <input
        className="input-field mx-4 mb-4 w-[calc(100%-32px)]"
        placeholder="Search blocks..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="max-h-[46vh] overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((item) => (
            <PaletteItem key={item.type} type={item.type} label={item.label} category={item.category} onClick={() => onPick(item.type)} />
          ))}
        </div>
      </div>
    </div>
  );
}
