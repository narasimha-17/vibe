/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "http", hostname: "localhost" }],
  },
  // Uploaded assets (logos, photos) are stored on the API and referenced by relative "/static/..." URLs so the
  // same URL works from the builder, from exported code and inside sandboxed custom-section previews. The web
  // app itself doesn't serve that path, so proxy it straight through to the API, same as /api/proxy/*.
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return [{ source: "/static/:path*", destination: `${api}/static/:path*` }];
  },
};

export default nextConfig;
