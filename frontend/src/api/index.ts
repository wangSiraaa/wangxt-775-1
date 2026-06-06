import axios from 'axios';
import { Complaint, ComplaintDetail, TrackCompareResult, AuditLogsResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export const complaintApi = {
  submitComplaint: (data: any) => 
    api.post('/complaints/passenger/submit', data).then(r => r.data),

  getDriverList: (driverId: string, status?: string) =>
    api.get(`/complaints/driver/${driverId}/list`, { params: { status } }).then(r => r.data),

  submitEvidence: (complaintId: string, data: any) =>
    api.post(`/complaints/driver/${complaintId}/evidence`, data).then(r => r.data),

  getAuditList: (status?: string) =>
    api.get('/complaints/audit/list', { params: { status } }).then(r => r.data),

  getDetail: (complaintId: string): Promise<{ success: boolean; data: ComplaintDetail }> =>
    api.get(`/complaints/audit/${complaintId}/detail`).then(r => r.data),

  submitAudit: (complaintId: string, data: any) =>
    api.post(`/complaints/audit/${complaintId}/submit`, data).then(r => r.data),

  publishConclusion: (complaintId: string, data: any) =>
    api.post(`/complaints/conclusion/${complaintId}/publish`, data).then(r => r.data),

  requestReview: (complaintId: string, data: any) =>
    api.post(`/complaints/review/${complaintId}/request`, data).then(r => r.data),

  checkTimeouts: () =>
    api.post('/complaints/system/check-timeouts').then(r => r.data),

  getComplaint: (complaintId: string): Promise<{ success: boolean; data: Complaint }> =>
    api.get(`/complaints/${complaintId}`).then(r => r.data),

  compareTrackVersions: (complaintId: string, sourceA?: string, sourceB?: string): Promise<{ success: boolean; data: TrackCompareResult }> =>
    api.get(`/complaints/${complaintId}/versions/compare`, { params: { sourceA, sourceB } }).then(r => r.data),

  saveTrackCompare: (complaintId: string, data: any): Promise<{ success: boolean; data: any }> =>
    api.post(`/complaints/${complaintId}/versions/compare/save`, data).then(r => r.data),

  getAuditLogs: (complaintId: string): Promise<{ success: boolean; data: AuditLogsResponse }> =>
    api.get(`/complaints/${complaintId}/audit-logs`).then(r => r.data),
};

export default api;
