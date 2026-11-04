import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  XCircle,
  RotateCw,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  RefreshCw,
  Facebook,
  Filter,
} from 'lucide-react';
import { api } from '../../../services/api.js';

interface CampaignTrackerTabProps {
  activeCampaignId: string | null;
  onSelectCampaign: (id: string) => void;
}

export const CampaignTrackerTab: React.FC<CampaignTrackerTabProps> = ({
  activeCampaignId,
  onSelectCampaign,
}) => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [currentCampaign, setCurrentCampaign] = useState<any | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [searchCode, setSearchCode] = useState('');

  const loadCampaigns = async () => {
    try {
      const res = await api.get('/sku-posting/campaigns');
      setCampaigns(res.data.data.campaigns);
      if (!activeCampaignId && res.data.data.campaigns.length > 0) {
        onSelectCampaign(res.data.data.campaigns[0]._id);
      }
    } catch (err) {
      console.error('Error fetching SKU campaigns:', err);
    }
  };

  const loadCampaignDetails = async (id: string) => {
    try {
      setLoading(true);
      const [campRes, tasksRes] = await Promise.all([
        api.get(`/sku-posting/campaigns/${id}`),
        api.get(`/sku-posting/campaigns/${id}/tasks`, {
          params: { status: statusFilter || undefined, productCode: searchCode || undefined },
        }),
      ]);
      setCurrentCampaign(campRes.data.data.campaign);
      setTasks(tasksRes.data.data.tasks);
    } catch (err) {
      console.error('Error fetching campaign details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (activeCampaignId) {
      loadCampaignDetails(activeCampaignId);
    }
  }, [activeCampaignId, statusFilter, searchCode]);

  // Campaign Actions
  const handlePause = async () => {
    if (!activeCampaignId) return;
    try {
      setActionLoading(true);
      await api.post(`/sku-posting/campaigns/${activeCampaignId}/pause`);
      await loadCampaignDetails(activeCampaignId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi tạm dừng');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!activeCampaignId) return;
    try {
      setActionLoading(true);
      await api.post(`/sku-posting/campaigns/${activeCampaignId}/resume`);
      await loadCampaignDetails(activeCampaignId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi tiếp tục');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!activeCampaignId) return;
    if (!confirm('Bạn có chắc muốn hủy bỏ toàn bộ chiến dịch này?')) return;
    try {
      setActionLoading(true);
      await api.post(`/sku-posting/campaigns/${activeCampaignId}/cancel`);
      await loadCampaignDetails(activeCampaignId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi hủy chiến dịch');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryTask = async (taskId: string) => {
    try {
      await api.post(`/sku-posting/tasks/${taskId}/retry`);
      if (activeCampaignId) await loadCampaignDetails(activeCampaignId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi thử lại');
    }
  };

  const handleExportCsv = () => {
    if (!activeCampaignId) return;
    window.open(`/api/v1/sku-posting/campaigns/${activeCampaignId}/export`, '_blank');
  };

  if (!activeCampaignId && campaigns.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 border border-slate-800 rounded-2xl">
        <p className="text-sm">Chưa có chiến dịch nào được tạo. Hãy tạo chiến dịch đầu tiên tại Tab "Tạo chiến dịch".</p>
      </div>
    );
  }

  const stats = currentCampaign?.stats || {
    totalProducts: 0,
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    pendingTasks: 0,
    processingTasks: 0,
  };

  const progressPercent =
    stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Campaign Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>Theo Dõi Tiến Trình Xuất Bản</span>
            {currentCampaign && (
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                  currentCampaign.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : currentCampaign.status === 'paused'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : currentCampaign.status === 'cancelled'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 animate-pulse'
                }`}
              >
                {currentCampaign.status.toUpperCase()}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Chiến dịch: <strong>{currentCampaign?.name || 'Đang tải...'}</strong>
          </p>
        </div>

        {/* Switcher & Export */}
        <div className="flex items-center space-x-2.5">
          <select
            value={activeCampaignId || ''}
            onChange={(e) => onSelectCampaign(e.target.value)}
            className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
          >
            {campaigns.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.status})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Excel</span>
          </button>

          <button
            type="button"
            onClick={() => activeCampaignId && loadCampaignDetails(activeCampaignId)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Progress & Stat Cards */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 shadow-xl">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-slate-300">Tiến độ xuất bản toàn chiến dịch:</span>
            <span className="text-indigo-400 text-sm font-extrabold">{progressPercent}%</span>
          </div>
          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Counters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-400">Tổng số bài</p>
            <p className="text-lg font-bold text-white mt-1">{stats.totalTasks}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-[11px] text-emerald-400">Đăng thành công</p>
            <p className="text-lg font-bold text-emerald-400 mt-1">{stats.completedTasks}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
            <p className="text-[11px] text-rose-400">Thất bại</p>
            <p className="text-lg font-bold text-rose-400 mt-1">{stats.failedTasks}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-center">
            <p className="text-[11px] text-indigo-400">Đang chờ đăng</p>
            <p className="text-lg font-bold text-indigo-400 mt-1">{stats.pendingTasks}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
            <p className="text-[11px] text-blue-400">Đang xử lý</p>
            <p className="text-lg font-bold text-blue-400 mt-1">{stats.processingTasks}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            {currentCampaign?.status === 'paused' ? (
              <button
                type="button"
                onClick={handleResume}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Tiếp tục chiến dịch</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePause}
                disabled={actionLoading || currentCampaign?.status === 'completed' || currentCampaign?.status === 'cancelled'}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all disabled:opacity-50"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Tạm dừng chiến dịch</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCancel}
              disabled={actionLoading || currentCampaign?.status === 'completed' || currentCampaign?.status === 'cancelled'}
              className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Hủy bỏ</span>
            </button>
          </div>

          <span className="text-xs text-slate-500">
            Hàng đợi BullMQ tự động phân phối nhiệm vụ theo lịch độc lập từng Fanpage
          </span>
        </div>
      </div>

      {/* Filter & Tasks Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo mã SKU..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="success">Thành công</option>
              <option value="pending">Đang chờ</option>
              <option value="processing">Đang xử lý</option>
              <option value="failed">Thất bại</option>
              <option value="paused">Tạm dừng</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">STT</th>
                <th className="py-3 px-4">Mã SKU</th>
                <th className="py-3 px-4">Fanpage ID</th>
                <th className="py-3 px-4">Lịch xuất bản</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Facebook Post Link</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Chưa có bài đăng nào trong danh sách
                  </td>
                </tr>
              ) : (
                tasks.map((task, idx) => {
                  const isSuccess = task.status === 'success';
                  const isFailed = task.status === 'failed';
                  const isProcessing = task.status === 'processing';

                  return (
                    <tr key={task._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-300">{task.productCode}</td>
                      <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">{task.pageId}</td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(task.scheduledAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3 px-4">
                        {isSuccess && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Đăng thành công</span>
                          </span>
                        )}
                        {isFailed && (
                          <span
                            title={task.errorMessage}
                            className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 cursor-help"
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span className="truncate max-w-[120px]">{task.errorMessage || 'Lỗi'}</span>
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
                            <span>Đang đăng...</span>
                          </span>
                        )}
                        {!isSuccess && !isFailed && !isProcessing && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            <Clock className="w-3 h-3" />
                            <span>Đang chờ</span>
                          </span>
                        )}
                      </td>

                      {/* Facebook Post Link */}
                      <td className="py-3 px-4">
                        {task.facebookPostId ? (
                          <a
                            href={
                              task.facebookPostUrl || `https://facebook.com/${task.facebookPostId}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 text-blue-400 hover:text-blue-300 hover:underline font-mono text-[11px]"
                          >
                            <span>Xem trên Facebook</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-600 italic text-[11px]">Chưa đăng</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        {isFailed && (
                          <button
                            type="button"
                            onClick={() => handleRetryTask(task._id)}
                            className="p-1 px-2.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[11px] font-semibold transition-all inline-flex items-center space-x-1"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>Thử lại</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

