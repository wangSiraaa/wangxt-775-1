import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography } from 'antd';
import {
  UserOutlined,
  CarOutlined,
  AuditOutlined,
  MessageOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import PassengerSubmit from './pages/PassengerSubmit';
import DriverEvidence from './pages/DriverEvidence';
import AuditJudgement from './pages/AuditJudgement';
import ConclusionPublish from './pages/ConclusionPublish';
import Home from './pages/Home';
import ComplaintDetailPage from './pages/ComplaintDetail';

const { Header, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: <Link to="/">系统首页</Link>,
    },
    {
      key: '/passenger',
      icon: <UserOutlined />,
      label: <Link to="/passenger">乘客端-投诉提交</Link>,
    },
    {
      key: '/driver',
      icon: <CarOutlined />,
      label: <Link to="/driver">司机端-举证</Link>,
    },
    {
      key: '/audit',
      icon: <AuditOutlined />,
      label: <Link to="/audit">稽核端-判责</Link>,
    },
    {
      key: '/conclusion',
      icon: <MessageOutlined />,
      label: <Link to="/conclusion">客服端-结论发布</Link>,
    },
  ];

  const selectedKey = location.pathname.includes('/detail') 
    ? [] 
    : [location.pathname];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', background: '#001529' }}>
        <div style={{ color: '#fff', marginRight: 40 }}>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>
            🚕 出租车绕行投诉处理系统
          </Title>
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={selectedKey}
          items={menuItems}
          style={{ flex: 1, minWidth: 0, background: 'transparent' }}
        />
      </Header>
      <Layout>
        <Content>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/passenger" element={<PassengerSubmit />} />
            <Route path="/driver" element={<DriverEvidence />} />
            <Route path="/audit" element={<AuditJudgement />} />
            <Route path="/conclusion" element={<ConclusionPublish />} />
            <Route path="/detail/:id" element={<ComplaintDetailPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
