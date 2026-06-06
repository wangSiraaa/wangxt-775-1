import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Card,
  Tag,
  message,
  Space,
  Typography,
  Drawer,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Alert,
  List,
} from 'antd';
import {
  EyeOutlined,
  SendOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { complaintApi } from '../api';
import { Complaint, StatusMap, ComplaintDetail, ComplaintStatus } from '../types';

const { Title } = Typography;
const { TextArea } = Input;

const ConclusionPublish: React.FC = () => {
  const [list, setList] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState<ComplaintDetail | null>(null);
  const [conclusionForm] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    loadList();
  }, []);

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await complaintApi.getAuditList();
      if (res.success) {
        setList(res.data);
      }
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    try {
      const res = await complaintApi.getDetail(id);
      if (res.success) {
        setDetail(res.data);
        setDetailVisible(true);
        if (res.data.auditOpinions.length > 0) {
          const audit = res.data.auditOpinions[0];
          conclusionForm.setFieldsValue({
            suggestedCompensation: audit.suggested_compensation,
            suggestedPenalty: audit.suggested_penalty,
          });
        }
      }
    } catch (e) {
      message.error('加载详情失败');
    }
  };

  const handlePublish = async (values: any) => {
    if (!detail) return;
    try {
      const data = {
        publisherId: 'CS001',
        publisherName: '客服小张',
        conclusion: values.conclusion,
        penaltyResult: values.penaltyResult,
        compensationAmount: values.compensationAmount,
      };
      const res = await complaintApi.publishConclusion(detail.complaint.id, data);
      if (res.success) {
        message.success(`结论发布成功！版本号：v${res.data.version}`);
        setDetailVisible(false);
        conclusionForm.resetFields();
        loadList();
      }
    } catch (e) {
      message.error('发布失败');
    }
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
      title: '车牌号',
      dataIndex: 'plate_number',
      key: 'plate_number',
    },
    {
      title: '司机',
      dataIndex: 'driver_name',
      key: 'driver_name',
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
      title: '稽核时间',
      dataIndex: 'judge_time',
      key: 'judge_time',
      render: (t: string) => t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Complaint) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => loadDetail(record.id)}
          >
            详情
          </Button>
          {record.status === 'pending_conclusion' && (
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              onClick={() => loadDetail(record.id)}
            >
              发布结论
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <Title level={2}>客服端 - 结论发布</Title>
        <p className="ant-typography-secondary">
          查看稽核意见，发布处理结论和赔付建议
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
        title="发布处理结论"
        width={700}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        destroyOnClose
      >
        {detail && (
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="投诉单号">{detail.complaint.complaint_no}</Descriptions.Item>
              <Descriptions.Item label="车牌号">{detail.complaint.plate_number}</Descriptions.Item>
              <Descriptions.Item label="司机">{detail.complaint.driver_name}</Descriptions.Item>
              <Descriptions.Item label="乘客">{detail.complaint.passenger_name}</Descriptions.Item>
              <Descriptions.Item label="投诉说明">{detail.complaint.complaint_description}</Descriptions.Item>
            </Descriptions>

            <Card title="稽核意见" size="small" style={{ marginTop: 16, marginBottom: 16 }}>
              <List
                size="small"
                dataSource={detail.auditOpinions}
                renderItem={item => (
                  <List.Item>
                    <List.Item.Meta
                      title={`${item.auditor_name} - ${dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}`}
                      description={
                        <div>
                          <p style={{ margin: '4px 0' }}><strong>意见：</strong>{item.opinion}</p>
                          {item.suggested_penalty && (
                            <p style={{ margin: '4px 0' }}><strong>处罚建议：</strong>{item.suggested_penalty}</p>
                          )}
                          {item.suggested_compensation && (
                            <p style={{ margin: '4px 0' }}><strong>赔付建议：</strong>¥{item.suggested_compensation}</p>
                          )}
                          {item.detour_detected && (
                            <Tag color="red">判定绕行</Tag>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>

            {detail.conclusions.length > 0 && (
              <Card title="已发布结论（历史版本）" size="small" style={{ marginBottom: 16 }}>
                <List
                  size="small"
                  dataSource={detail.conclusions}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Tag color="blue">v{item.version}</Tag>
                            {item.is_review && <Tag color="orange">复议</Tag>}
                            <span>{item.publisher_name} - {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}</span>
                          </Space>
                        }
                        description={
                          <div>
                            <p style={{ margin: '4px 0' }}>{item.conclusion}</p>
                            {item.penalty_result && (
                              <p style={{ margin: '4px 0' }}><strong>处罚结果：</strong>{item.penalty_result}</p>
                            )}
                            {item.compensation_amount && (
                              <p style={{ margin: '4px 0' }}><strong>赔付金额：</strong>¥{item.compensation_amount}</p>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}

            {detail.complaint.status === 'pending_conclusion' && (
              <>
                <Card title="发布结论" size="small">
                  <Alert
                    message="结论发布后投诉单将变为只读状态，但允许追加复议版本"
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  <Form form={conclusionForm} layout="vertical" onFinish={handlePublish}>
                    <Form.Item
                      name="conclusion"
                      label="处理结论"
                      rules={[{ required: true, message: '请输入处理结论' }]}
                    >
                      <TextArea rows={4} placeholder="请输入详细的处理结论，向乘客说明处理结果..." />
                    </Form.Item>
                    <Form.Item
                      name="penaltyResult"
                      label="对司机的处罚结果"
                    >
                      <Input placeholder="如：警告处分、停运学习等" />
                    </Form.Item>
                    <Form.Item
                      name="compensationAmount"
                      label="向乘客赔付金额（元）"
                    >
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit" block icon={<FileTextOutlined />}>
                        发布结论
                      </Button>
                    </Form.Item>
                  </Form>
                </Card>
              </>
            )}

            {detail.isReadOnly && (
              <Alert
                message="该投诉单已结案，结论只读"
                description="如需要复议，请在详情页申请追加复议版本"
                type="info"
                showIcon
              />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ConclusionPublish;
