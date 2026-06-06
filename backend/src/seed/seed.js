const { run, get, all, initDatabase } = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

async function seedData() {
  console.log('🌱 开始填充种子数据...');

  await initDatabase();

  const passengers = [
    { id: 'P001', name: '张三' },
    { id: 'P002', name: '李四' },
    { id: 'P003', name: '王五' },
  ];

  const drivers = [
    { id: 'D001', name: '刘师傅', plate: '京A12345' },
    { id: 'D002', name: '陈师傅', plate: '京B67890' },
    { id: 'D003', name: '赵师傅', plate: '京C11111' },
  ];

  const auditors = [
    { id: 'A001', name: '稽核员小王' },
    { id: 'A002', name: '稽核员小李' },
  ];

  const customerServices = [
    { id: 'CS001', name: '客服小张' },
  ];

  function generateTrackPoints(baseLat, baseLng, count, variance = 0.001) {
    const points = [];
    const now = dayjs();
    for (let i = 0; i < count; i++) {
      points.push({
        id: uuidv4(),
        timestamp: now.subtract(count - i, 'minute').format('YYYY-MM-DD HH:mm:ss'),
        latitude: baseLat + (Math.random() - 0.5) * variance,
        longitude: baseLng + (Math.random() - 0.5) * variance,
        speed: Math.random() * 60,
        heading: Math.random() * 360,
      });
    }
    return points;
  }

  const complaintsData = [
    {
      id: uuidv4(),
      complaintNo: 'CMP20240101ABC001',
      passenger: passengers[0],
      driver: drivers[0],
      startTime: dayjs().subtract(2, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      endTime: dayjs().subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      startAddress: '北京西站',
      endAddress: '首都机场T3',
      paidAmount: 280,
      expectedAmount: 180,
      description: '平时走机场高速只需要180元左右，这次司机绕了三环多收了100元',
      status: 'pending_driver_evidence',
      trackPoints: generateTrackPoints(39.9042, 116.4074, 8, 0.005),
    },
    {
      id: uuidv4(),
      complaintNo: 'CMP20240101ABC002',
      passenger: passengers[1],
      driver: drivers[1],
      startTime: dayjs().subtract(3, 'day').subtract(2, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      endTime: dayjs().subtract(3, 'day').subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      startAddress: '国贸大厦',
      endAddress: '中关村软件园',
      paidAmount: 150,
      expectedAmount: 90,
      description: '司机不走近路，故意绕远路多收费',
      status: 'pending_audit',
      trackPoints: generateTrackPoints(39.9142, 116.4674, 15, 0.008),
      hasDriverEvidence: true,
    },
    {
      id: uuidv4(),
      complaintNo: 'CMP20240101ABC003',
      passenger: passengers[2],
      driver: drivers[2],
      startTime: dayjs().subtract(7, 'day').subtract(3, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      endTime: dayjs().subtract(7, 'day').subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      startAddress: '颐和园',
      endAddress: '故宫博物院',
      paidAmount: 120,
      expectedAmount: 80,
      description: '司机声称走了快车道，但实际走了小路，里程异常',
      status: 'pending_conclusion',
      trackPoints: generateTrackPoints(39.9999, 116.2755, 12, 0.01),
      hasDriverEvidence: true,
      hasAudit: true,
    },
    {
      id: uuidv4(),
      complaintNo: 'CMP20240101ABC004',
      passenger: passengers[0],
      driver: drivers[1],
      startTime: dayjs().subtract(14, 'day').subtract(2, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      endTime: dayjs().subtract(14, 'day').subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      startAddress: '朝阳公园',
      endAddress: '鸟巢体育场',
      paidAmount: 95,
      expectedAmount: 65,
      description: '已完成处理的历史投诉，用于测试只读和复议功能',
      status: 'concluded',
      trackPoints: generateTrackPoints(39.9339, 116.4728, 20, 0.006),
      hasDriverEvidence: true,
      hasAudit: true,
      hasConclusion: true,
    },
    {
      id: uuidv4(),
      complaintNo: 'CMP20240101ABC005',
      passenger: passengers[1],
      driver: drivers[0],
      startTime: dayjs().subtract(2, 'day').subtract(26, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      endTime: dayjs().subtract(2, 'day').subtract(24, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      startAddress: '清华大学',
      endAddress: '北京大学',
      paidAmount: 50,
      expectedAmount: 30,
      description: '司机超时未举证的测试单，用于验证自动转稽核功能',
      status: 'pending_driver_evidence',
      evidenceDeadline: dayjs().subtract(2, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      trackPoints: generateTrackPoints(40.0000, 116.3264, 6, 0.003),
      isOverdue: true,
    },
  ];

  for (const c of complaintsData) {
    const evidenceDeadline = c.evidenceDeadline || 
      (c.status === 'pending_driver_evidence' 
        ? dayjs().add(24, 'hour').format('YYYY-MM-DD HH:mm:ss')
        : dayjs().add(2, 'day').format('YYYY-MM-DD HH:mm:ss'));

    await run(`
      INSERT INTO complaints (
        id, complaint_no, passenger_id, passenger_name, driver_id, driver_name,
        plate_number, start_time, end_time, start_address, end_address,
        paid_amount, expected_amount, complaint_description, status, evidence_deadline
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      c.id, c.complaintNo, c.passenger.id, c.passenger.name,
      c.driver.id, c.driver.name, c.driver.plate,
      c.startTime, c.endTime, c.startAddress, c.endAddress,
      c.paidAmount, c.expectedAmount, c.description,
      c.status, evidenceDeadline
    ]);

    for (const tp of c.trackPoints) {
      await run(`
        INSERT INTO track_points (id, complaint_id, source, timestamp, latitude, longitude, speed, heading)
        VALUES (?, ?, 'passenger', ?, ?, ?, ?, ?)
      `, [tp.id, c.id, tp.timestamp, tp.latitude, tp.longitude, tp.speed, tp.heading]);
    }

    if (c.hasDriverEvidence) {
      await run(`
        INSERT INTO evidence (id, complaint_id, submitter_type, submitter_id, evidence_type, content)
        VALUES (?, ?, 'driver', ?, 'explanation', ?)
      `, [uuidv4(), c.id, c.driver.id, '当时是晚高峰，主干道拥堵严重，为了赶时间选择绕行，乘客当时也同意了。']);
      
      const driverTracks = generateTrackPoints(39.9142, 116.4674, 25, 0.01);
      for (const tp of driverTracks) {
        await run(`
          INSERT INTO track_points (id, complaint_id, source, timestamp, latitude, longitude, speed, heading)
          VALUES (?, ?, 'driver', ?, ?, ?, ?, ?)
        `, [tp.id, c.id, tp.timestamp, tp.latitude, tp.longitude, tp.speed, tp.heading]);
      }
    }

    const meterMileage = c.paidAmount > 200 ? 35.5 : c.paidAmount > 100 ? 18.2 : 8.5;
    await run(`
      INSERT INTO meter_records (
        id, complaint_id, start_mileage, end_mileage, total_mileage,
        waiting_time, unit_price, waiting_price, total_amount
      ) VALUES (?, ?, 0, ?, ?, 300, 2.3, 15, ?)
    `, [uuidv4(), c.id, meterMileage, meterMileage, c.paidAmount]);

    if (c.hasAudit) {
      const trackMileage = c.paidAmount > 200 ? 30.2 : c.paidAmount > 100 ? 15.8 : 7.2;
      const mileageDiff = meterMileage - trackMileage;
      const mileageDiffPercent = mileageDiff / trackMileage;
      
      await run(`
        INSERT INTO audit_opinions (
          id, complaint_id, auditor_id, auditor_name, track_mileage, meter_mileage,
          mileage_diff, mileage_diff_percent, is_track_missing, is_mileage_abnormal,
          detour_detected, rule_hits, opinion, suggested_penalty, suggested_compensation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1, ?, ?, ?, ?)
      `, [
        uuidv4(), c.id, auditors[0].id, auditors[0].name,
        trackMileage, meterMileage, mileageDiff, mileageDiffPercent,
        mileageDiffPercent > 0.15 ? 1 : 0,
        JSON.stringify(['MILEAGE_DIFF_EXCEEDED']),
        '经比对轨迹和计价器数据，确认存在绕行情况，建议向乘客退款并对司机进行警告。',
        '警告并停运学习1天', Math.round(c.paidAmount * 0.5)
      ]);
    }

    if (c.hasConclusion) {
      await run(`
        INSERT INTO conclusions (
          id, complaint_id, version, publisher_id, publisher_name,
          conclusion, penalty_result, compensation_amount, is_review
        ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, 0)
      `, [
        uuidv4(), c.id, customerServices[0].id, customerServices[0].name,
        '经核查，司机确实存在绕行行为。已对司机进行警告处理，并向乘客退还50%的车费。感谢您的监督。',
        '司机警告处分', Math.round(c.paidAmount * 0.5)
      ]);
    }
  }

  console.log('✅ 种子数据填充完成');
  console.log(`📋 已创建 ${complaintsData.length} 条投诉记录`);
  console.log(`👤 乘客: ${passengers.map(p => p.name).join(', ')}`);
  console.log(`🚗 司机: ${drivers.map(d => `${d.name}(${d.plate})`).join(', ')}`);
  console.log(`🔍 稽核员: ${auditors.map(a => a.name).join(', ')}`);
  console.log(`💬 客服: ${customerServices.map(c => c.name).join(', ')}`);
}

seedData().catch(error => {
  console.error('❌ 种子数据填充失败:', error);
  process.exit(1);
});
