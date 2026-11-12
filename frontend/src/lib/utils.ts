import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime12Hour(timeString: string) {
  if (!timeString) return "";
  const [hourStr, minuteStr] = timeString.split(':');
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minuteStr} ${ampm}`;
}

/**
 * Normalizes any Indian phone number representation to a clean 10-digit string.
 * Handles:
 * - "+919168310559" / "919168310559" -> "9168310559" (country code 91 removed)
 * - "9168310559" -> "9168310559" (preserved 10 digits)
 * - "09168310559" -> "9168310559" (trunk prefix 0 removed)
 */
export function normalizeTo10Digits(phone: string): string {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.substring(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.substring(1);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}
