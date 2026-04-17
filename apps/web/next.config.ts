import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  // Allow cross-origin dev asset requests (Next.js 15+)
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    // Server Actions CSRF origin allowlist.
    // Next.js matcher splits on "." so wildcards must align to a part boundary.
    // "127.0.0.*" matches any port on 127.0.0.1 (covers Cascade browser-preview proxies).
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        "127.0.0.*",
      ],
    },
  },
};

export default nextConfig;
