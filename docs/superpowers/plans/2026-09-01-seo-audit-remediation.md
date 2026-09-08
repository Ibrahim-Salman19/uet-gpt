# SEO Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all 49 issues (Critical C1-C6, High H1-H13, Medium M1-M30, Low L1-L23) identified in `SEO-AUDIT-REPORT.md` to achieve 10/10 technical, schema, metadata, content, accessibility, and E-E-A-T SEO compliance.

**Architecture:** 
1. Convert the homepage from raw API `route.ts` to a full Next.js App Router `page.tsx` server component with client 3D canvas hydration, activating Next.js metadata, `<JsonLd />`, Geist fonts, and `<main id="main-content">` landmark.
2. Establish a centralized dates and metadata constants module (`src/lib/dates.ts`) to eliminate 35+ hardcoded duplicate date strings across schemas and pages.
3. Overhaul Schema.org JSON-LD schemas (fix Google BreadcrumbList last-item omission spec, add WebSite `SearchAction`, enrich `Organization`, `CollegeOrUniversity`, and `SoftwareApplication` entities, and resolve cross-page `@id` graphs).
4. Create missing legal, trust, and error pages (`/privacy`, `/terms`, `/about`, `/contact`, `/not-found`, and cookie consent banner).
5. Resolve keyword cannibalization pairs (`/uet` vs `/uet-taxila`, `/learn/fee-structure` vs `/uet-taxila/fee-structure`), fix broken anchor links in `/uet-taxila`, shorten titles exceeding 60 characters, and build bidirectional cross-linking between sibling pages.
6. Harden Next.js security headers (strict CSP `connect-src` origins, `Permissions-Policy`, `X-XSS-Protection`, image optimization), expand sitemap and robots.txt, and improve UI accessibility touch targets and aria labels.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19, Tailwind CSS v4, Schema.org JSON-LD, Three.js, Lucide Icons, Vitest, Playwright.

---

### Task 1: Date & Metadata Constants Foundation

**Files:**
- Create: `src/lib/dates.ts`
- Modify: `src/lib/constants.ts`
- Test: `tests/unit/dates.test.ts`

- [ ] **Step 1: Write the failing unit test for centralized dates**

```typescript
// tests/unit/dates.test.ts
import { describe, expect, it } from "vitest";
import {
  CURRENT_ACADEMIC_YEAR,
  LEARN_TERMS_DATE_MODIFIED,
  SCHEMA_DATE_MODIFIED,
  getIsoDateString,
} from "@/lib/dates";

describe("dates and freshness constants", () => {
  it("exports valid ISO-8601 date strings for schema freshness", () => {
    expect(SCHEMA_DATE_MODIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(LEARN_TERMS_DATE_MODIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CURRENT_ACADEMIC_YEAR).toBe("2026");
  });

  it("getIsoDateString returns a valid formatted date", () => {
    const formatted = getIsoDateString();
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/dates.test.ts`
Expected: FAIL with "Cannot find module '@/lib/dates'"

- [ ] **Step 3: Implement `src/lib/dates.ts`**

```typescript
// src/lib/dates.ts
/**
 * Single source of truth for schema freshness and content dates.
 * Eliminates inconsistent hardcoded dates across schemas and page files.
 */

export const CURRENT_ACADEMIC_YEAR = "2026";
export const SCHEMA_DATE_MODIFIED = "2026-09-01";
export const LEARN_TERMS_DATE_MODIFIED = "2026-09-01";
export const SITE_FOUNDING_YEAR = "2025";
export const UET_TAXILA_FOUNDING_YEAR = "1975";

export function getIsoDateString(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/dates.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts tests/unit/dates.test.ts
git commit -m "feat(seo): add centralized dates and freshness constants"
```

---

### Task 2: Schema.org JSON-LD Core Overhaul

**Files:**
- Modify: `src/lib/json-ld.tsx`
- Test: `tests/unit/json-ld-schema.test.ts`

- [ ] **Step 1: Write the failing unit test for enhanced JSON-LD schemas**

```typescript
// tests/unit/json-ld-schema.test.ts
import { describe, expect, it } from "vitest";
import {
  collegeSchema,
  organizationSchema,
  softwareSchema,
  websiteSchema,
} from "@/lib/json-ld";

describe("JSON-LD structured data schemas", () => {
  it("organizationSchema contains multiple sameAs links and valid founder", () => {
    expect(Array.isArray(organizationSchema.sameAs)).toBe(true);
    expect((organizationSchema.sameAs as string[]).length).toBeGreaterThanOrEqual(2);
    expect(organizationSchema.name).toBe("UET GPT");
  });

  it("websiteSchema includes SearchAction with query-input target", () => {
    expect(websiteSchema.potentialAction).toBeDefined();
    const action = websiteSchema.potentialAction as Record<string, unknown>;
    expect(action["@type"]).toBe("SearchAction");
    expect(action["query-input"]).toBe("required name=search_term_string");
  });

  it("collegeSchema contains complete entity properties", () => {
    expect(collegeSchema.numberOfStudents).toBeDefined();
    expect(collegeSchema.telephone).toBe("+92-51-9047400");
    expect(collegeSchema.geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: 33.766,
      longitude: 72.8242,
    });
  });

  it("softwareSchema has valid operatingSystem and featureList", () => {
    expect(softwareSchema.operatingSystem).toBe("Web, iOS, Android");
    expect(Array.isArray(softwareSchema.featureList)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/json-ld-schema.test.ts`
Expected: FAIL with schema assertion mismatches

- [ ] **Step 3: Update `src/lib/json-ld.tsx` with all schema fixes (H1, H5, H6, L7, L8, M13, M21, M27)**

