"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { api, ApiError } from "@/lib/api-client";
import type { Project } from "@/lib/types";
import { toast } from "@/lib/toast";
import { DraftsMenu } from "@/components/dashboard/DraftsMenu";
import { ProjectCover } from "@/components/dashboard/ProjectCover";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      router.replace("/start");
    }
  }, [router]);

  async function refresh() {
    setLoadError(null);
    try {
      setProjects(await api.get<Project[]>("projects"));
    } catch (error) {
      setProjects(null);
      setLoadError(
        error instanceof ApiError && error.status === 401
          ? "Your session has expired. Sign in again to load your projects."
          : "We could not load your projects. Check that the API is running and try again."
      );
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function openProjectIntake() { try { sessionStorage.removeItem("vibe.guide.preset"); } catch {} router.push("/start"); }

  async function duplicateProject(id: string) {
    await api.post(`projects/${id}/duplicate`);
    toast("Project duplicated.");
    refresh();
  }

  async function deleteProject(id: string) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    await api.delete(`projects/${id}`);
    toast("Project deleted.");
    refresh();
  }

  async function renameProject(id: string, currentName: string) {
    const name = prompt("Rename project", currentName);
    if (!name) return;
    await api.patch(`projects/${id}`, { name });
    refresh();
  }

  return (
    <div className="app-shell min-h-screen">
      <DashboardHeader />
      <main className="dashboard-main mx-auto max-w-6xl px-8 py-12">
        <div className="dashboard-heading mb-10 flex items-center justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">Workspace</p>
            <h1 className="text-3xl font-bold tracking-tight text-main">Your projects</h1>
            <p className="mt-2 text-sm text-muted">Pick up where you left off, or start something new.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/templates" className="btn">
              Browse Templates
            </Link>
            <DraftsMenu variant="primary" />
          </div>
        </div>

        {projects === null && !loadError && <p className="text-sm text-muted">Loading projects…</p>}
        {loadError && (
          <div className="card-surface flex max-w-xl flex-col gap-4 p-6">
            <div>
              <p className="font-semibold text-main">Couldn&apos;t load your workspace</p>
              <p className="mt-1 text-sm text-muted">{loadError}</p>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={() => router.push("/login?next=/dashboard")}>
                Sign in
              </button>
              <button className="btn" onClick={refresh}>
                Try again
              </button>
            </div>
          </div>
        )}
        {projects && projects.length === 0 && (
          <div className="card-surface flex flex-col items-center gap-3 p-16 text-center">
            <div className="text-3xl">✦</div>
            <p className="text-main">No projects yet.</p>
            <p className="max-w-sm text-sm text-muted">Start from a blank canvas or a professionally designed template.</p>
            <button className="btn btn-primary" onClick={openProjectIntake}>
              Create your first project
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => (
            <div key={project.id} className="project-card card-surface group flex flex-col">
              <Link href={`/builder/${project.id}`} aria-label={`Open ${project.name}`} className="block">
                <ProjectCover seed={project.id} templateKey={project.template_key} />
              </Link>
              <div className="flex flex-1 flex-col gap-1 p-5">
                <Link href={`/builder/${project.id}`} className="font-semibold text-main transition hover:text-primary">
                  {project.name}
                </Link>
                <span className="text-xs text-muted">Last edited {new Date(project.updated_at).toLocaleDateString()}</span>
                <div className="mt-4 flex items-center gap-3 border-t border-border pt-3 text-xs">
                  <button className="text-muted hover:text-main" onClick={() => renameProject(project.id, project.name)}>
                    Rename
                  </button>
                  <button className="text-muted hover:text-main" onClick={() => duplicateProject(project.id)}>
                    Duplicate
                  </button>
                  <button className="text-muted hover:text-red-400" onClick={() => deleteProject(project.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
