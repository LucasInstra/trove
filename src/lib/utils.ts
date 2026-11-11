import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins class names and lets the last Tailwind class win. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
