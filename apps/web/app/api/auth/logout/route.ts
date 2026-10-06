import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/server-config";

export async function POST() {
  cookies().delete(AUTH_COOKIE);
  return NextResponse.json({ ok: true });
}
