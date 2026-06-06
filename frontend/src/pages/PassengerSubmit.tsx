import React, { useState } from 'react';
import { Form, Input, InputNumber, DatePicker, Button, Card, message, Space, Typography, Alert } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { complaintApi } from '../api';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;
const { TextArea } = Input;

const PassengerSubmit: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (values: any) => {
    setLoading(true);
    try {
      const data = {
        passengerId: 'P001',
        passengerName: '测试乘客',
        plateNumber: values.plateNumber,
        startTime: values.timeRange[0].format('YYYY-MM-DD HH:mm:ss'),
        endTime: values.timeRange[1].format('YYYY-MM-DD HH:mm:ss'),
        startAddress: values.startAddress,
        endAddress: values.endAddress,
        paidAmount: values.paidAmount,
        expectedAmount: values.expectedAmount,
        complaintDescription: values.complaintDescription,
        trackPoints: generateMockTrackPoints(),
      };

      const res = await complaintApi.submitComplaint(data);
      if (res.success) {
        message.success(`投诉提交成功！投诉单号：${res.data.complaintNo}`);
        form.resetFields();
        setTimeout(() => navigate('/driver'), 1500);
      } else {
        message.error(res.message || '提交失败');
      }
    } catch (e: any) {
      message.error(e.message || '提交失败');
    } finally {
      setLoading(false);
    }
  };

  const generateMockTrackPoints = () => {
    const points = [];
    const baseLat = 39.9042;
    const baseLng = 116.4074;
    for (let i = 0; i < 8; i++) {
      points.push({
        timestamp: dayjs().subtract(8 - i, 'minute').format('YYYY-MM-DD HH:mm:ss'),
        latitude: baseLat + (Math.random() - 0.5) * 0.005,
        longitude: baseLng + (Math.random() - 0.5) * 0.005,
        speed: Math.random() * 60,
      });
    }
    return points;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <Title level={2}>乘客端 - 投诉提交</Title>
        <p className="ant-typography-secondary">
          请填写行程信息和绕行说明，我们会尽快为您处理
        </p>
      </div>

      <div className="page-content">
        <Alert
          message="温馨提示"
          description="请确保填写的车牌号和行程时间准确，这将有助于后续的稽核处理。司机将在24小时内进行举证。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={onSubmit}
          initialValues={{
            passengerId: 'P001',
            passengerName: '测试乘客',
          }}
        >
          <Card title="行程信息" className="card-section">
            <Form.Item
              name="plateNumber"
              label="车牌号"
              rules={[{ required: true, message: '请输入车牌号' }]}
            >
              <Input placeholder="如：京A12345" style={{ width: 300 }} />
            </Form.Item>

            <Form.Item
              name="timeRange"
              label="行程时间"
              rules={[{ required: true, message: '请选择行程时间' }]}
            >
              <DatePicker.RangePicker
                showTime
                format="YYYY-MM-DD HH:mm:ss"
                style={{ width: '100%', maxWidth: 500 }}
              />
            </Form.Item>

            <Form.Item
              name="startAddress"
              label="出发地"
              rules={[{ required: true, message: '请输入出发地' }]}
            >
              <Input placeholder="如：北京西站" />
            </Form.Item>

            <Form.Item
              name="endAddress"
              label="目的地"
              rules={[{ required: true, message: '请输入目的地' }]}
            >
              <Input placeholder="如：首都机场T3" />
            </Form.Item>
          </Card>

          <Card title="费用信息" className="card-section">
            <Space size="large" align="start">
              <Form.Item
                name="paidAmount"
                label="实际支付金额（元）"
                rules={[{ required: true, message: '请输入实际支付金额' }]}
              >
                <InputNumber min={0} style={{ width: 200 }} />
              </Form.Item>

              <Form.Item
                name="expectedAmount"
                label="预估金额（元）"
              >
                <InputNumber min={0} style={{ width: 200 }} placeholder="可选" />
              </Form.Item>
            </Space>
          </Card>

          <Card title="投诉说明" className="card-section">
            <Form.Item
              name="complaintDescription"
              label="疑似绕行说明"
              rules={[{ required: true, message: '请输入投诉说明' }]}
            >
              <TextArea
                rows={4}
                placeholder="请详细描述您认为司机绕行的情况，包括但不限于：平时的路线、本次的路线、费用差异等..."
              />
            </Form.Item>
          </Card>

          <Form.Item>
            <Button type="primary" size="large" htmlType="submit" loading={loading} icon={<SendOutlined />}>
              提交投诉
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};

export default PassengerSubmit;
