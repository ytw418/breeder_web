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
    domains: [
      "imagedelivery.net",
      "k.kakaocdn.net",
      "lh3.googleusercontent.com",
    ],
  },
};

module.exports = nextConfig;
