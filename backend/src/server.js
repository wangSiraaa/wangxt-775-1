const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const complaintRoutes = require('./routes/complaints');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/complaints', complaintRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 投诉系统后端服务已启动: http://localhost:${PORT}`);
  console.log(`📊 API 健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
