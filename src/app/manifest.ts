import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UET GPT - Your AI Guide to UET Taxila",
    short_name: "UET GPT",
    description:
      "An intelligent AI assistant that answers any question about UET Taxila - admissions, programs, campus life, faculty, departments, and more.",
    start_url: "/",
    display: "standalone",
    background_color: "#070708",
    theme_color: "#070708",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/favicon.ico",
        sizes: "48x48 32x32 16x16",
        type: "image/x-icon",
        purpose: "any",
      },
    ],
    categories: ["education", "productivity", "utilities"],
    shortcuts: [
      {
        name: "Merit Calculator",
        short_name: "Merit Calc",
        description: "Calculate UET Taxila admission merit aggregate",
        url: "/tools?tab=merit",
      },
      {
        name: "GPA Calculator",
        short_name: "GPA Calc",
        description: "Calculate semester SGPA and cumulative CGPA",
        url: "/tools?tab=gpa",
      },
      {
        name: "Ask AI Assistant",
        short_name: "AI Chat",
        description: "Ask questions to UET GPT AI assistant",
        url: "/chat",
      },
      {
        name: "Scholarships & Aid",
        short_name: "Scholarships",
        description: "View HEC Need-Based and Ehsaas scholarships",
        url: "/admissions?tab=scholarships",
      },
    ],
  };
}
