import type { NextConfig } from 'next';

const nextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
  },
};

export default nextConfig;
