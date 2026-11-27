import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js (leitura da fatura em PDF) roda no Node como está, sem passar pelo bundler
  serverExternalPackages: ["pdfjs-dist"],
  experimental: {
    // A fatura em PDF vai para uma server action (o padrão é 1 MB)
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
