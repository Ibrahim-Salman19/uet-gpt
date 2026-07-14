import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UET GPT — Your AI Guide to UET Taxila",
    short_name: "UET GPT",
    description:
      "An intelligent AI assistant that answers any question about UET Taxila — admissions, programs, campus life, faculty, departments, and more.",
    start_url: "/chat",
    display: "standalone",
    background_color: "#070708",
    theme_color: "#070708",
    icons: [
      {
        src: "/uet-logo.jpg",
        sizes: "any",
        type: "image/jpeg",
      },
    ],
  };
}
