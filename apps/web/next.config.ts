import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Strict mode double-invokes effects in dev, which would join a call twice.
  reactStrictMode: false,
  poweredByHeader: false,
};

export default nextConfig;
