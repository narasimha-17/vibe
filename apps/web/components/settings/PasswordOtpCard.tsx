"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Mail, MailOpen } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { User } from "@/lib/types";
import { Card, Field } from "./SettingsUI";

interface OtpSent {
  email: string;
  expires_in: number;
  resend_in: number;
  delivery: "email" | "console";
  dev_code: string | null;
}

const LENGTH = 6;

function detailOf(e: unknown, fallback: string) {
  if (e instanceof ApiError && typeof e.detail === "object" && e.detail && "detail" in (e.detail as object)) {
    const d = (e.detail as { detail: unknown }).detail;
    if (typeof d === "string") return d;
  }
  return fallback;
}

function mmss(seconds: number) {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function PasswordOtpCard({ user, onUserChange }: { user: User; onUserChange: (u: User) => void }) {
  const [step, setStep] = useState<"start" | "code" | "done">("start");
  const [sent, setSent] = useState<OtpSent | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step !== "code") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);

  const code = digits.join("");
  const secondsLeft = Math.ceil((expiresAt - now) / 1000);
  const resendIn = Math.ceil((resendAt - now) / 1000);
  const expired = step === "code" && secondsLeft <= 0;
  const canSubmit = code.length === LENGTH && password.length >= 8 && password === confirm && !expired && !busy;

  const title = user.has_password ? "Change password" : "Set a password";
  const passwordHint = useMemo(() => {
    if (!password && !confirm) return "Use at least 8 characters.";
    if (password.length < 8) return "Use at least 8 characters.";
    if (confirm && password !== confirm) return "Passwords don't match yet.";
    return "";
  }, [password, confirm]);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<OtpSent>("auth/password-otp/send");
      setSent(res);
      setNow(Date.now());
      setExpiresAt(Date.now() + res.expires_in * 1000);
      setResendAt(Date.now() + res.resend_in * 1000);
      setDigits(Array(LENGTH).fill(""));
      setStep("code");
      setTimeout(() => refs.current[0]?.focus(), 50);
      toast(res.delivery === "email" ? `Code sent to ${res.email}` : "Code generated.");
    } catch (e) {
      setError(detailOf(e, "Couldn't send the code. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  function setDigit(i: number, value: string) {
    const d = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => prev.map((x, idx) => (idx === i ? d : x)));
    if (d && i < LENGTH - 1) refs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < LENGTH - 1) refs.current[i + 1]?.focus();
  }

  function onPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!pasted) return;
    e.preventDefault();
    setDigits(Array.from({ length: LENGTH }, (_, i) => pasted[i] ?? ""));
    refs.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("auth/password-otp/confirm", { code, new_password: password });
      onUserChange({ ...user, has_password: true });
      setStep("done");
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(detailOf(err, "Couldn't update your password."));
      setDigits(Array(LENGTH).fill(""));
      refs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={title} description="For your security, we confirm it's you with a one-time code emailed to your address.">
      <div className="overflow-hidden rounded-2xl border border-border-light bg-gradient-to-b from-primary/[0.04] to-transparent">
        {step === "start" && (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="relative mb-5 grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
              <Mail className="relative h-7 w-7" strokeWidth={1.7} />
            </span>
            <h3 className="mb-1 text-lg font-semibold text-main">Verify your email</h3>
            <p className="mb-6 max-w-sm text-sm text-muted">
              We&apos;ll send a 6-digit code to <span className="font-semibold text-main">{user.email}</span>. It expires in 10 minutes.
            </p>
            {error && <p role="alert" className="auth-shake mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <button className="btn btn-primary" onClick={sendCode} disabled={busy}>
              {busy ? "Sending…" : "Send verification code"}
            </button>
          </div>
        )}

        {step === "code" && sent && (
          <form onSubmit={submit} className="px-6 py-8 sm:px-10">
            <div className="mb-6 flex flex-col items-center text-center">
              <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                <MailOpen className="h-6 w-6" strokeWidth={1.7} />
              </span>
              <h3 className="text-lg font-semibold text-main">Enter the code</h3>
              <p className="mt-1 text-sm text-muted">
                {sent.delivery === "email" ? (
                  <>
                    We emailed a 6-digit code to <span className="font-semibold text-main">{sent.email}</span>.
                  </>
                ) : (
                  <>Email delivery isn&apos;t set up on this server, so the code was written to the API console.</>
                )}
              </p>
            </div>

            {sent.dev_code && (
              <div className="mx-auto mb-5 flex max-w-md items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                <span>
                  Local dev — your code is <span className="font-mono text-base font-bold tracking-widest">{sent.dev_code}</span>
                </span>
                <button
                  type="button"
                  className="font-bold underline"
                  onClick={() => {
                    setDigits(sent.dev_code!.split(""));
                    refs.current[LENGTH - 1]?.focus();
                  }}
                >
                  Fill
                </button>
              </div>
            )}

            <div className="mb-3 flex justify-center gap-2.5 sm:gap-3" onPaste={onPaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  value={d}
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  aria-label={`Digit ${i + 1}`}
                  maxLength={1}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                  className={`h-14 w-11 rounded-xl border-2 bg-white text-center font-mono text-2xl font-bold text-main outline-none transition sm:w-12 ${
                    d ? "border-primary" : "border-border-light"
                  } focus:border-primary focus:shadow-[0_0_0_4px_rgba(107,77,154,0.15)]`}
                />
              ))}
            </div>

            <div className="mb-6 flex items-center justify-center gap-3 text-xs text-muted">
              <span className={expired ? "font-semibold text-red-600" : ""}>{expired ? "Code expired" : `Expires in ${mmss(secondsLeft)}`}</span>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={sendCode} disabled={busy || resendIn > 0} className="font-semibold text-primary disabled:text-muted disabled:no-underline hover:underline">
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </div>

            <div className={`mx-auto grid max-w-md gap-4 transition-opacity ${code.length === LENGTH ? "opacity-100" : "pointer-events-none opacity-40"}`}>
              <Field label="New password" hint={passwordHint}>
                <input className="input-field" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Field label="Confirm new password">
                <input className="input-field" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </Field>
            </div>

            {error && (
              <p role="alert" className="auth-shake mx-auto mt-4 max-w-md rounded-md border border-red-300 bg-red-50 px-3 py-2 text-center text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-center gap-3">
              <button type="button" className="btn" onClick={() => setStep("start")}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={!canSubmit}>
                {busy ? "Verifying…" : user.has_password ? "Verify & update password" : "Verify & set password"}
              </button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <CheckCircle2 className="mb-4 h-14 w-14 text-emerald-500" strokeWidth={1.5} />
            <h3 className="mb-1 text-lg font-semibold text-main">Password updated</h3>
            <p className="mb-6 max-w-sm text-sm text-muted">Use your new password next time you sign in.</p>
            <button className="btn" onClick={() => setStep("start")}>
              Done
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
