/** Submission statuses that still need trainer review. */
export const AWAITING_REVIEW_STATUSES = ["pending", "submitted"]

export function isAwaitingReview(status) {
  return AWAITING_REVIEW_STATUSES.includes(status)
}
