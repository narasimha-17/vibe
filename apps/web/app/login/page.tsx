"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthError, AuthInput, AuthPassword, AuthSubmit, SocialRow } from "@/components/auth/AuthFields";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "That sign-in attempt failed. Please try again.",
  unknown_provider: "Unknown sign-in provider.",
  google_not_configured: "Google sign-in isn't configured on this deployment yet.",
  github_not_configured: "GitHub sign-in isn't configured on this deployment yet.",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") ? ERROR_MESSAGES[params.get("error")!] || "Something went wrong." : null
  );
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push(params.get("next") || "/dashboard");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.detail || "Invalid email or password.");
    }
  }

  return (
    <AuthShell
      title="Sign in"
      switchText="New to VIBE?"
      switchLabel="Sign up"
      switchHref="/signup"
      panelTitle="Welcome back, builder."
      panelText="Pick up right where you left off — your canvas, components and code are waiting."
    >
      <AuthError key={error} message={error} />
      <form onSubmit={submit} className="auth-stagger flex flex-col gap-3.5">
        <AuthInput required type="email" placeholder="Email address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <AuthPassword required placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <AuthSubmit loading={loading} loadingText="Signing in…">
          Sign In
        </AuthSubmit>
      </form>
      <SocialRow label="or sign in with" />
    </AuthShell>
  );
}
