const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [{ hostname: "**" }],
    // Vercel 이미지 최적화 및 캐싱 설정
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30일 캐시
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // 실험적 기능: 부분 사전 렌더링 (PPR) 활성화
  // ISR과 함께 사용하여 성능 최적화
  experimental: {
    // PPR 활성화 시 ISR과 함께 사용되어 더 빠른 페이지 로딩 제공
    // ppr: true, // 안정화 버전에서 활성화 고려
  },
  // 캐싱 최적화: onDemandEntries 설정
  // 개발 모드에서도 페이지를 메모리에 유지하는 시간 설정
  onDemandEntries: {
    // 페이지를 메모리에 유지하는 시간 (밀리초)
    maxInactiveAge: 60 * 1000,
    // 동시에 메모리에 유지할 수 있는 페이지 수
    pagesBufferLength: 5,
  },
};

module.exports = withSentryConfig(nextConfig, {
  org: "bredy",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  disableLogger: true,
});
