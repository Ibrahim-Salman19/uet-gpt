import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
