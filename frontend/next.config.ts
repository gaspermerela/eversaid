import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  // This creates a minimal production bundle that can run without node_modules
  output: 'standalone',
};

export default withNextIntl(nextConfig);
