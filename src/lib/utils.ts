import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function stripHtml(value?: string) {
  return value?.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() ?? "";
}

export function normalizeVietnameseSearch(str: string) {
  return str
    .replace(/kì/gi, "kỳ")
    .replace(/kí/gi, "ký")
    .replace(/kỉ/gi, "kỷ")
    .replace(/kĩ/gi, "kỹ")
    .replace(/kị/gi, "kỵ")
    .replace(/lí/gi, "lý")
    .replace(/lì/gi, "lỳ")
    .replace(/lỉ/gi, "lỷ")
    .replace(/lĩ/gi, "lỹ")
    .replace(/lị/gi, "lỵ")
    .replace(/mĩ/gi, "mỹ")
    .replace(/mị/gi, "mỵ")
    .replace(/mi/gi, "my")
    .replace(/[:\-!?,.'"]/g, " "); // Strip punctuation that breaks KKPhim search API
}
