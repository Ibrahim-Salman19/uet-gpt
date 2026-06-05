import { LoadingState } from "@/components/loading-state";

export default function MainLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <LoadingState type="page" />
    </div>
  );
}
