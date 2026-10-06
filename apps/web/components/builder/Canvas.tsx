"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useActivePage, useProjectStore } from "@/lib/store/project-store";
import { SectionBlock } from "./SectionBlock";
import { LayoutTemplate } from "lucide-react";
import { ChatbotWidget } from "@/components/chatbot/ChatbotWidget";
import { FLOATING_CHAT } from "@/lib/registry/chatbot";
import { useEffect, useMemo } from "react";
import { buildTokens, cssVarsFor, fontsOf, siteAttrs } from "@/lib/style/engine";
import { ensureFonts } from "@/lib/style/fonts";
import type { StyleSpec } from "@/lib/style/types";

export function Canvas() {
  const page = useActivePage();
  const breakpoint = useProjectStore((s) => s.breakpoint);
  const previewMode = useProjectStore((s) => s.previewMode);
  const themeMode = useProjectStore((s) => s.project?.theme.mode || "light");
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId);
  const selectNode = useProjectStore((s) => s.selectNode);
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-root" });
  const chatNode = useProjectStore((s) => s.project?.pages.flatMap((pg) => pg.tree).find((n) => n.type === "chatbot" && FLOATING_CHAT.has(n.variant) && !n.hidden));
  const design = useProjectStore((s) => (s.project?.theme as any)?.design?.spec) as StyleSpec | undefined;
  const styled = useMemo(() => {
    if (!design) return null;
    const spec = { ...design, mode: themeMode } as StyleSpec;
    return { attrs: siteAttrs(spec), vars: cssVarsFor(spec, buildTokens(spec), themeMode) as React.CSSProperties, fonts: fontsOf(spec) };
  }, [design, themeMode]);
  useEffect(() => {
    if (styled) ensureFonts(styled.fonts);
  }, [styled]);

  const widths: Record<string, string> = { desktop: "1100px", tablet: "760px", mobile: "390px" };

  return (
    <main
      className="flex h-full min-h-0 min-w-0 flex-1 items-start justify-center overflow-auto overscroll-contain px-10 pb-40 pt-10"
      style={{
        backgroundColor: "var(--bg-app)",
        backgroundImage: "radial-gradient(var(--border-light) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
      onClick={() => selectNode(null)}
    >
      <div
        ref={setNodeRef}
        className={`site-preview ${previewMode ? "is-preview" : ""} ${styled ? "" : `theme-${themeMode}`} relative min-h-[600px] shrink-0 self-start overflow-hidden rounded-xl bg-white shadow-2xl transition-[width] ${
          isOver ? "outline outline-2 outline-primary outline-offset-[-2px]" : ""
        }`}
        {...(styled?.attrs || {})}
        style={{
          ...(styled?.vars || {}),
          width: widths[breakpoint],
          maxWidth: breakpoint === "desktop" ? "100%" : undefined,
        }}
      >
        {page && page.tree.length > 0 ? (
          <SortableContext items={page.tree.map((n) => n.id)} strategy={verticalListSortingStrategy}>
            {page.tree.map((node) =>
              node.hidden && previewMode ? null : (
                <SectionBlock
                  key={node.id}
                  node={node}
                  selected={!previewMode && node.id === selectedNodeId}
                  onSelect={() => selectNode(node.id)}
                />
              )
            )}
          </SortableContext>
        ) : (
          <div className="flex h-[500px] flex-col items-center justify-center gap-3 text-center text-slate-400">
            <LayoutTemplate className="h-8 w-8 text-primary/50" />
            <p className="max-w-xs text-sm">This page is empty. Drag a component from the left, or click one to add it.</p>
          </div>
        )}
        {chatNode && <ChatbotWidget dock variant={chatNode.variant as "widget" | "whatsapp" | "bubble"} p={chatNode.props} />}
      </div>
    </main>
  );
}
