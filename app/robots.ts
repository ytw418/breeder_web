import { MetadataRoute } from "next";

/** 로그인·개인 화면·작성 화면. 어떤 봇도 들어가지 않는다. */
const PRIVATE_PATHS = [
  "/api/",
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
  "/posts/*/edit",
  "/auctions/*/edit",
];

/**
 * 생성형 검색(GEO, 2026-10-15): 답변에 출처로 인용하는 검색 봇과 사용자가 시켜서 페이지를 여는 봇은 허용한다.
 * ChatGPT 검색·Perplexity·Claude 가 브리디 분양글·게시글을 근거로 답하려면 이 봇들이 읽을 수 있어야 한다.
 */
const AI_SEARCH_AGENTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "Claude-SearchBot",
  "Claude-User",
];

/**
 * 모델 학습용 수집 봇은 계속 막는다(사용자 글·사진을 학습 데이터로 내주지 않는다).
 * Google-Extended 는 구글 검색·AI 개요와 무관하고 Gemini 학습·근거 사용만 정한다.
 */
const AI_TRAINING_AGENTS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: AI_SEARCH_AGENTS, allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: AI_TRAINING_AGENTS, disallow: ["/"] },
    ],
    sitemap: "https://bredy.app/sitemap.xml",
    host: "https://bredy.app",
  };
}
