/** Plain words for the owner instead of database values (admin pages). */
const STATUS: Record<string, string> = {
  AWAITING_PAYMENT: "Waiting for payment",
  PAYMENT_REVIEW: "Payment to check",
  PAID: "Paid, starting",
  PROCESSING: "In progress",
  FULFILLED: "Completed",
  FAILED: "Failed",
  CANCELED: "Canceled",
  REFUNDED: "Refunded",
  PENDING: "Waiting",
  DELIVERED: "Delivered",
  REVIEW: "To check",
  SUCCEEDED: "Credited",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  REQUESTED: "To send",
  SENT: "Sent",
  AVAILABLE: "Paid into earnings",
  OPEN: "Waiting for you",
  WAITING_CUSTOMER: "Waiting for customer",
  CLOSED: "Closed",
  ACTIVE: "Active",
  RESTRICTED: "Restricted",
  SUSPENDED: "Suspended",
  QUEUED: "Queued",
  SENDING: "Sending",
  UNKNOWN: "No clear answer",
  SUCCESS: "Done",
};
export const statusLabel = (s: string) => STATUS[s] ?? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

const METHOD: Record<string, string> = { WALLET: "Wallet", MONCASH: "MonCash", NATCASH: "NatCash", MANUAL: "Bank / other" };
export const methodLabel = (m: string) => METHOD[m] ?? m;

const ROLE: Record<string, string> = {
  CUSTOMER: "Customer",
  SUPER_ADMIN: "Owner (all rights)",
  STORE_MANAGER: "Store manager",
  FINANCE_MANAGER: "Finance",
  CONTENT_EDITOR: "Content editor",
  SUPPORT_AGENT: "Support",
  FULFILLMENT: "Order delivery",
  CUSTOM: "Custom role",
};
export const roleLabel = (r: string) => ROLE[r] ?? r;

/** Admin dates and times always in Haiti time. */
export const haitiDate = (d: Date, withTime = true) =>
  d.toLocaleString("en-US", { timeZone: "America/Port-au-Prince", month: "short", day: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : { year: "numeric" }) });
