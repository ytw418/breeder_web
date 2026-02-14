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
  },
};

module.exports = withSentryConfig(nextConfig, {
  org: "bredy",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  disableLogger: true,
});
