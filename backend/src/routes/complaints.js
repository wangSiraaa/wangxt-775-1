const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { run, get, all, initDatabase } = require('../database/db');
const dayjs = require('dayjs');
const ruleEngine = require('../rules/ruleEngine');

const router = express.Router();

(async () => {
  try {
    await initDatabase();
  } catch (e) {
    console.error('数据库初始化失败:', e);
  }
})();

function generateComplaintNo() {
  const date = dayjs().format('YYYYMMDD');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CMP${date}${random}`;
}

router.post('/passenger/submit', async (req, res) => {
  try {
    const {
      passengerId,
      passengerName,
      plateNumber,
      startTime,
      endTime,
      startAddress,
      endAddress,
      paidAmount,
      expectedAmount,
      complaintDescription,
      trackPoints = []
    } = req.body;

    const complaintId = uuidv4();
    const complaintNo = generateComplaintNo();
    const evidenceDeadline = dayjs().add(24, 'hour').format('YYYY-MM-DD HH:mm:ss');

    await run(`
      INSERT INTO complaints (
        id, complaint_no, passenger_id, passenger_name, plate_number,
        start_time, end_time, start_address, end_address, paid_amount,
        expected_amount, complaint_description, status, evidence_deadline
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_driver_evidence', ?)
    `, [
      complaintId, complaintNo, passengerId, passengerName, plateNumber,
      startTime, endTime, startAddress, endAddress, paidAmount,
      expectedAmount, complaintDescription, evidenceDeadline
    ]);

    for (const tp of trackPoints) {
      await run(`
        INSERT INTO track_points (id, complaint_id, source, timestamp, latitude, longitude, speed, heading)
        VALUES (?, ?, 'passenger', ?, ?, ?, ?, ?)
      `, [uuidv4(), complaintId, tp.timestamp, tp.latitude, tp.longitude, tp.speed || null, tp.heading || null]);
    }

    res.json({
      success: true,
      data: { id: complaintId, complaintNo, status: 'pending_driver_evidence' }
    });
  } catch (error) {
    console.error('提交投诉失败:', error);
    res.status(500).json({ success: false, message: '提交失败' });
  }
});

router.get('/driver/:driverId/list', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { status } = req.query;
    
    let sql = 'SELECT * FROM complaints WHERE driver_id = ?';
    const params = [driverId];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY created_at DESC';
    const complaints = await all(sql, params);
    
    res.json({ success: true, data: complaints });
  } catch (error) {
    res.status(500).json({ success: false, message: '查询失败' });
  }
});

router.post('/driver/:complaintId/evidence', async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { driverId, explanation, trackPoints = [] } = req.body;

    const complaint = await get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    if (!complaint) {
      return res.status(404).json({ success: false, message: '投诉单不存在' });
    }

    if (complaint.status !== 'pending_driver_evidence') {
      return res.status(400).json({ success: false, message: '当前状态不可提交举证' });
    }

    await run(`
      INSERT INTO evidence (id, complaint_id, submitter_type, submitter_id, evidence_type, content)
      VALUES (?, ?, 'driver', ?, 'explanation', ?)
    `, [uuidv4(), complaintId, driverId, explanation]);

    for (const tp of trackPoints) {
      await run(`
        INSERT INTO track_points (id, complaint_id, source, timestamp, latitude, longitude, speed, heading)
        VALUES (?, ?, 'driver', ?, ?, ?, ?, ?)
      `, [uuidv4(), complaintId, tp.timestamp, tp.latitude, tp.longitude, tp.speed || null, tp.heading || null]);
    }

    const newStatus = ruleEngine.getNextStatus(complaint.status, 'driver_submit');
    await run('UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, complaintId]);

    res.json({ success: true, data: { status: newStatus } });
  } catch (error) {
    console.error('提交举证失败:', error);
    res.status(500).json({ success: false, message: '提交失败' });
  }
});

router.get('/audit/list', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM complaints';
    const params = [];
    
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    
    const complaints = await all(sql, params);
    res.json({ success: true, data: complaints });
  } catch (error) {
    res.status(500).json({ success: false, message: '查询失败' });
  }
});

router.get('/audit/:complaintId/detail', async (req, res) => {
  try {
    const { complaintId } = req.params;
    
    const complaint = await get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    if (!complaint) {
      return res.status(404).json({ success: false, message: '投诉单不存在' });
    }

    const trackPoints = await all('SELECT * FROM track_points WHERE complaint_id = ? ORDER BY timestamp', [complaintId]);
    const evidence = await all('SELECT * FROM evidence WHERE complaint_id = ? ORDER BY created_at', [complaintId]);
    const meterRecords = await all('SELECT * FROM meter_records WHERE complaint_id = ?', [complaintId]);
    const auditOpinions = await all('SELECT * FROM audit_opinions WHERE complaint_id = ? ORDER BY created_at DESC', [complaintId]);
    const conclusions = await all('SELECT * FROM conclusions WHERE complaint_id = ? ORDER BY version DESC', [complaintId]);

    const ruleCheck = ruleEngine.checkRules(complaint, trackPoints, meterRecords);

    res.json({
      success: true,
      data: {
        complaint,
        trackPoints,
        evidence,
        meterRecords,
        auditOpinions,
        conclusions,
        ruleCheck,
        isReadOnly: ruleEngine.checkComplaintReadOnly(complaint),
        canReview: ruleEngine.canAddReview(complaint),
      }
    });
  } catch (error) {
    console.error('获取详情失败:', error);
    res.status(500).json({ success: false, message: '查询失败' });
  }
});

router.post('/audit/:complaintId/submit', async (req, res) => {
  try {
    const { complaintId } = req.params;
    const {
      auditorId,
      auditorName,
      opinion,
      suggestedPenalty,
      suggestedCompensation,
      detourDetected,
    } = req.body;

    const complaint = await get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    if (!complaint) {
      return res.status(404).json({ success: false, message: '投诉单不存在' });
    }

    const trackPoints = await all('SELECT * FROM track_points WHERE complaint_id = ?', [complaintId]);
    const meterRecords = await all('SELECT * FROM meter_records WHERE complaint_id = ?', [complaintId]);
    const ruleCheck = ruleEngine.checkRules(complaint, trackPoints, meterRecords);

    await run(`
      INSERT INTO audit_opinions (
        id, complaint_id, auditor_id, auditor_name, track_mileage, meter_mileage,
        mileage_diff, mileage_diff_percent, is_track_missing, is_mileage_abnormal,
        detour_detected, rule_hits, opinion, suggested_penalty, suggested_compensation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(), complaintId, auditorId, auditorName,
      ruleCheck.trackMileage, ruleCheck.meterMileage,
      ruleCheck.mileageDiff, ruleCheck.mileageDiffPercent,
      ruleCheck.isTrackMissing ? 1 : 0,
      ruleCheck.isMileageAbnormal ? 1 : 0,
      detourDetected ? 1 : 0,
      JSON.stringify(ruleCheck.ruleHits),
      opinion, suggestedPenalty, suggestedCompensation
    ]);

    const newStatus = ruleEngine.getNextStatus(complaint.status, 'audit_complete');
    await run('UPDATE complaints SET status = ?, judged_by = ?, judge_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, auditorId, complaintId]);

    res.json({ success: true, data: { status: newStatus } });
  } catch (error) {
    console.error('提交稽核意见失败:', error);
    res.status(500).json({ success: false, message: '提交失败' });
  }
});

