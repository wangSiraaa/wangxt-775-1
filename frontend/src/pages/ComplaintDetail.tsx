import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  message,
  Spin,
  Typography,
  Row,
  Col,
  List,
  Form,
  Input,
  Modal,
  Alert,
  Tabs,
  Divider,
  Space,
  Statistic,
} from 'antd';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  EnvironmentOutlined,
  CarOutlined,
  AuditOutlined,
  MessageOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { MapContainer, TileLayer, Polyline, CircleMarker } from 'react-leaflet';
import dayjs from 'dayjs';
import { complaintApi } from '../api';
import { ComplaintDetail, StatusMap, TrackPoint } from '../types';

const { Title } = Typography;
const { TextArea } = Input;

const ComplaintDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ComplaintDetail | null>(null);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewForm] = Form.useForm();

  useEffect(() => {
    if (id) {
      loadDetail();
    }
  }, [id]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const res = await complaintApi.getDetail(id!);
      if (res.success) {
        setDetail(res.data);
      }
    } catch (e) {
      message.error('加载详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (values: any) => {
    try {
      const data = {
        requesterId: 'P001',
        reviewReason: values.reviewReason,
        reviewEvidence: [],
      };
      const res = await complaintApi.requestReview(id!, data);
      if (res.success) {
        message.success('复议申请已提交');
        setReviewVisible(false);
        reviewForm.resetFields();
        loadDetail();
      }
    } catch (e) {
      message.error('申请失败');
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!detail) {
    return <div className="page-container"><Alert message="投诉单不存在" type="error" /></div>;
  }

  const statusInfo = StatusMap[detail.complaint.status];

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            投诉详情 - {detail.complaint.complaint_no}
          </Title>
          <Tag color={statusInfo.color} className="status-tag">
            {statusInfo.label}
          </Tag>
          {detail.isReadOnly && <Tag color="default">只读</Tag>}
        </Space>
      </div>

      <div className="page-content">
        <Tabs
          items={[
            {
              key: 'base',
              label: '基本信息',
              children: (
                <>
                  <Descriptions bordered column={2} className="card-section">
                    <Descriptions.Item label="投诉单号">{detail.complaint.complaint_no}</Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="车牌号">{detail.complaint.plate_number}</Descriptions.Item>
                    <Descriptions.Item label="司机">{detail.complaint.driver_name || '-'}</Descriptions.Item>
                    <Descriptions.Item label="乘客">{detail.complaint.passenger_name}</Descriptions.Item>
                    <Descriptions.Item label="乘客ID">{detail.complaint.passenger_id}</Descriptions.Item>
                    <Descriptions.Item label="出发地">{detail.complaint.start_address}</Descriptions.Item>
                    <Descriptions.Item label="目的地">{detail.complaint.end_address}</Descriptions.Item>
                    <Descriptions.Item label="行程时间">
                      {dayjs(detail.complaint.start_time).format('YYYY-MM-DD HH:mm')} ~{' '}
                      {dayjs(detail.complaint.end_time).format('HH:mm')}
                    </Descriptions.Item>
                    <Descriptions.Item label="举证截止">
                      {dayjs(detail.complaint.evidence_deadline).format('YYYY-MM-DD HH:mm:ss')}
                    </Descriptions.Item>
                    <Descriptions.Item label="实际支付" span={1}>
                      <span style={{ color: '#fa8c16', fontSize: 18, fontWeight: 'bold' }}>
                        ¥{detail.complaint.paid_amount}
                      </span>
                    </Descriptions.Item>
                    <Descriptions.Item label="预估金额" span={1}>
                      ¥{detail.complaint.expected_amount || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="投诉说明" span={2}>
                      {detail.complaint.complaint_description}
                    </Descriptions.Item>
                  </Descriptions>

                  <Card title="规则检测结果" className="card-section">
                    <Row gutter={16}>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic
                            title="轨迹里程"
                            value={detail.ruleCheck.trackMileage}
                            suffix="km"
                          />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic
                            title="计价器里程"
                            value={detail.ruleCheck.meterMileage}
                            suffix="km"
                          />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic
                            title="里程差异"
                            value={(detail.ruleCheck.mileageDiffPercent * 100).toFixed(1)}
                            suffix="%"
                            valueStyle={{
                              color: detail.ruleCheck.isMileageAbnormal ? '#ff4d4f' : '#52c41a',
                            }}
                          />
                        </Card>
                      </Col>
                    </Row>
                    {detail.ruleCheck.warnings.length > 0 && (
                      <Alert
                        message="规则命中警告"
                        description={
                          <ul style={{ margin: 0, paddingLeft: 20 }}>
                            {detail.ruleCheck.warnings.map((w, i) => (
                              <li key={i} className="warning-text">{w}</li>
                            ))}
                          </ul>
                        }
                        type="warning"
                        showIcon
                        style={{ marginTop: 16 }}
                      />
                    )}
                    {!detail.ruleCheck.canJudgeDirectly && (
                      <Alert
                        message="无法直接判责"
                        description="轨迹数据不足，需结合其他证据综合判断"
                        type="error"
                        showIcon
                        style={{ marginTop: 16 }}
                      />
                    )}
                  </Card>
                </>
              ),
            },
            {
              key: 'track',
              label: (
                <span>
                  <EnvironmentOutlined /> 轨迹地图
                </span>
              ),
              children: (
                <div style={{ height: 500 }}>
                  <MapContainer
                    center={getCenter(detail.trackPoints)}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {detail.trackPoints.filter(t => t.source === 'passenger').length > 0 && (
                      <Polyline
                        positions={getTrackPath(detail.trackPoints.filter(t => t.source === 'passenger'))}
                        color="#1890ff"
                        weight={4}
                        opacity={0.8}
                      />
                    )}
                    {detail.trackPoints.filter(t => t.source === 'driver').length > 0 && (
                      <Polyline
                        positions={getTrackPath(detail.trackPoints.filter(t => t.source === 'driver'))}
                        color="#ff4d4f"
                        weight={4}
                        opacity={0.8}
                        dashArray="10, 10"
                      />
                    )}
                    {detail.trackPoints.map(p => (
                      <CircleMarker
                        key={p.id}
                        center={[p.latitude, p.longitude]}
                        radius={4}
                        color={p.source === 'driver' ? '#ff4d4f' : '#1890ff'}
                        fillColor={p.source === 'driver' ? '#ff4d4f' : '#1890ff'}
                        fillOpacity={0.8}
                      />
                    ))}
                  </MapContainer>
                  <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <Space>
                      <span><span style={{ display: 'inline-block', width: 20, height: 3, background: '#1890ff', marginRight: 6 }}></span>乘客轨迹</span>
                      <span><span style={{ display: 'inline-block', width: 20, height: 3, background: '#ff4d4f', marginRight: 6, borderTop: '2px dashed #ff4d4f' }}></span>司机轨迹</span>
                    </Space>
                  </div>
                </div>
              ),
            },
            {
              key: 'evidence',
              label: (
                <span>
                  <CarOutlined /> 举证材料
                </span>
              ),
              children: (
                <List
                  itemLayout="vertical"
                  dataSource={detail.evidence}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Tag color={item.submitter_type === 'driver' ? 'blue' : 'green'}>
                              {item.submitter_type === 'driver' ? '司机举证' : item.submitter_type === 'reviewer' ? '复议材料' : '乘客提供'}
                            </Tag>
                            <span>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</span>
                          </Space>
                        }
                        description={item.content}
                      />
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'audit',
              label: (
                <span>
                  <AuditOutlined /> 稽核意见
                </span>
              ),
              children: (
                <List
                  itemLayout="vertical"
                  dataSource={detail.auditOpinions}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <span>{item.auditor_name}</span>
                            <Tag color={item.detour_detected ? 'red' : 'green'}>
                              {item.detour_detected ? '判定绕行' : '未判定绕行'}
                            </Tag>
                            <span style={{ color: '#999' }}>
                              {dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                            </span>
                          </Space>
                        }
                        description={
                          <div>
                            <p><strong>稽核意见：</strong>{item.opinion}</p>
                            <p>
                              <strong>里程比对：</strong>
                              轨迹 {item.track_mileage?.toFixed(2)} km / 
                              计价器 {item.meter_mileage?.toFixed(2)} km / 
                              差异 {item.mileage_diff_percent != null ? (item.mileage_diff_percent * 100).toFixed(1) : 0}%
                            </p>
                            {item.suggested_penalty && (
                              <p><strong>处罚建议：</strong>{item.suggested_penalty}</p>
                            )}
                            {item.suggested_compensation && (
                              <p><strong>赔付建议：</strong>¥{item.suggested_compensation}</p>
                            )}
                            {item.rule_hits && (
                              <p>
                                <strong>命中规则：</strong>
                                {JSON.parse(item.rule_hits).map((r: string) => (
                                  <Tag key={r} color="orange" style={{ marginLeft: 4 }}>{r}</Tag>
                                ))}
                              </p>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'conclusion',
              label: (
                <span>
                  <MessageOutlined /> 处理结论
                </span>
              ),
              children: (
                <>
                  {detail.conclusions.length === 0 ? (
                    <Empty description="暂无结论" />
                  ) : (
                    <List
                      itemLayout="vertical"
                      dataSource={detail.conclusions}
                      renderItem={item => (
                        <List.Item>
                          <List.Item.Meta
                            title={
                              <Space>
                                <Tag color="blue">v{item.version}</Tag>
                                {item.is_review && <Tag color="orange">复议版本</Tag>}
                                <span>{item.publisher_name}</span>
                                <span style={{ color: '#999' }}>
                                  {dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                                </span>
                              </Space>
                            }
                            description={
                              <div>
                                <p style={{ fontSize: 15 }}>{item.conclusion}</p>
                                {item.penalty_result && (
                                  <p><strong>处罚结果：</strong>{item.penalty_result}</p>
                                )}
                                {item.compensation_amount && (
                                  <p><strong>赔付金额：</strong><span style={{ color: '#fa8c16', fontWeight: 'bold' }}>¥{item.compensation_amount}</span></p>
                                )}
                              </div>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  )}
                </>
              ),
            },
          ]}
        />

        {detail.canReview && (
          <>
            <Divider />
            <Alert
              message="结案提示"
              description={
                <Space>
                  <span>该投诉单已结案，您可以申请追加复议版本</span>
                  <Button type="primary" onClick={() => setReviewVisible(true)} icon={<ExclamationCircleOutlined />}>
                    申请复议
                  </Button>
                </Space>
              }
              type="info"
              showIcon
            />
          </>
        )}
      </div>

      <Modal
        title="申请复议"
        open={reviewVisible}
        onCancel={() => setReviewVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Alert
          message="复议说明"
          description="申请复议将创建新的结论版本，原结论不会被覆盖或修改"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={reviewForm} layout="vertical" onFinish={handleReview}>
          <Form.Item
            name="reviewReason"
            label="复议理由"
            rules={[{ required: true, message: '请输入复议理由' }]}
          >
            <TextArea rows={4} placeholder="请详细说明您申请复议的理由..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              提交复议申请
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const Empty: React.FC<{ description: string }> = ({ description }) => (
  <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
    <FileTextOutlined style={{ fontSize: 48, marginBottom: 12 }} />
    <p>{description}</p>
  </div>
);

export default ComplaintDetailPage;
