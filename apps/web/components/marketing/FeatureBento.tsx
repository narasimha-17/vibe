import { REGISTRY_LIST } from "@/lib/registry";

const SWATCHES = ["#6b4d9a", "#ff5b7f", "#22d3ee", "#f5a524", "#3b2d5a", "#ece6fb"];

function Tile({ className = "", title, text, children }: { className?: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className={`group flex flex-col overflow-hidden rounded-2xl border border-border-light bg-surface p-6 shadow-[0_10px_30px_rgba(59,45,90,0.06)] transition duration-300 hover:-translate-y-1 hover:border-primary/40 ${className}`}>
      <div className="mb-5 flex-1">{children}</div>
      <h3 className="mb-1 font-semibold text-main">{title}</h3>
      <p className="text-sm leading-relaxed text-muted">{text}</p>
    </div>
  );
}

export function FeatureBento() {
  return (
    <div className="mx-auto mt-14 grid max-w-6xl gap-5 lg:grid-cols-3">
      <Tile className="lg:col-span-2" title="Drag, drop and edit in place" text="Fourteen block types with multiple variants each. Drop them anywhere, reorder sections, and edit every value from the inspector.">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {REGISTRY_LIST.slice(0, 10).map((c, i) => (
            <div
              key={c.type}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border-light bg-app px-2 py-3 text-[11px] font-medium text-main transition group-hover:border-primary/30"
              style={{ transitionDelay: `${i * 20}ms` }}
            >
              <span className="text-base text-primary">{c.icon}</span>
              {c.label}
            </div>
          ))}
        </div>
      </Tile>

      <Tile title="One design system" text="Change a color or font token once and the whole site follows — in the editor and in the exported CSS.">
        <div className="mb-3 flex gap-2">
          {SWATCHES.map((c) => (
            <span key={c} className="h-8 w-8 rounded-full border border-black/5 shadow-sm transition-transform group-hover:scale-110" style={{ background: c }} />
          ))}
        </div>
        <div className="rounded-xl bg-app p-3 text-sm">
          <div className="text-2xl font-extrabold tracking-tight text-main">Aa</div>
          <div className="text-xs text-muted">Inter · Heading 700 / Body 400</div>
        </div>
      </Tile>

      <Tile title="AI that shows its work" text="Every AI edit is a small, typed operation you can apply or reject — never a silent rewrite.">
        <div className="space-y-2 text-xs">
          {[
            ["add_component", "Add a pricing section", true],
            ["update_theme", "Switch to a dark palette", false],
          ].map(([op, label, on]) => (
            <div key={String(op)} className="flex items-center justify-between rounded-lg border border-border-light bg-app px-3 py-2">
              <div>
                <div className="font-mono text-[10px] text-primary">{String(op)}</div>
                <div className="font-medium text-main">{String(label)}</div>
              </div>
              <span className={`rounded-md px-2 py-1 font-bold ${on ? "bg-primary text-white" : "text-muted"}`}>{on ? "Apply" : "Reject"}</span>
            </div>
          ))}
        </div>
      </Tile>

      <Tile title="Desktop, tablet, mobile" text="Switch breakpoints while you design, and export markup that is genuinely responsive.">
        <div className="flex items-end gap-3">
          {[
            ["w-24 h-16", "Desktop"],
            ["w-14 h-16", "Tablet"],
            ["w-8 h-14", "Mobile"],
          ].map(([size, label]) => (
            <div key={label} className="text-center">
              <div className={`${size} mb-1.5 rounded-md border-2 border-primary/40 bg-primary/10 transition group-hover:border-primary`} />
              <span className="text-[10px] font-semibold text-muted">{label}</span>
            </div>
          ))}
        </div>
      </Tile>

      <Tile title="Undo, autosave, history" text="Every edit is undoable, changes save automatically, and you can restore an earlier version of the project.">
        <ul className="space-y-1.5 text-xs">
          {["Added Pricing section", "Changed primary color", "Edited Hero headline"].map((h, i) => (
            <li key={h} className={`flex items-center justify-between rounded-lg px-3 py-2 ${i === 0 ? "bg-primary/10 font-semibold text-primary" : "bg-app text-muted"}`}>
              {h}
              <span className="text-[10px]">{i === 0 ? "now" : `${i * 2}m ago`}</span>
            </li>
          ))}
        </ul>
      </Tile>
    </div>
  );
}
