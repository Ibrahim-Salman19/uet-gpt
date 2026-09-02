import { ImageResponse } from "next/og";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from "@/lib/constants";

export const alt = `${APP_NAME} - ${APP_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "80px",
        background: "linear-gradient(135deg, #07080a 0%, #0f1015 100%)",
        color: "#edf0ec",
        fontFamily: "sans-serif",
      }}
    >
      {/* Top Brand Tag */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "16px",
              background: "#d9b451",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "40px",
              fontWeight: 800,
              color: "#07080a",
            }}
          >
            U
          </div>
          <div
            style={{
              fontSize: "40px",
              fontWeight: 800,
              letterSpacing: "-0.5px",
            }}
          >
            UET <span style={{ color: "#d9b451" }}>GPT</span>
          </div>
        </div>

        <div
          style={{
            padding: "8px 20px",
            borderRadius: "9999px",
            border: "1px solid rgba(217, 180, 81, 0.3)",
            background: "rgba(217, 180, 81, 0.1)",
            color: "#d9b451",
            fontSize: "18px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "2px",
          }}
        >
          AI Guide to UET Taxila
        </div>
      </div>

      {/* Center Heading */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          maxWidth: "1000px",
        }}
      >
        <div
          style={{
            fontSize: "64px",
            fontWeight: 800,
            lineHeight: 1.15,
            color: "#ffffff",
          }}
        >
          Admissions, Fees, Merit Calculator &amp; Campus Guide
        </div>
        <div
          style={{
            fontSize: "26px",
            lineHeight: 1.4,
            color: "#a1a1aa",
          }}
        >
          {APP_DESCRIPTION}
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          paddingTop: "24px",
          fontSize: "20px",
          color: "#71717a",
        }}
      >
        <div>uet-gpt.vercel.app</div>
        <div style={{ color: "#d9b451" }}>RAG Synced 2026 • Verified Prospectus Data</div>
      </div>
    </div>,
    { ...size },
  );
}
