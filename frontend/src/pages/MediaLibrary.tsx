import React, { useEffect, useState, useRef } from 'react';
import {
  Images,
  UploadCloud,
  Trash2,
  Search,
  CheckSquare,
  Square,
  RefreshCw,
  HardDrive,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../services/api.js';
import { MediaAsset } from '../types/index.js';

export const MediaLibrary: React.FC = () => {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (search) params.search = search;
      const res = await api.get('/media', { params });
      setAssets(res.data.data.assets);
    } catch (err) {
      console.error('Error fetching media:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [search]);

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) continue;

      const formData = new FormData();
      formData.append('file', file);

      try {
        await api.post('/media/upload-direct', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }

    setUploading(false);
    fetchAssets();
  };

  const handleDeleteSingle = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa ảnh này?')) return;
    try {
      await api.delete(`/media/${id}`);
      setAssets((prev) => prev.filter((a) => a._id !== id));
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi xóa ảnh');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Bạn có chắc muốn xóa ${selectedIds.length} ảnh đã chọn?`)) return;
    try {
      await api.post('/media/bulk-delete', { ids: selectedIds });
      setAssets((prev) => prev.filter((a) => !selectedIds.includes(a._id)));
      setSelectedIds([]);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi xóa nhiều ảnh');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === assets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(assets.map((a) => a._id));
    }
  };

  const copyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(window.location.origin + url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Thư Viện Hình Ảnh</h1>
          <p className="text-sm text-slate-400 mt-1">
            Quản lý tập trung các tài nguyên hình ảnh, kiểm tra trùng lặp checksum và dung lượng
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{uploading ? 'Đang tải lên...' : 'Tải ảnh lên'}</span>
          </button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên file ảnh..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={selectAll}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            {selectedIds.length === assets.length && assets.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-indigo-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-500" />
            )}
            <span>Chọn tất cả ({assets.length})</span>
          </button>

          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 text-xs font-bold border border-rose-500/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa đã chọn ({selectedIds.length})</span>
            </button>
          )}

          <button
            onClick={fetchAssets}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-24 text-center text-slate-500 text-sm">
          Đang tải thư viện ảnh...
        </div>
      ) : assets.length === 0 ? (
        <div className="py-20 text-center text-slate-400 text-sm bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
          <Images className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="font-semibold text-white">Chưa có hình ảnh nào trong thư viện</p>
          <p className="text-xs text-slate-500 mt-1">
            Bấm vào nút "Tải ảnh lên" ở góc trên để bắt đầu thêm ảnh vào kho
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {assets.map((asset) => {
            const isSelected = selectedIds.includes(asset._id);
            return (
              <div
                key={asset._id}
                className={`group relative rounded-2xl overflow-hidden bg-slate-900 border transition-all flex flex-col ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Image preview */}
                <div className="aspect-square w-full overflow-hidden bg-slate-950 relative">
                  <img
                    src={asset.storageUrl}
                    alt={asset.originalName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Selection checkbox */}
                  <button
                    onClick={() => toggleSelect(asset._id)}
                    className="absolute top-2 left-2 p-1 rounded-lg bg-black/60 text-white hover:bg-black transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-white/80" />
                    )}
                  </button>

                  {/* Action overlays */}
                  <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => copyUrl(asset.storageUrl, asset._id)}
                      className="p-1.5 rounded-lg bg-black/70 hover:bg-black text-slate-300 hover:text-white"
                      title="Sao chép link ảnh"
                    >
                      {copiedId === asset._id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteSingle(asset._id)}
                      className="p-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white"
                      title="Xóa ảnh"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Info Footer */}
                <div className="p-3 bg-slate-900/90 text-[11px] space-y-1">
                  <p className="font-semibold text-slate-200 truncate" title={asset.originalName}>
                    {asset.originalName}
                  </p>
                  <div className="flex justify-between text-slate-500 text-[10px]">
                    <span>{(asset.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                    <span className="uppercase">{asset.mimeType.split('/')[1]}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

