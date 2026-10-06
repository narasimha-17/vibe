import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, AUTH_COOKIE } from "@/lib/server-config";

export async function GET(req: NextRequest) {
  if (!cookies().get(AUTH_COOKIE)?.value) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.redirect(`${API_BASE_URL}/github/connect/start`);
}
