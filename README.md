# 出租车绕行投诉处理系统

全栈 Web 应用，贯通投诉提交、轨迹比对、司机举证、稽核判责、赔付建议和结论发布的完整业务流程。

## 功能模块

### 乘客端
- 提交行程信息（车牌号、时间、路线、费用）
- 填写疑似绕行说明
- 查看投诉处理进度

### 司机端
- 查看待举证的投诉单
- 上传情况说明和轨迹片段
- 举证时限内可提交证据

### 稽核端
- 地图化展示轨迹比对（乘客轨迹 vs 司机轨迹）
- 计价器记录分析
- 规则命中自动检测
- 提交稽核意见和处罚/赔付建议

### 客服端
- 查看稽核意见
- 发布处理结论
- 支持多版本结论管理
- 复议追加新版本

## 核心业务规则

✅ **轨迹缺失不直接判责** - 轨迹点数量不足时，系统禁止直接判定司机责任，需结合其他证据综合判断

✅ **超时自动转稽核** - 司机超过 24 小时举证时限，系统自动将投诉单转为待稽核状态

✅ **里程差异自动标红** - 计价器记录与轨迹里程差异超过 15% 阈值时，自动标红提醒稽核员重点关注

✅ **结论只读 + 复议追加** - 结论发布后投诉单变为只读，但允许追加复议版本，原结论不被覆盖

## 技术栈

### 后端
- Node.js + Express
- SQLite (better-sqlite3)
- 业务规则引擎

### 前端
- React 18 + TypeScript
- Vite
- Ant Design
- React Leaflet (地图)
- React Router

## 快速开始

### 方式一：Docker 启动（推荐）

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 访问应用
open http://localhost:3001
```

容器启动后自动填充种子数据。

### 方式二：本地开发

```bash
# 安装所有依赖
npm run install:all

# 填充种子数据
npm run seed

# 启动前后端（并发）
npm run dev

# 或分别启动
npm run dev:backend  # 后端 http://localhost:3001
npm run dev:frontend # 前端 http://localhost:3000
```

## 验收测试

系统提供完整的命令行验收脚本，覆盖所有核心场景：

```bash
# 确保后端服务已启动，然后运行验收测试
npm run acceptance

# 或带自动等待服务启动
node scripts/acceptance-test.js --wait
```

### 验收测试覆盖场景

1. ✅ 健康检查 - 验证服务启动
2. ✅ 种子数据验证
3. ✅ 乘客提交投诉
4. ✅ 司机提交举证
5. ✅ **司机超时未举证 → 自动转待稽核**
6. ✅ 稽核员判责（轨迹比对 + 规则检测）
7. ✅ 客服发布结论
8. ✅ 结案后只读状态验证
9. ✅ **复议追加新版本，原结论不覆盖**
10. ✅ 里程差异阈值标红规则

## 项目结构

```
.
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── server.js       # 服务入口
│   │   ├── database/       # 数据库模型
│   │   ├── routes/         # API 路由
│   │   ├── rules/          # 业务规则引擎
│   │   └── seed/           # 种子数据
│   └── data/               # SQLite 数据文件
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   ├── api/            # API 封装
│   │   └── types/          # TypeScript 类型
│   └── index.html
├── scripts/                # 脚本
│   └── acceptance-test.js  # 验收测试脚本
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## API 接口

### 乘客端
- `POST /api/complaints/passenger/submit` - 提交投诉

### 司机端
- `GET /api/complaints/driver/:driverId/list` - 获取司机投诉列表
- `POST /api/complaints/driver/:complaintId/evidence` - 提交举证

### 稽核端
- `GET /api/complaints/audit/list` - 获取稽核列表
- `GET /api/complaints/audit/:complaintId/detail` - 获取详情（含规则检测）
- `POST /api/complaints/audit/:complaintId/submit` - 提交稽核意见

### 客服端
- `POST /api/complaints/conclusion/:complaintId/publish` - 发布结论
- `POST /api/complaints/review/:complaintId/request` - 申请复议

### 系统
- `POST /api/complaints/system/check-timeouts` - 检查超时投诉
- `GET /api/health` - 健康检查

## 数据库表

- `complaints` - 投诉单主表
- `track_points` - 轨迹点（乘客/司机）
- `evidence` - 举证材料
- `meter_records` - 计价器记录
- `audit_opinions` - 稽核意见
- `conclusions` - 处理结论（多版本）

## 状态流转

```
pending_driver_evidence (待司机举证)
    ├─ 司机提交举证 → pending_audit (待稽核)
    └─ 超时未举证 → pending_audit (待稽核, 自动)

pending_audit (待稽核)
    └─ 稽核完成 → pending_conclusion (待发布结论)

pending_conclusion (待发布结论)
    └─ 发布结论 → concluded (已结案, 只读)

concluded (已结案)
    └─ 申请复议 → in_review (复议中)
        └─ 复议结论发布 → concluded (追加新版本, 原结论保留)
```
