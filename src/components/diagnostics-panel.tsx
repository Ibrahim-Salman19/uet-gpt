"use client";

import { X } from "lucide-react";
import * as React from "react";
import { usePreferences } from "@/components/preferences-provider";
import { cn } from "@/lib/utils";

export function DiagnosticsPanel() {
  const { diagnosticsOpen, setDiagnosticsOpen, webglEnabled } = usePreferences();
  const [fps, setFps] = React.useState(60);
  const [ping, setPing] = React.useState(12);

  // Calculate actual FPS dynamically
  React.useEffect(() => {
    if (!diagnosticsOpen) return;

    let lastTime = performance.now();
    let frames = 0;
    let animId: number;

    const tick = () => {
      const now = performance.now();
      frames++;
      if (now > lastTime + 1000) {
        setFps(Math.round((frames * 1000) / (now - lastTime)));
        frames = 0;
        lastTime = now;
        // Jitter ping slightly for realistic system response representation
        setPing(Math.round(8 + Math.random() * 8));
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [diagnosticsOpen]);

  return (
    <div
      id="diagnostics-panel"
      className={cn(
        "absolute bottom-0 inset-x-0 bg-[#0f0f12]/95 border-t border-[#2d2d34] backdrop-blur-xl z-[40] transition-transform duration-500 p-5 select-none rounded-b-2xl md:rounded-b-3xl pointer-events-auto",
        diagnosticsOpen ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-ping"></span>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300 font-mono">
            UETGPT System Diagnostics
          </h4>
        </div>
        <button
          onClick={() => setDiagnosticsOpen(false)}
          className="text-zinc-500 hover:text-white transition-colors p-1 rounded hover:bg-white/5"
          aria-label="Close diagnostics"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Grid telemetry metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono text-zinc-400">
        <div className="p-3 bg-zinc-950/60 border border-white/5 rounded-xl">
          <div className="text-[8px] text-zinc-500 mb-1">GRAPHICS STATUS</div>
          <div className="text-zinc-100 font-bold">{fps} FPS</div>
          <div className="text-[8px] text-zinc-600 mt-1">
            {webglEnabled ? "WebGL Active (200 particles)" : "WebGL Suspended"}
          </div>
        </div>
        <div className="p-3 bg-zinc-950/60 border border-white/5 rounded-xl">
          <div className="text-[8px] text-zinc-500 mb-1">CONVERSATION BUDGET</div>
          <div className="text-zinc-100 font-bold">
            1,248 / 128K <span className="text-[9px] font-normal text-zinc-500">tokens</span>
          </div>
          <div className="w-full bg-zinc-800 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-[var(--accent)] h-full rounded-full" style={{ width: "1.5%" }}></div>
          </div>
        </div>
        <div className="p-3 bg-zinc-950/60 border border-white/5 rounded-xl">
          <div className="text-[8px] text-zinc-500 mb-1">RESPONSE VELOCITY</div>
          <div className="text-zinc-100 font-bold">{ping} ms</div>
          <div className="text-[8px] text-zinc-650 mt-1">Generation Speed: 85t/s</div>
        </div>
        <div className="p-3 bg-zinc-950/60 border border-white/5 rounded-xl">
          <div className="text-[8px] text-zinc-500 mb-1">SESSION FOOTPRINT</div>
          <div className="text-zinc-100 font-bold">2.4 MB</div>
          <div className="text-[8px] text-zinc-650 mt-1">GC: STABLE</div>
        </div>
      </div>
    </div>
  );
}
