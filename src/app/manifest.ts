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
        src: "/uet-logo.jpg",
        sizes: "192x192 512x512",
        type: "image/jpeg",
        purpose: "maskable",
      },
    ],
    categories: ["education", "productivity", "utilities"],
    shortcuts: [
      {
        name: "Merit Calculator",
        short_name: "Merit Calc",
        description: "Calculate UET Taxila admission merit aggregate",
        url: "/calculator",
      },
      {
        name: "GPA Calculator",
        short_name: "GPA Calc",
        description: "Calculate semester SGPA and cumulative CGPA",
        url: "/gpa-calculator",
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
        url: "/scholarships",
      },
    ],
  };
}
