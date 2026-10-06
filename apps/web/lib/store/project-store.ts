import { create } from "zustand";
import type { AIOp, DesignTokens, Node, PageData, ProjectDetail } from "@/lib/types";
import { REGISTRY } from "@/lib/registry";
import { getByPath, setByPath } from "@/lib/registry/types";

interface Snapshot {
  name: string;
  theme: DesignTokens;
  pages: PageData[];
}

interface ProjectState {
  project: ProjectDetail | null;
  activePageId: string | null;
  selectedNodeId: string | null;
  breakpoint: "desktop" | "tablet" | "mobile";
  previewMode: boolean;
  dirty: boolean;
  past: Snapshot[];
  future: Snapshot[];

  loadProject: (project: ProjectDetail) => void;
  snapshot: () => Snapshot;
  restore: (s: Snapshot) => void;
  commit: (mutate: (draft: Snapshot) => Snapshot) => void;
  undo: () => void;
  redo: () => void;

  setActivePage: (id: string) => void;
  selectNode: (id: string | null) => void;
  setBreakpoint: (b: "desktop" | "tablet" | "mobile") => void;
  togglePreview: () => void;

  renameProject: (name: string) => void;
  updateTheme: (partial: Partial<DesignTokens> | Record<string, any>) => void;

  addNode: (type: string, variant?: string, atIndex?: number) => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  moveNode: (id: string, toIndex: number) => void;
  updateNodeField: (id: string, path: string, value: any) => void;
  renameNode: (id: string, name: string) => void;
  toggleLock: (id: string) => void;
  toggleHidden: (id: string) => void;

  createPage: (name: string, path: string) => void;
  deletePage: (id: string) => void;
  addPages: (pages: { id?: string; name: string; path: string; tree: PageData["tree"] }[]) => void;

  applyOps: (ops: AIOp[]) => void;

