import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Megaphone,
  PlusCircle,
  Play,
  Pause,
  XCircle,
  Eye,
  Trash2,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { getSocket } from '../../services/socket.js';
import { Campaign } from '../../types/index.js';
import { StatusBadge } from '../Dashboard.js';

export const CampaignList: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;

      const res = await api.get('/campaigns', { params });
      setCampaigns(res.data.data.campaigns);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();

    const socket = getSocket();
    const handleUpdate = () => fetchCampaigns();
    socket.on('campaign:created', handleUpdate);
    socket.on('campaign:started', handleUpdate);
    socket.on('campaign:paused', handleUpdate);
    socket.on('campaign:resumed', handleUpdate);
    socket.on('campaign:completed', handleUpdate);
    socket.on('publish:success', handleUpdate);

    return () => {
      socket.off('campaign:created', handleUpdate);
      socket.off('campaign:started', handleUpdate);
      socket.off('campaign:paused', handleUpdate);
      socket.off('campaign:resumed', handleUpdate);
      socket.off('campaign:completed', handleUpdate);
      socket.off('publish:success', handleUpdate);
    };
  }, [statusFilter, search]);

  const handleStart = async (id: string) => {
    try {
      await api.post(`/campaigns/${id}/start`);
      fetchCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi khởi chạy chiến dịch');
    }
  };

  const handlePause = async (id: string) => {
    try {
      await api.post(`/campaigns/${id}/pause`);
      fetchCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi tạm dừng chiến dịch');
    }
  };

  const handleResume = async (id: string) => {
    try {
      await api.post(`/campaigns/${id}/resume`);
      fetchCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi tiếp tục chiến dịch');
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn hủy chiến dịch này? Các tác vụ chưa đăng sẽ bị hủy.')) return;
    try {
      await api.post(`/campaigns/${id}/cancel`);
      fetchCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi hủy chiến dịch');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa chiến dịch này vĩnh viễn?')) return;
    try {
      await api.delete(`/campaigns/${id}`);
      fetchCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi xóa chiến dịch');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Danh Sách Chiến Dịch</h1>
          <p className="text-sm text-slate-400 mt-1">
            Quản lý, theo dõi tiến độ và điều khiển các chiến dịch đăng bài hàng loạt
          </p>
        </div>
        <Link
          to="/campaigns/create"
          className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Tạo chiến dịch mới</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên chiến dịch..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Trạng thái:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Tất cả</option>
            <option value="draft">Bản nháp (Draft)</option>
            <option value="scheduled">Đã lên lịch (Scheduled)</option>
            <option value="running">Đang chạy (Running)</option>
            <option value="paused">Tạm dừng (Paused)</option>
            <option value="completed">Hoàn tất (Completed)</option>
            <option value="cancelled">Đã hủy (Cancelled)</option>
          </select>

          <button
            onClick={fetchCampaigns}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors"
            title="Làm mới"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">
            Đang tải danh sách chiến dịch...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <Megaphone className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-white">Chưa tìm thấy chiến dịch nào</p>
            <p className="text-xs text-slate-500 mt-1">Bắt đầu bằng cách tạo chiến dịch đăng bài đầu tiên</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-950/40 border-b border-slate-800 font-bold">
                <tr>
                  <th className="px-4 py-3.5">Chiến Dịch</th>
                  <th className="px-4 py-3.5">Ngày Bắt Đầu</th>
                  <th className="px-4 py-3.5 text-center">Ảnh</th>
                  <th className="px-4 py-3.5 text-center">Bài Viết</th>
                  <th className="px-4 py-3.5 text-center">Fanpage</th>
                  <th className="px-4 py-3.5 text-center">Tiến Độ</th>
                  <th className="px-4 py-3.5">Trạng Thái</th>
                  <th className="px-4 py-3.5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {campaigns.map((camp) => (
                  <tr key={camp._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-4">
                      <div>
                        <Link
                          to={`/campaigns/${camp._id}`}
                          className="font-bold text-white hover:text-indigo-400 text-sm"
                        >
                          {camp.name}
                        </Link>
                        {camp.description && (
                          <p className="text-xs text-slate-500 truncate max-w-xs mt-0.5">
                            {camp.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-400">
                      {new Date(camp.startAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-4 text-center whitespace-nowrap font-semibold text-white">
                      {camp.totalImages}
                    </td>
                    <td className="px-4 py-4 text-center whitespace-nowrap font-semibold text-indigo-400">
                      {camp.totalPosts}
                    </td>
                    <td className="px-4 py-4 text-center whitespace-nowrap font-semibold text-blue-400">
                      {camp.pageIds.length}
                    </td>
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <div className="text-xs">
                        <span className="text-emerald-400 font-bold">{camp.stats?.successfulPublishes || 0}</span>
                        <span className="text-slate-600"> / </span>
                        <span className="text-slate-400">{camp.stats?.totalPublishes || 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <StatusBadge status={camp.status} />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          to={`/campaigns/${camp._id}`}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>

                        {camp.status === 'draft' && (
                          <button
                            onClick={() => handleStart(camp._id)}
                            className="p-1.5 text-emerald-400 hover:text-emerald-300 rounded-lg hover:bg-emerald-500/10 transition-colors"
                            title="Khởi chạy chiến dịch"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}

                        {(camp.status === 'running' || camp.status === 'scheduled') && (
                          <button
                            onClick={() => handlePause(camp._id)}
                            className="p-1.5 text-yellow-400 hover:text-yellow-300 rounded-lg hover:bg-yellow-500/10 transition-colors"
                            title="Tạm dừng"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        )}

                        {camp.status === 'paused' && (
                          <button
                            onClick={() => handleResume(camp._id)}
                            className="p-1.5 text-emerald-400 hover:text-emerald-300 rounded-lg hover:bg-emerald-500/10 transition-colors"
                            title="Tiếp tục"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}

                        {camp.status !== 'completed' && camp.status !== 'cancelled' && (
                          <button
                            onClick={() => handleCancel(camp._id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                            title="Hủy chiến dịch"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}

                        {camp.status !== 'running' && (
                          <button
                            onClick={() => handleDelete(camp._id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                            title="Xóa chiến dịch"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

