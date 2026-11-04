import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  UploadCloud,
  Layers,
  FileText,
  Facebook,
  Calendar,
  Eye,
  CheckCircle2,
  Trash2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  HelpCircle,
  Clock,
  Send,
  Plus,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useCampaignWizardStore } from '../../stores/campaignWizardStore.js';
import { FacebookPage, MediaAsset } from '../../types/index.js';

export const CampaignCreate: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wizard = useCampaignWizardStore();
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [previewSchedule, setPreviewSchedule] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Load connected active pages
    const fetchPages = async () => {
      setLoadingPages(true);
      try {
        const res = await api.get('/facebook/pages?status=active');
        setPages(res.data.data.pages);
      } catch (err) {
        console.error('Failed to load fanpages:', err);
      } finally {
        setLoadingPages(false);
      }
    };
    fetchPages();
  }, []);

  // When reaching Step 7, generate schedule preview from backend
  useEffect(() => {
    if (wizard.currentStep === 7 && wizard.mediaAssets.length > 0 && wizard.selectedPageIds.length > 0) {
      const fetchPreview = async () => {
        try {
          const startDateTime = new Date(`${wizard.startDate}T${wizard.startTime}:00`);
          const res = await api.post('/campaigns/preview', {
            totalImages: wizard.mediaAssets.length,
            imagesPerPost: wizard.imagesPerPost,
            pageIds: wizard.selectedPageIds,
            intervalMinutes: wizard.intervalMinutes,
            startAt: startDateTime.toISOString(),
            timezone: wizard.timezone,
          });
          setPreviewSchedule(res.data.data);
        } catch (err: any) {
          console.error('Error generating preview:', err);
        }
      };
      fetchPreview();
    }
  }, [wizard.currentStep]);

  // Handle Multi-file uploads
  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await api.post('/media/upload-direct', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const asset: MediaAsset = res.data.data.asset;
        wizard.addMediaAsset(asset);
      } catch (err) {
        console.error('Error uploading file:', file.name, err);
      } finally {
        setUploadProgress({ current: i + 1, total: files.length });
      }
    }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Group calculation
  const totalPosts = Math.ceil(wizard.mediaAssets.length / wizard.imagesPerPost);

  // Submit campaign
  const handleSaveCampaign = async (startImmediately: boolean) => {
    try {
      setSubmitting(true);
      setErrorMsg(null);

      const startDateTime = new Date(`${wizard.startDate}T${wizard.startTime}:00`);

      // 1. Create campaign
      const createRes = await api.post('/campaigns', {
        name: wizard.name,
        description: wizard.description,
        caption: wizard.caption,
        imagesPerPost: wizard.imagesPerPost,
        pageIds: wizard.selectedPageIds,
        intervalMinutes: wizard.intervalMinutes,
        startAt: startDateTime.toISOString(),
        timezone: wizard.timezone,
        distributionMode: 'all_pages',
        mediaIds: wizard.mediaAssets.map((m) => m._id),
      });

      const campaign = createRes.data.data.campaign;

      // 2. If start immediately, call start endpoint
      if (startImmediately) {
        await api.post(`/campaigns/${campaign._id}/start`);
      }

      wizard.resetWizard();
      navigate('/campaigns');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Lỗi khi lưu chiến dịch');
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { num: 1, label: 'Thông tin', icon: Sparkles },
    { num: 2, label: 'Upload ảnh', icon: UploadCloud },
    { num: 3, label: 'Chia nhóm', icon: Layers },
    { num: 4, label: 'Nội dung', icon: FileText },
    { num: 5, label: 'Chọn Fanpage', icon: Facebook },
    { num: 6, label: 'Lịch đăng', icon: Calendar },
    { num: 7, label: 'Xem trước', icon: Eye },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Tạo Chiến Dịch Đăng Bài Hàng Loạt</h1>
        <p className="text-sm text-slate-400 mt-1">
          Quy trình 7 bước cấu hình chiến dịch, phân phối ảnh và lên lịch riêng biệt cho từng Fanpage
        </p>
      </div>

      {/* Stepper Navigation */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between overflow-x-auto gap-2">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isCompleted = wizard.currentStep > s.num;
            const isCurrent = wizard.currentStep === s.num;

            return (
              <React.Fragment key={s.num}>
                <div
                  onClick={() => s.num < wizard.currentStep && wizard.setStep(s.num)}
                  className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    isCurrent
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : isCompleted
                      ? 'text-emerald-400 hover:bg-slate-800'
                      : 'text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] ${
                      isCurrent
                        ? 'bg-white/20 text-white'
                        : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                  </div>
                  <span>{s.label}</span>
                </div>
                {idx < steps.length - 1 && <div className="h-0.5 w-4 bg-slate-800 shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Step Content Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 min-h-[420px]">
        {/* STEP 1: THÔNG TIN CHIẾN DỊCH */}
        {wizard.currentStep === 1 && (
          <div className="max-w-2xl space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <span>Bước 1: Thông Tin Cơ Bản Của Chiến Dịch</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Tên chiến dịch <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={wizard.name}
                onChange={(e) => wizard.updateData({ name: e.target.value })}
                placeholder="Ví dụ: SALE THÁNG 11 - XẢ KHO 99K"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Mô tả chiến dịch (Tùy chọn)
              </label>
              <textarea
                rows={3}
                value={wizard.description}
                onChange={(e) => wizard.updateData({ description: e.target.value })}
                placeholder="Ghi chú nội bộ về mục tiêu và lưu ý của chiến dịch..."
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Ngày bắt đầu
                </label>
                <input
                  type="date"
                  value={wizard.startDate}
                  onChange={(e) => wizard.updateData({ startDate: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Giờ bắt đầu
                </label>
                <input
                  type="time"
                  value={wizard.startTime}
                  onChange={(e) => wizard.updateData({ startTime: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Múi giờ
              </label>
              <input
                type="text"
                disabled
                value="Asia/Ho_Chi_Minh (GMT+7)"
                className="w-full px-4 py-2.5 bg-slate-950/50 border border-slate-800/60 rounded-xl text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>
        )}

        {/* STEP 2: UPLOAD ẢNH */}
        {wizard.currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <UploadCloud className="w-5 h-5 text-indigo-400" />
                <span>Bước 2: Tải Lên Hàng Loạt Ảnh (100 - 1000 ảnh)</span>
              </h2>
              <span className="text-sm font-semibold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                Đã tải: {wizard.mediaAssets.length} ảnh
              </span>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-10 text-center cursor-pointer bg-slate-950/40 hover:bg-slate-950/80 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              <UploadCloud className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-white">
                Kéo thả nhiều ảnh vào đây hoặc nhấp để chọn từ máy tính
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Hỗ trợ tải lên cùng lúc hàng trăm ảnh (JPG, JPEG, PNG, WEBP tối đa 20MB/ảnh)
              </p>
            </div>

            {/* Upload Progress Bar */}
            {uploading && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">Đang tải ảnh lên hệ thống...</span>
                  <span className="text-indigo-400">
                    {uploadProgress.current} / {uploadProgress.total} ({Math.round((uploadProgress.current / uploadProgress.total) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 transition-all duration-200"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Images Grid */}
            {wizard.mediaAssets.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Danh sách ảnh đã tải lên:</span>
                  <button
                    onClick={() => wizard.setMediaAssets([])}
                    className="text-rose-400 hover:text-rose-300 font-semibold"
                  >
                    Xóa tất cả
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-[360px] overflow-y-auto p-2 border border-slate-800/80 rounded-xl bg-slate-950/40">
                  {wizard.mediaAssets.map((asset, idx) => (
                    <div
                      key={asset._id}
                      className="group relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 aspect-square"
                    >
                      <img
                        src={asset.storageUrl}
                        alt={asset.originalName}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                        #{idx + 1}
                      </span>
                      <button
                        onClick={() => wizard.removeMediaAsset(asset._id)}
                        className="absolute top-1 right-1 p-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Xóa ảnh này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: CHIA NHÓM ẢNH */}
        {wizard.currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <span>Bước 3: Chia Nhóm Ảnh Thành Các Bài Viết</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Công thức: Tổng số bài = Math.ceil({wizard.mediaAssets.length} ảnh / số ảnh mỗi bài)
              </p>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-slate-300 uppercase">Chọn nhanh:</span>
              {[1, 5, 10, 20].map((preset) => (
                <button
                  key={preset}
                  onClick={() => wizard.updateData({ imagesPerPost: preset })}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    wizard.imagesPerPost === preset
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {preset} ảnh / bài
                </button>
              ))}
              <div className="flex items-center space-x-2 ml-2">
                <span className="text-xs text-slate-400">Tùy chỉnh:</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={wizard.imagesPerPost}
                  onChange={(e) => wizard.updateData({ imagesPerPost: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-20 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-center text-sm text-white"
                />
              </div>
            </div>

            {/* Grouping Summary Badge */}
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-300 font-semibold">Kết quả phân nhóm tự động:</p>
                <p className="text-sm font-bold text-white mt-0.5">
                  Tạo ra <span className="text-indigo-400 font-extrabold text-base">{totalPosts} bài viết</span> từ {wizard.mediaAssets.length} ảnh đã upload.
                </p>
              </div>
              <span className="text-xs text-slate-400">
                {wizard.mediaAssets.length % wizard.imagesPerPost !== 0
                  ? `Bài cuối chứa ${wizard.mediaAssets.length % wizard.imagesPerPost} ảnh còn lại`
                  : 'Mỗi bài có số ảnh đồng đều'}
              </span>
            </div>

            {/* Posts Groups Preview Cards */}
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
              {Array.from({ length: totalPosts }).map((_, postIdx) => {
                const startIdx = postIdx * wizard.imagesPerPost;
                const endIdx = Math.min(startIdx + wizard.imagesPerPost, wizard.mediaAssets.length);
                const postImages = wizard.mediaAssets.slice(startIdx, endIdx);

                return (
                  <div
                    key={postIdx}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white">
                        Bài viết #{postIdx + 1}
                      </span>
                      <span className="text-slate-400">
                        {postImages.length} ảnh (từ ảnh #{startIdx + 1} đến #{endIdx})
                      </span>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {postImages.map((img, i) => (
                        <img
                          key={img._id}
                          src={img.storageUrl}
                          alt="thumb"
                          className="w-16 h-16 rounded-lg object-cover border border-slate-800 shrink-0"
                          title={`Ảnh #${startIdx + i + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4: CAPTION */}
        {wizard.currentStep === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <span>Bước 4: Soạn Nội Dung Caption</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Nội dung caption này sẽ được sử dụng chung cho tất cả các bài viết trong chiến dịch
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Nội dung bài viết (Hỗ trợ Emoji, xuống dòng, Hashtag)
                </label>
                <textarea
                  rows={8}
                  value={wizard.caption}
                  onChange={(e) => wizard.updateData({ caption: e.target.value })}
                  placeholder={`💥 SIÊU KHUYẾN MÃI THÁNG 11 - XẢ KHO ĐỒNG GIÁ 99K!\n\n👉 Cam kết hàng chính hãng 100%\n👉 Miễn phí giao hàng toàn quốc\n👉 Nhắn tin ngay để nhận ưu đãi!\n\n#sale #khuyenmai #hot #xekoxuka`}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-sm leading-relaxed"
                />
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {['💥 SALE 50%', '🔥 HOT DEAL', '🎁 TẶNG QUÀ', '⚡ GIAO NHANH', '📞 LIÊN HỆ NGAY'].map(
                  (badge) => (
                    <button
                      key={badge}
                      type="button"
                      onClick={() => wizard.updateData({ caption: wizard.caption + ' ' + badge })}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >
                      {badge}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Facebook Mockup Preview */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Mô phỏng hiển thị trên Facebook
              </p>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl max-w-sm mx-auto">
                {/* Facebook Post Header */}
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                    FB
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Fanpage Facebook của bạn</p>
                    <p className="text-[10px] text-slate-400">Vừa xong · 🌐 Công khai</p>
                  </div>
                </div>

                {/* Caption preview */}
                <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed mb-3">
                  {wizard.caption || 'Nội dung caption bài viết của bạn sẽ hiển thị ở đây...'}
                </div>

                {/* Photo grid mock */}
                <div className="rounded-xl overflow-hidden border border-slate-800 aspect-video bg-slate-950 flex items-center justify-center text-slate-500 text-xs">
                  {wizard.mediaAssets[0] ? (
                    <img
                      src={wizard.mediaAssets[0].storageUrl}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>Thumbnail ảnh bài viết</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: CHỌN FANPAGE */}
        {wizard.currentStep === 5 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Facebook className="w-5 h-5 text-indigo-400" />
                  <span>Bước 5: Chọn Các Fanpage Nhận Bài Đăng</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Mỗi bài viết sẽ được phân phối và đăng lên tất cả Fanpage được chọn theo lịch độc lập
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => wizard.selectAllPages(pages.map((p) => p.pageId))}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={wizard.clearSelectedPages}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
                >
                  Bỏ chọn tất cả
                </button>
              </div>
            </div>

            {loadingPages ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                Đang tải danh sách Fanpage...
              </div>
            ) : pages.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                Chưa có Fanpage nào được kết nối. Vui lòng vào trang "Quản lý Fanpage" để kết nối tài khoản.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pages.map((page) => {
                  const isSelected = wizard.selectedPageIds.includes(page.pageId);
                  return (
                    <div
                      key={page._id}
                      onClick={() => wizard.togglePageSelection(page.pageId)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center space-x-3.5 select-none ${
                        isSelected
                          ? 'bg-indigo-600/10 border-indigo-500 shadow-md shadow-indigo-500/10'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by card click
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                      />
                      {page.avatarUrl ? (
                        <img
                          src={page.avatarUrl}
                          alt={page.pageName}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-800"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                          <Facebook className="w-5 h-5" />
                        </div>
                      )}
                      <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-bold text-white truncate">{page.pageName}</p>
                        <p className="text-[10px] text-slate-500 font-mono">ID: {page.pageId}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STEP 6: LỊCH ĐĂNG BÀI */}
        {wizard.currentStep === 6 && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <span>Bước 6: Cấu Hình Khoảng Cách Và Lịch Đăng</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Mỗi Fanpage có lịch đăng riêng biệt. Các Fanpage hoạt động độc lập và song song.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Khoảng cách giữa 2 bài viết liên tiếp (Phút)
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={wizard.intervalMinutes}
                  onChange={(e) =>
                    wizard.updateData({ intervalMinutes: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                  className="w-32 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-center font-bold text-base focus:outline-none focus:border-indigo-500"
                />
                <span className="text-sm text-slate-400">phút giữa mỗi bài viết</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <p className="text-xs font-semibold text-slate-300 uppercase">Minh họa lịch đăng:</p>
              <p className="text-xs text-slate-400">
                Nếu bài đầu tiên đăng lúc <strong className="text-white">{wizard.startTime}</strong>, bài thứ hai sẽ đăng lúc{' '}
                <strong className="text-white">
                  {new Date(
                    new Date(`2000-01-01T${wizard.startTime}:00`).getTime() + wizard.intervalMinutes * 60000
                  ).toTimeString().slice(0, 5)}
                </strong>
                , bài thứ ba lúc{' '}
                <strong className="text-white">
                  {new Date(
                    new Date(`2000-01-01T${wizard.startTime}:00`).getTime() + wizard.intervalMinutes * 2 * 60000
                  ).toTimeString().slice(0, 5)}
                </strong>
                ...
              </p>
            </div>
          </div>
        )}

        {/* STEP 7: XEM TRƯỚC CHIẾN DỊCH */}
        {wizard.currentStep === 7 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Eye className="w-5 h-5 text-indigo-400" />
                <span>Bước 7: Xem Trước Toàn Bộ Chiến Dịch</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Kiểm tra kỹ lưỡng các thông số trước khi lưu bản nháp hoặc bấm bắt đầu chạy
              </p>
            </div>

            {/* Metrics Summary Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Tổng số ảnh</p>
                <p className="text-lg font-bold text-white mt-1">{wizard.mediaAssets.length}</p>
              </div>
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Ảnh mỗi bài</p>
                <p className="text-lg font-bold text-white mt-1">{wizard.imagesPerPost}</p>
              </div>
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Tổng số bài</p>
                <p className="text-lg font-bold text-indigo-400 mt-1">{totalPosts}</p>
              </div>
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Số Fanpage</p>
                <p className="text-lg font-bold text-blue-400 mt-1">{wizard.selectedPageIds.length}</p>
              </div>
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Khoảng cách</p>
                <p className="text-lg font-bold text-white mt-1">{wizard.intervalMinutes} phút</p>
              </div>
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Tổng lượt đăng</p>
                <p className="text-lg font-bold text-emerald-400 mt-1">
                  {totalPosts * wizard.selectedPageIds.length}
                </p>
              </div>
            </div>

            {/* Schedule Table Preview */}
            {previewSchedule?.posts && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Bảng Lịch Đăng Dự Kiến Riêng Từng Fanpage
                </p>
                <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Bài viết</th>
                        <th className="px-4 py-3 font-semibold">Số ảnh</th>
                        {wizard.selectedPageIds.map((pageId) => {
                          const page = pages.find((p) => p.pageId === pageId);
                          return (
                            <th key={pageId} className="px-4 py-3 font-semibold">
                              {page?.pageName || pageId}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {previewSchedule.posts.map((p: any) => (
                        <tr key={p.postNumber} className="hover:bg-slate-900/40">
                          <td className="px-4 py-3 font-bold text-white">Bài #{p.postNumber}</td>
                          <td className="px-4 py-3 text-slate-400">{p.imageCount} ảnh</td>
                          {p.schedules.map((s: any) => (
                            <td key={s.pageId} className="px-4 py-3 text-slate-300 font-mono">
                              {new Date(s.scheduledAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Wizard Bottom Controls */}
      <div className="flex justify-between items-center bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        {wizard.currentStep > 1 ? (
          <button
            type="button"
            onClick={wizard.prevStep}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center space-x-3">
          {wizard.currentStep === 7 ? (
            <>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSaveCampaign(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all disabled:opacity-50"
              >
                Lưu bản nháp
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSaveCampaign(true)}
                className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Đang lưu...' : 'Xác nhận chạy chiến dịch'}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                // Validation before proceeding
                if (wizard.currentStep === 1 && !wizard.name.trim()) {
                  alert('Vui lòng nhập tên chiến dịch');
                  return;
                }
                if (wizard.currentStep === 2 && wizard.mediaAssets.length === 0) {
                  alert('Vui lòng tải lên ít nhất 1 hình ảnh');
                  return;
                }
                if (wizard.currentStep === 5 && wizard.selectedPageIds.length === 0) {
                  alert('Vui lòng chọn ít nhất 1 Fanpage nhận bài');
                  return;
                }
                wizard.nextStep();
              }}
              className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
            >
              <span>Tiếp tục</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

