#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const APP_FILE = path.join(FRONTEND_DIR, 'src', 'App.tsx');
const AUDIT_FILE = path.join(FRONTEND_DIR, 'src', 'pages', 'AuditJudgement.tsx');

let passed = 0;
let failed = 0;

function runStep(description, fn) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔍 检查: ${description}`);
  console.log('='.repeat(70));
  try {
    fn();
    console.log(`✅ PASS: ${description}`);
    passed++;
  } catch (e) {
    console.log(`❌ FAIL: ${description}`);
    console.log(`   错误: ${e.message}`);
    failed++;
  }
}

function exec(cmd, cwd) {
  return execSync(cmd, {
    cwd: cwd || ROOT_DIR,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function readSource(file) {
  return fs.readFileSync(file, 'utf8');
}

function assertAntIconImport(source, iconName, fileLabel) {
  const iconImport = source.match(/import\s*\{([\s\S]*?)\}\s*from\s*['"]@ant-design\/icons['"];?/);
  if (!iconImport) {
    throw new Error(`${fileLabel} 缺少 @ant-design/icons 导入`);
  }
  const importedIcons = iconImport[1]
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  if (!importedIcons.includes(iconName)) {
    throw new Error(`${fileLabel} 未从 @ant-design/icons 导入 ${iconName}`);
  }
}

console.log('🚀 出租车绕行投诉处理系统 - 构建校验脚本');
console.log(`📂 项目目录: ${ROOT_DIR}`);

runStep('AuditOutlined 图标导入回归检查', () => {
  const appSource = readSource(APP_FILE);
  const auditSource = readSource(AUDIT_FILE);

  assertAntIconImport(appSource, 'AuditOutlined', 'frontend/src/App.tsx');
  assertAntIconImport(auditSource, 'AuditOutlined', 'frontend/src/pages/AuditJudgement.tsx');

  if (!appSource.includes('<AuditOutlined />')) {
    throw new Error('frontend/src/App.tsx 未使用 AuditOutlined 图标');
  }
  if (!auditSource.includes('icon={<AuditOutlined />}')) {
    throw new Error('frontend/src/pages/AuditJudgement.tsx 未在稽核按钮中使用 AuditOutlined 图标');
  }
});

runStep('已知无用 import 清理回归检查', () => {
  const appSource = readSource(APP_FILE);
  const auditSource = readSource(AUDIT_FILE);

  if (/import\s*\{[^}]*\buseNavigate\b[^}]*\}\s*from\s*['"]react-router-dom['"]/.test(appSource)) {
    throw new Error('frontend/src/App.tsx 仍导入未使用的 useNavigate');
  }
  if (/import\s+L\s+from\s+['"]leaflet['"]/.test(auditSource)) {
    throw new Error('frontend/src/pages/AuditJudgement.tsx 仍导入未使用的 leaflet 默认导入 L');
  }
});

runStep('TypeScript 类型检查 (前端)', () => {
  const result = exec('npx tsc --noEmit', FRONTEND_DIR);
  if (result.trim() !== '') {
    throw new Error(`TypeScript 检查输出了错误或警告:\n${result}`);
  }
});

runStep('前端 npm run build 构建', () => {
  const distDir = path.join(FRONTEND_DIR, 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  exec('npm run build', FRONTEND_DIR);
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('构建产物中缺少 index.html');
  }
  const jsFiles = fs.readdirSync(path.join(distDir, 'assets')).filter(f => f.endsWith('.js'));
  if (jsFiles.length === 0) {
    throw new Error('构建产物中缺少 JS 文件');
  }
  console.log(`   构建产物: ${jsFiles.length} 个 JS 文件`);
});

runStep('后端依赖安装检查', () => {
  if (!fs.existsSync(path.join(BACKEND_DIR, 'node_modules'))) {
    throw new Error('后端 node_modules 不存在，请先运行 npm install');
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(BACKEND_DIR, 'package.json'), 'utf8'));
  const requiredDeps = ['express', 'cors', 'sqlite3', 'dayjs'];
  for (const dep of requiredDeps) {
    if (!pkg.dependencies[dep]) {
      throw new Error(`后端缺少依赖: ${dep}`);
    }
  }
  console.log(`   后端依赖齐全: ${requiredDeps.join(', ')}`);
});

runStep('后端脚本语法检查', () => {
  const result = exec('node -c src/server.js && node -c src/routes/complaints.js && node -c src/rules/ruleEngine.js && node -c src/database/db.js', BACKEND_DIR);
});

runStep('Dockerfile 存在性检查', () => {
  if (!fs.existsSync(path.join(ROOT_DIR, 'Dockerfile'))) {
    throw new Error('Dockerfile 不存在');
  }
  const content = fs.readFileSync(path.join(ROOT_DIR, 'Dockerfile'), 'utf8');
  if (!content.includes('npm run build')) {
    throw new Error('Dockerfile 中缺少前端构建步骤');
  }
  if (!content.includes('npm run seed')) {
    throw new Error('Dockerfile 中缺少种子数据启动步骤');
  }
  console.log('   Dockerfile 配置正确');
});

runStep('docker-compose.yml 存在性检查', () => {
  if (!fs.existsSync(path.join(ROOT_DIR, 'docker-compose.yml'))) {
    throw new Error('docker-compose.yml 不存在');
  }
  const content = fs.readFileSync(path.join(ROOT_DIR, 'docker-compose.yml'), 'utf8');
  if (!content.includes('ports:')) {
    throw new Error('docker-compose.yml 中缺少端口映射');
  }
  console.log('   docker-compose.yml 配置正确');
});

runStep('验收测试脚本存在性', () => {
  if (!fs.existsSync(path.join(ROOT_DIR, 'scripts', 'acceptance-test.js'))) {
    throw new Error('验收测试脚本不存在');
  }
  console.log('   验收测试脚本就绪');
});

console.log(`\n${'='.repeat(70)}`);
console.log('📊 校验结果汇总');
console.log('='.repeat(70));
console.log(`✅ 通过: ${passed}`);
console.log(`❌ 失败: ${failed}`);
console.log(`📈 通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log('\n❌ 部分校验未通过，请修复后重新运行');
  process.exit(1);
} else {
  console.log('\n🎉 所有构建校验通过！项目可以正常构建和部署。');
  console.log('\n📝 后续可用命令:');
  console.log('   npm run dev          - 本地开发模式（前后端并发）');
  console.log('   docker compose up    - Docker 完整部署');
  console.log('   npm run acceptance   - 运行验收测试');
  process.exit(0);
}