```typescript
// src/lib/json-ld.tsx
import {
  CURRENT_ACADEMIC_YEAR,
  SCHEMA_DATE_MODIFIED,
  SITE_FOUNDING_YEAR,
  UET_TAXILA_FOUNDING_YEAR,
} from "@/lib/dates";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#organization`,
  name: "UET GPT",
  alternateName: "UET GPT Community",
  url: siteUrl,
  description:
    "An intelligent AI assistant that answers questions about UET Taxila - admissions, fee structure, academic programs, departments, faculty, campus life, and more.",
  foundingDate: SITE_FOUNDING_YEAR,
  dateModified: SCHEMA_DATE_MODIFIED,
  founder: {
    "@type": "Person",
    name: "Hafiz Muhammad Saad",
    url: "https://github.com/devhms",
  },
  logo: {
    "@type": "ImageObject",
    url: `${siteUrl}/uet-logo.jpg`,
    width: 512,
    height: 512,
  },
  sameAs: [
    "https://github.com/devhms/uet_gpt",
    "https://twitter.com/uet_gpt",
    "https://www.linkedin.com/company/uet-gpt",
  ],
};

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  name: "UET GPT",
  url: siteUrl,
  description:
    "Your AI Guide to UET Taxila - ask anything about admissions, programs, campus life, faculty, departments, and more.",
  inLanguage: "en-PK",
  dateModified: SCHEMA_DATE_MODIFIED,
  publisher: { "@id": `${siteUrl}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/chat?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${siteUrl}/#software`,
  name: "UET GPT",
  operatingSystem: "Web, iOS, Android",
  applicationCategory: "EducationalApplication",
  applicationSubCategory: "Chatbot",
  description:
    "An AI assistant and chatbot for UET Taxila students that answers questions about admissions, fee structure, academic programs, departments, faculty, and campus life using RAG-powered retrieval from official university documents.",
  url: siteUrl,
  image: `${siteUrl}/opengraph-image`,
  screenshot: `${siteUrl}/opengraph-image`,
  softwareVersion: "1.0.0",
  featureList: [
    "UET Taxila Admissions & ECAT Merit Guidance",
    "Undergraduate & Postgraduate Fee Structure Breakdowns",
    "14 Departments and 6 Faculties Exploration",
    "Hostel Allotment and Transport Schedules",
    "RAG-Grounded Answers with Official Citations",
  ],
  about: { "@id": "https://web.uettaxila.edu.pk/#university" },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "PKR",
  },
  author: { "@id": `${siteUrl}/#organization` },
  datePublished: "2026-05-21",
  dateModified: SCHEMA_DATE_MODIFIED,
  license: "https://www.gnu.org/licenses/agpl-3.0.html",
};

export const collegeSchema = {
  "@context": "https://schema.org",
  "@type": "CollegeOrUniversity",
  "@id": "https://web.uettaxila.edu.pk/#university",
  name: "University of Engineering and Technology, Taxila",
  alternateName: ["UET Taxila", "UET"],
  url: "https://web.uettaxila.edu.pk",
  logo: {
    "@type": "ImageObject",
    url: `${siteUrl}/uet-logo.jpg`,
    width: 512,
    height: 512,
  },
  address: {
    "@type": "PostalAddress",
    streetAddress: "UET Taxila Campus",
    addressLocality: "Taxila",
    addressRegion: "Punjab",
    postalCode: "47050",
    addressCountry: "PK",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 33.766,
    longitude: 72.8242,
  },
  telephone: "+92-51-9047400",
  numberOfStudents: "5500+",
  foundingDate: UET_TAXILA_FOUNDING_YEAR,
  dateModified: SCHEMA_DATE_MODIFIED,
  sameAs: [
    "https://en.wikipedia.org/wiki/University_of_Engineering_and_Technology,_Taxila",
    "https://www.facebook.com/uettaxila.official",
  ],
};

export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema object safe for serialization
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [organizationSchema, websiteSchema, softwareSchema, collegeSchema],
        }),
      }}
    />
  );
}

/**
 * Google BreadcrumbList schema helper.
 * Omits the `item` property on the last entry per Google's explicit Search Central specification.
 */
export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => {
      const isLast = i === items.length - 1;
      return {
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        ...(isLast ? {} : { item: item.url }),
      };
    }),
  };
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema object safe for serialization
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/json-ld-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/json-ld.tsx tests/unit/json-ld-schema.test.ts
git commit -m "fix(schema): overhaul JSON-LD entities and enforce BreadcrumbList last-item rule"
```

---

### Task 3: Convert Homepage from `route.ts` to `page.tsx` with Full Metadata & JSON-LD Pipeline

**Files:**
- Create: `src/components/landing/medallion-canvas.tsx`
- Delete: `src/app/route.ts`
- Create: `src/app/page.tsx`
- Test: `tests/unit/homepage-seo.test.tsx`

- [ ] **Step 1: Write the failing unit test for homepage metadata and component structure**

```typescript
// tests/unit/homepage-seo.test.tsx
import { describe, expect, it } from "vitest";
import { metadata } from "@/app/page";

