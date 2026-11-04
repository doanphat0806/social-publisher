import React, { useState } from 'react';
import {
  Facebook,
  Clock,
  Sparkles,
  Edit2,
  Check,
  EyeOff,
  Rocket,
  ChevronLeft,
  Calendar,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';
import { SkuGroup } from './UploadImagesTab.js';
import { FacebookPage } from '../../../types/index.js';

export interface PreviewPostItem {
  productCode: string;
  pageId: string;
  pageName: string;
  pageAvatar?: string;
  price: number;
  formattedPrice: string;
  caption: string;
  images: any[];
  scheduledAt: string | Date;
  skipped?: boolean;
}

interface PreviewPostsTabProps {
  previewPosts: PreviewPostItem[];
  setPreviewPosts: React.Dispatch<React.SetStateAction<PreviewPostItem[]>>;
  selectedPages: string[];
  fanpages: FacebookPage[];
  onLaunchCampaign: () => Promise<void>;
  launching: boolean;
  onBackTab: () => void;
}

export const PreviewPostsTab: React.FC<PreviewPostsTabProps> = ({
  previewPosts,
  setPreviewPosts,
  selectedPages,
  fanpages,
  onLaunchCampaign,
  launching,
  onBackTab,
}) => {
  const [filterPageId, setFilterPageId] = useState<string>('all');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editCaptionText, setEditCaptionText] = useState<string>('');

  const handleToggleSkip = (idx: number) => {
    setPreviewPosts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, skipped: !p.skipped } : p))
    );
  };

  const handleStartEdit = (idx: number, currentCaption: string) => {
    setEditingIndex(idx);
    setEditCaptionText(currentCaption);
  };

  const handleSaveEdit = (idx: number) => {
    setPreviewPosts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, caption: editCaptionText } : p))
    );
    setEditingIndex(null);
  };

  const filteredPosts = previewPosts.filter((p) => {
    if (filterPageId !== 'all' && p.pageId !== filterPageId) return false;
    return true;
  });

  const activePostsCount = previewPosts.filter((p) => !p.skipped).length;
  const skippedCount = previewPosts.filter((p) => p.skipped).length;

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>Xem Trước Bài Đăng Facebook ({activePostsCount} bài sẵn sàng)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Mô phỏng chính xác giao diện bài viết trên từng Fanpage trước khi hệ thống bắt đầu đăng.
          </p>
        </div>

        {/* Filter by Page */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 font-semibold">Xem theo Page:</span>
          <select
            value={filterPageId}
            onChange={(e) => setFilterPageId(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
          >
            <option value="all">Tất cả Fanpage ({selectedPages.length})</option>
            {fanpages
              .filter((p) => selectedPages.includes(p.pageId))
              .map((p) => (
                <option key={p.pageId} value={p.pageId}>
                  {p.pageName}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Posts Mockup Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredPosts.map((post, idx) => {
          const isSkipped = !!post.skipped;
          const isEditing = editingIndex === idx;

          return (
            <div
              key={`${post.pageId}_${post.productCode}_${idx}`}
              className={`rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${
                isSkipped
                  ? 'bg-slate-950/40 border-slate-800/50 opacity-50'
                  : 'bg-slate-900 border-slate-800 shadow-xl hover:border-slate-700'
              }`}
            >
              <div>
                {/* Facebook Mockup Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center text-white shrink-0">
                      {post.pageAvatar ? (
                        <img src={post.pageAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Facebook className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white truncate max-w-[170px]">{post.pageName}</p>
                      <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>{new Date(post.scheduledAt).toLocaleString('vi-VN')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleToggleSkip(idx)}
                      title={isSkipped ? 'Bỏ qua bài này' : 'Khôi phục bài'}
                      className={`p-1.5 rounded-lg text-xs transition-colors ${
                        isSkipped ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:text-white'
                      }`}
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* SKU Code & Price Pill */}
                <div className="px-4 py-2 bg-slate-950/80 flex items-center justify-between text-xs border-b border-slate-800/80">
                  <span className="font-mono font-bold text-indigo-400">Mã: {post.productCode}</span>
                  <span className="font-bold text-emerald-400">Giá: {post.formattedPrice}</span>
                </div>

                {/* Post Caption Body */}
                <div className="p-4 space-y-2">
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        rows={5}
                        value={editCaptionText}
                        onChange={(e) => setEditCaptionText(e.target.value)}
                        className="w-full p-2.5 bg-slate-950 border border-indigo-500 rounded-xl text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(idx)}
                        className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center space-x-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Lưu caption</span>
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleStartEdit(idx, post.caption)}
                      className="group cursor-pointer relative"
                    >
                      <p className="text-xs text-slate-200 whitespace-pre-line line-clamp-6 leading-relaxed font-sans">
                        {post.caption}
                      </p>
                      <span className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 flex items-center space-x-1 mt-1 transition-opacity">
                        <Edit2 className="w-2.5 h-2.5" />
                        <span>Bấm để chỉnh sửa</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* 4-Image Grid Mockup */}
                <div className="px-4 pb-4">
                  {post.images && post.images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1.5 rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                      {post.images.slice(0, 4).map((img, i) => (
                        <div key={i} className="aspect-square bg-slate-900 relative">
                          <img
                            src={img.url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {i === 3 && post.images.length > 4 && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-sm">
                              +{post.images.length - 4}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-600 border border-dashed border-slate-800 rounded-xl text-xs">
                      Không có ảnh đính kèm
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer status */}
              <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-[11px] flex items-center justify-between text-slate-400">
                <span>{post.images?.length || 0} ảnh đính kèm</span>
                {isSkipped ? (
                  <span className="text-amber-400 font-bold">Đã bỏ qua</span>
                ) : (
                  <span className="text-emerald-400 font-semibold">Sẵn sàng xuất bản</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation & Launch Bottom Bar */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
        <button
          type="button"
          onClick={onBackTab}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center space-x-1.5 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Quay lại chỉnh cấu hình</span>
        </button>

        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white">
              Xuất bản {activePostsCount} bài viết lên {selectedPages.length} Fanpage
            </p>
            {skippedCount > 0 && (
              <p className="text-[11px] text-amber-400">{skippedCount} bài viết được chọn bỏ qua</p>
            )}
          </div>

          <button
            type="button"
            onClick={onLaunchCampaign}
            disabled={launching || activePostsCount === 0}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/40 flex items-center space-x-2.5 transition-all disabled:opacity-50"
          >
            <Rocket className={`w-5 h-5 ${launching ? 'animate-bounce' : ''}`} />
            <span>{launching ? 'Đang khởi tạo chiến dịch...' : 'XÁC NHẬN & BẮT ĐẦU XUẤT BẢN'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

