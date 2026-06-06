import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Tag,
  Button,
  message,
  Spin,
  Typography,
  Row,
  Col,
  Tabs,
  Space,
  Statistic,
  Select,
  Alert,
  List,
  Timeline,
  Badge,
} from 'antd';
import {
  ArrowLeftOutlined,
  EnvironmentOutlined,
  DiffOutlined,
  HistoryOutlined,
  SaveOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { MapContainer, TileLayer, Polyline, Tooltip } from 'react-leaflet';
import dayjs from 'dayjs';
import { complaintApi } from '../api';
import {
  TrackCompareResult,
  TrackPoint,
  StatusMap,
  AuditLog,
  StatusChangeRecord,
  TrackVersionCompare,
  DetourSegment,
} from '../types';

const { Title } = Typography;
const { Option } = Select;

const VersionComparePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [compareData, setCompareData] = useState<TrackCompareResult | null>(null);
  const [auditData, setAuditData] = useState<{
    auditLogs: AuditLog[];
    statusChanges: StatusChangeRecord[];
    compareRecords: TrackVersionCompare[];
  } | null>(null);
  const [sourceA, setSourceA] = useState<string>('passenger');
  const [sourceB, setSourceB] = useState<string>('driver');

  useEffect(() => {
    if (id) {
      loadCompareData();
      loadAuditData();
    }
  }, [id, sourceA, sourceB]);

  const loadCompareData = async () => {
    setLoading(true);
    try {
      const res = await complaintApi.compareTrackVersions(id!, sourceA, sourceB);
      if (res.success) {
        setCompareData(res.data);
      }
    } catch (e) {
      message.error('加载对比数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditData = async () => {
    try {
      const res = await complaintApi.getAuditLogs(id!);
      if (res.success) {
        setAuditData(res.data);
      }
    } catch (e) {
      message.error('加载审计日志失败');
    }
  };

  const handleSaveCompare = async () => {
    setSaving(true);
    try {
      const res = await complaintApi.saveTrackCompare(id!, {
        sourceA,
        sourceB,
        operatorId: 'AUDIT001',
        operatorName: '稽核员',
      });
      if (res.success) {
        message.success('版本对比结果已保存');
        loadAuditData();
      }
    } catch (e) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const getTrackPath = (points: TrackPoint[]) => {
    return points.map(p => [p.latitude, p.longitude] as [number, number]);
  };

  const getCenter = (pointsA: TrackPoint[], pointsB: TrackPoint[]) => {
    const allPoints = [...pointsA, ...pointsB];
    if (!allPoints || allPoints.length === 0) return [39.9042, 116.4074] as [number, number];
    const avgLat = allPoints.reduce((sum, p) => sum + p.latitude, 0) / allPoints.length;
    const avgLng = allPoints.reduce((sum, p) => sum + p.longitude, 0) / allPoints.length;
    return [avgLat, avgLng] as [number, number];
  };

  const getResultStatus = (result: string) => {
    switch (result) {
      case 'abnormal':
        return { color: 'red', icon: <WarningOutlined />, text: '异常' };
      case 'warning':
        return { color: 'orange', icon: <ClockCircleOutlined />, text: '警告' };
      default:
        return { color: 'green', icon: <CheckCircleOutlined />, text: '正常' };
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      default: return 'blue';
    }
  };

  const getActionTypeLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'DRIVER_SUBMIT_EVIDENCE': '司机提交举证',
      'AUDIT_COMPLETE': '稽核完成',
      'CONCLUSION_PUBLISH': '结论发布',
      'CONCLUSION_REVIEW': '复议结论发布',
      'TRACK_VERSION_COMPARE': '轨迹版本对比',
      'DRIVER_TIMEOUT_AUTO_AUDIT': '司机超时自动转稽核',
    };
    return labels[actionType] || actionType;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!compareData) {
    return <div className="page-container"><Alert message="对比数据加载失败" type="error" /></div>;
  }

  const statusInfo = StatusMap[compareData.complaint.status];
  const resultStatus = getResultStatus(compareData.comparison.compareResult);

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            版本对比 - {compareData.complaint.complaint_no}
          </Title>
          <Tag color={statusInfo.color} className="status-tag">
            {statusInfo.label}
          </Tag>
          <Badge status={resultStatus.color as any} text={resultStatus.text} />
        </Space>
        <Space style={{ marginTop: 8 }}>
          <span>对比源A：</span>
          <Select value={sourceA} onChange={setSourceA} style={{ width: 120 }}>
            <Option value="passenger">乘客轨迹</Option>
            <Option value="driver">司机轨迹</Option>
          </Select>
          <span>对比源B：</span>
          <Select value={sourceB} onChange={setSourceB} style={{ width: 120 }}>
            <Option value="driver">司机轨迹</Option>
            <Option value="passenger">乘客轨迹</Option>
          </Select>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSaveCompare}
            loading={saving}
          >
            保存对比结果
          </Button>
        </Space>
      </div>

      <div className="page-content">
        <Tabs
          items={[
            {
              key: 'compare',
              label: (
                <span>
                  <DiffOutlined /> 轨迹对比
                </span>
              ),
              children: (
                <>
                  <Card title="对比概览" className="card-section">
                    <Row gutter={16}>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic
                            title={`${sourceA === 'passenger' ? '乘客' : '司机'}轨迹里程`}
                            value={compareData.trackA.mileage.toFixed(2)}
                            suffix="km"
                            valueStyle={{ color: '#1890ff' }}
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic
                            title={`${sourceB === 'passenger' ? '乘客' : '司机'}轨迹里程`}
                            value={compareData.trackB.mileage.toFixed(2)}
                            suffix="km"
                            valueStyle={{ color: '#ff4d4f' }}
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic
                            title="里程差异"
                            value={compareData.comparison.mileageDiff.toFixed(2)}
                            suffix="km"
                            valueStyle={{
                              color: compareData.comparison.mileageDiffPercent > 0.15 ? '#ff4d4f' : '#52c41a',
                            }}
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic
                            title="差异比例"
                            value={(compareData.comparison.mileageDiffPercent * 100).toFixed(1)}
                            suffix="%"
                            valueStyle={{
                              color: compareData.comparison.mileageDiffPercent > 0.15 ? '#ff4d4f' : '#52c41a',
                            }}
                          />
                        </Card>
                      </Col>
                    </Row>
                    <Row gutter={16} style={{ marginTop: 16 }}>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic
                            title="匹配轨迹点"
                            value={compareData.comparison.commonPoints}
                            suffix="个"
                            valueStyle={{ color: '#52c41a' }}
                          />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic
                            title="差异轨迹点"
                            value={compareData.comparison.diffPoints}
                            suffix="个"
                            valueStyle={{ color: '#fa8c16' }}
                          />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic
                            title="匹配度"
                            value={
                              compareData.trackA.points.length > 0
                                ? ((compareData.comparison.commonPoints / compareData.trackA.points.length) * 100).toFixed(1)
                                : 0
                            }
                            suffix="%"
                            valueStyle={{ color: '#1890ff' }}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </Card>

                  {compareData.comparison.detourSegments.length > 0 && (
                    <Card title="异常检测" className="card-section">
                      {compareData.comparison.detourSegments.map((segment: DetourSegment, index: number) => (
                        <Alert
                          key={index}
                          message={
                            <Space>
                              <Tag color={getSeverityColor(segment.severity)}>
                                {segment.severity === 'high' ? '高危' : segment.severity === 'medium' ? '中等' : '低危'}
                              </Tag>
                              <span>{segment.type}</span>
                            </Space>
                          }
                          description={segment.description}
                          type={segment.severity === 'high' ? 'error' : 'warning'}
                          showIcon
                          style={{ marginBottom: 8 }}
                        />
                      ))}
                    </Card>
                  )}

                  <Card title="轨迹地图对比" className="card-section">
                    <div style={{ height: 500 }}>
                      <MapContainer
                        center={getCenter(compareData.trackA.points, compareData.trackB.points)}
                        zoom={13}
                        style={{ height: '100%', width: '100%' }}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        {compareData.trackA.points.length > 0 && (
                          <Polyline
                            positions={getTrackPath(compareData.trackA.points)}
                            color="#1890ff"
                            weight={4}
                            opacity={0.8}
                          >
                            <Tooltip>{sourceA === 'passenger' ? '乘客轨迹' : '司机轨迹'}</Tooltip>
                          </Polyline>
                        )}
                        {compareData.trackB.points.length > 0 && (
                          <Polyline
                            positions={getTrackPath(compareData.trackB.points)}
                            color="#ff4d4f"
                            weight={4}
                            opacity={0.6}
                            dashArray="10, 10"
                          >
                            <Tooltip>{sourceB === 'passenger' ? '乘客轨迹' : '司机轨迹'}</Tooltip>
                          </Polyline>
                        )}
                      </MapContainer>
                      <div style={{ marginTop: 12, textAlign: 'center' }}>
                        <Space>
                          <span>
                            <span style={{ display: 'inline-block', width: 20, height: 3, background: '#1890ff', marginRight: 6 }}></span>
                            {sourceA === 'passenger' ? '乘客轨迹' : '司机轨迹'} (A)
                          </span>
                          <span>
                            <span style={{ display: 'inline-block', width: 20, height: 3, background: '#ff4d4f', marginRight: 6, borderTop: '2px dashed #ff4d4f' }}></span>
                            {sourceB === 'passenger' ? '乘客轨迹' : '司机轨迹'} (B)
                          </span>
                        </Space>
                      </div>
                    </div>
                  </Card>
                </>
              ),
            },
            {
              key: 'audit',
              label: (
                <span>
                  <HistoryOutlined /> 审计日志
                </span>
              ),
              children: (
                <Tabs
                  items={[
                    {
                      key: 'logs',
                      label: '操作日志',
                      children: auditData?.auditLogs && auditData.auditLogs.length > 0 ? (
                        <List
                          itemLayout="vertical"
                          dataSource={auditData.auditLogs}
                          renderItem={(item: AuditLog) => (
                            <List.Item>
                              <List.Item.Meta
                                title={
                                  <Space>
                                    <Tag color="blue">{getActionTypeLabel(item.action_type)}</Tag>
                                    <span style={{ color: '#999' }}>
                                      {dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                                    </span>
                                  </Space>
                                }
                                description={
                                  <div>
                                    <p>
                                      <strong>操作人：</strong>
                                      {item.operator_name || item.operator_id}
                                    </p>
                                    {item.old_status && item.new_status && (
                                      <p>
                                        <strong>状态变更：</strong>
                                        <Tag color="default">{StatusMap[item.old_status as keyof typeof StatusMap]?.label || item.old_status}</Tag>
                                        <span style={{ margin: '0 8px' }}>→</span>
                                        <Tag color={StatusMap[item.new_status as keyof typeof StatusMap]?.color || 'blue'}>
                                          {StatusMap[item.new_status as keyof typeof StatusMap]?.label || item.new_status}
                                        </Tag>
                                      </p>
                                    )}
                                    {item.remark && (
                                      <p>
                                        <strong>备注：</strong>
                                        {item.remark}
                                      </p>
                                    )}
                                  </div>
                                }
                              />
                            </List.Item>
                          )}
                        />
                      ) : (
                        <Empty description="暂无操作日志" />
                      ),
                    },
                    {
                      key: 'status',
                      label: '状态流转',
                      children: auditData?.statusChanges && auditData.statusChanges.length > 0 ? (
                        <Timeline>
                          {auditData.statusChanges.map((item: StatusChangeRecord) => (
                            <Timeline.Item
                              key={item.id}
                              color={item.is_auto_trigger ? 'orange' : 'blue'}
                            >
                              <Space>
                                <Tag color={StatusMap[item.new_status as keyof typeof StatusMap]?.color || 'blue'}>
                                  {StatusMap[item.new_status as keyof typeof StatusMap]?.label || item.new_status}
                                </Tag>
                                {item.is_auto_trigger && <Tag color="orange">系统自动</Tag>}
                                <span style={{ color: '#999' }}>
                                  {dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                                </span>
                              </Space>
                              <div style={{ marginTop: 4 }}>
                                <p style={{ margin: 0 }}>
                                  {StatusMap[item.old_status as keyof typeof StatusMap]?.label || item.old_status} →{' '}
                                  {StatusMap[item.new_status as keyof typeof StatusMap]?.label || item.new_status}
                                </p>
                                {item.change_reason && (
                                  <p style={{ margin: 0, color: '#666' }}>
                                    原因：{item.change_reason}
                                  </p>
                                )}
                                {item.operator_name && (
                                  <p style={{ margin: 0, color: '#666' }}>
                                    操作人：{item.operator_name}
                                  </p>
                                )}
                              </div>
                            </Timeline.Item>
                          ))}
                        </Timeline>
                      ) : (
                        <Empty description="暂无状态变更记录" />
                      ),
                    },
                    {
                      key: 'compares',
                      label: '对比记录',
                      children: auditData?.compareRecords && auditData.compareRecords.length > 0 ? (
                        <List
                          itemLayout="vertical"
                          dataSource={auditData.compareRecords}
                          renderItem={(item: TrackVersionCompare) => {
                            const status = getResultStatus(item.compare_result);
                            return (
                              <List.Item>
                                <List.Item.Meta
                                  title={
                                    <Space>
                                      <Badge status={status.color as any} text={status.text} />
                                      <span>{item.source_a} vs {item.source_b}</span>
                                      <span style={{ color: '#999' }}>
                                        {dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                                      </span>
                                    </Space>
                                  }
                                  description={
                                    <div>
                                      <Row gutter={16}>
                                        <Col span={8}>
                                          <p>A里程：{item.mileage_a?.toFixed(2)} km</p>
                                        </Col>
                                        <Col span={8}>
                                          <p>B里程：{item.mileage_b?.toFixed(2)} km</p>
                                        </Col>
                                        <Col span={8}>
                                          <p>差异：{(item.mileage_diff_percent || 0) * 100}%</p>
                                        </Col>
                                      </Row>
                                      <p>匹配：{item.common_points} / 差异：{item.diff_points}</p>
                                      {item.operator_name && (
                                        <p style={{ color: '#666' }}>操作人：{item.operator_name}</p>
                                      )}
                                    </div>
                                  }
                                />
                              </List.Item>
                            );
                          }}
                        />
                      ) : (
                        <Empty description="暂无对比记录" />
                      ),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
};

const Empty: React.FC<{ description: string }> = ({ description }) => (
  <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
    <EnvironmentOutlined style={{ fontSize: 48, marginBottom: 12 }} />
    <p>{description}</p>
  </div>
);

export default VersionComparePage;
