import React, { useEffect, useState } from 'react';
import {
  ListOrdered,
  RefreshCw,
  RotateCw,
  XCircle,
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Facebook,
} from 'lucide-react';
import { api } from '../services/api.js';
import { getSocket } from '../services/socket.js';
import { PublishTask } from '../types/index.js';
import { StatusBadge } from './Dashboard.js';

export const QueuePage: React.FC = () => {
  const [tasks, setTasks] = useState<PublishTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'queued' | 'processing' | 'pending' | 'failed'>('all');

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await api.get('/publish/tasks', {
        params: {
          limit: 100,
        },
      });
      setTasks(res.data.data.tasks);
    } catch (err) {
      console.error('Error fetching queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();

    const socket = getSocket();
    const handleUpdate = () => fetchQueue();
    socket.on('publish:queued', handleUpdate);
    socket.on('publish:processing', handleUpdate);
    socket.on('publish:success', handleUpdate);
    socket.on('publish:failed', handleUpdate);

    return () => {
      socket.off('publish:queued', handleUpdate);
      socket.off('publish:processing', handleUpdate);
      socket.off('publish:success', handleUpdate);
      socket.off('publish:failed', handleUpdate);
    };
  }, []);

  const handleRetry = async (taskId: string) => {
    try {
      await api.post(`/publish/tasks/${taskId}/retry`);
      fetchQueue();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi đưa vào hàng đợi đăng lại');
    }
  };

  const handleCancel = async (taskId: string) => {
    if (!window.confirm('Bạn có chắc muốn hủy task này?')) return;
    try {
      await api.post(`/publish/tasks/${taskId}/cancel`);
      fetchQueue();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi hủy task');
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (activeTab === 'all') return true;
    return t.status === activeTab;
  });

  const queuedCount = tasks.filter((t) => t.status === 'queued').length;
  const processingCount = tasks.filter((t) => t.status === 'processing').length;
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const failedCount = tasks.filter((t) => t.status === 'failed').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Hàng Đợi Đăng Bài (BullMQ)</h1>
          <p className="text-sm text-slate-400 mt-1">
            Giám sát các tác vụ xuất bản đang chờ xử lý, concurrency trên từng Page và tiến trình Worker
          </p>
        </div>

        <button
          onClick={fetchQueue}
          className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-semibold text-xs transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới hàng đợi</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { key: 'all', label: 'Tất cả', count: tasks.length },
          { key: 'queued', label: 'Trong hàng đợi', count: queuedCount },
          { key: 'processing', label: 'Đang xử lý', count: processingCount },
          { key: 'pending', label: 'Chờ đến lịch', count: pendingCount },
          { key: 'failed', label: 'Lỗi', count: failedCount },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Queue Tasks Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">Đang kiểm tra hàng đợi...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Không có tác vụ nào trong trạng thái này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-950/40 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">ID Tác Vụ</th>
                  <th className="px-4 py-3.5">Chiến Dịch</th>
                  <th className="px-4 py-3.5">Fanpage</th>
                  <th className="px-4 py-3.5">Thời Gian Lập Lịch</th>
                  <th className="px-4 py-3.5">Số Lần Thử</th>
                  <th className="px-4 py-3.5">Trạng Thái</th>
                  <th className="px-4 py-3.5 text-right">Điều Khiển</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTasks.map((task) => {
                  const campName = typeof task.campaignId === 'object' ? task.campaignId.name : 'Chiến dịch';
                  const pageName = task.facebookPageRef?.pageName || task.pageId;

                  return (
                    <tr key={task._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-slate-400">
                        {task._id.slice(-8)}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-white whitespace-nowrap">
                        {campName}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Facebook className="w-3.5 h-3.5 text-blue-400" />
                          <span>{pageName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono text-slate-400">
                        {new Date(task.scheduledAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-white">
                        {task.attemptCount} lần
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          {task.status === 'failed' && (
                            <button
                              onClick={() => handleRetry(task._id)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 font-semibold"
                            >
                              Thử lại
                            </button>
                          )}
                          {(task.status === 'pending' || task.status === 'queued') && (
                            <button
                              onClick={() => handleCancel(task._id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-semibold"
                            >
                              Hủy
                            </button>
                          )}
                        </div>
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

