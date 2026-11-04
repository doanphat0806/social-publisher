import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore.js';
import { MainLayout } from './components/layout/MainLayout.js';
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';
import { Dashboard } from './pages/Dashboard.js';
import { CampaignCreate } from './pages/campaigns/CampaignCreate.js';
import { CampaignList } from './pages/campaigns/CampaignList.js';
import { CampaignDetail } from './pages/campaigns/CampaignDetail.js';
import { Fanpages } from './pages/Fanpages.js';
import { MediaLibrary } from './pages/MediaLibrary.js';
import { WatermarkEditor } from './pages/WatermarkEditor.js';
import { SkuPostingPage } from './pages/SkuPosting/SkuPostingPage.js';
import { Calendar } from './pages/Calendar.js';
import { PublishHistory } from './pages/PublishHistory.js';
import { QueuePage } from './pages/QueuePage.js';
import { Settings } from './pages/Settings.js';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  const fetchMe = useAuthStore((state) => state.fetchMe);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (token) {
      fetchMe();
    }
  }, [token]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Dashboard Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="campaigns/create" element={<CampaignCreate />} />
          <Route path="campaigns" element={<CampaignList />} />
          <Route path="campaigns/:id" element={<CampaignDetail />} />
          <Route path="fanpages" element={<Fanpages />} />
          <Route path="watermark" element={<WatermarkEditor />} />
          <Route path="sku-posting" element={<SkuPostingPage />} />
          <Route path="media" element={<MediaLibrary />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="history" element={<PublishHistory />} />
          <Route path="queue" element={<QueuePage />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