  markSaved: () => void;
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function activePage(pages: PageData[], id: string | null): PageData | undefined {
  return pages.find((p) => p.id === id) || pages[0];
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  activePageId: null,
  selectedNodeId: null,
  breakpoint: "desktop",
  previewMode: false,
  dirty: false,
  past: [],
  future: [],

  loadProject: (project) =>
    set({
      project,
      activePageId: project.pages.find((p) => p.is_home)?.id || project.pages[0]?.id || null,
      selectedNodeId: null,
      past: [],
      future: [],
      dirty: false,
    }),

  snapshot: () => {
    const { project } = get();
    return { name: project!.name, theme: project!.theme, pages: structuredClone(project!.pages) };
  },

  restore: (s) =>
    set((state) => ({
      project: state.project ? { ...state.project, name: s.name, theme: s.theme, pages: s.pages } : state.project,
    })),

  commit: (mutate) => {
    const { project, past } = get();
    if (!project) return;
    const before = get().snapshot();
    const after = mutate(structuredClone(before));
    set({
      project: { ...project, name: after.name, theme: after.theme, pages: after.pages },
      past: [...past.slice(-49), before],
      future: [],
      dirty: true,
    });
  },

  undo: () => {
    const { past, future, project } = get();
    if (past.length === 0 || !project) return;
    const previous = past[past.length - 1];
    const current = get().snapshot();
    set({
      project: { ...project, name: previous.name, theme: previous.theme, pages: previous.pages },
      past: past.slice(0, -1),
      future: [current, ...future],
      dirty: true,
    });
  },

  redo: () => {
    const { past, future, project } = get();
    if (future.length === 0 || !project) return;
    const next = future[0];
    const current = get().snapshot();
    set({
      project: { ...project, name: next.name, theme: next.theme, pages: next.pages },
      past: [...past, current],
      future: future.slice(1),
      dirty: true,
    });
  },

  setActivePage: (id) => set({ activePageId: id, selectedNodeId: null }),
  selectNode: (id) => set({ selectedNodeId: id }),
  setBreakpoint: (b) => set({ breakpoint: b }),
  togglePreview: () => set((s) => ({ previewMode: !s.previewMode, selectedNodeId: null })),

  renameProject: (name) => get().commit((draft) => ({ ...draft, name })),

  updateTheme: (partial) =>
    get().commit((draft) => {
      const theme = { ...draft.theme } as any;
      for (const [key, value] of Object.entries(partial)) {
        theme[key] = key === "colors" ? { ...theme.colors, ...(value as any) } : value;
      }
      return { ...draft, theme };
    }),

  addNode: (type, variant, atIndex) =>
    get().commit((draft) => {
      const def = REGISTRY[type];
      if (!def) return draft;
      const chosenVariant = variant || def.variants[0].id;
      const node: Node = {
        id: genId(),
        type,
        variant: chosenVariant,
        name: def.label,
        props: structuredClone(def.defaultProps),
        style: {},
        responsive: {},
        children: [],
        locked: false,
        hidden: false,
      };
      const page = activePage(draft.pages, get().activePageId);
      if (!page) return draft;
      const idx = atIndex ?? page.tree.length;
      page.tree.splice(idx, 0, node);
      set({ selectedNodeId: node.id });
      return draft;
    }),

  deleteNode: (id) =>
    get().commit((draft) => {
      const page = activePage(draft.pages, get().activePageId);
      if (!page) return draft;
      page.tree = page.tree.filter((n) => n.id !== id);
      if (get().selectedNodeId === id) set({ selectedNodeId: page.tree[0]?.id || null });
      return draft;
    }),

  duplicateNode: (id) =>
    get().commit((draft) => {
      const page = activePage(draft.pages, get().activePageId);
      if (!page) return draft;
      const idx = page.tree.findIndex((n) => n.id === id);
      if (idx === -1) return draft;
      const clone: Node = { ...structuredClone(page.tree[idx]), id: genId() };
      page.tree.splice(idx + 1, 0, clone);
      set({ selectedNodeId: clone.id });
      return draft;
    }),

  moveNode: (id, toIndex) =>
    get().commit((draft) => {
      const page = activePage(draft.pages, get().activePageId);
      if (!page) return draft;
      const fromIndex = page.tree.findIndex((n) => n.id === id);
      if (fromIndex === -1) return draft;
      const [node] = page.tree.splice(fromIndex, 1);
      page.tree.splice(toIndex, 0, node);
      return draft;
    }),

  updateNodeField: (id, path, value) =>
    get().commit((draft) => {
      const page = activePage(draft.pages, get().activePageId);
      if (!page) return draft;
      const node = page.tree.find((n) => n.id === id);
      if (!node) return draft;
      node.props = setByPath(node.props, path, value);
      return draft;
    }),

  renameNode: (id, name) =>
    get().commit((draft) => {
      const page = activePage(draft.pages, get().activePageId);
      const node = page?.tree.find((n) => n.id === id);
      if (node) node.name = name;
      return draft;
    }),

  toggleLock: (id) =>
    get().commit((draft) => {
      const page = activePage(draft.pages, get().activePageId);
      const node = page?.tree.find((n) => n.id === id);
      if (node) node.locked = !node.locked;
      return draft;
    }),

  toggleHidden: (id) =>
    get().commit((draft) => {
      const page = activePage(draft.pages, get().activePageId);
      const node = page?.tree.find((n) => n.id === id);
      if (node) node.hidden = !node.hidden;
      return draft;
    }),

  createPage: (name, path) =>
    get().commit((draft) => {
      const page: PageData = {
        id: genId(),
        name,
        path,
        is_home: false,
        order: draft.pages.length,
        tree: [],
      };
      draft.pages.push(page);
      set({ activePageId: page.id, selectedNodeId: null });
      return draft;
    }),

  deletePage: (id) =>
    get().commit((draft) => {
      const target = draft.pages.find((p) => p.id === id);
      if (!target || target.is_home || draft.pages.length <= 1) return draft; // the home page always stays
      const index = draft.pages.indexOf(target);
      draft.pages.splice(index, 1);
      draft.pages.forEach((p, i) => { p.order = i; });
      if (get().activePageId === id) set({ activePageId: (draft.pages[index] || draft.pages[index - 1] || draft.pages[0]).id, selectedNodeId: null });
      return draft;
    }),

  addPages: (pages) =>
    get().commit((draft) => {
      let first: string | null = null;
      for (const p of pages) {
        const page: PageData = { id: p.id || genId(), name: p.name, path: p.path, is_home: false, order: draft.pages.length, tree: p.tree };
        draft.pages.push(page);
        first = first || page.id;
      }
      if (first) set({ activePageId: first, selectedNodeId: null });
      return draft;
    }),

  applyOps: (ops) =>
    get().commit((draft) => {
      for (const op of ops) {
        // an edit can target another page (site-wide translation) or the page being edited
        const targetId: string | undefined = op.payload?.page_id;
        const page: PageData | undefined = (targetId ? draft.pages.find((p) => p.id === targetId) : undefined) || activePage(draft.pages, get().activePageId);
        if (!page) continue;
        if (op.op === "update_theme") {
          const theme = { ...draft.theme } as any;
          for (const [key, value] of Object.entries(op.payload || {})) {
            theme[key] = key === "colors" ? { ...theme.colors, ...(value as any) } : value;
          }
          draft.theme = theme;
        } else if (op.op === "add_component" && op.payload.node) {
          const node = structuredClone(op.payload.node);
          const at = typeof op.payload.index === "number" ? Math.max(0, Math.min(op.payload.index, page.tree.length)) : page.tree.length;
          page.tree.splice(at, 0, node);
        } else if (op.op === "move_component" && op.target_id) {
          const from = page.tree.findIndex((n) => n.id === op.target_id);
          if (from !== -1) {
            const [node] = page.tree.splice(from, 1);
            page.tree.splice(Math.max(0, Math.min(op.payload.index ?? 0, page.tree.length)), 0, node);
          }
        } else if (op.op === "add_component") {
          const def = REGISTRY[op.payload.type];
          if (def) {
            page.tree.push({
              id: genId(),
              type: op.payload.type,
              variant: op.payload.variant || def.variants[0].id,
              name: def.label,
              props: structuredClone(def.defaultProps),
              style: {},
              responsive: {},
              children: [],
              locked: false,
              hidden: false,
            });
          }
        } else if (op.op === "delete_component" && op.target_id) {
          page.tree = page.tree.filter((n) => n.id !== op.target_id);
        } else if (op.op === "update_style" && op.target_id) {
          const node = page.tree.find((n) => n.id === op.target_id);
          if (node) node.style = { ...node.style, ...(op.payload.style || {}) };
        } else if (op.op === "update_component" && op.target_id) {
          const node = page.tree.find((n) => n.id === op.target_id);
          if (node) {
            node.props = { ...node.props, ...(op.payload.props || {}) };
            if (op.payload.variant) node.variant = op.payload.variant;
          }
        } else if (op.op === "duplicate_component" && op.target_id) {
          const idx = page.tree.findIndex((n) => n.id === op.target_id);
          if (idx !== -1) page.tree.splice(idx + 1, 0, { ...structuredClone(page.tree[idx]), id: genId() });
        } else if (op.op === "create_page") {
          draft.pages.push({
            id: op.payload.id || genId(),
            name: op.payload.name || "New Page",
            path: op.payload.path || "/new-page",
            is_home: false,
            order: draft.pages.length,
            tree: op.payload.tree || [],
          });
        }
      }
      return draft;
    }),

  markSaved: () => set({ dirty: false }),
}));

export function useActivePage(): PageData | undefined {
  const project = useProjectStore((s) => s.project);
  const activePageId = useProjectStore((s) => s.activePageId);
  if (!project) return undefined;
  return project.pages.find((p) => p.id === activePageId) || project.pages[0];
}

export function useSelectedNode(): Node | undefined {
  const page = useActivePage();
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId);
  return page?.tree.find((n) => n.id === selectedNodeId);
}
