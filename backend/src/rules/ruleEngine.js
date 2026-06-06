const dayjs = require('dayjs');

const RULES = {
  MILEAGE_DIFF_THRESHOLD: 0.15,
  EVIDENCE_TIMEOUT_HOURS: 24,
  TRACK_MIN_POINTS: 5,
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateTrackMileage(trackPoints) {
  if (!trackPoints || trackPoints.length < 2) return 0;
  
  let totalDistance = 0;
  const sorted = [...trackPoints].sort((a, b) => 
    new Date(a.timestamp) - new Date(b.timestamp)
  );
  
  for (let i = 1; i < sorted.length; i++) {
    totalDistance += calculateDistance(
      sorted[i-1].latitude, sorted[i-1].longitude,
      sorted[i].latitude, sorted[i].longitude
    );
  }
  
  return parseFloat(totalDistance.toFixed(3));
}

function checkEvidenceTimeout(complaint) {
  const now = dayjs();
  const deadline = dayjs(complaint.evidence_deadline);
  return now.isAfter(deadline) && complaint.status === 'pending_driver_evidence';
}

function checkRules(complaint, trackPoints, meterRecords) {
  const results = {
    ruleHits: [],
    warnings: [],
    isTrackMissing: false,
    isMileageAbnormal: false,
    canJudgeDirectly: true,
    trackMileage: 0,
    meterMileage: 0,
    mileageDiff: 0,
    mileageDiffPercent: 0,
  };

  const driverTracks = trackPoints.filter(t => t.source === 'driver');
  results.trackMileage = calculateTrackMileage(driverTracks);
  
  if (driverTracks.length < RULES.TRACK_MIN_POINTS) {
    results.isTrackMissing = true;
    results.canJudgeDirectly = false;
    results.ruleHits.push('TRACK_INSUFFICIENT');
    results.warnings.push('轨迹点数量不足，不能直接判定司机责任');
  }

  if (meterRecords && meterRecords.length > 0) {
    results.meterMileage = meterRecords[0].total_mileage;
    
    if (results.trackMileage > 0 && results.meterMileage > 0) {
      results.mileageDiff = Math.abs(results.meterMileage - results.trackMileage);
      results.mileageDiffPercent = results.mileageDiff / results.trackMileage;
      
      if (results.mileageDiffPercent > RULES.MILEAGE_DIFF_THRESHOLD) {
        results.isMileageAbnormal = true;
        results.ruleHits.push('MILEAGE_DIFF_EXCEEDED');
        results.warnings.push(`计价器里程与轨迹里程差异${(results.mileageDiffPercent * 100).toFixed(1)}%，超过阈值${RULES.MILEAGE_DIFF_THRESHOLD * 100}%，需重点关注`);
      }
    }
  }

  return results;
}

function checkComplaintReadOnly(complaint) {
  return complaint.status === 'concluded';
}

function canAddReview(complaint) {
  return complaint.status === 'concluded';
}

function getNextStatus(currentStatus, action) {
  const statusFlow = {
    'pending_driver_evidence': {
      'driver_submit': 'pending_audit',
      'timeout': 'pending_audit',
    },
    'pending_audit': {
      'audit_complete': 'pending_conclusion',
    },
    'pending_conclusion': {
      'publish': 'concluded',
    },
    'concluded': {
      'review_request': 'in_review',
    },
    'in_review': {
      'review_complete': 'concluded',
    },
  };
  
  return statusFlow[currentStatus]?.[action] || currentStatus;
}

module.exports = {
  RULES,
  calculateDistance,
  calculateTrackMileage,
  checkEvidenceTimeout,
  checkRules,
  checkComplaintReadOnly,
  canAddReview,
  getNextStatus,
};
