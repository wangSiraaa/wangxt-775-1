export interface Complaint {
  id: string;
  complaint_no: string;
  passenger_id: string;
  passenger_name: string;
  driver_id?: string;
  driver_name?: string;
  plate_number: string;
  start_time: string;
  end_time: string;
  start_address: string;
  end_address: string;
  paid_amount: number;
  expected_amount?: number;
  complaint_description: string;
  status: ComplaintStatus;
  evidence_deadline: string;
  judged_by?: string;
  judge_time?: string;
  created_at: string;
  updated_at: string;
}

export type ComplaintStatus = 
  | 'pending_driver_evidence'
  | 'pending_audit'
  | 'pending_conclusion'
  | 'concluded'
  | 'in_review';

export const StatusMap: Record<ComplaintStatus, { label: string; color: string }> = {
  pending_driver_evidence: { label: '待司机举证', color: 'orange' },
  pending_audit: { label: '待稽核', color: 'blue' },
  pending_conclusion: { label: '待发布结论', color: 'purple' },
  concluded: { label: '已结案', color: 'green' },
  in_review: { label: '复议中', color: 'red' },
};

export interface TrackPoint {
  id: string;
  complaint_id: string;
  source: 'passenger' | 'driver';
  timestamp: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
}

export interface Evidence {
  id: string;
  complaint_id: string;
  submitter_type: string;
  submitter_id: string;
  evidence_type: string;
  content: string;
  file_url?: string;
  created_at: string;
}

export interface MeterRecord {
  id: string;
  complaint_id: string;
  start_mileage: number;
  end_mileage: number;
  total_mileage: number;
  waiting_time: number;
  unit_price: number;
  waiting_price: number;
  total_amount: number;
  record_time: string;
}

export interface AuditOpinion {
  id: string;
  complaint_id: string;
  auditor_id: string;
  auditor_name: string;
  track_mileage?: number;
  meter_mileage?: number;
  mileage_diff?: number;
  mileage_diff_percent?: number;
  is_track_missing: boolean;
  is_mileage_abnormal: boolean;
  detour_detected: boolean;
  rule_hits?: string;
  opinion: string;
  suggested_penalty?: string;
  suggested_compensation?: number;
  created_at: string;
}

export interface Conclusion {
  id: string;
  complaint_id: string;
  version: number;
  publisher_id: string;
  publisher_name: string;
  conclusion: string;
  penalty_result?: string;
  compensation_amount?: number;
  is_review: boolean;
  parent_id?: string;
  created_at: string;
}

export interface RuleCheckResult {
  ruleHits: string[];
  warnings: string[];
  isTrackMissing: boolean;
  isMileageAbnormal: boolean;
  canJudgeDirectly: boolean;
  trackMileage: number;
  meterMileage: number;
  mileageDiff: number;
  mileageDiffPercent: number;
}

export interface AuditLog {
  id: string;
  complaint_id: string;
  operator_id: string;
  operator_name: string;
  action_type: string;
  old_status?: string;
  new_status?: string;
  remark?: string;
  detail_json?: string;
  created_at: string;
}

export interface StatusChangeRecord {
  id: string;
  complaint_id: string;
  old_status: string;
  new_status: string;
  operator_id?: string;
  operator_name?: string;
  change_reason?: string;
  is_auto_trigger: boolean;
  created_at: string;
}

export interface TrackVersionCompare {
  id: string;
  complaint_id: string;
  compare_type: string;
  version_a: number;
  version_b: number;
  source_a: string;
  source_b: string;
  mileage_a?: number;
  mileage_b?: number;
  mileage_diff?: number;
  mileage_diff_percent?: number;
  common_points: number;
  diff_points: number;
  detour_segments?: string;
  compare_result: string;
  operator_id?: string;
  operator_name?: string;
  created_at: string;
}

export interface DetourSegment {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface TrackCompareResult {
  complaint: Complaint;
  trackA: {
    source: string;
    points: TrackPoint[];
    mileage: number;
  };
  trackB: {
    source: string;
    points: TrackPoint[];
    mileage: number;
  };
  comparison: {
    mileageDiff: number;
    mileageDiffPercent: number;
    commonPoints: number;
    diffPoints: number;
    detourSegments: DetourSegment[];
    compareResult: 'normal' | 'warning' | 'abnormal';
  };
}

export interface AuditLogsResponse {
  auditLogs: AuditLog[];
  statusChanges: StatusChangeRecord[];
  compareRecords: TrackVersionCompare[];
}

export interface ComplaintDetail {
  complaint: Complaint;
  trackPoints: TrackPoint[];
  evidence: Evidence[];
  meterRecords: MeterRecord[];
  auditOpinions: AuditOpinion[];
  conclusions: Conclusion[];
  ruleCheck: RuleCheckResult;
  isReadOnly: boolean;
  canReview: boolean;
}
