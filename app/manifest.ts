import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bredy",
    short_name: "Bredy",
    description:
      "브리더들의 SNS 브리디 - 분양·거래·랭킹·무료경매",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    lang: "ko",
    categories: ["shopping", "social"],
    icons: [
      {
        src: "/images/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/images/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/images/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
