"use client";

// Filter out benign hydration warnings caused by browser extensions like Bitdefender (bis_skin_checked)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const errorStr = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    if (errorStr.includes("bis_skin_checked") || (errorStr.includes("hydration") && errorStr.includes("bis_skin"))) {
      // Suppress extension-injected attribute false-alarms
      return;
    }
    originalError.apply(console, args);
  };
}

export function ExtensionHydrationFix() {
  return null;
}
