"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectGuide, type GuidePreset } from "@/components/dashboard/ProjectGuide";
import { api } from "@/lib/api-client";
import { applyRecipe } from "@/lib/style/templates";
import type { Recipe } from "@/lib/style/templates";
import type { ProjectDetail } from "@/lib/types";
import { toast } from "@/lib/toast";

type Stored = GuidePreset & { recipe?: Recipe };

/** The requirements conversation, on its own page. Optionally starts from a template chosen on /templates. */
export default function StartPage() {
  const router = useRouter();
  const [preset, setPreset] = useState<Stored | null | undefined>(undefined);
  const [draftId, setDraftId] = useState<string | undefined>();

  useEffect(() => {
    setDraftId(new URLSearchParams(window.location.search).get("draft") || undefined);
    try {
      const raw = sessionStorage.getItem("vibe.guide.preset");
      setPreset(raw ? (JSON.parse(raw) as Stored) : null);
    } catch {
      setPreset(null);
    }
  }, []);

  if (preset === undefined) return <div className="h-screen bg-white" />;

  async function finish(projectId: string) {
    try { sessionStorage.removeItem("vibe.guide.preset"); } catch {}
    if (preset?.recipe) {
      try {
        const project = await api.get<ProjectDetail>(`projects/${projectId}`);
        const pages = project.pages.map((pg) => ({ ...pg, tree: applyRecipe(pg.tree, preset.recipe!) }));
        await api.put(`projects/${projectId}/sync`, { name: project.name, theme: project.theme, pages });
      } catch {
        toast("Your workspace was created, but the style couldn't be applied fully.");
      }
    }
    router.push(`/design/${projectId}`); // pick each section's style (or describe a custom one), then the builder opens and the agents build
  }

  return (
    <ProjectGuide
      preset={preset ? { templateKey: preset.templateKey, title: preset.title, spec: preset.spec } : undefined}
      onClose={() => { try { sessionStorage.removeItem("vibe.guide.preset"); } catch {} router.push("/dashboard"); }}
      draftId={draftId}
      onCreated={finish}
    />
  );
}
