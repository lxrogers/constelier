/** @type {import('next').NextConfig} */
const nextConfig = {
  // Local dev database (DATABASE_URL=pglite:…): loaded from node_modules at
  // runtime instead of bundled, because it ships its own WebAssembly.
  serverExternalPackages: ['@electric-sql/pglite'],
  // No dev-mode badge in the corner (it covers buttons in screenshots).
  devIndicators: false,
  // Include WASM in the serverless bundle for the sun-arcs prototype API
  // (the main pendant routes are mesh-only and don't need it).
  outputFileTracingIncludes: {
    '/api/prototypes/sun-arcs': ['./public/wasm/replicad_single.wasm'],
  },
  // Turbopack config (Next.js 16 default bundler)
  turbopack: {
    resolveAlias: {
      fs: { browser: './empty-module.js' },
      path: { browser: './empty-module.js' },
    },
  },
  // Webpack fallback for WASM support + Node.js polyfill stubs
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    return config;
  },
  // staging.constelier.com is a short address for the newest build of main,
  // the one waiting to be promoted. Vercel will not attach a domain to the
  // production branch's unpromoted builds, so it forwards to their fixed link.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'staging.constelier.com' }],
        destination:
          'https://constelier-git-main-lawrences-projects-c9c8f187.vercel.app/:path*',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/wasm/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/softbox.hdr',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
