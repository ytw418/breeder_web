const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
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
  webpack(config) {
    // @svgr/webpack: turbopack.rules에서는 이미 설정되어 있지만
    // webpack 모드에서도 SVG를 React 컴포넌트로 import할 수 있도록 설정
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.(".svg")
    );

    config.module.rules.push(
      // *.svg?url → 기존 file-loader 적용 (이미지 URL로 사용)
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/,
      },
      // 그 외 *.svg → React 컴포넌트로 변환
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: {
          not: [...(fileLoaderRule.resourceQuery?.not || []), /url/],
        },
        use: ["@svgr/webpack"],
      }
    );

    // 기존 file-loader에서 SVG 제외 (위에서 별도 처리)
    fileLoaderRule.exclude = /\.svg$/i;

    return config;
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
});
