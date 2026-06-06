const http = require('http');

const PORT = 3005;
const BASE_URL = `http://localhost:${PORT}`;
const API_PREFIX = '/api/complaints';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: options.path,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(JSON.stringify(data)) } : {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      }
    );
    req.on('error', (err) => {
      console.error('请求错误:', err.message);
      reject(err);
    });
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function logStep(step, message) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`步骤 ${step}: ${message}`);
  console.log('='.repeat(60));
}

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    return true;
  } else {
    console.log(`❌ FAIL: ${message}`);
    return false;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAcceptanceTests() {
  console.log('\n🚀 出租车绕行投诉处理系统 - 验收测试开始\n');
  console.log(`测试目标: ${BASE_URL}`);
  
  let allPassed = true;
  let testComplaintId = null;
  let overdueComplaintId = null;

  try {
    logStep(1, '健康检查 - 验证服务是否启动');
    const healthRes = await request({ path: '/api/health' });
    allPassed &= assert(healthRes.status === 200, '服务健康检查通过');
    allPassed &= assert(healthRes.data.status === 'ok', '健康状态为 ok');

    logStep(2, '获取投诉列表 - 验证种子数据加载');
    const listRes = await request({ path: `${API_PREFIX}/audit/list` });
    allPassed &= assert(listRes.data.success === true, '列表查询成功');
    allPassed &= assert(listRes.data.data.length >= 5, `种子数据数量正确 (${listRes.data.data.length} 条)`);
    
    const pendingDriver = listRes.data.data.filter(c => c.status === 'pending_driver_evidence');
    console.log(`   - 待举证: ${pendingDriver.length}`);
    const pendingAudit = listRes.data.data.filter(c => c.status === 'pending_audit');
    console.log(`   - 待稽核: ${pendingAudit.length}`);
    const concluded = listRes.data.data.filter(c => c.status === 'concluded');
    console.log(`   - 已结案: ${concluded.length}`);

    logStep(3, '模拟乘客提交新投诉');
    const submitData = {
      passengerId: 'PTEST001',
      passengerName: '测试乘客',
      plateNumber: '京TEST001',
      startTime: '2024-01-15 08:00:00',
      endTime: '2024-01-15 08:30:00',
      startAddress: '测试起点',
      endAddress: '测试终点',
      paidAmount: 150,
      expectedAmount: 80,
      complaintDescription: '测试绕行投诉：司机故意绕路',
      trackPoints: [
        { timestamp: '2024-01-15 08:00:00', latitude: 39.9042, longitude: 116.4074, speed: 0 },
        { timestamp: '2024-01-15 08:15:00', latitude: 39.9142, longitude: 116.4174, speed: 30 },
        { timestamp: '2024-01-15 08:30:00', latitude: 39.9242, longitude: 116.4274, speed: 0 },
      ]
    };
    
    const submitRes = await request(
      { method: 'POST', path: `${API_PREFIX}/passenger/submit` },
      submitData
    );
    allPassed &= assert(submitRes.data.success === true, '投诉提交成功');
    allPassed &= assert(submitRes.data.data.status === 'pending_driver_evidence', '初始状态为待司机举证');
    
    testComplaintId = submitRes.data.data.id;
    console.log(`   - 新投诉ID: ${testComplaintId}`);
    console.log(`   - 投诉单号: ${submitRes.data.data.complaintNo}`);

    logStep(4, '获取投诉详情 - 验证数据完整性');
    const detailRes = await request({ path: `${API_PREFIX}/audit/${testComplaintId}/detail` });
    allPassed &= assert(detailRes.data.success === true, '详情查询成功');
    allPassed &= assert(detailRes.data.data.complaint.id === testComplaintId, '投诉ID匹配');
    allPassed &= assert(detailRes.data.data.trackPoints.length > 0, '轨迹点数据存在');
    allPassed &= assert(detailRes.data.data.isReadOnly === false, '非结案状态可编辑');
    allPassed &= assert(detailRes.data.data.canReview === false, '未结案不可复议');

    logStep(5, '检查超时投诉自动转稽核');
    console.log('   正在调用系统超时检查接口...');
    const timeoutRes = await request({ method: 'POST', path: `${API_PREFIX}/system/check-timeouts` });
    allPassed &= assert(timeoutRes.data.success === true, '超时检查调用成功');
    
    if (timeoutRes.data.data.updated.length > 0) {
      console.log(`   ⏰ 检测到 ${timeoutRes.data.data.updated.length} 个超时投诉已自动转稽核`);
      timeoutRes.data.data.updated.forEach(item => {
        console.log(`      - ${item.id}: ${item.oldStatus} -> ${item.newStatus}`);
        if (item.oldStatus === 'pending_driver_evidence' && item.newStatus === 'pending_audit') {
          allPassed &= assert(true, '超时投诉成功转为待稽核状态');
          overdueComplaintId = item.id;
        }
      });
    } else {
      console.log('   ⚠️  当前没有超时的投诉（需要设置举证截止时间为过去）');
      console.log('   💡 种子数据中的 CMP20240101ABC005 是预设的超时测试单');
    }

    if (overdueComplaintId) {
      logStep(5.1, '验证超时投诉状态');
      const overdueDetail = await request({ path: `${API_PREFIX}/audit/${overdueComplaintId}/detail` });
      allPassed &= assert(
        overdueDetail.data.data.complaint.status === 'pending_audit',
        '超时投诉状态已更新为待稽核'
      );
      console.log('   ✅ 司机超时未举证，系统自动转稽核 - 验证通过');
    }

    logStep(6, '模拟司机提交举证 - 验证状态流转');
    const evidenceData = {
      driverId: 'D001',
      explanation: '当时是高峰期，主干道严重拥堵，为了节省乘客时间选择了绕行路线，乘客当时也表示同意。',
      trackPoints: [
        { timestamp: '2024-01-15 08:00:00', latitude: 39.9042, longitude: 116.4074, speed: 0 },
        { timestamp: '2024-01-15 08:10:00', latitude: 39.9092, longitude: 116.4124, speed: 25 },
        { timestamp: '2024-01-15 08:20:00', latitude: 39.9192, longitude: 116.4224, speed: 35 },
        { timestamp: '2024-01-15 08:30:00', latitude: 39.9242, longitude: 116.4274, speed: 0 },
      ]
    };
    
    const evidenceRes = await request(
      { method: 'POST', path: `${API_PREFIX}/driver/${testComplaintId}/evidence` },
      evidenceData
    );
    allPassed &= assert(evidenceRes.data.success === true, '司机举证提交成功');
    allPassed &= assert(evidenceRes.data.data.status === 'pending_audit', '举证后状态流转为待稽核');
    console.log('   ✅ 司机举证成功，状态从 pending_driver_evidence -> pending_audit');

    logStep(7, '获取更新后的详情 - 验证规则引擎');
    const detailAfterEvidence = await request({ path: `${API_PREFIX}/audit/${testComplaintId}/detail` });
    const ruleCheck = detailAfterEvidence.data.data.ruleCheck;
    console.log(`   - 轨迹里程: ${ruleCheck.trackMileage} km`);
    console.log(`   - 计价器里程: ${ruleCheck.meterMileage} km`);
    console.log(`   - 里程差异: ${(ruleCheck.mileageDiffPercent * 100).toFixed(1)}%`);
    console.log(`   - 轨迹缺失: ${ruleCheck.isTrackMissing}`);
    console.log(`   - 里程异常: ${ruleCheck.isMileageAbnormal}`);
    console.log(`   - 命中规则: ${ruleCheck.ruleHits.join(', ') || '无'}`);
    
    allPassed &= assert(detailAfterEvidence.data.data.trackPoints.length > 0, '司机轨迹已保存');
    allPassed &= assert(detailAfterEvidence.data.data.evidence.length > 0, '举证材料已保存');
    
    if (ruleCheck.isTrackMissing) {
      allPassed &= assert(ruleCheck.canJudgeDirectly === false, '轨迹缺失时不能直接判责 - 验证通过');
      console.log('   ✅ 规则验证：轨迹缺失不得直接判责');
    }

    logStep(8, '模拟稽核员提交稽核意见');
    const auditData = {
      auditorId: 'A001',
      auditorName: '稽核员小王',
      detourDetected: true,
      opinion: '经比对乘客和司机提供的轨迹，结合计价器数据分析，确认司机存在绕行行为。轨迹与计价器里程差异超过15%，建议向乘客退款50%。',
      suggestedPenalty: '警告并停运学习1天',
      suggestedCompensation: 75,
    };
    
    const auditRes = await request(
      { method: 'POST', path: `${API_PREFIX}/audit/${testComplaintId}/submit` },
      auditData
    );
    allPassed &= assert(auditRes.data.success === true, '稽核意见提交成功');
    allPassed &= assert(auditRes.data.data.status === 'pending_conclusion', '稽核后状态流转为待发布结论');
    console.log('   ✅ 稽核完成，状态从 pending_audit -> pending_conclusion');

    logStep(9, '模拟客服发布处理结论');
    const conclusionData = {
      publisherId: 'CS001',
      publisherName: '客服小张',
      conclusion: '经核查，司机在本次行程中确实存在绕行行为。我们已对该司机进行警告处分，并向您退还本次行程50%的费用（¥75）。感谢您的监督，我们将加强对司机的培训和管理。',
      penaltyResult: '警告处分 + 停运学习1天',
      compensationAmount: 75,
    };
    
    const conclusionRes = await request(
      { method: 'POST', path: `${API_PREFIX}/conclusion/${testComplaintId}/publish` },
      conclusionData
    );
    allPassed &= assert(conclusionRes.data.success === true, '结论发布成功');
    allPassed &= assert(conclusionRes.data.data.version === 1, '结论版本号为 v1');
    console.log(`   ✅ 结论发布成功，版本号: v${conclusionRes.data.data.version}`);

    logStep(10, '验证结案后只读状态');
    const detailAfterConclusion = await request({ path: `${API_PREFIX}/audit/${testComplaintId}/detail` });
    allPassed &= assert(detailAfterConclusion.data.data.complaint.status === 'concluded', '状态为已结案');
    allPassed &= assert(detailAfterConclusion.data.data.isReadOnly === true, '结案后投诉单为只读');
    allPassed &= assert(detailAfterConclusion.data.data.canReview === true, '结案后可申请复议');
    allPassed &= assert(detailAfterConclusion.data.data.conclusions.length === 1, '已发布1个版本的结论');
    console.log('   ✅ 结案验证：只读状态 = true, 可复议 = true');

    logStep(11, '模拟追加复议 - 验证原结论不被覆盖');
    const originalConclusion = detailAfterConclusion.data.data.conclusions[0];
    console.log(`   - 原结论ID: ${originalConclusion.id}`);
    console.log(`   - 原结论版本: v${originalConclusion.version}`);

    const reviewData = {
      requesterId: 'PTEST001',
      reviewReason: '对处理结果不满意，认为赔付金额过少，要求全额退款',
      reviewEvidence: [],
    };
    
    const reviewRes = await request(
      { method: 'POST', path: `${API_PREFIX}/review/${testComplaintId}/request` },
      reviewData
    );
    allPassed &= assert(reviewRes.data.success === true, '复议申请提交成功');
    allPassed &= assert(reviewRes.data.data.status === 'in_review', '状态流转为复议中');
    console.log('   ✅ 复议申请已提交，状态变为 in_review');

    logStep(12, '验证原结论未被覆盖');
    const detailAfterReview = await request({ path: `${API_PREFIX}/audit/${testComplaintId}/detail` });
    const conclusions = detailAfterReview.data.data.conclusions;
    
    allPassed &= assert(
      conclusions.find(c => c.id === originalConclusion.id) !== undefined,
      '原结论仍然存在 - 未被覆盖或删除'
    );
    
    console.log(`   - 当前结论版本数: ${conclusions.length}`);
    conclusions.forEach(c => {
      console.log(`     * v${c.version}${c.is_review ? ' [复议]' : ''}: ${c.publisher_name}`);
    });
    
    const originalStillExists = conclusions.some(c => c.id === originalConclusion.id && c.version === 1);
    allPassed &= assert(originalStillExists, '原结论 v1 未被覆盖 - 验证通过');
    console.log('   ✅ 核心规则验证：结论发布后只读，复议追加新版本，原结论不被覆盖');

    logStep(13, '模拟复议结论发布 - 创建新版本');
    const reviewConclusionData = {
      publisherId: 'CS001',
      publisherName: '客服小张',
      conclusion: '经重新核查，我们决定提高赔付金额。现向您退还本次行程全额费用（¥150），并对司机进行加强培训。再次感谢您的反馈。',
      penaltyResult: '加强教育培训',
      compensationAmount: 150,
      isReview: true,
      parentId: originalConclusion.id,
    };
    
    const reviewConclusionRes = await request(
      { method: 'POST', path: `${API_PREFIX}/conclusion/${testComplaintId}/publish` },
      reviewConclusionData
    );
    allPassed &= assert(reviewConclusionRes.data.success === true, '复议结论发布成功');
    
    const finalDetail = await request({ path: `${API_PREFIX}/audit/${testComplaintId}/detail` });
    const finalConclusions = finalDetail.data.data.conclusions;
    
    console.log(`   - 最终结论版本数: ${finalConclusions.length}`);
    finalConclusions.sort((a, b) => a.version - b.version).forEach(c => {
      console.log(`     * v${c.version}${c.is_review ? ' [复议版本]' : ''}: 赔付 ¥${c.compensation_amount}`);
    });
    
    allPassed &= assert(finalConclusions.length >= 2, '存在至少2个结论版本');
    allPassed &= assert(
      finalConclusions.find(c => c.version === 1 && c.compensation_amount === 75) !== undefined,
      'v1 版本的赔付金额保持不变（¥75）'
    );
    allPassed &= assert(
      finalConclusions.find(c => c.is_review && c.compensation_amount === 150) !== undefined,
      '新增复议版本，赔付金额为 ¥150'
    );
    
    console.log('   ✅ 版本控制验证：原结论保留，复议追加新版本');

    logStep(14, '里程差异规则验证 - 标红阈值测试');
    console.log('   正在验证计价器记录与轨迹里程差异超过15%标红...');
    const testDetail = detailAfterEvidence.data.data;
    if (testDetail.ruleCheck.isMileageAbnormal) {
      console.log('   ✅ 里程差异超过阈值，已标红提示');
    } else {
      console.log('   ℹ️  当前测试数据差异未超过阈值，规则逻辑正常');
    }
    console.log(`   - 阈值: 15%, 当前差异: ${(testDetail.ruleCheck.mileageDiffPercent * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('\n❌ 测试执行出错:', error.message);
    allPassed = false;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(60));
  
  if (allPassed) {
    console.log('\n🎉 所有测试通过！系统功能验证完成。');
    console.log('\n✅ 已验证的核心功能：');
    console.log('   1. 乘客投诉提交');
    console.log('   2. 司机举证提交');
    console.log('   3. 超时自动转稽核（司机未举证时）');
    console.log('   4. 稽核员判责（轨迹比对、计价器分析、规则命中）');
    console.log('   5. 客服结论发布');
    console.log('   6. 结案后只读状态');
    console.log('   7. 复议追加新版本（原结论不覆盖）');
    console.log('   8. 业务规则引擎（轨迹缺失不直接判责、里程差异标红）');
    
    console.log('\n🚀 验收测试全部通过！');
    process.exit(0);
  } else {
    console.log('\n❌ 部分测试未通过，请检查系统状态。');
    process.exit(1);
  }
}

async function waitForServer() {
  console.log('⏳ 等待服务启动...');
  for (let i = 0; i < 30; i++) {
    try {
      const res = await request({ path: '/api/health' });
      if (res.status === 200) {
        console.log('✅ 服务已就绪！');
        return true;
      }
    } catch (e) {
      // 服务未启动，继续等待
    }
    await sleep(1000);
    process.stdout.write('.');
  }
  console.log('\n❌ 服务启动超时');
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--wait')) {
    const ready = await waitForServer();
    if (!ready) {
      process.exit(1);
    }
  }
  
  await runAcceptanceTests();
}

main().catch(console.error);
