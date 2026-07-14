import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Settings — ${APP_NAME}`,
  description:
    "Manage your UET GPT account settings, preferences, theme, AI model selection, font size, and data controls.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
