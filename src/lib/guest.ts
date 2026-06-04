"use client";

export type GuestIdentity = {
  id: string;
  name: string;
};

function randomId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getGuestIdentity(): GuestIdentity {
  const existing = localStorage.getItem("pmovies_guest");
  if (existing) return JSON.parse(existing) as GuestIdentity;

  const number = Number(localStorage.getItem("pmovies_guest_counter") ?? "0") + 1;
  localStorage.setItem("pmovies_guest_counter", String(number));
  const identity = { id: randomId(), name: `User ${number}` };
  localStorage.setItem("pmovies_guest", JSON.stringify(identity));
  return identity;
}
