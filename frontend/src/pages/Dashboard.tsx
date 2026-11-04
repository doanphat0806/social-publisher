import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Facebook,
  Megaphone,
  Images,
  FileText,
  Send,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  ExternalLink,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api.js';
import { getSocket } from '../services/socket.js';
import { DashboardOverview, PublishTask } from '../types/index.js';

export const Dashboard: React.FC = () => {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [activities, setActivities] = useState<PublishTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [overviewRes, activitiesRes] = await Promise.all([
        api.get('/dashboard/overview'),
        api.get('/dashboard/recent-activities'),
      ]);
      setOverview(overviewRes.data.data);
      setActivities(activitiesRes.data.data.activities);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Listen to realtime socket updates
    const socket = getSocket();
    const handleUpdate = () => {
      fetchDashboardData();
    };

    socket.on('publish:success', handleUpdate);
    socket.on('publish:failed', handleUpdate);
    socket.on('publish:processing', handleUpdate);
    socket.on('campaign:created', handleUpdate);
    socket.on('campaign:completed', handleUpdate);

    return () => {
      socket.off('publish:success', handleUpdate);
      socket.off('publish:failed', handleUpdate);
      socket.off('publish:processing', handleUpdate);
      socket.off('campaign:created', handleUpdate);
      socket.off('campaign:completed', handleUpdate);
    };
  }, []);

  const statsCards = [
    { label: 'Fanpage Đã Kết Nối', value: overview?.totalFanpages ?? 0, icon: Facebook, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Tổng Chiến Dịch', value: overview?.totalCampaigns ?? 0, icon: Megaphone, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Tổng Ảnh Upload', value: overview?.totalImages ?? 0, icon: Images, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Tổng Số Bài Viết', value: overview?.totalPosts ?? 0, icon: FileText, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Tổng Lượt Đăng', value: overview?.totalPublishes ?? 0, icon: Send, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Đăng Thành Công', value: overview?.successfulPublishes ?? 0, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Đang Chờ Đăng', value: overview?.pendingPublishes ?? 0, icon: Clock, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: 'Đang Xử Lý', value: overview?.processingPublishes ?? 0, icon: Loader2, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Đăng Thất Bại', value: overview?.failedPublishes ?? 0, icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className="space-y-8">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard Tổng Quan</h1>
          <p className="text-sm text-slate-400 mt-1">
            Theo dõi hiệu suất đăng bài hàng loạt trên các Fanpage Facebook theo thời gian thực
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDashboardData}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/campaigns/create"
            className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm shadow-lg shadow-indigo-600/30 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Tạo chiến dịch mới</span>
          </Link>
        </div>
      </div>

      {/* 9 Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-5">
        {statsCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between hover:border-slate-700/80 transition-all shadow-sm"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {card.label}
                </p>
                <p className="text-2xl font-bold text-white mt-2">
                  {loading ? '...' : card.value.toLocaleString()}
                </p>
              </div>
              <div className={`p-3.5 rounded-2xl ${card.bg} ${card.color}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activities Section */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">Hoạt Động Đăng Bài Gần Đây</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              10 lượt đăng bài được cập nhật trạng thái mới nhất từ Meta Graph API
            </p>
          </div>
          <Link
            to="/history"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Xem tất cả lịch sử &rarr;
          </Link>
        </div>

        {activities.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            Chưa có lượt đăng bài nào. Hãy tạo chiến dịch đầu tiên của bạn!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950/40 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold">Thời Gian</th>
                  <th className="px-4 py-3 font-semibold">Chiến Dịch</th>
                  <th className="px-4 py-3 font-semibold">Fanpage</th>
                  <th className="px-4 py-3 font-semibold">Bài Viết</th>
                  <th className="px-4 py-3 font-semibold">Trạng Thái</th>
                  <th className="px-4 py-3 font-semibold">Facebook Post ID</th>
                  <th className="px-4 py-3 font-semibold text-right">Xem Bài</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {activities.map((task) => {
                  const campaignName = typeof task.campaignId === 'object' ? task.campaignId.name : 'Chiến dịch';
                  const post = typeof task.postId === 'object' ? task.postId : null;
                  const pageName = task.facebookPageRef?.pageName || task.pageId;

                  return (
                    <tr key={task._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-400">
                        {new Date(task.scheduledAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-medium text-white">
                        {campaignName}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Facebook className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="truncate max-w-[160px] text-xs font-medium text-slate-200">
                            {pageName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-300">
                        Bài #{post?.postNumber || '1'} ({post?.totalImages || 0} ảnh)
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs font-mono text-slate-400">
                        {task.facebookPostId || '—'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        {task.facebookPostUrl ? (
                          <a
                            href={task.facebookPostUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                          >
                            <span>Mở bài</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'success':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Thành công
        </span>
      );
    case 'processing':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
          Đang đăng...
        </span>
      );
    case 'queued':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          Trong hàng đợi
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
          Chờ đến lịch
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          Thất bại
        </span>
      );
    case 'paused':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
          Tạm dừng
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
          Đã hủy
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
          {status}
        </span>
      );
  }
};

