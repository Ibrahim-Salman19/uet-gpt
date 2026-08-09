import { v } from "convex/values";
import { action } from "../_generated/server";

export const ALLOWED_HOST_SUFFIXES = ["uet.edu.pk", "uettaxila.edu.pk"] as const;

export function isOfficialUrlAllowed(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

export const verifyOfficialSourceFact = action({
  args: {
    targetUrl: v.string(),
    expectedFactType: v.string(),
  },
  handler: async (_ctx, args) => {
    if (!isOfficialUrlAllowed(args.targetUrl)) {
      return {
        success: false,
        reasonCode: "LIVE_VERIFICATION_HOST_DENIED",
        error: "URL does not belong to an approved official UET Taxila host.",
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s deadline

      const res = await fetch(args.targetUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "UETGPT-OfficialSourceVerifier/1.0",
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return {
          success: false,
          reasonCode: "LIVE_VERIFICATION_HTTP_ERROR",
          status: res.status,
        };
      }

      return {
        success: true,
        reasonCode: "LIVE_VERIFICATION_SUCCESS",
        verifiedAt: Date.now(),
        httpStatus: res.status,
      };
    } catch (err) {
      return {
        success: false,
        reasonCode: "LIVE_VERIFICATION_TIMEOUT_OR_NETWORK",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});
