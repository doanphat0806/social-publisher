import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Megaphone,
  ArrowLeft,
  Calendar,
  Layers,
  Facebook,
  RefreshCw,
  ExternalLink,
  Play,
  Pause,
  XCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCw,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { getSocket } from '../../services/socket.js';
import { Campaign, Post, FacebookPage } from '../../types/index.js';
import { StatusBadge } from '../Dashboard.js';

export const CampaignDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaignData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [campRes, postsRes] = await Promise.all([
        api.get(`/campaigns/${id}`),
        api.get(`/posts/campaigns/${id}/posts`),
      ]);
      setCampaign(campRes.data.data.campaign);
      setPages(campRes.data.data.pages);
      setPosts(postsRes.data.data.posts);
    } catch (err) {
      console.error('Error fetching campaign detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaignData();

    const socket = getSocket();
    const handleUpdate = () => fetchCampaignData();
    socket.on('publish:success', handleUpdate);
    socket.on('publish:failed', handleUpdate);
    socket.on('publish:processing', handleUpdate);
    socket.on('campaign:completed', handleUpdate);

    return () => {
      socket.off('publish:success', handleUpdate);
      socket.off('publish:failed', handleUpdate);
      socket.off('publish:processing', handleUpdate);
      socket.off('campaign:completed', handleUpdate);
    };
  }, [id]);

  const handleRetryTask = async (taskId: string) => {
    try {
      await api.post(`/publish/tasks/${taskId}/retry`);
      alert('Đã gửi yêu cầu đăng lại vào hàng đợi!');
      fetchCampaignData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi đăng lại bài viết');
    }
  };

  const handleStart = async () => {
    if (!campaign) return;
    try {
      await api.post(`/campaigns/${campaign._id}/start`);
      fetchCampaignData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi khởi chạy chiến dịch');
    }
  };

  const handlePause = async () => {
    if (!campaign) return;
    try {
      await api.post(`/campaigns/${campaign._id}/pause`);
      fetchCampaignData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi tạm dừng chiến dịch');
    }
  };

  const handleResume = async () => {
    if (!campaign) return;
    try {
      await api.post(`/campaigns/${campaign._id}/resume`);
      fetchCampaignData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi tiếp tục chiến dịch');
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500 text-sm">
        Đang tải thông tin chi tiết chiến dịch...
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-slate-400">Không tìm thấy chiến dịch này</p>
        <Link to="/campaigns" className="text-indigo-400 font-semibold text-sm">
          &larr; Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          <Link
            to="/campaigns"
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{campaign.name}</h1>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Bắt đầu lúc: {new Date(campaign.startAt).toLocaleString('vi-VN')} · Khoảng cách:{' '}
              {campaign.intervalMinutes} phút
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchCampaignData}
            className="p-2.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
            title="Làm mới"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {campaign.status === 'draft' && (
            <button
              onClick={handleStart}
              className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all"
            >
              <Play className="w-4 h-4" />
              <span>Khởi chạy ngay</span>
            </button>
          )}

          {(campaign.status === 'running' || campaign.status === 'scheduled') && (
            <button
              onClick={handlePause}
              className="flex items-center space-x-2 px-5 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl font-semibold text-sm transition-all"
            >
              <Pause className="w-4 h-4" />
              <span>Tạm dừng</span>
            </button>
          )}

          {campaign.status === 'paused' && (
            <button
              onClick={handleResume}
              className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm transition-all"
            >
              <Play className="w-4 h-4" />
              <span>Tiếp tục</span>
            </button>
          )}
        </div>
      </div>

      {/* Campaign Metrics Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Tổng số ảnh</p>
          <p className="text-xl font-bold text-white mt-1">{campaign.totalImages}</p>
        </div>
        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Ảnh mỗi bài</p>
          <p className="text-xl font-bold text-white mt-1">{campaign.imagesPerPost}</p>
        </div>
        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Tổng số bài</p>
          <p className="text-xl font-bold text-indigo-400 mt-1">{campaign.totalPosts}</p>
        </div>
        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Số Fanpage</p>
          <p className="text-xl font-bold text-blue-400 mt-1">{campaign.pageIds.length}</p>
        </div>
        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Đăng thành công</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            {campaign.stats?.successfulPublishes || 0}
          </p>
        </div>
        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Lỗi / Đang chờ</p>
          <p className="text-xl font-bold text-rose-400 mt-1">
            {campaign.stats?.failedPublishes || 0}
            <span className="text-xs text-slate-500 font-normal ml-1">
              / {campaign.stats?.pendingPublishes || 0}
            </span>
          </p>
        </div>
      </div>

      {/* Posts Breakdown List */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          <span>Danh Sách Các Bài Viết Và Trạng Thái Từng Fanpage</span>
        </h2>

        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post._id}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-800/80">
                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1 rounded-lg bg-indigo-600/20 text-indigo-400 font-bold text-xs border border-indigo-500/30">
                    Bài #{post.postNumber}
                  </span>
                  <span className="text-xs text-slate-400">
                    {post.mediaIds?.length || 0} hình ảnh đính kèm
                  </span>
                </div>
              </div>

              {/* Caption preview */}
              <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800/60 whitespace-pre-wrap">
                {post.caption || campaign.caption || '(Không có caption)'}
              </div>

              {/* Photos Thumbnail Carousel */}
              {post.mediaIds && post.mediaIds.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {post.mediaIds.map((media, i) => (
                    <img
                      key={media._id || i}
                      src={media.storageUrl}
                      alt={media.originalName}
                      className="w-16 h-16 rounded-xl object-cover border border-slate-800 shrink-0"
                    />
                  ))}
                </div>
              )}

              {/* Publish Tasks Table Across Pages */}
              <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/60">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5">Fanpage</th>
                      <th className="px-4 py-2.5">Lịch Đăng</th>
                      <th className="px-4 py-2.5">Trạng Thái</th>
                      <th className="px-4 py-2.5">Post ID</th>
                      <th className="px-4 py-2.5 text-right">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {post.tasks?.map((task) => {
                      const page = pages.find((p) => p.pageId === task.pageId);
                      return (
                        <tr key={task._id} className="hover:bg-slate-900/40">
                          <td className="px-4 py-3 font-semibold text-white">
                            <div className="flex items-center space-x-2">
                              <Facebook className="w-3.5 h-3.5 text-blue-400" />
                              <span>{page?.pageName || task.pageId}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-400 font-mono">
                            {new Date(task.scheduledAt).toLocaleString('vi-VN')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              <StatusBadge status={task.status} />
                              {task.errorMessage && (
                                <span
                                  className="text-[10px] text-rose-400 truncate max-w-xs"
                                  title={task.errorMessage}
                                >
                                  ({task.errorMessage})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-400">
                            {task.facebookPostId || '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end space-x-3">
                              {task.status === 'failed' && (
                                <button
                                  onClick={() => handleRetryTask(task._id)}
                                  className="inline-flex items-center space-x-1 text-xs text-amber-400 hover:text-amber-300 font-medium"
                                  title="Đăng lại bài này"
                                >
                                  <RotateCw className="w-3.5 h-3.5" />
                                  <span>Đăng lại</span>
                                </button>
                              )}
                              {task.facebookPostUrl && (
                                <a
                                  href={task.facebookPostUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                                >
                                  <span>Xem bài</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

