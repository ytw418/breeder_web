import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bredy",
    short_name: "Bredy",
    description:
      "곤충 거래와 커뮤니티를 위한 Bredy 앱",
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
