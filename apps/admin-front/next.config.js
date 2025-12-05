const isProd = process.env.NODE_ENV === 'production'
const distDir = isProd ? '../../dist/admin-front' : undefined

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(distDir ? { distDir } : {}),
  output: 'export',
  images: {
    unoptimized: true,
  },
  reactStrictMode: false,
  trailingSlash: false,
  transpilePackages: ['@ai/shared'],
  experimental: {
    optimizePackageImports: ['@ai/shared'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

export default nextConfig
