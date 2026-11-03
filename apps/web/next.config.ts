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
  // The original Kosmographica HTML pages fetch their data by relative URL. These
  // rewrites (beforeFiles, so they win over the file copies in public/) answer
  // those URLs from the database instead.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/kosmo/static/catalog/objects.json",
          destination: "/api/kosmo/data/catalog/objects.json",
        },
        {
          source: "/kosmo/static/university-tree.js",
          destination: "/api/kosmo/data/university-tree.js",
        },
        {
          source: "/kosmo/static/history-taxonomy.js",
          destination: "/api/kosmo/data/history-taxonomy.js",
        },
        {
          source: "/kosmo/static/small-bodies.json",
          destination: "/api/kosmo/data/small-bodies.json",
        },
        {
          source: "/kosmo/static/effects.json",
          destination: "/api/kosmo/data/effects.json",
        },
        {
          source: "/kosmo/static/university-exams.json",
          destination: "/api/kosmo/data/university-exams.json",
        },
        {
          source: "/kosmo/static/oracle/:file(.+-(?:data|claims)\\.js)",
          destination: "/api/kosmo/data/oracle/:file",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
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
