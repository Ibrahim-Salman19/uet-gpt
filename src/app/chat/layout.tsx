import { ErrorBoundary } from "@/components/error-boundary";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main id="main-content" className="flex-1 overflow-hidden">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
