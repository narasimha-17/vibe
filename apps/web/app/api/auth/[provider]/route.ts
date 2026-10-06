import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/server-config";

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  if (!["google", "github"].includes(params.provider)) {
    return NextResponse.redirect(new URL("/login?error=unknown_provider", req.url));
  }

  const providersRes = await fetch(`${API_BASE_URL}/auth/providers`, { cache: "no-store" }).catch(() => null);
  const providers = providersRes && providersRes.ok ? await providersRes.json() : {};
  if (!providers[params.provider]) {
    return NextResponse.redirect(new URL(`/login?error=${params.provider}_not_configured`, req.url));
  }

  return NextResponse.redirect(`${API_BASE_URL}/auth/${params.provider}/start`);
}
