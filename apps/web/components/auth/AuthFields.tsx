"use client";

import { useState } from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function AuthInput(props: InputProps) {
  return (
    <input
      {...props}
      aria-label={props["aria-label"] || props.placeholder}
      className="auth-input w-full rounded-2xl bg-[#f0e6fb] px-3.5 py-3 text-sm text-[#3b2d5a] outline-none transition placeholder:text-[#a08bc4] focus:bg-[#e8dafa] focus:shadow-[0_0_0_2px_#b79be6]"
    />
  );
}

export function AuthPassword(props: Omit<InputProps, "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <AuthInput {...props} type={show ? "text" : "password"} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a72b8] transition hover:scale-110 hover:text-[#6b4d9a]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
          {show && <line x1="3" y1="21" x2="21" y2="3" />}
        </svg>
      </button>
    </div>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="auth-shake mb-4 rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
      {message}
    </div>
  );
}

export function AuthSubmit({ loading, children, loadingText }: { loading: boolean; children: React.ReactNode; loadingText: string }) {
  return (
    <button
      disabled={loading}
      className="auth-btn mx-auto mt-2 inline-flex min-w-[10rem] items-center justify-center gap-2 rounded-full bg-[#6b4d9a] px-8 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(107,77,154,0.35)] disabled:opacity-70"
    >
      {loading && <span className="auth-spinner" />}
      {loading ? loadingText : children}
    </button>
  );
}

export function SocialRow({ label }: { label: string }) {
  return (
    <div className="mt-7 text-center">
      <div className="mb-4 flex items-center gap-3 text-[11px] text-[#9a8bb5]">
        <span className="h-px flex-1 bg-[#e6def5]" />
        {label}
        <span className="h-px flex-1 bg-[#e6def5]" />
      </div>
      <div className="flex justify-center gap-4">
        <a href="/api/auth/google" aria-label="Continue with Google" className="auth-social">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
        </a>
        <a href="/api/auth/github" aria-label="Continue with GitHub" className="auth-social">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="#24292f" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