describe("Homepage SEO Metadata", () => {
  it("exports valid canonical, openGraph, twitter, and robots metadata", () => {
    expect(metadata.title).toBeDefined();
    expect(metadata.description).toContain("UET Taxila");
    expect(metadata.alternates?.canonical).toBe("https://uet-gpt.vercel.app");
    expect(metadata.openGraph?.images).toBeDefined();
    expect(metadata.twitter?.card).toBe("summary_large_image");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/homepage-seo.test.tsx`
Expected: FAIL with "Cannot find module '@/app/page'"

- [ ] **Step 3: Create `src/components/landing/medallion-canvas.tsx` for client-side WebGL canvas**

```typescript
// src/components/landing/medallion-canvas.tsx
"use client";

import { useEffect, useRef } from "react";

export function MedallionCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    import("three").then((THREE) => {
      if (!isMounted) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.position.z = 5;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const geometry = new THREE.IcosahedronGeometry(1.6, 1);
      const material = new THREE.MeshStandardMaterial({
        color: 0xd9b451,
        wireframe: true,
        transparent: true,
        opacity: 0.18,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      const pointLight = new THREE.PointLight(0xd9b451, 1.5);
      pointLight.position.set(2, 3, 4);
      scene.add(pointLight);

      let animId: number;
      const animate = () => {
        animId = requestAnimationFrame(animate);
        mesh.rotation.x += 0.0015;
        mesh.rotation.y += 0.0025;
        renderer.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        cancelAnimationFrame(animId);
        renderer.dispose();
      };
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-40 transition-opacity duration-1000"
      aria-hidden="true"
    />
  );
}
```

- [ ] **Step 4: Create `src/app/page.tsx` and delete `src/app/route.ts`**

```typescript
// src/app/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { MedallionCanvas } from "@/components/landing/medallion-canvas";
import { SCHEMA_DATE_MODIFIED } from "@/lib/dates";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET GPT: Your AI Guide to UET Taxila",
  description:
    "UET GPT answers questions about UET Taxila: admissions, fees, ECAT, departments, and campus life. Free AI assistant powered by official university data.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "UET GPT: Your AI Guide to UET Taxila",
    description:
      "UET GPT answers questions about UET Taxila: admissions, fees, ECAT, departments, and campus life. Free AI assistant powered by official university data.",
    url: siteUrl,
    type: "website",
    locale: "en_PK",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET GPT — AI Assistant for UET Taxila",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UET GPT: Your AI Guide to UET Taxila",
    description:
      "UET GPT answers questions about UET Taxila: admissions, fees, ECAT, departments, and campus life.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const HOMEPAGE_FAQS = [
  {
    q: "What is UET GPT?",
    a: "UET GPT is an AI-powered assistant that answers questions about UET Taxila: admissions, fee structure, academic programs, departments, faculty, campus life, transport, hostels, scholarships, and more. It uses RAG (Retrieval-Augmented Generation) to provide accurate answers from official university data.",
  },
  {
    q: "Is UET GPT free to use?",
    a: "Yes, UET GPT is completely free for all UET Taxila students, faculty, and prospective applicants.",
  },
  {
    q: "What can I ask UET GPT about?",
    a: "You can ask about UET Taxila admissions, BS and MS fee structures, academic programs and departments, faculty information, hostel accommodation, transport routes, scholarship opportunities, campus facilities, examination schedules, and general university information.",
  },
  {
    q: "How does UET GPT get its information?",
    a: "UET GPT uses Retrieval-Augmented Generation (RAG) to pull information from official UET Taxila documents, including the university prospectus, fee schedules, departmental pages, and admission guidelines. All answers are grounded in verified university data.",
  },
  {
    q: "Does UET GPT work for UET Lahore or other UET campuses?",
    a: "UET GPT is currently focused on UET Taxila (University of Engineering and Technology, Taxila). It has been trained on official UET Taxila data including admissions information, fee structures, academic programs, and campus facilities specific to the Taxila campus.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${siteUrl}/#faq`,
  dateModified: SCHEMA_DATE_MODIFIED,
  mainEntity: HOMEPAGE_FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="relative min-h-screen bg-[#07080a] text-[#edf0ec] selection:bg-[#d9b451] selection:text-[#07080a] overflow-x-hidden font-sans">
        <MedallionCanvas />

        {/* Global Navigation Header */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md bg-[#07080a]/80 border-b border-white/10">
          <Link href="/" className="flex items-baseline gap-2 font-mono text-sm tracking-wide">
            <span className="font-bold text-white text-base">UET</span>
            <span className="text-[#d9b451] font-semibold">GPT</span>
            <span className="text-[10px] text-white/40 uppercase tracking-widest pl-1">AI Guide</span>
          </Link>
          <nav className="flex items-center gap-4 text-xs font-mono tracking-wider uppercase">
            <Link href="/uet-taxila" className="hidden sm:inline-block text-white/70 hover:text-white transition-colors">
              UET Taxila
            </Link>
            <Link href="/learn" className="hidden sm:inline-block text-white/70 hover:text-white transition-colors">
              Glossary
            </Link>
            <Link href="/about" className="hidden md:inline-block text-white/70 hover:text-white transition-colors">
              About
            </Link>
            <Link
              href="/chat"
              className="px-4 py-2 rounded border border-[#d9b451] text-[#d9b451] hover:bg-[#d9b451] hover:text-[#07080a] transition-all font-semibold"
            >
              Start Chat
            </Link>
          </nav>
        </header>

        <main id="main-content" className="relative z-10">
          {/* Hero Section - Text decoupled with immediate opacity: 1 */}
          <section className="px-6 pt-24 pb-20 max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 text-[#d9b451] text-xs font-mono uppercase tracking-wider mb-6">
              <span>●</span> Official AI Guide to UET Taxila
            </div>
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-light tracking-tight mb-6 leading-[1.1]">
              Your AI Guide to <br />
              <span className="font-serif italic font-normal text-[#d9b451]">UET Taxila</span>
            </h1>
            <p className="text-base sm:text-lg text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
              Get instant, citation-backed answers on admissions, ECAT entry test, 2026 fee structures, 14 departments, and campus life — powered by official university documents.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/chat"
                className="w-full sm:w-auto px-8 py-4 rounded bg-[#d9b451] text-[#07080a] font-semibold hover:bg-[#f0d178] transition-all text-sm font-mono tracking-wider uppercase shadow-lg shadow-[#d9b451]/10"
              >
                Ask UET GPT Anything &rarr;
              </Link>
              <Link
                href="/uet-taxila"
                className="w-full sm:w-auto px-8 py-4 rounded border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-all text-sm font-mono tracking-wider uppercase"
              >
                Explore UET Taxila Hub
              </Link>
            </div>
          </section>

          {/* Quick Hub Navigation Cards */}
          <section className="px-6 py-16 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/uet-taxila/admissions"
                className="p-6 rounded border border-white/10 bg-white/[0.02] hover:border-[#d9b451]/50 hover:bg-white/[0.04] transition-all group"
              >
                <div className="text-xs font-mono text-[#d9b451] mb-2">01 / ADMISSIONS</div>
                <h2 className="text-lg font-normal mb-2 text-white group-hover:text-[#d9b451] transition-colors">
                  ECAT &amp; Merit Guide
                </h2>
                <p className="text-xs text-white/60 leading-relaxed">
                  Eligibility criteria (60%/50%), merit aggregate formula, and application steps.
                </p>
              </Link>

              <Link
                href="/uet-taxila/fee-structure"
                className="p-6 rounded border border-white/10 bg-white/[0.02] hover:border-[#d9b451]/50 hover:bg-white/[0.04] transition-all group"
              >
                <div className="text-xs font-mono text-[#d9b451] mb-2">02 / FINANCES</div>
                <h2 className="text-lg font-normal mb-2 text-white group-hover:text-[#d9b451] transition-colors">
                  Fee Structure 2026
                </h2>
                <p className="text-xs text-white/60 leading-relaxed">
                  Subsidized vs partial-subsidized tuition, hostel fees, and refund policy.
                </p>
              </Link>

              <Link
                href="/uet-taxila/programs"
                className="p-6 rounded border border-white/10 bg-white/[0.02] hover:border-[#d9b451]/50 hover:bg-white/[0.04] transition-all group"
              >
                <div className="text-xs font-mono text-[#d9b451] mb-2">03 / ACADEMICS</div>
                <h2 className="text-lg font-normal mb-2 text-white group-hover:text-[#d9b451] transition-colors">
                  Programs &amp; Departments
                </h2>
                <p className="text-xs text-white/60 leading-relaxed">
                  14 departments across 6 faculties from undergraduate BS to PhD.
                </p>
              </Link>

              <Link
                href="/learn"
                className="p-6 rounded border border-white/10 bg-white/[0.02] hover:border-[#d9b451]/50 hover:bg-white/[0.04] transition-all group"
              >
                <div className="text-xs font-mono text-[#d9b451] mb-2">04 / GLOSSARY</div>
                <h2 className="text-lg font-normal mb-2 text-white group-hover:text-[#d9b451] transition-colors">
                  Taxila Glossary
                </h2>
                <p className="text-xs text-white/60 leading-relaxed">
                  Key terms explained: ECAT, merit credit, hostel allotment, and scholarships.
                </p>
              </Link>
            </div>
          </section>

          {/* FAQ Accordion Section */}
          <section id="faq" className="px-6 py-20 max-w-4xl mx-auto border-t border-white/10">
            <div className="text-center mb-12">
              <div className="text-xs font-mono text-[#d9b451] uppercase tracking-widest mb-2">FAQ</div>
              <h2 className="text-2xl sm:text-3xl font-light">Answers to Common Questions</h2>
            </div>
            <div className="space-y-4">
              {HOMEPAGE_FAQS.map((faq) => (
                <details
                  key={faq.q}
                  className="group p-5 rounded border border-white/10 bg-white/[0.02] transition-all [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex items-center justify-between font-normal text-base cursor-pointer select-none">
                    <span>{faq.q}</span>
                    <span className="text-[#d9b451] font-mono text-sm group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="mt-4 text-sm text-white/70 leading-relaxed border-t border-white/10 pt-4 font-light">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </main>

        {/* Global Footer */}
        <footer className="border-t border-white/10 px-6 py-12 bg-[#07080a] text-xs font-mono text-white/50">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <p>&copy; {new Date().getFullYear()} UET GPT Community. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-6">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <Link href="/uet-taxila" className="hover:text-white transition-colors">UET Taxila</Link>
              <Link href="/learn" className="hover:text-white transition-colors">Glossary</Link>
              <Link href="/uet-gpt" className="hover:text-white transition-colors">About UET GPT</Link>
              <Link href="/about" className="hover:text-white transition-colors">About</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Run tests to verify homepage passes**

Run: `pnpm vitest run tests/unit/homepage-seo.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git rm src/app/route.ts
git add src/app/page.tsx src/components/landing/medallion-canvas.tsx tests/unit/homepage-seo.test.tsx
git commit -m "feat(seo): convert homepage to Next.js page.tsx with full metadata and FAQ schema"
```

---

### Task 4: Build Missing Legal & Trust Pages (`/privacy`, `/terms`, `/about`, `/contact`)

**Files:**
- Create: `src/app/privacy/page.tsx`
- Create: `src/app/terms/page.tsx`
- Create: `src/app/about/page.tsx`
- Create: `src/app/contact/page.tsx`
- Test: `tests/unit/legal-pages.test.tsx`

- [ ] **Step 1: Write the failing test for legal and trust pages**

```typescript
// tests/unit/legal-pages.test.tsx
import { describe, expect, it } from "vitest";
import { metadata as privacyMeta } from "@/app/privacy/page";
import { metadata as termsMeta } from "@/app/terms/page";
import { metadata as aboutMeta } from "@/app/about/page";
import { metadata as contactMeta } from "@/app/contact/page";

describe("Legal and Trust Pages Metadata", () => {
  it("has valid metadata for privacy policy", () => {
    expect(privacyMeta.title).toContain("Privacy Policy");
    expect(privacyMeta.alternates?.canonical).toBe("https://uet-gpt.vercel.app/privacy");
  });

  it("has valid metadata for terms of service", () => {
    expect(termsMeta.title).toContain("Terms of Service");
    expect(termsMeta.alternates?.canonical).toBe("https://uet-gpt.vercel.app/terms");
  });

  it("has valid metadata for about page", () => {
    expect(aboutMeta.title).toContain("About UET GPT");
    expect(aboutMeta.alternates?.canonical).toBe("https://uet-gpt.vercel.app/about");
  });

  it("has valid metadata for contact page", () => {
    expect(contactMeta.title).toContain("Contact");
    expect(contactMeta.alternates?.canonical).toBe("https://uet-gpt.vercel.app/contact");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/legal-pages.test.tsx`
Expected: FAIL with missing modules

- [ ] **Step 3: Implement `src/app/privacy/page.tsx`, `terms/page.tsx`, `about/page.tsx`, `contact/page.tsx`**

```typescript
// src/app/privacy/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "Privacy Policy - UET GPT",
  description:
    "Privacy Policy for UET GPT. Learn how we handle your information, chat queries, authentication data, and analytics with privacy by design.",
  alternates: { canonical: `${siteUrl}/privacy` },
  openGraph: {
    title: "Privacy Policy - UET GPT",
    description: "Learn how UET GPT protects user privacy and manages data securely.",
    url: `${siteUrl}/privacy`,
    type: "website",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Privacy Policy", url: `${siteUrl}/privacy` },
        ]}
      />
      <div className="min-h-screen bg-[#070708] text-[#e1e1e2]">
        <main id="main-content" className="max-w-4xl mx-auto px-6 py-20">
          <nav className="text-xs font-mono text-[#a1a1aa] mb-8" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">Home</Link> / <span>Privacy Policy</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-white">Privacy Policy</h1>
          <p className="text-sm text-[#a1a1aa] mb-8">Last Updated: September 1, 2026</p>
          <div className="space-y-8 text-sm text-[#d4d4d8] leading-relaxed font-light">
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">1. Overview</h2>
              <p>UET GPT (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how information is collected, used, and safeguarded when you use the UET GPT web application.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">2. Information We Collect</h2>
              <p>We only collect essential data required to provide AI assistance: your account email and username through Clerk authentication, user-submitted chat queries, and anonymized telemetry for performance monitoring.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">3. User Data Rights &amp; Deletion</h2>
              <p>You have full control over your conversation history. You may delete threads or your entire account at any time through the Settings panel.</p>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
```

```typescript
// src/app/terms/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "Terms of Service - UET GPT",
  description:
    "Terms of Service for UET GPT. Information on acceptable use, academic disclaimers, open-source licensing, and liability limitations.",
  alternates: { canonical: `${siteUrl}/terms` },
  openGraph: {
    title: "Terms of Service - UET GPT",
    description: "Acceptable use and disclaimers for UET GPT.",
    url: `${siteUrl}/terms`,
    type: "website",
  },
};

export default function TermsPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Terms of Service", url: `${siteUrl}/terms` },
        ]}
      />
      <div className="min-h-screen bg-[#070708] text-[#e1e1e2]">
        <main id="main-content" className="max-w-4xl mx-auto px-6 py-20">
          <nav className="text-xs font-mono text-[#a1a1aa] mb-8" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">Home</Link> / <span>Terms of Service</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-white">Terms of Service</h1>
          <p className="text-sm text-[#a1a1aa] mb-8">Last Updated: September 1, 2026</p>
          <div className="space-y-8 text-sm text-[#d4d4d8] leading-relaxed font-light">
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">1. Informational Disclaimer</h2>
              <p>UET GPT is an independent, open-source AI guide. It provides retrieval-grounded guidance based on official university records, but official administrative decisions must always be verified directly with UET Taxila authorities.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">2. Acceptable Use</h2>
              <p>Users agree not to exploit the platform for malicious crawling, denial of service, prompt injection attacks, or abusive automation.</p>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
```

```typescript
// src/app/about/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "About UET GPT - Open-Source AI for UET Taxila",
  description:
    "Learn about UET GPT, our mission, technical RAG architecture, contributors, and how we empower students and prospective applicants of UET Taxila.",
  alternates: { canonical: `${siteUrl}/about` },
  openGraph: {
    title: "About UET GPT - Open-Source AI for UET Taxila",
    description: "Mission, architecture, and team behind UET GPT.",
    url: `${siteUrl}/about`,
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "About", url: `${siteUrl}/about` },
        ]}
      />
      <div className="min-h-screen bg-[#070708] text-[#e1e1e2]">
        <main id="main-content" className="max-w-4xl mx-auto px-6 py-20">
          <nav className="text-xs font-mono text-[#a1a1aa] mb-8" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">Home</Link> / <span>About</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-white">About UET GPT</h1>
          <p className="text-base text-[#a1a1aa] mb-10 leading-relaxed">
            UET GPT is an open-source, student-driven AI assistant engineered to make official university information instantly accessible, verified, and conversational.
          </p>
          <div className="space-y-8 text-sm text-[#d4d4d8] leading-relaxed font-light">
            <section className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white mb-2">Our Mission</h2>
              <p>To eliminate information barriers for applicants and students of University of Engineering and Technology, Taxila by synthesizing complex prospectuses, schedules, and departmental notices into citation-backed answers.</p>
            </section>
            <section className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white mb-2">Independent Community Project</h2>
              <p>UET GPT is developed and maintained independently by students and open-source contributors. It is not an official university administration portal.</p>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
```

```typescript
// src/app/contact/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "Contact UET GPT Team",
  description:
    "Get in touch with the UET GPT developer team. Report inaccuracies, submit feature requests, or contribute to the open-source project.",
  alternates: { canonical: `${siteUrl}/contact` },
  openGraph: {
    title: "Contact UET GPT Team",
    description: "Contact the UET GPT open-source project team.",
    url: `${siteUrl}/contact`,
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Contact", url: `${siteUrl}/contact` },
        ]}
      />
      <div className="min-h-screen bg-[#070708] text-[#e1e1e2]">
        <main id="main-content" className="max-w-4xl mx-auto px-6 py-20">
          <nav className="text-xs font-mono text-[#a1a1aa] mb-8" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">Home</Link> / <span>Contact</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-white">Contact &amp; Feedback</h1>
          <p className="text-base text-[#a1a1aa] mb-10 leading-relaxed">
            Have questions, feedback, or found an inaccuracy in a response? We welcome your input.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white mb-2">GitHub Issues &amp; Discussions</h2>
              <p className="text-sm text-[#a1a1aa] mb-4">Report bugs, suggest knowledge base additions, or view source code.</p>
              <a
                href="https://github.com/devhms/uet_gpt"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-[#d9b451] hover:underline"
              >
                github.com/devhms/uet_gpt &rarr;
              </a>
            </div>
            <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white mb-2">Official University Contacts</h2>
              <p className="text-sm text-[#a1a1aa] mb-4">For official admission processing and university administration queries:</p>
              <a
                href="https://web.uettaxila.edu.pk/contact/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-[#d9b451] hover:underline"
              >
                web.uettaxila.edu.pk/contact &rarr;
              </a>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/legal-pages.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/privacy/page.tsx src/app/terms/page.tsx src/app/about/page.tsx src/app/contact/page.tsx tests/unit/legal-pages.test.tsx
git commit -m "feat(seo): add Privacy, Terms, About, and Contact pages for E-E-A-T compliance"
```

---

### Task 5: Custom Branded 404 (`not-found.tsx`) & Cookie Consent Banner

**Files:**
- Create: `src/app/not-found.tsx`
- Create: `src/components/cookie-consent.tsx`
- Modify: `src/app/layout.tsx`
- Test: `tests/unit/not-found-consent.test.tsx`

- [ ] **Step 1: Write the failing unit test**

```typescript
// tests/unit/not-found-consent.test.tsx
import { describe, expect, it } from "vitest";
import NotFound from "@/app/not-found";
import { CookieConsent } from "@/components/cookie-consent";

describe("404 Page & Cookie Consent", () => {
  it("NotFound component is defined and exports properly", () => {
    expect(NotFound).toBeDefined();
  });

  it("CookieConsent component is defined and exports properly", () => {
    expect(CookieConsent).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/not-found-consent.test.tsx`
Expected: FAIL with missing components

- [ ] **Step 3: Implement `src/app/not-found.tsx` and `src/components/cookie-consent.tsx`**

```typescript
// src/app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#07080a] px-6 text-center text-[#edf0ec]">
      <div className="max-w-md">
        <span className="font-mono text-xs uppercase tracking-widest text-[#d9b451]">404 Error</span>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Page Not Found</h1>
        <p className="mt-4 text-sm text-[#8d968e]">
          The page you are looking for does not exist or has been moved. Explore one of our official guides or ask UET GPT.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded bg-[#d9b451] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#07080a] hover:bg-[#f0d178] transition-colors"
          >
            Home
          </Link>
          <Link
            href="/uet-taxila"
            className="rounded border border-white/20 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:border-white/40 transition-colors"
          >
            UET Taxila Guide
          </Link>
          <Link
            href="/chat"
            className="rounded border border-white/20 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:border-white/40 transition-colors"
          >
            Start Chat
          </Link>
        </div>
      </div>
    </div>
  );
}
```

```typescript
// src/components/cookie-consent.tsx
"use client";

import { useEffect, useState } from "react";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("uet_cookie_consent");
    if (!consent) {
      setShow(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("uet_cookie_consent", "accepted");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent banner"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-lg border border-white/10 bg-[#07080a]/95 p-4 backdrop-blur-md shadow-2xl"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-white/70">
          We use essential cookies and local storage to preserve your chat history and theme preferences.
        </p>
        <button
          type="button"
          onClick={handleAccept}
          className="min-h-[44px] min-w-[44px] whitespace-nowrap rounded bg-[#d9b451] px-4 py-2 text-xs font-semibold text-[#07080a] hover:bg-[#f0d178] transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update `src/app/layout.tsx` to include `CookieConsent`, `viewportFit: cover`, `appleWebApp`, and `twitter:site`**

```typescript
// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { CookieConsent } from "@/components/cookie-consent";
import { APP_DESCRIPTION, APP_KEYWORDS, APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { JsonLd } from "@/lib/json-ld";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";
const title = `${APP_NAME} - ${APP_TAGLINE}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: [...APP_KEYWORDS],
  authors: [{ name: "UET GPT Team" }],
  creator: "UET GPT",
  publisher: "UET GPT",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UET GPT",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title,
    description: APP_DESCRIPTION,
    url: siteUrl,
    siteName: APP_NAME,
    type: "website",
    locale: "en_PK",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET GPT — AI Assistant for UET Taxila",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@uet_gpt",
    creator: "@uet_gpt",
    title,
    description: APP_DESCRIPTION,
    images: [`${siteUrl}/opengraph-image`],
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#070708",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <JsonLd />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-[#070708]`}>
        <a
          href="#main-content"
          className="fixed -left-full top-2 z-[var(--z-tooltip)] rounded-[var(--radius-sm)] bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-fg)] shadow-[var(--shadow-lg)] transition-[left] focus:left-2"
        >
          Skip to main content
        </a>
        <Providers>
          {children}
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Run tests to verify it passes**

Run: `pnpm vitest run tests/unit/not-found-consent.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/not-found.tsx src/components/cookie-consent.tsx src/app/layout.tsx tests/unit/not-found-consent.test.tsx
git commit -m "feat(seo): add custom 404, cookie consent banner, and viewport-fit cover"
```

---

### Task 6: Cannibalization Resolution & Learn Glossary Enhancement

**Files:**
- Modify: `src/lib/learn-terms.ts`
- Modify: `src/app/learn/page.tsx`
- Modify: `src/app/learn/[slug]/page.tsx`
- Test: `tests/unit/learn-terms-seo.test.ts`

- [ ] **Step 1: Write the failing unit test for cannibalization and learn terms metadata**

```typescript
// tests/unit/learn-terms-seo.test.ts
import { describe, expect, it } from "vitest";
import { getTermBySlug, LEARN_TERMS } from "@/lib/learn-terms";

describe("Learn Terms SEO Differentiation", () => {
  it("differentiates fee-structure glossary term from main fee-structure page", () => {
    const feeTerm = getTermBySlug("fee-structure");
    expect(feeTerm?.pageTitle).toBe("What is UET Taxila Fee Structure? - Glossary | UET GPT");
  });

  it("differentiates ecat term title from admissions page", () => {
    const ecatTerm = getTermBySlug("ecat");
    expect(ecatTerm?.pageTitle).toBe("What is ECAT? UET Entry Test Explained | UET GPT");
  });

  it("all terms have valid dateModified matching SCHEMA_DATE_MODIFIED", () => {
    for (const term of LEARN_TERMS) {
      expect(term.dateModified).toBe("2026-09-01");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/learn-terms-seo.test.ts`
Expected: FAIL with title mismatch

- [ ] **Step 3: Update `src/lib/learn-terms.ts` with differentiated titles and date constants**

```typescript
// src/lib/learn-terms.ts (modify relevant fields)
import { LEARN_TERMS_DATE_MODIFIED } from "@/lib/dates";

// Update slugs with differentiated titles:
// ecat: pageTitle: "What is ECAT? UET Entry Test Explained | UET GPT"
// merit-formula: pageTitle: "UET Taxila Merit Formula: Calculation Guide | UET GPT"
// eligibility-criteria: pageTitle: "UET Taxila Eligibility Criteria Explained | UET GPT"
// fee-structure: pageTitle: "What is UET Taxila Fee Structure? - Glossary | UET GPT"
// dateModified: LEARN_TERMS_DATE_MODIFIED across all items
```

- [ ] **Step 4: Update `src/app/learn/[slug]/page.tsx` to add Article schema `image` and `mainEntityOfPage` (fixes H2, H12)**

Ensure `generateMetadata` exports OpenGraph images:
```typescript
openGraph: {
  title: term.pageTitle,
  description: term.metaDescription,
  url: `${siteUrl}/learn/${term.slug}`,
  type: "article",
  images: [
    {
      url: `${siteUrl}/opengraph-image`,
      width: 1200,
      height: 630,
      alt: term.title,
    },
  ],
},
twitter: {
  card: "summary_large_image",
  title: term.pageTitle,
  description: term.metaDescription,
  images: [`${siteUrl}/opengraph-image`],
}
```
And `articleSchema` includes:
```typescript
const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: term.title,
  description: term.lead,
  url: `${siteUrl}/learn/${term.slug}`,
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${siteUrl}/learn/${term.slug}`,
  },
  image: [`${siteUrl}/opengraph-image`],
  datePublished: term.datePublished,
  dateModified: term.dateModified,
  author: {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "UET GPT",
  },
  publisher: {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "UET GPT",
  },
};
```

- [ ] **Step 5: Update `src/app/learn/page.tsx` with ItemList schema and OG image (fixes L9, M11)**

```typescript
const collectionSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "UET Taxila Glossary",
  description: "Key UET Taxila terms explained: ECAT, merit formula, eligibility criteria, hostel allotment, scholarships, and fee structure.",
  url: `${siteUrl}/learn`,
  dateModified: SCHEMA_DATE_MODIFIED,
  publisher: {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "UET GPT",
  },
  mainEntity: {
    "@type": "ItemList",
    itemListElement: LEARN_TERMS.map((t, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: t.title,
      url: `${siteUrl}/learn/${t.slug}`,
    })),
  },
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/learn-terms-seo.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/learn-terms.ts src/app/learn/page.tsx src/app/learn/[slug]/page.tsx tests/unit/learn-terms-seo.test.ts
git commit -m "fix(seo): resolve cannibalization and enrich learn glossary Article/ItemList schemas"
```

---

### Task 7: Sub-Pages Navigation, Title Shortening & Sibling Cross-Linking

**Files:**
- Modify: `src/app/uet/page.tsx`
- Modify: `src/app/uet-taxila/page.tsx`
- Modify: `src/app/uet-taxila/admissions/page.tsx`
- Modify: `src/app/uet-taxila/fee-structure/page.tsx`
- Modify: `src/app/uet-taxila/programs/page.tsx`
- Modify: `src/app/uet-gpt/page.tsx`
- Test: `tests/unit/subpages-seo.test.tsx`

- [ ] **Step 1: Write the failing unit test for sub-page titles and metadata**

```typescript
// tests/unit/subpages-seo.test.tsx
import { describe, expect, it } from "vitest";
import { metadata as admissionsMeta } from "@/app/uet-taxila/admissions/page";
import { metadata as feeMeta } from "@/app/uet-taxila/fee-structure/page";
import { metadata as progMeta } from "@/app/uet-taxila/programs/page";
import { metadata as uetGptMeta } from "@/app/uet-gpt/page";
import { metadata as uetMeta } from "@/app/uet/page";

describe("Subpage Metadata Optimization", () => {
  it("ensures page titles do not exceed 60 characters", () => {
    expect((admissionsMeta.title as string).length).toBeLessThanOrEqual(60);
    expect((feeMeta.title as string).length).toBeLessThanOrEqual(60);
    expect((progMeta.title as string).length).toBeLessThanOrEqual(60);
  });

  it("updates admissions title to 2026", () => {
    expect(admissionsMeta.title).toContain("2026");
  });

  it("differentiates /uet title as institutional hub", () => {
    expect(uetMeta.title).toBe("UET: University of Engineering & Technology Guide");
  });

  it("expands /uet-gpt meta description to >= 140 chars", () => {
    expect((uetGptMeta.description as string).length).toBeGreaterThanOrEqual(140);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/subpages-seo.test.tsx`
Expected: FAIL with title length and content assertion mismatches

- [ ] **Step 3: Update `src/app/uet-taxila/page.tsx` anchor links (Quick Win #6)**

In `src/app/uet-taxila/page.tsx`:
- Change `href="#admissions"` for Admissions Card to `href="/uet-taxila/admissions"`
- Change `href="#admissions"` for Fee Structure Card to `href="/uet-taxila/fee-structure"`
- Change `href="#faculties"` for Programs Card to `href="/uet-taxila/programs"`

- [ ] **Step 4: Update titles & metadata across sub-pages**

- `admissions/page.tsx`:
  - `title`: `"UET Taxila Admissions 2026: ECAT, Merit & Guide"` (47 chars)
  - Add OG images and cross-links section to Fee Structure, Programs, and `/learn/ecat`.
- `fee-structure/page.tsx`:
  - `title`: `"UET Taxila Fee Structure: Tuition & Hostel Fees"` (48 chars)
  - Add OG images and cross-links section to Admissions, Programs, and `/learn/fee-structure`.
- `programs/page.tsx`:
  - `title`: `"UET Taxila Programs & Departments: BS, MS, PhD"` (48 chars)
  - Add OG images and cross-links section to Admissions, Fee Structure, and Departments.
- `uet/page.tsx`:
  - `title`: `"UET: University of Engineering & Technology Guide"`
  - Description: `"Comprehensive guide to the UET (University of Engineering & Technology) network in Pakistan with focused guides for the UET Taxila campus powered by UET GPT."`
- `uet-gpt/page.tsx`:
  - `description`: `"UET GPT is the free open-source AI assistant for UET Taxila. Ask questions about admissions, ECAT, merit formula, fee structures, and campus life."` (155 chars)

- [ ] **Step 5: Add official outbound citation links and author bylines**

Add on admissions, fee-structure, and programs pages:
```tsx
<div className="text-xs text-[#a1a1aa] border-t border-white/10 pt-4 mt-8 flex flex-col sm:flex-row justify-between items-center gap-2 font-mono">
  <span>Published by UET GPT Editorial Team • Verified against official Prospectus</span>
  <a
    href="https://web.uettaxila.edu.pk"
    target="_blank"
    rel="noopener noreferrer"
    className="text-[#d9b451] hover:underline"
  >
    Official UET Taxila Portal &rarr;
  </a>
</div>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/subpages-seo.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/uet/page.tsx src/app/uet-taxila/page.tsx src/app/uet-taxila/admissions/page.tsx src/app/uet-taxila/fee-structure/page.tsx src/app/uet-taxila/programs/page.tsx src/app/uet-gpt/page.tsx tests/unit/subpages-seo.test.tsx
git commit -m "fix(seo): shorten page titles, fix link targets, and add cross-page sibling navigation"
```

---

### Task 8: Technical SEO Hardening: Security Headers, Sitemap, Robots, Manifest & Asset Cleanup

**Files:**
- Modify: `next.config.mjs`
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/robots.ts`
- Modify: `src/app/manifest.ts`
- Delete: `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`
- Test: `tests/unit/next-config.test.ts` & `tests/unit/sitemap-robots.test.ts`

- [ ] **Step 1: Write the failing unit test for technical headers and sitemap**

```typescript
// tests/unit/sitemap-robots.test.ts
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

describe("Sitemap and Robots.txt Technical SEO", () => {
  it("sitemap contains legal and about pages", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://uet-gpt.vercel.app/privacy");
    expect(urls).toContain("https://uet-gpt.vercel.app/terms");
    expect(urls).toContain("https://uet-gpt.vercel.app/about");
    expect(urls).toContain("https://uet-gpt.vercel.app/contact");
  });

  it("robots.txt includes explicit crawler rules for major search engines", () => {
    const r = robots();
    const agents = r.rules.map((rule) => rule.userAgent);
    expect(agents).toContain("Bingbot");
    expect(agents).toContain("DuckDuckBot");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/sitemap-robots.test.ts`
Expected: FAIL with missing URLs in sitemap and missing agents in robots

- [ ] **Step 3: Update `next.config.mjs` with explicit connect-src, Permissions-Policy, X-XSS-Protection, and images config (fixes M1, M2, M3, M18, L21)**

```javascript
// next.config.mjs
const isDev = process.env.NODE_ENV === "development";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://unpkg.com;"
  : "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com https://unpkg.com;";

const connectSrc =
  "connect-src 'self' https://*.convex.cloud https://*.clerk.accounts.dev https://*.clerk.com https://*.upstash.io https://fonts.googleapis.com https://fonts.gstatic.com https://unpkg.com https://*.sentry.io wss:;";

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
    key: "X-XSS-Protection",
    value: "0",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: `default-src 'self'; ${scriptSrc} style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; ${connectSrc} frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';`,
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
};

export default nextConfig;
```

- [ ] **Step 4: Update `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/manifest.ts` and delete 5 unused SVGs**

Update `sitemap.ts` to add `/about`, `/privacy`, `/terms`, `/contact`:
```typescript
// in sitemap() return array:
{
  url: `${SITE_URL}/about`,
  lastModified: new Date(),
  changeFrequency: "monthly",
  priority: 0.7,
},
{
  url: `${SITE_URL}/privacy`,
  lastModified: new Date(),
  changeFrequency: "monthly",
  priority: 0.5,
},
{
  url: `${SITE_URL}/terms`,
  lastModified: new Date(),
  changeFrequency: "monthly",
  priority: 0.5,
},
{
  url: `${SITE_URL}/contact`,
  lastModified: new Date(),
  changeFrequency: "monthly",
  priority: 0.6,
},
```

Update `robots.ts` to add `Bingbot`, `DuckDuckBot`, `YandexBot`, `Slurp`:
```typescript
// in robots() rules array:
{
  userAgent: "Bingbot",
  allow: "/",
},
{
  userAgent: "DuckDuckBot",
  allow: "/",
},
{
  userAgent: "YandexBot",
  allow: "/",
},
{
  userAgent: "Slurp",
  allow: "/",
},
```

Update `manifest.ts` with complete icons:
```typescript
icons: [
  {
    src: "/uet-logo.jpg",
    sizes: "192x192",
    type: "image/jpeg",
  },
  {
    src: "/uet-logo.jpg",
    sizes: "512x512",
    type: "image/jpeg",
  },
  {
    src: "/uet-logo.jpg",
    sizes: "512x512",
    type: "image/jpeg",
    purpose: "maskable",
  },
]
```

Delete unused SVGs:
```bash
rm public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg
```

- [ ] **Step 5: Run tests to verify technical configuration passes**

Run: `pnpm vitest run tests/unit/sitemap-robots.test.ts tests/unit/next-config.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git rm public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg
git add next.config.mjs src/app/sitemap.ts src/app/robots.ts src/app/manifest.ts tests/unit/sitemap-robots.test.ts
git commit -m "chore(seo): harden CSP and headers, expand sitemap/robots, and clean unused assets"
```

---

### Task 9: Accessibility (a11y) & Touch Target Compliance

**Files:**
- Modify: `src/components/markdown.tsx`
- Modify: `src/components/auth/auth-guard.tsx`
- Modify: `src/components/ui/select.tsx`
- Modify: `src/components/ui/switch.tsx`
- Modify: `src/components/main-shell.tsx`
- Test: `tests/unit/accessibility-seo.test.tsx`

- [ ] **Step 1: Write the failing unit test for accessibility attributes**

```typescript
// tests/unit/accessibility-seo.test.tsx
import { describe, expect, it } from "vitest";

describe("Accessibility attributes check", () => {
  it("validates that markdown images have fallback alt text", async () => {
    const { Markdown } = await import("@/components/markdown");
    expect(Markdown).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it executes**

Run: `pnpm vitest run tests/unit/accessibility-seo.test.tsx`

- [ ] **Step 3: Update UI components with accessible aria attributes and minimum touch targets**

- `src/components/markdown.tsx`: Ensure image rendering fallbacks default to `alt={alt || "Illustration"}` rather than empty string (fixes L11).
- `src/components/auth/auth-guard.tsx`: Add `aria-hidden="true"` to ShieldAlert decorative icon (fixes L12).
- `src/components/ui/select.tsx`: Ensure SelectTrigger has default `aria-label` fallback if missing (fixes L13).
- `src/components/ui/switch.tsx`: Add `aria-label="Toggle setting"` fallback when no programmatic label is passed (fixes L14).
- `src/components/main-shell.tsx`: Ensure mobile navigation buttons have minimum dimensions `min-h-[44px] min-w-[44px]` (fixes M15).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/accessibility-seo.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/markdown.tsx src/components/auth/auth-guard.tsx src/components/ui/select.tsx src/components/ui/switch.tsx src/components/main-shell.tsx tests/unit/accessibility-seo.test.tsx
git commit -m "fix(a11y): enhance image alt fallbacks, icon aria-hidden, and mobile touch targets"
```

---

### Task 10: End-to-End Verification & SEO Audit Compliance Report

**Files:**
- Create: `tests/e2e/seo-audit-compliance.spec.ts`
- Modify: `SEO-AUDIT-REPORT.md` (add verification addendum)

- [ ] **Step 1: Write the Playwright E2E verification test checking all public routes**

```typescript
// tests/e2e/seo-audit-compliance.spec.ts
import { test, expect } from "@playwright/test";

const ROUTES = [
  "/",
  "/uet",
  "/uet-taxila",
  "/uet-taxila/admissions",
  "/uet-taxila/fee-structure",
  "/uet-taxila/programs",
  "/uet-gpt",
  "/learn",
  "/learn/ecat",
  "/learn/fee-structure",
  "/learn/merit-formula",
  "/about",
  "/privacy",
  "/terms",
  "/contact",
];

test.describe("SEO Verification across all public routes", () => {
  for (const route of ROUTES) {
    test(`route ${route} has title, canonical, and landmark main`, async ({ page }) => {
      await page.goto(route);
      const title = await page.title();
      expect(title.length).toBeGreaterThan(10);
      
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(canonical).toBeDefined();

      const main = page.locator("main#main-content");
      await expect(main).toBeAttached();
    });
  }
});
```

- [ ] **Step 2: Run full unit test suite**

Run: `pnpm vitest run`
Expected: All tests pass with 0 errors.

- [ ] **Step 3: Run full production build**

Run: `pnpm build`
Expected: Successful Next.js production build without errors.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/seo-audit-compliance.spec.ts
git commit -m "test(seo): add comprehensive E2E SEO compliance test suite"
```
