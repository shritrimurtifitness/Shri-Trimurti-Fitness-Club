import { addDays, format } from "date-fns";

export type FacilityType = string;

export interface Facility {
  id: FacilityType;
  name: string;
  description: string;
  image: string;
  icon: string;
}

export interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  price: number;
}

export interface Booking {
  id: string;
  customerName: string;
  phone: string;
  date: string;
  facility: FacilityType;
  startTime: string;
  endTime: string;
  status: "confirmed" | "cancelled" | "pending";
  paymentStatus: "paid" | "pending" | "refunded";
  amount: number;
  createdAt: string;
}

/** Static fallback map for known types */
const knownLabels: Record<string, string> = {
  cricket: "Cricket Turf",
  snooker: "Snooker Table",
  pool: "Pool Table",
};

/** Dynamic label resolver - uses known map or capitalizes the raw type */
export function getFacilityLabel(type: string): string {
  if (!type) return "";
  const lower = type.toLowerCase();
  if (knownLabels[lower]) return knownLabels[lower];
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/** Legacy compat - acts as a proxy so existing `facilityLabels[x]` still works */
export const facilityLabels: Record<string, string> = new Proxy(knownLabels, {
  get(target, prop: string) {
    return getFacilityLabel(prop);
  }
});



export const revenueData = [
  { name: "Mon", cricket: 12400, snooker: 3200, pool: 2400 },
  { name: "Tue", cricket: 9800, snooker: 2800, pool: 1800 },
  { name: "Wed", cricket: 11200, snooker: 3400, pool: 2200 },
  { name: "Thu", cricket: 13600, snooker: 3000, pool: 2600 },
  { name: "Fri", cricket: 18200, snooker: 4800, pool: 3600 },
  { name: "Sat", cricket: 24400, snooker: 5600, pool: 4200 },
  { name: "Sun", cricket: 21800, snooker: 5200, pool: 3800 },
];

export const peakHoursData = [
  { hour: "6AM", bookings: 3 },
  { hour: "8AM", bookings: 5 },
  { hour: "10AM", bookings: 6 },
  { hour: "12PM", bookings: 4 },
  { hour: "2PM", bookings: 5 },
  { hour: "4PM", bookings: 8 },
  { hour: "5PM", bookings: 11 },
  { hour: "6PM", bookings: 16 },
  { hour: "7PM", bookings: 19 },
  { hour: "8PM", bookings: 15 },
  { hour: "9PM", bookings: 12 },
  { hour: "10PM", bookings: 7 },
];
