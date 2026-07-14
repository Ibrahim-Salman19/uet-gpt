import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Explore Documents — ${APP_NAME}`,
  description:
    "Browse and search all indexed UET Taxila documents — academic content, admissions info, campus resources, research papers, and official university pages.",
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
