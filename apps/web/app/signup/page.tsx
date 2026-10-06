"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthError, AuthInput, AuthPassword, AuthSubmit, SocialRow } from "@/components/auth/AuthFields";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/dashboard");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.detail || "Couldn't create your account.");
    }
  }

  return (
    <AuthShell
      reverse
      title="Sign up"
      switchText="Already a member?"
      switchLabel="Sign in"
      switchHref="/login"
      panelTitle="Start building what's next."
      panelText="Design visually, build intelligently, and keep every line of code you generate."
    >
      <AuthError key={error} message={error} />
      <form onSubmit={submit} className="auth-stagger flex flex-col gap-3.5">
        <AuthInput placeholder="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <AuthInput required type="email" placeholder="Email address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <AuthPassword required minLength={8} placeholder="Password (8+ characters)" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <AuthPassword required placeholder="Confirm password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <label className="flex items-center gap-2 text-xs text-[#7a6d96]">
          <input required type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="accent-[#6b4d9a]" />
          I agree to the terms of service
        </label>
        <AuthSubmit loading={loading} loadingText="Creating account…">
          Create Account
        </AuthSubmit>
      </form>
      <SocialRow label="or sign up with" />
    </AuthShell>
  );
}
