const tone: Record<string, string> = {
  AWAITING_PAYMENT: "bg-warning-soft text-warning",
  PAYMENT_REVIEW: "bg-warning-soft text-warning",
  PENDING: "bg-warning-soft text-warning",
  REVIEW: "bg-warning-soft text-warning",
  PAID: "bg-[#DBEAFE] text-[#1E40AF] dark:bg-[#1E3A8A]/40 dark:text-[#BFDBFE]",
  PROCESSING: "bg-[#DBEAFE] text-[#1E40AF] dark:bg-[#1E3A8A]/40 dark:text-[#BFDBFE]",
  FULFILLED: "bg-success-soft text-success",
  DELIVERED: "bg-success-soft text-success",
  SUCCEEDED: "bg-success-soft text-success",
  REFUNDED: "bg-surface-2 text-muted",
  CANCELED: "bg-surface-2 text-muted",
  EXPIRED: "bg-surface-2 text-muted",
  FAILED: "bg-danger-soft text-danger",
  REJECTED: "bg-danger-soft text-danger",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={`badge ${tone[status] ?? "bg-surface-2 text-muted"}`}>{label}</span>;
}
