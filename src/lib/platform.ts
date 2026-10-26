export type Platform = "android" | "ios" | "windows" | "macos" | "linux" | "other";

export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  // iPadOS 13+ reports as Macintosh with touch support
  if (/macintosh/i.test(ua) && maxTouchPoints > 1) return "ios";
  if (/windows/i.test(ua)) return "windows";
  if (/macintosh|mac os x/i.test(ua)) return "macos";
  if (/linux|cros/i.test(ua)) return "linux";
  return "other";
}
