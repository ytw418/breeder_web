import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/_next/",
          "/private/",
          "/admin/",
          "/auth",
          "/chat",
          "/fake",
          "/myPage",
          "/settings",
          "/editProfile",
          "/notifications",
          "/posts/upload",
          "/products/upload",
          "/search",
          "/profiles/*/edit",
          "/products/*/edit",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: [
          "/api/",
          "/_next/",
          "/private/",
          "/admin/",
          "/fake",
          "/myPage",
          "/settings",
          "/editProfile",
          "/notifications",
          "/chat",
          "/posts/upload",
          "/products/upload",
          "/auth",
          "/search",
        ],
      },
      {
        userAgent: "GPTBot",
        disallow: ["/"],
      },
      {
        userAgent: "ChatGPT-User",
        disallow: ["/"],
      },
      {
        userAgent: "Google-Extended",
        disallow: ["/"],
      },
    ],
    sitemap: "https://bredy.app/sitemap.xml",
    host: "https://bredy.app",
  };
}
