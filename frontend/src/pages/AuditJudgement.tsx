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
  Select,
  InputNumber,
  Alert,
  Row,
  Col,
  Statistic,
  Divider,
  List,
} from 'antd';
import {
  EyeOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { MapContainer, TileLayer, Polyline, Popup, CircleMarker } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { complaintApi } from '../api';
import { Complaint, StatusMap, ComplaintDetail, TrackPoint, ComplaintStatus } from '../types';
import L from 'leaflet';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const AuditJudgement: React.FC = () => {
  const [list, setList] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState<ComplaintDetail | null>(null);
  const [auditForm] = Form.useForm();
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
      }
    } catch (e) {
      message.error('加载详情失败');
    }
  };

  const handleSubmitAudit = async (values: any) => {
    if (!detail) return;
    try {
      const data = {
        auditorId: 'A001',
        auditorName: '稽核员小王',
        detourDetected: values.detourDetected,
        opinion: values.opinion,
        suggestedPenalty: values.suggestedPenalty,
        suggestedCompensation: values.suggestedCompensation,
      };
      const res = await complaintApi.submitAudit(detail.complaint.id, data);
      if (res.success) {
        message.success('稽核意见提交成功');
        setDetailVisible(false);
        auditForm.resetFields();
        loadList();
      }
    } catch (e) {
      message.error('提交失败');
    }
  };

  const getTrackPath = (points: TrackPoint[]) => {
    return points.map(p => [p.latitude, p.longitude] as [number, number]);
  };

  const getCenter = (points: TrackPoint[]) => {
    if (!points || points.length === 0) return [39.9042, 116.4074] as [number, number];
    const avgLat = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
    const avgLng = points.reduce((sum, p) => sum + p.longitude, 0) / points.length;
    return [avgLat, avgLng] as [number, number];
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
          {record.status === 'pending_audit' && (
            <Button
              type="primary"
              size="small"
              icon={<AuditOutlined />}
              onClick={() => loadDetail(record.id)}
            >
              稽核
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <Title level={2}>稽核端 - 判责处理</Title>
        <p className="ant-typography-secondary">
          地图化轨迹比对、计价器分析、规则命中检测
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
        title="稽核详情"
        width={800}
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
              <Descriptions.Item label="行程">
                {detail.complaint.start_address} → {detail.complaint.end_address}
              </Descriptions.Item>
              <Descriptions.Item label="支付金额">¥{detail.complaint.paid_amount}</Descriptions.Item>
              <Descriptions.Item label="投诉说明">{detail.complaint.complaint_description}</Descriptions.Item>
            </Descriptions>

            <Divider />

            <Card title="规则检测结果" size="small" style={{ marginBottom: 16 }}>
              {detail.ruleCheck.warnings.length > 0 ? (
                <Alert
                  message="检测到异常"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {detail.ruleCheck.warnings.map((w, i) => (
                        <li key={i} className="warning-text">{w}</li>
                      ))}
                    </ul>
                  }
                  type="warning"
                  showIcon
                />
              ) : (
                <Alert message="未检测到异常规则命中" type="success" showIcon />
              )}
            </Card>

            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="轨迹里程"
                    value={detail.ruleCheck.trackMileage}
                    suffix="km"
                    valueStyle={{ fontSize: 18 }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="计价器里程"
                    value={detail.ruleCheck.meterMileage}
                    suffix="km"
                    valueStyle={{ fontSize: 18 }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="差异"
                    value={detail.ruleCheck.mileageDiffPercent * 100}
                    suffix="%"
                    valueStyle={{ 
                      fontSize: 18, 
                      color: detail.ruleCheck.isMileageAbnormal ? '#ff4d4f' : '#52c41a' 
                    }}
                    prefix={detail.ruleCheck.isMileageAbnormal ? <WarningOutlined /> : null}
                  />
                </Card>
              </Col>
            </Row>

            <Divider orientation="left">轨迹地图</Divider>
            
            <div style={{ height: 300, marginBottom: 16 }}>
              <MapContainer
                center={getCenter(detail.trackPoints)}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {detail.trackPoints.filter(t => t.source === 'passenger').length > 0 && (
                  <Polyline
                    positions={getTrackPath(detail.trackPoints.filter(t => t.source === 'passenger'))}
                    color="blue"
                    weight={3}
                    opacity={0.7}
                  >
                    <Popup>乘客提供轨迹</Popup>
                  </Polyline>
                )}
                {detail.trackPoints.filter(t => t.source === 'driver').length > 0 && (
                  <Polyline
                    positions={getTrackPath(detail.trackPoints.filter(t => t.source === 'driver'))}
                    color="red"
                    weight={3}
                    opacity={0.7}
                    dashArray="10, 10"
                  >
                    <Popup>司机提供轨迹</Popup>
                  </Polyline>
                )}
                {detail.trackPoints.slice(0, 5).map((p) => (
                  <CircleMarker
                    key={p.id}
                    center={[p.latitude, p.longitude]}
                    radius={5}
                    color={p.source === 'driver' ? 'red' : 'blue'}
                  />
                ))}
              </MapContainer>
            </div>

            <Card title="计价器记录" size="small" style={{ marginBottom: 16 }}>
              <List
                size="small"
                dataSource={detail.meterRecords}
                renderItem={item => (
                  <List.Item>
                    <List.Item.Meta
                      title={`总里程: ${item.total_mileage} km`}
                      description={`单价: ¥${item.unit_price}/km, 等候费: ¥${item.waiting_price}, 总计: ¥${item.total_amount}`}
                    />
                  </List.Item>
                )}
              />
            </Card>

            <Card title="举证材料" size="small" style={{ marginBottom: 16 }}>
              <List
                size="small"
                dataSource={detail.evidence}
                renderItem={item => (
                  <List.Item>
                    <List.Item.Meta
                      title={`${item.submitter_type === 'driver' ? '司机' : '乘客'}举证`}
                      description={item.content}
                    />
                  </List.Item>
                )}
              />
            </Card>

            {detail.complaint.status === 'pending_audit' && !detail.isReadOnly && (
              <>
                <Divider />
                <Card title="提交稽核意见" size="small">
                  <Form form={auditForm} layout="vertical" onFinish={handleSubmitAudit}>
                    <Form.Item
                      name="detourDetected"
                      label="是否判定绕行"
                      rules={[{ required: true, message: '请选择' }]}
                    >
                      <Select>
                        <Option value={1}>是，存在绕行</Option>
                        <Option value={0}>否，不存在绕行</Option>
                        <Option value={0}>证据不足，无法判定</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item
                      name="opinion"
                      label="稽核意见"
                      rules={[{ required: true, message: '请输入稽核意见' }]}
                    >
                      <TextArea rows={3} placeholder="请输入详细的稽核意见..." />
                    </Form.Item>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="suggestedPenalty"
                          label="处罚建议"
                        >
                          <Select placeholder="请选择">
                            <Option value="警告">警告</Option>
                            <Option value="停运学习1天">停运学习1天</Option>
                            <Option value="停运学习3天">停运学习3天</Option>
                            <Option value="罚款">罚款</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="suggestedCompensation"
                          label="赔付建议（元）"
                        >
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    {detail.ruleCheck.isTrackMissing && (
                      <Alert
                        message="轨迹数据不足，不得直接判责"
                        description="请结合其他证据综合判断，或要求补充证据"
                        type="warning"
                        showIcon
                        style={{ marginBottom: 16 }}
                      />
                    )}
                    <Form.Item>
                      <Button type="primary" htmlType="submit" block icon={<CheckCircleOutlined />}>
                        提交稽核意见
                      </Button>
                    </Form.Item>
                  </Form>
                </Card>
              </>
            )}

            {detail.isReadOnly && (
              <Alert
                message="该投诉单已结案，只读模式"
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

export default AuditJudgement;
