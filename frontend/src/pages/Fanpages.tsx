import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Facebook,
  RefreshCw,
  Plus,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Trash2,
  ExternalLink,
  Search,
  Key,
  HelpCircle,
  X,
  Send,
} from 'lucide-react';
import { api } from '../services/api.js';
import { FacebookPage, FacebookAccount } from '../types/index.js';

export const Fanpages: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  // Direct Token Import Modal State
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [inputToken, setInputToken] = useState('');
  const [importingToken, setImportingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Check URL query params for oauth redirect feedback
  useEffect(() => {
    if (searchParams.get('connected')) {
      const count = searchParams.get('count') || 'các';
      setMessage(`Kết nối Facebook thành công! Đã đồng bộ ${count} Fanpage.`);
    } else if (searchParams.get('error')) {
      setMessage(`Lỗi khi kết nối Facebook: ${searchParams.get('error')}`);
    }
  }, [searchParams]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pagesRes, accountsRes] = await Promise.all([
        api.get('/facebook/pages'),
        api.get('/facebook/accounts'),
      ]);
      setPages(pagesRes.data.data.pages);
      setAccounts(accountsRes.data.data.accounts);
    } catch (err) {
      console.error('Error fetching Facebook data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConnectFacebook = async () => {
    try {
      const res = await api.get('/facebook/oauth/start');
      if (res.data.data?.authUrl) {
        window.location.href = res.data.data.authUrl;
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể tạo liên kết kết nối Facebook');
    }
  };

  const handleImportToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) {
      setTokenError('Vui lòng dán Access Token vào ô bên dưới');
      return;
    }

    try {
      setImportingToken(true);
      setTokenError(null);

      const res = await api.post('/facebook/import-token', {
        accessToken: inputToken.trim(),
      });

      setMessage(res.data.message || 'Lưu token và đồng bộ Fanpage thành công!');
      setShowTokenModal(false);
      setInputToken('');
      await loadData();
    } catch (err: any) {
      setTokenError(err.response?.data?.message || 'Lỗi khi xác thực hoặc lưu Token');
    } finally {
      setImportingToken(false);
    }
  };

  const handleSyncPages = async () => {
    try {
      setSyncing(true);
      const res = await api.post('/facebook/sync-pages');
      setMessage(res.data.message || 'Đồng bộ Fanpage thành công!');
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi đồng bộ Fanpage');
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckPermission = async (pageId: string) => {
    try {
      const res = await api.post(`/facebook/pages/${pageId}/check-permissions`);
      if (res.data.success) {
        alert('Token và quyền đăng bài của Fanpage đang hoạt động tốt!');
      } else {
        alert(`Cảnh báo quyền: ${res.data.message}`);
      }
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi kiểm tra quyền');
    }
  };

  const handleDisconnectAccount = async (accountId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn ngắt kết nối tài khoản Facebook này? Tất cả Fanpage liên quan sẽ bị gỡ bỏ.')) {
      return;
    }
    try {
      await api.delete(`/facebook/accounts/${accountId}`);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi ngắt kết nối tài khoản');
    }
  };

  const filteredPages = pages.filter((page) =>
    page.pageName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Quản Lý Fanpage Facebook</h1>
          <p className="text-sm text-slate-400 mt-1">
            Kết nối Facebook bằng OAuth hoặc nhập trực tiếp Access Token lưu an toàn vào Database
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSyncPages}
            disabled={syncing || accounts.length === 0}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-medium text-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Đang đồng bộ...' : 'Đồng bộ lại'}</span>
          </button>

          {/* Button: Nhập Token Trực Tiếp */}
          <button
            onClick={() => setShowTokenModal(true)}
            className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Key className="w-4 h-4" />
            <span>Nhập Access Token</span>
          </button>

          {/* Button: Kết Nối OAuth */}
          <button
            onClick={handleConnectFacebook}
            className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-600/30 transition-all"
            title="Đăng nhập qua Facebook OAuth Dialog"
          >
            <Facebook className="w-4 h-4" />
            <span>Kết nối OAuth</span>
          </button>
        </div>
      </div>

      {/* Alert message if any */}
      {message && (
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Connected Accounts Section */}
      {accounts.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Tài Khoản Facebook Đã Kết Nối ({accounts.length})
          </h3>
          <div className="flex flex-wrap gap-4">
            {accounts.map((acc) => (
              <div
                key={acc._id}
                className="flex items-center space-x-3 px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
                  <Facebook className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{acc.facebookName}</p>
                  <p className="text-[10px] text-slate-400">ID: {acc.facebookUserId}</p>
                </div>
                <button
                  onClick={() => handleDisconnectAccount(acc._id)}
                  title="Ngắt kết nối tài khoản"
                  className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors ml-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm Fanpage theo tên..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Fanpage Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-sm">
          Đang tải danh sách Fanpage...
        </div>
      ) : filteredPages.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
          <Facebook className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white">Chưa có Fanpage nào được lưu trong Database</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mt-2">
            Bạn có thể bấm vào nút "Nhập Access Token" ở trên để dán mã Token lấy từ Graph API Explorer hoặc bấm "Kết nối OAuth".
          </p>
          <div className="mt-6 flex justify-center items-center space-x-4">
            <button
              onClick={() => setShowTokenModal(true)}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30"
            >
              <Key className="w-4 h-4" />
              <span>Nhập Token Ngay</span>
            </button>
            <button
              onClick={handleConnectFacebook}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-semibold text-sm transition-all"
            >
              <Facebook className="w-4 h-4" />
              <span>Kết nối OAuth</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPages.map((page) => (
            <div
              key={page._id}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start space-x-3.5">
                  {page.avatarUrl ? (
                    <img
                      src={page.avatarUrl}
                      alt={page.pageName}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-800"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <Facebook className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 overflow-hidden">
                    <h4 className="font-bold text-sm text-white truncate" title={page.pageName}>
                      {page.pageName}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {page.pageId}</p>
                    <span className="inline-block mt-1 text-[10px] uppercase font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded">
                      {page.pageCategory || 'Fanpage'}
                    </span>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Trạng thái quyền:</span>
                  {page.status === 'active' ? (
                    <span className="inline-flex items-center space-x-1 text-emerald-400 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Sẵn sàng đăng bài</span>
                    </span>
                  ) : page.status === 'expired' ? (
                    <span className="inline-flex items-center space-x-1 text-rose-400 font-medium">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Token hết hạn</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-yellow-400 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Thiếu quyền</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <button
                  onClick={() => handleCheckPermission(page._id)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Kiểm tra token</span>
                </button>
                <a
                  href={`https://facebook.com/${page.pageId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1"
                >
                  <span>Mở Page</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: NHẬP ACCESS TOKEN TRỰC TIẾP */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowTokenModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-3">
                <Key className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">Nhập Facebook Access Token</h2>
              <p className="text-xs text-slate-400 mt-1">
                Dán User Access Token hoặc Page Access Token để hệ thống tự động tải thông tin Fanpage, mã hóa AES-256-GCM và lưu vào Database.
              </p>
            </div>

            {tokenError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{tokenError}</span>
              </div>
            )}

            <form onSubmit={handleImportToken} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Access Token Facebook (EAAB... hoặc EAA...)
                </label>
                <textarea
                  rows={4}
                  required
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  placeholder="Dán token Facebook của bạn vào đây (User Token hoặc Page Token)..."
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 font-mono text-xs focus:outline-none focus:border-indigo-500 break-all"
                />
              </div>

              {/* Guide Box */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs text-slate-400">
                <p className="font-semibold text-slate-300 flex items-center space-x-1.5">
                  <HelpCircle className="w-4 h-4 text-indigo-400" />
                  <span>Cách lấy Token nhanh nhất:</span>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-slate-400 pl-1">
                  <li>
                    Truy cập công cụ chính thức của Meta:{' '}
                    <a
                      href="https://developers.facebook.com/tools/explorer/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline font-semibold"
                    >
                      Graph API Explorer &rarr;
                    </a>
                  </li>
                  <li>Chọn App của bạn (ví dụ: <code className="text-slate-300">DB CONNECTOR</code>).</li>
                  <li>
                    Bấm mục <strong>Add a Permission</strong> và chọn 3 quyền: <code className="text-indigo-300">pages_show_list</code>, <code className="text-indigo-300">pages_read_engagement</code>, <code className="text-indigo-300">pages_manage_posts</code>.
                  </li>
                  <li>Bấm nút <strong>Generate Access Token</strong> và copy dán vào ô trên.</li>
                </ol>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={importingToken}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{importingToken ? 'Đang xác thực & Lưu...' : 'Xác thực & Lưu vào Database'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
