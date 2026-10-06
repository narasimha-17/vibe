"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Node } from "@/lib/types";
import { getVariant } from "@/lib/registry";
import { sectionForLink } from "@/lib/section-links";
import { CustomSectionFrame } from "@/components/design/CustomSectionFrame";
import { useProjectStore } from "@/lib/store/project-store";
import { Copy, Eye, EyeOff, GripVertical, Lock, Unlock, X } from "lucide-react";

export function SectionBlock({ node, selected, onSelect }: { node: Node; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  const duplicateNode = useProjectStore((s) => s.duplicateNode);
  const deleteNode = useProjectStore((s) => s.deleteNode);
  const toggleLock = useProjectStore((s) => s.toggleLock);
  const toggleHidden = useProjectStore((s) => s.toggleHidden);
  const setActivePage = useProjectStore((s) => s.setActivePage);

  const variant = getVariant(node.type, node.variant);
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : node.hidden ? 0.35 : 1 };

  return (
    <div
      ref={setNodeRef}
      data-node-id={node.id}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
        if (node.type === "navbar") {
          // Navbar links behave like a real one-page site: "Team" scrolls to the team section on this
          // page; failing that, a link named after another page ("Contact") opens that page.
          const el = e.target as HTMLElement;
          const label = el.children.length === 0 ? el.textContent?.trim() : "";
          if (!label) return;
          const { project, activePageId } = useProjectStore.getState();
          const pages = project?.pages || [];
          const current = pages.find((pg) => pg.id === activePageId);
          const section = current ? sectionForLink(label, current.tree) : null;
          const target = section && document.querySelector(`[data-node-id="${section.id}"]`);
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          const hit = pages.find((pg) => pg.name.toLowerCase() === label.toLowerCase());
          if (hit) setActivePage(hit.id);
        }
      }}
      className={`group relative transition ${
        selected
          ? "z-[2] outline outline-2 -outline-offset-2 outline-[#6b4d9a]"
          : "hover:outline hover:outline-1 hover:-outline-offset-1 hover:outline-dashed hover:outline-[#b4a3ff]"
      }`}
    >
      {selected && (
        <div className="builder-chrome absolute left-0 top-0 z-[5] flex items-center gap-1.5 rounded-br-md bg-primary py-1 pl-2.5 pr-1.5 text-[11px] font-semibold text-white shadow-lg">
          <span {...attributes} {...listeners} className="cursor-grab px-1 opacity-85">
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <span>{node.name}</span>
          {node.locked && <Lock className="h-3 w-3" aria-label="Locked" />}
          <button
            className="ml-1 flex h-[18px] w-[18px] items-center justify-center rounded bg-white/20 hover:bg-white/35"
            onClick={(e) => {
              e.stopPropagation();
              toggleHidden(node.id);
            }}
            title={node.hidden ? "Show" : "Hide"}
          >
            {node.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
          <button
            className="flex h-[18px] w-[18px] items-center justify-center rounded bg-white/20 hover:bg-white/35"
            onClick={(e) => {
              e.stopPropagation();
              toggleLock(node.id);
            }}
            title={node.locked ? "Unlock" : "Lock"}
          >
            {node.locked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          </button>
          <button
            className="flex h-[18px] w-[18px] items-center justify-center rounded bg-white/20 hover:bg-white/35"
            onClick={(e) => {
              e.stopPropagation();
              duplicateNode(node.id);
            }}
            title="Duplicate"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            className="flex h-[18px] w-[18px] items-center justify-center rounded bg-white/20 hover:bg-white/35"
            onClick={(e) => {
              e.stopPropagation();
              deleteNode(node.id);
            }}
            title="Delete"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {node.props?.custom?.html ? (
        <CustomSectionFrame section={node.props.custom} />
      ) : variant ? (
        variant.render(node.props)
      ) : (
        <div className="p-6 text-sm text-red-500">Unknown component: {node.type}</div>
      )}
    </div>
  );
}
