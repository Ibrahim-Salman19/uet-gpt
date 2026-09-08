const isDev = process.env.NODE_ENV === "development";
// challenges.cloudflare.com serves Clerk's bot-protection (Turnstile) CAPTCHA
// widget; *.protect.clerk.com is Clerk's fraud-protection service. Both need
// script-src (to load) and frame-src (the CAPTCHA renders in an iframe) -
// without them the browser silently blocks it and Clerk shows
// "The CAPTCHA failed to load".
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://*.protect.clerk.com;"
  : "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://*.protect.clerk.com;";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: `default-src 'self'; ${scriptSrc} style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https: wss:; worker-src 'self' blob:; frame-src 'self' https://challenges.cloudflare.com https://*.protect.clerk.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';`,
  },
];

const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/calculator",
        destination: "/tools?tab=merit",
        permanent: true,
      },
      {
        source: "/gpa-calculator",
        destination: "/tools?tab=gpa",
        permanent: true,
      },
      {
        source: "/merit-archive",
        destination: "/tools?tab=archive",
        permanent: true,
      },
      {
        source: "/scholarship-finder",
        destination: "/tools?tab=scholarships",
        permanent: true,
      },
      {
        source: "/calendar",
        destination: "/academics?tab=calendar",
        permanent: true,
      },
      {
        source: "/resources",
        destination: "/academics?tab=resources",
        permanent: true,
      },
      {
        source: "/uet-taxila/admissions",
        destination: "/admissions?tab=overview",
        permanent: true,
      },
      {
        source: "/ecat-guide",
        destination: "/admissions?tab=ecat",
        permanent: true,
      },
      {
        source: "/uet-taxila/fee-structure",
        destination: "/admissions?tab=fees",
        permanent: true,
      },
      {
        source: "/scholarships",
        destination: "/admissions?tab=scholarships",
        permanent: true,
      },
      {
        source: "/compare",
        destination: "/admissions?tab=compare",
        permanent: true,
      },
      {
        source: "/bus-routes",
        destination: "/campus-life?tab=transport",
        permanent: true,
      },
      {
        source: "/societies",
        destination: "/campus-life?tab=societies",
        permanent: true,
      },
      {
        source: "/directory",
        destination: "/campus-life?tab=directory",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
