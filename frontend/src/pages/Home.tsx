import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Tag, Button, Space, Typography, Steps } from 'antd';
import {
  FileTextOutlined,
  CarOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { complaintApi } from '../api';

const { Title, Paragraph } = Typography;

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    pendingDriver: 0,
    pendingAudit: 0,
    concluded: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await complaintApi.getAuditList();
      if (res.success) {
        const list = res.data;
        setStats({
          total: list.length,
          pendingDriver: list.filter((c: any) => c.status === 'pending_driver_evidence').length,
          pendingAudit: list.filter((c: any) => c.status === 'pending_audit' || c.status === 'pending_conclusion').length,
          concluded: list.filter((c: any) => c.status === 'concluded').length,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
      <Title level={2}>欢迎使用出租车绕行投诉处理系统</Title>
      <Paragraph type="secondary">
        贯通投诉提交、轨迹比对、司机举证、稽核判责、赔付建议和结论发布的全流程处理
      </Paragraph>
    </div>

    <Row gutter={[16, 16]}>
      <Col span={6}>
        <Card>
          <Statistic
            title="投诉总量"
            value={stats.total}
            prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="待司机举证"
            value={stats.pendingDriver}
            valueStyle={{ color: '#fa8c16' }}
            prefix={<ClockCircleOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="待稽核处理"
            value={stats.pendingAudit}
            valueStyle={{ color: '#722ed1' }}
            prefix={<AuditOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="已结案"
            value={stats.concluded}
            valueStyle={{ color: '#52c41a' }}
            prefix={<CheckCircleOutlined />}
          />
        </Card>
      </Col>
    </Row>

    <div className="page-content" style={{ marginTop: 24 }}>
      <Title level={3} style={{ marginBottom: 24 }}>业务流程</Title>
      <Steps
        size="small"
        current={-1}
        items={[
          {
            title: '乘客投诉',
            description: '乘客提交行程信息和绕行说明',
            icon: <FileTextOutlined />,
            status: 'finish',
          },
          {
            title: '司机举证',
            description: '司机上传解释和轨迹片段，超时自动转稽核',
            icon: <CarOutlined />,
            status: 'process',
          },
          {
            title: '稽核判责',
            description: '地图化轨迹比对、计价器分析、规则命中检测',
            icon: <AuditOutlined />,
            status: 'wait',
          },
          {
            title: '结论发布',
            description: '客服发布处理结论，支持复议追加',
            icon: <CheckCircleOutlined />,
            status: 'wait',
          },
        ]}
      />
    </div>

    <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
      <Col span={12}>
        <Card title="核心规则说明" extra={<Tag color="red">重要</Tag>}>
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>轨迹缺失不得直接判责，需结合其他证据综合判断</li>
            <li>司机超过24小时举证时限，自动转为待稽核状态</li>
            <li>计价器记录与轨迹里程差异超过15%自动标红</li>
            <li>结论发布后投诉单只读，但允许追加复议版本</li>
          </ul>
        </Card>
      </Col>
      <Col span={12}>
        <Card title="快速入口">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" size="large" block icon={<FileTextOutlined />} onClick={() => navigate('/passenger')}>
              我要投诉（乘客端）
            </Button>
            <Button type="default" size="large" block icon={<CarOutlined />} onClick={() => navigate('/driver')}>
              司机举证
            </Button>
            <Button type="default" size="large" block icon={<AuditOutlined />} onClick={() => navigate('/audit')}>
              稽核判责
            </Button>
            <Button type="default" size="large" block icon={<MessageOutlined />} onClick={() => navigate('/conclusion')}>
              结论发布
            </Button>
          </Space>
        </Card>
      </Col>
    </Row>
    </div>
  );
};

export default Home;
