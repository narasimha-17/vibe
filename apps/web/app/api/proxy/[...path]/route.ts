import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL, AUTH_COOKIE } from "@/lib/server-config";

/**
 * Generic authenticated proxy: the browser only ever holds an httpOnly
 * cookie, never the JWT itself. Client components call `/api/proxy/*`
 * (same-origin, cookie sent automatically); this route reads the cookie
 * server-side and forwards the request to FastAPI with a Bearer header.
 * Bytes pass through unchanged in both directions, so this also handles
 * multipart asset uploads and the binary ZIP download without special-casing.
 */
async function handle(req: NextRequest, { params }: { params: { path: string[] } }) {
  const token = cookies().get(AUTH_COOKIE)?.value;
  const targetPath = params.path.join("/");
  const search = req.nextUrl.search;
  const url = `${API_BASE_URL}/${targetPath}${search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (token) headers.set("authorization", `Bearer ${token}`);

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const res = await fetch(url, {
    method: req.method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  const passthroughHeaders = ["content-type", "content-disposition"];
  for (const h of passthroughHeaders) {
    const v = res.headers.get(h);
    if (v) responseHeaders.set(h, v);
  }

  const buf = await res.arrayBuffer();
  return new NextResponse(buf, { status: res.status, headers: responseHeaders });
}

export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as PUT,
  handle as DELETE,
};
