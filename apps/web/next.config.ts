import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["tiptap-markdown", "markdown-it", "markdown-it-task-lists"],
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "markdown-it": "markdown-it/dist/index.cjs.js",
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/widget/ai",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *;",
          },
        ],
      },
      {
        source: "/widget/ai/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *;",
          },
        ],
      },
      {
        source: "/widget/ai/launcher",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *;",
          },
        ],
      },
      {
        source: "/widget/ai/messenger",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
