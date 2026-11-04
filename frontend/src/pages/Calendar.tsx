import React, { useEffect, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api.js';
import { PublishTask, FacebookPage, Campaign } from '../types/index.js';
import { StatusBadge } from './Dashboard.js';

export const Calendar: React.FC = () => {
  const [tasks, setTasks] = useState<PublishTask[]>([]);
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

  const fetchCalendarTasks = async () => {
    try {
      setLoading(true);
      const startOfDay = `${selectedDate}T00:00:00.000Z`;
      const endOfDay = `${selectedDate}T23:59:59.999Z`;

      const params: any = {
        startDate: startOfDay,
        endDate: endOfDay,
        limit: 100,
      };
      if (selectedPageId) params.pageId = selectedPageId;
      if (selectedCampaignId) params.campaignId = selectedCampaignId;

      const [tasksRes, pagesRes, campsRes] = await Promise.all([
        api.get('/publish/tasks', { params }),
        api.get('/facebook/pages'),
        api.get('/campaigns'),
      ]);

      setTasks(tasksRes.data.data.tasks);
      setPages(pagesRes.data.data.pages);
      setCampaigns(campsRes.data.data.campaigns);
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarTasks();
  }, [selectedDate, selectedPageId, selectedCampaignId]);

  const changeDay = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Lịch Đăng Bài</h1>
          <p className="text-sm text-slate-400 mt-1">
            Theo dõi chi tiết các mốc giờ đăng bài theo từng Fanpage và chiến dịch trong ngày
          </p>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
          <button
            onClick={() => changeDay(-1)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-xs font-semibold text-white px-2 focus:outline-none"
          />
          <button
            onClick={() => changeDay(1)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span>Lọc theo Fanpage:</span>
        </div>
        <select
          value={selectedPageId}
          onChange={(e) => setSelectedPageId(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="">Tất cả Fanpage ({pages.length})</option>
          {pages.map((p) => (
            <option key={p.pageId} value={p.pageId}>
              {p.pageName}
            </option>
          ))}
        </select>

        <div className="flex items-center space-x-2 text-xs text-slate-400 ml-4">
          <Filter className="w-3.5 h-3.5" />
          <span>Chiến dịch:</span>
        </div>
        <select
          value={selectedCampaignId}
          onChange={(e) => setSelectedCampaignId(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="">Tất cả chiến dịch ({campaigns.length})</option>
          {campaigns.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>

        <button
          onClick={fetchCalendarTasks}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors ml-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Timeline List */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
          <CalendarIcon className="w-4 h-4 text-indigo-400" />
          <span>
            Các Lượt Đăng Vào Ngày {new Date(selectedDate).toLocaleDateString('vi-VN')} ({tasks.length} lượt)
          </span>
        </h2>

        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">Đang tải lịch đăng...</div>
        ) : tasks.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Không có bài đăng nào được lên lịch vào ngày này.
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const campName = typeof task.campaignId === 'object' ? task.campaignId.name : 'Chiến dịch';
              const post = typeof task.postId === 'object' ? task.postId : null;
              const page = pages.find((p) => p.pageId === task.pageId);

              return (
                <div
                  key={task._id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="px-3 py-1.5 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 font-mono text-sm font-bold">
                      {new Date(task.scheduledAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{campName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Bài #{post?.postNumber || 1} ({post?.totalImages || 0} ảnh)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex items-center space-x-2 text-xs font-medium text-slate-300">
                      <Facebook className="w-3.5 h-3.5 text-blue-400" />
                      <span>{page?.pageName || task.pageId}</span>
                    </div>

                    <StatusBadge status={task.status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

