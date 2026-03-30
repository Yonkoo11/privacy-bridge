/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  typescript: { ignoreBuildErrors: true },
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  images: { unoptimized: true },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    // snarkjs needs these
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    // Exclude large circuit files from webpack processing
    config.module.rules.push({
      test: /\.(wasm|zkey)$/,
      type: 'asset/resource',
    });
    return config;
  },
};
export default nextConfig;
