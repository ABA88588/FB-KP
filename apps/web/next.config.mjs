/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/ads",
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@adflow/meta-client", "@adflow/shared"],
  async redirects() {
    const redirectMap = [
      ["/", "/ads/login"],
      ["/login", "/ads/login"],
      ["/overview", "/ads/overview"],
      ["/campaigns", "/ads/campaigns"],
      ["/campaigns/:path*", "/ads/campaigns/:path*"],
      ["/reports", "/ads/reports"],
      ["/sync-center", "/ads/sync-center"],
      ["/creatives", "/ads/creatives"],
      ["/settings", "/ads/settings/connections"],
      ["/settings/:path*", "/ads/settings/:path*"],
      ["/onboarding", "/ads/onboarding"],
      ["/onboarding/:path*", "/ads/onboarding/:path*"]
    ];

    return redirectMap.map(([source, destination]) => ({
      source,
      destination,
      permanent: false,
      basePath: false
    }));
  }
};

export default nextConfig;