router.post('/conclusion/:complaintId/publish', async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { publisherId, publisherName, conclusion, penaltyResult, compensationAmount, isReview = false, parentId = null } = req.body;

    const complaint = await get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    if (!complaint) {
      return res.status(404).json({ success: false, message: '投诉单不存在' });
    }

    const existingVersions = await get('SELECT MAX(version) as max_version FROM conclusions WHERE complaint_id = ?', [complaintId]);
    const nextVersion = (existingVersions.max_version || 0) + 1;

    const conclusionId = uuidv4();
    await run(`
      INSERT INTO conclusions (
        id, complaint_id, version, publisher_id, publisher_name,
        conclusion, penalty_result, compensation_amount, is_review, parent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      conclusionId, complaintId, nextVersion, publisherId, publisherName,
      conclusion, penaltyResult, compensationAmount, isReview ? 1 : 0, parentId
    ]);

    if (!isReview) {
      const newStatus = ruleEngine.getNextStatus(complaint.status, 'publish');
      await run('UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newStatus, complaintId]);
    }

    res.json({ success: true, data: { id: conclusionId, version: nextVersion } });
  } catch (error) {
    console.error('发布结论失败:', error);
    res.status(500).json({ success: false, message: '发布失败' });
  }
});

router.post('/review/:complaintId/request', async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { requesterId, reviewReason, reviewEvidence = [] } = req.body;

    const complaint = await get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    if (!complaint) {
      return res.status(404).json({ success: false, message: '投诉单不存在' });
    }

    if (!ruleEngine.canAddReview(complaint)) {
      return res.status(400).json({ success: false, message: '当前状态不可申请复议' });
    }

    await run(`
      INSERT INTO evidence (id, complaint_id, submitter_type, submitter_id, evidence_type, content)
      VALUES (?, ?, 'reviewer', ?, 'review_evidence', ?)
    `, [uuidv4(), complaintId, requesterId, reviewReason]);

    const newStatus = ruleEngine.getNextStatus(complaint.status, 'review_request');
    await run('UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, complaintId]);

    res.json({ success: true, data: { status: newStatus } });
  } catch (error) {
    console.error('申请复议失败:', error);
    res.status(500).json({ success: false, message: '申请失败' });
  }
});

router.post('/system/check-timeouts', async (req, res) => {
  try {
    const pendingComplaints = await all("SELECT * FROM complaints WHERE status = 'pending_driver_evidence'");
    const updated = [];

    for (const complaint of pendingComplaints) {
      if (ruleEngine.checkEvidenceTimeout(complaint)) {
        const newStatus = ruleEngine.getNextStatus(complaint.status, 'timeout');
        await run('UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newStatus, complaint.id]);
        updated.push({ id: complaint.id, oldStatus: complaint.status, newStatus });
      }
    }

    res.json({ success: true, data: { processed: pendingComplaints.length, updated } });
  } catch (error) {
    console.error('超时检查失败:', error);
    res.status(500).json({ success: false, message: '检查失败' });
  }
});

router.get('/complaints/:complaintId', async (req, res) => {
  try {
    const { complaintId } = req.params;
    const complaint = await get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    
    if (!complaint) {
      return res.status(404).json({ success: false, message: '投诉单不存在' });
    }

    res.json({ success: true, data: complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: '查询失败' });
  }
});

module.exports = router;
