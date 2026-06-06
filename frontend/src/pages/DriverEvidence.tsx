import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Form, Input, Modal, Tag, message, Space, Typography, Drawer, Descriptions } from 'antd';
import { EyeOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { complaintApi } from '../api';
import { Complaint, StatusMap, ComplaintStatus } from '../types';

const { Title } = Typography;
const { TextArea } = Input;

const DriverEvidence: React.FC = () => {
  const [list, setList] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [evidenceVisible, setEvidenceVisible] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const driverId = 'D001';

  useEffect(() => {
    loadList();
  }, []);

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await complaintApi.getDriverList(driverId);
      if (res.success) {
        setList(res.data);
      }
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEvidence = async (values: any) => {
    if (!selectedComplaint) return;
    try {
      const data = {
        driverId,
        explanation: values.explanation,
        trackPoints: generateMockTrackPoints(),
      };
      const res = await complaintApi.submitEvidence(selectedComplaint.id, data);
      if (res.success) {
        message.success('举证提交成功');
        setEvidenceVisible(false);
        form.resetFields();
        loadList();
      } else {
        message.error(res.message || '提交失败');
      }
    } catch (e) {
      message.error('提交失败');
    }
  };

  const generateMockTrackPoints = () => {
    const points = [];
    const baseLat = 39.9042;
    const baseLng = 116.4074;
    for (let i = 0; i < 20; i++) {
      points.push({
        timestamp: dayjs().subtract(20 - i, 'minute').format('YYYY-MM-DD HH:mm:ss'),
        latitude: baseLat + (Math.random() - 0.5) * 0.01,
        longitude: baseLng + (Math.random() - 0.5) * 0.01,
        speed: Math.random() * 60,
      });
    }
    return points;
  };

  const columns = [
    {
      title: '投诉单号',
      dataIndex: 'complaint_no',
      key: 'complaint_no',
      render: (text: string, record: Complaint) => (
        <a onClick={() => navigate(`/detail/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '乘客',
      dataIndex: 'passenger_name',
      key: 'passenger_name',
    },
    {
      title: '行程',
      key: 'route',
      render: (_: any, record: Complaint) => (
        <span>{record.start_address} → {record.end_address}</span>
      ),
    },
    {
      title: '支付金额',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      render: (val: number) => `¥${val}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: ComplaintStatus) => {
        const s = StatusMap[status];
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '举证截止',
      dataIndex: 'evidence_deadline',
      key: 'evidence_deadline',
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Complaint) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedComplaint(record);
              setDetailVisible(true);
            }}
          >
            查看详情
          </Button>
          {record.status === 'pending_driver_evidence' && (
            <Button
              type="primary"
              size="small"
              icon={<UploadOutlined />}
              onClick={() => {
                setSelectedComplaint(record);
                setEvidenceVisible(true);
              }}
            >
              提交举证
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <Title level={2}>司机端 - 举证处理</Title>
        <p className="ant-typography-secondary">
          处理乘客投诉，上传行驶轨迹和解释说明
        </p>
      </div>

      <div className="page-content">
        <Card>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={list}
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </div>

      <Drawer
        title="投诉详情"
        width={600}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {selectedComplaint && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="投诉单号">{selectedComplaint.complaint_no}</Descriptions.Item>
            <Descriptions.Item label="乘客">{selectedComplaint.passenger_name}</Descriptions.Item>
            <Descriptions.Item label="车牌号">{selectedComplaint.plate_number}</Descriptions.Item>
            <Descriptions.Item label="出发地">{selectedComplaint.start_address}</Descriptions.Item>
            <Descriptions.Item label="目的地">{selectedComplaint.end_address}</Descriptions.Item>
            <Descriptions.Item label="行程时间">
              {dayjs(selectedComplaint.start_time).format('YYYY-MM-DD HH:mm')} ~ {dayjs(selectedComplaint.end_time).format('HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="支付金额">¥{selectedComplaint.paid_amount}</Descriptions.Item>
            <Descriptions.Item label="投诉说明">{selectedComplaint.complaint_description}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={StatusMap[selectedComplaint.status].color}>
                {StatusMap[selectedComplaint.status].label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="举证截止">
              {dayjs(selectedComplaint.evidence_deadline).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      <Modal
        title="提交举证"
        open={evidenceVisible}
        onCancel={() => setEvidenceVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitEvidence}>
          <Form.Item
            name="explanation"
            label="情况说明"
            rules={[{ required: true, message: '请输入情况说明' }]}
          >
            <TextArea
              rows={4}
              placeholder="请详细说明本次行程的情况，如是否有堵车、乘客要求等..."
            />
          </Form.Item>
          <Form.Item label="行驶轨迹">
            <Input value="系统将自动获取车辆GPS轨迹数据" disabled />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              提交举证
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DriverEvidence;
