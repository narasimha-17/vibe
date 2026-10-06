export interface Node {
  id: string;
  type: string;
  variant: string;
  name: string;
  props: Record<string, any>;
  style: Record<string, any>;
  responsive: Record<string, any>;
  children: Node[];
  locked: boolean;
  hidden: boolean;
}

export interface PageData {
  id: string;
  name: string;
  path: string;
  is_home: boolean;
  order: number;
  tree: Node[];
}

export interface DesignTokens {
  mode?: "light" | "dark";
  colors: Record<string, string>;
  heading_font: string;
  body_font: string;
  scale: number;
  spacing: number[];
  radius: number[];
  shadows: string[];
  breakpoints: Record<string, number>;
  /** Style Studio design system (spec is regenerated into tokens at render time). */
  design?: { spec: any } | null;
}

export interface SeoSettings {
  title?: string;
  description?: string;
}

export interface ProjectSettings {
  seo?: SeoSettings;
  favicon?: string;
  analyticsId?: string;
}

export interface GithubRepoInfo {
  repo_url: string;
  branch: string;
  last_commit_sha: string;
}

export interface Project {
  id: string;
  name: string;
  theme: DesignTokens;
  settings: ProjectSettings;
  github_repo: GithubRepoInfo | null;
  template_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail extends Project {
  pages: PageData[];
}

export interface Asset {
  id: string;
  filename: string;
  url: string;
  content_type: string;
  size_bytes: number;
  folder: string;
  created_at: string;
}

export interface Snapshot {
  id: string;
  label: string;
  created_at: string;
}

export type AIOpType =
  | "add_component"
  | "delete_component"
  | "update_component"
  | "move_component"
  | "duplicate_component"
  | "update_style"
  | "update_theme"
  | "create_page"
  | "replace_content";

export interface AIOp {
  op: AIOpType;
  description: string;
  target_id: string | null;
  payload: Record<string, any>;
}

export interface AICommandResponse {
  message: string;
  ops: AIOp[];
  provider: "rule_based" | "anthropic" | "ollama" | "assistant";
  preview?: boolean;
  choices?: string[];
}

export type Framework = "nextjs" | "react" | "html";

export type BackendFramework = "fastapi" | "flask" | "django";

export interface BackendOptions {
  enabled: boolean;
  framework: BackendFramework;
  database: "sqlite" | "postgres" | "mysql";
  auth: boolean;
  docker: boolean;
  cors_origin: string;
}

export interface CodegenOptions {
  framework: Framework;
  language: "typescript" | "javascript";
  styling: "tailwind" | "css";
  seo: boolean;
  accessibility: boolean;
  dark_mode: boolean;
  backend?: BackendOptions;
}

export interface CodeFile {
  path: string;
  content: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  plan: string;
  has_password?: boolean;
  google_linked?: boolean;
  github_linked?: boolean;
  created_at?: string | null;
}
