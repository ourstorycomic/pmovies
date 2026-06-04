import { headers } from "next/headers";

export async function getSiteUrl() {
  const headerStore = await headers();
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
