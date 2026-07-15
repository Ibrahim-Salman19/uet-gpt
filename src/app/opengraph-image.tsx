import { ImageResponse } from "next/og";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from "@/lib/constants";

export const alt = `${APP_NAME} — ${APP_TAGLINE}`;
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
        justifyContent: "center",
        padding: "80px",
        background: "#070708",
        color: "#e1e1e2",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "24px",
          marginBottom: "40px",
        }}
      >
        <div
          style={{
            width: "88px",
            height: "88px",
            borderRadius: "20px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "48px",
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          U
        </div>
        <div style={{ fontSize: "44px", fontWeight: 700 }}>{APP_NAME}</div>
      </div>
      <div
        style={{
          fontSize: "68px",
          fontWeight: 700,
          lineHeight: 1.1,
          marginBottom: "28px",
          background: "linear-gradient(90deg, #818cf8, #c4b5fd)",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        {APP_TAGLINE}
      </div>
      <div style={{ fontSize: "30px", color: "#a1a1aa", maxWidth: "900px" }}>{APP_DESCRIPTION}</div>
    </div>,
    { ...size },
  );
}
