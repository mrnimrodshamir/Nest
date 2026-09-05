export const REPORT_REASONS = ['harassment', 'inappropriate', 'spam', 'hate', 'safety', 'other'] as const;
export type ReportReason = typeof REPORT_REASONS[number];
export type ReportTargetType = 'activity' | 'user' | 'message' | 'forum_message';

export interface ReportTarget {
  type: ReportTargetType;
  id: string;
  reportedUserId?: string;
  label?: string;
}

export interface SubmitReportInput {
  target: ReportTarget;
  reason: ReportReason;
  details?: string;
}
