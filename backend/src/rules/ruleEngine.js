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

function compareTrackVersions(trackPointsA, trackPointsB, sourceA, sourceB) {
  const sortedA = [...trackPointsA].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const sortedB = [...trackPointsB].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const mileageA = calculateTrackMileage(sortedA);
  const mileageB = calculateTrackMileage(sortedB);

  const mileageDiff = Math.abs(mileageA - mileageB);
  const mileageDiffPercent = mileageA > 0 ? mileageDiff / mileageA : 0;

  const timeThreshold = 5 * 60 * 1000;
  const distanceThreshold = 0.05;

  let commonPoints = 0;
  let diffPoints = 0;
  const detourSegments = [];

  for (const pointA of sortedA) {
    let foundMatch = false;
    for (const pointB of sortedB) {
      const timeDiff = Math.abs(new Date(pointA.timestamp) - new Date(pointB.timestamp));
      if (timeDiff <= timeThreshold) {
        const dist = calculateDistance(
          pointA.latitude, pointA.longitude,
          pointB.latitude, pointB.longitude
        );
        if (dist <= distanceThreshold) {
          foundMatch = true;
          break;
        }
      }
    }
    if (foundMatch) {
      commonPoints++;
    } else {
      diffPoints++;
    }
  }

  if (mileageDiffPercent > 0.1) {
    detourSegments.push({
      type: 'mileage_diff',
      description: `${sourceA}轨迹里程 ${mileageA.toFixed(2)}km 与 ${sourceB}轨迹里程 ${mileageB.toFixed(2)}km 差异 ${(mileageDiffPercent * 100).toFixed(1)}%`,
      severity: mileageDiffPercent > 0.2 ? 'high' : 'medium'
    });
  }

  const diffRatio = sortedA.length > 0 ? diffPoints / sortedA.length : 0;
  if (diffRatio > 0.3) {
    detourSegments.push({
      type: 'track_mismatch',
      description: `轨迹匹配度较低，${diffPoints}/${sortedA.length} 个点无法匹配`,
      severity: diffRatio > 0.5 ? 'high' : 'medium'
    });
  }

  let compareResult = 'normal';
  if (detourSegments.some(s => s.severity === 'high')) {
    compareResult = 'abnormal';
  } else if (detourSegments.some(s => s.severity === 'medium')) {
    compareResult = 'warning';
  }

  return {
    mileageA,
    mileageB,
    mileageDiff,
    mileageDiffPercent,
    commonPoints,
    diffPoints,
    detourSegments,
    compareResult,
    sourceA,
    sourceB
  };
}

function generateAuditLog(complaintId, operatorId, operatorName, actionType, oldStatus, newStatus, remark, detail) {
  return {
    id: null,
    complaintId,
    operatorId,
    operatorName,
    actionType,
    oldStatus,
    newStatus,
    remark,
    detailJson: detail ? JSON.stringify(detail) : null
  };
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
  compareTrackVersions,
  generateAuditLog,
};
