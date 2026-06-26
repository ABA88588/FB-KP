/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@adflow/meta-client", "@adflow/shared"]
};

export default nextConfig;
