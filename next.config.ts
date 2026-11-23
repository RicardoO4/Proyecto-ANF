import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // The dashboard is guarded client-side (sessionStorage) and its layout
    // renders null until the session is restored, so no dashboard segment can
    // be prerendered/validated for instant navigation. Only validate segments
    // that explicitly opt in with `export const instant`.
    instantInsights: {
      validationLevel: 'manual-warning',
    },
  },
};

export default nextConfig;
