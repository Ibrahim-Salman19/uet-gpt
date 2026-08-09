import type { Metadata } from "next";
import type { ReactNode } from "react";

import { APP_NAME } from "@/lib/constants";

const PAGE_TITLE = `Explore UET Taxila - ${APP_NAME}`;
const PAGE_DESCRIPTION =
  "Search and browse indexed UET Taxila documents, including academic information, admissions resources, research, departments, programs, campus services, and official university pages.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
};

interface ExploreLayoutProps {
  children: ReactNode;
}

export default function ExploreLayout({ children }: Readonly<ExploreLayoutProps>) {
  return children;
}
