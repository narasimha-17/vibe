"use client";

import { useEffect } from "react";
import { REGISTRY } from "@/lib/registry";
import { useProjectStore } from "@/lib/store/project-store";
import { ScaledFrame } from "@/components/style/PreviewSite";

export function StylePickerModal({ componentType, onClose }: { componentType: string; onClose: () => void }) {
  const def = REGISTRY[componentType];
  const addNode = useProjectStore((s) => s.addNode);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!def) return null;

  function pick(variantId: string) {
    addNode(componentType, variantId);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1b1330]/70 p-4 backdrop-blur-md sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Choose a ${def.label} style`}
        className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/60 bg-gradient-to-b from-[#f6f2fd] to-[#ece6fb] shadow-[0_40px_100px_rgba(27,19,48,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 z-20 grid h-10 w-10 place-items-center rounded-full bg-white text-lg text-muted shadow-md transition hover:rotate-90 hover:text-main"
        >
          ✕
        </button>
        <div className="max-h-[88vh] overflow-y-auto p-6 sm:p-9">
        <div className="mb-7 flex items-start justify-between gap-6 pr-12">
          <div>
            <span className="mb-3 inline-block rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary shadow-sm">
              {def.variants.length} styles
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-main">
              Choose a <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{def.label}</span> style
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted">Pick a look — it lands on the canvas exactly as previewed, and every value stays editable.</p>
          </div>
        </div>

        <div className="grid items-start gap-5 sm:grid-cols-2">
          {def.variants.map((v, i) => (
            <button
              key={v.id}
              onClick={() => pick(v.id)}
              className="group overflow-hidden rounded-3xl border border-[#d6c9ee] bg-white text-left shadow-[0_8px_24px_rgba(107,77,154,0.08)] transition duration-300 hover:-translate-y-1.5 hover:border-primary hover:shadow-[0_24px_48px_rgba(107,77,154,0.25)]"
            >
              <div className="relative overflow-hidden bg-[#f3eefb]">
                <div className="site-preview relative bg-white shadow-[0_10px_24px_rgba(43,33,64,0.12)]">
                  <ScaledFrame width={1100} maxHeight={280}>
                    {v.render(def.defaultProps)}
                  </ScaledFrame>
                </div>
                <span className="absolute bottom-3 right-3 z-10 translate-y-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  + Add to page
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#ece6fb] px-5 py-3.5">
                <span className="text-[15px] font-bold text-main">{v.label}</span>
                <span className="font-mono text-[11px] font-bold text-[#b79be6]">{String(i + 1).padStart(2, "0")}</span>
              </div>
            </button>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}
