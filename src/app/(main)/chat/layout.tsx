import type { Metadata } from "next";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Chat — ${APP_NAME}`,
  description:
    "Ask UET GPT anything about UET Taxila — admissions, fee structure, academic programs, departments, faculty, campus life, transport, hostels, scholarships, and more.",
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
