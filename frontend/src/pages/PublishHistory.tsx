import React, { useEffect, useState } from 'react';
import {
  History,
  Download,
  Filter,
  Search,
  ExternalLink,
  RefreshCw,
  Facebook,
  RotateCw,
} from 'lucide-react';
import { api } from '../services/api.js';
import { PublishTask, FacebookPage } from '../types/index.js';
import { StatusBadge } from './Dashboard.js';

export const PublishHistory: React.FC = () => {
  const [tasks, setTasks] = useState<PublishTask[]>([]);
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [statusFilter, setStatusFilter] = useState('');
  const [pageFilter, setPageFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (pageFilter) params.pageId = pageFilter;

      const [tasksRes, pagesRes] = await Promise.all([
        api.get('/publish/tasks', { params }),
        api.get('/facebook/pages'),
      ]);

      setTasks(tasksRes.data.data.tasks);
      setTotalPages(tasksRes.data.data.totalPages || 1);
      setPages(pagesRes.data.data.pages);
    } catch (err) {
      console.error('Error fetching publish history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page, statusFilter, pageFilter]);

  const handleExportCSV = () => {
    if (tasks.length === 0) {
      alert('Không có dữ liệu để xuất file');
      return;
    }

    const headers = ['Thời gian', 'Chiến dịch', 'Bài viết', 'Fanpage', 'Trạng thái', 'Post ID', 'Post URL', 'Lỗi'];
    const rows = tasks.map((t) => {
      const campName = typeof t.campaignId === 'object' ? t.campaignId.name : '';
      const post = typeof t.postId === 'object' ? `Bài #${t.postId.postNumber}` : '';
      const pageName = t.facebookPageRef?.pageName || t.pageId;
      return [
        new Date(t.scheduledAt).toISOString(),
        `"${campName.replace(/"/g, '""')}"`,
        post,
        `"${pageName.replace(/"/g, '""')}"`,
        t.status,
        t.facebookPostId || '',
        t.facebookPostUrl || '',
        `"${(t.errorMessage || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lich_su_dang_bai_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Lịch Sử Đăng Bài Facebook</h1>
          <p className="text-sm text-slate-400 mt-1">
            Toàn bộ nhật ký và lịch sử các lượt đăng bài thành công, thất bại và link xem bài viết
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-semibold text-xs shadow-sm transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Xuất báo cáo CSV</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span>Lọc theo Fanpage:</span>
        </div>
        <select
          value={pageFilter}
          onChange={(e) => {
            setPageFilter(e.target.value);
            setPage(1);
          }}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="">Tất cả Fanpage</option>
          {pages.map((p) => (
            <option key={p.pageId} value={p.pageId}>
              {p.pageName}
            </option>
          ))}
        </select>

        <div className="flex items-center space-x-2 text-xs text-slate-400 ml-2">
          <span>Trạng thái:</span>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="success">Thành công (Success)</option>
          <option value="failed">Thất bại (Failed)</option>
          <option value="pending">Chờ đăng (Pending)</option>
          <option value="processing">Đang đăng (Processing)</option>
          <option value="cancelled">Đã hủy (Cancelled)</option>
        </select>

        <button
          onClick={fetchHistory}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors ml-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">Đang tải lịch sử...</div>
        ) : tasks.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Chưa tìm thấy bản ghi lịch sử đăng bài nào.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-950/40 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">Thời Gian</th>
                  <th className="px-4 py-3.5">Chiến Dịch</th>
                  <th className="px-4 py-3.5">Bài Viết</th>
                  <th className="px-4 py-3.5">Fanpage</th>
                  <th className="px-4 py-3.5">Trạng Thái</th>
                  <th className="px-4 py-3.5">Facebook Post ID</th>
                  <th className="px-4 py-3.5">Lỗi (Nếu có)</th>
                  <th className="px-4 py-3.5 text-right">Xem Bài</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {tasks.map((task) => {
                  const campName = typeof task.campaignId === 'object' ? task.campaignId.name : 'Chiến dịch';
                  const post = typeof task.postId === 'object' ? task.postId : null;
                  const pageName = task.facebookPageRef?.pageName || task.pageId;

                  return (
                    <tr key={task._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 font-mono">
                        {new Date(task.scheduledAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-white whitespace-nowrap">
                        {campName}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        Bài #{post?.postNumber || 1} ({post?.totalImages || 0} ảnh)
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Facebook className="w-3.5 h-3.5 text-blue-400" />
                          <span className="font-semibold text-slate-200">{pageName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-400 whitespace-nowrap">
                        {task.facebookPostId || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-rose-400 max-w-xs truncate" title={task.errorMessage}>
                        {task.errorMessage || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {task.facebookPostUrl ? (
                          <a
                            href={task.facebookPostUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                          >
                            <span>Xem bài</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex justify-between items-center text-xs">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40"
            >
              Trang trước
            </button>
            <span className="text-slate-400 font-medium">
              Trang {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40"
            >
              Trang sau
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

