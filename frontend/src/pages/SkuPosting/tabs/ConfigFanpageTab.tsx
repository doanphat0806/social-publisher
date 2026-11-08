import React, { useState } from 'react';
import {
  Facebook,
  FileText,
  Calendar,
  Clock,
  Sparkles,
  Search,
  CheckCircle2,
  ChevronRight,
  Info,
  Layers,
  Settings2,
} from 'lucide-react';
import { FacebookPage } from '../../../types/index.js';

interface ConfigFanpageTabProps {
  campaignName: string;
  setCampaignName: (val: string) => void;
  captionTemplate: string;
  setCaptionTemplate: (val: string) => void;
  priceUnit: 'K' | 'nghìn đồng' | 'VNĐ';
  setPriceUnit: (val: 'K' | 'nghìn đồng' | 'VNĐ') => void;
  showCodeLine: boolean;
  setShowCodeLine: (val: boolean) => void;
  fanpages: FacebookPage[];
  selectedPages: string[];
  setSelectedPages: React.Dispatch<React.SetStateAction<string[]>>;
  scheduleMode: 'immediate' | 'scheduled';
  setScheduleMode: (val: 'immediate' | 'scheduled') => void;
  startDate: string;
  setStartDate: (val: string) => void;
  startTime: string;
  setStartTime: (val: string) => void;
  intervalMinutes: number;
  setIntervalMinutes: (val: number) => void;
  totalProducts: number;
  onNextTab: () => void;
}

export const ConfigFanpageTab: React.FC<ConfigFanpageTabProps> = ({
  campaignName,
  setCampaignName,
  captionTemplate,
  setCaptionTemplate,
  priceUnit,
  setPriceUnit,
  showCodeLine,
  setShowCodeLine,
  fanpages,
  selectedPages,
  setSelectedPages,
  scheduleMode,
  setScheduleMode,
  startDate,
  setStartDate,
  startTime,
  setStartTime,
  intervalMinutes,
  setIntervalMinutes,
  totalProducts,
  onNextTab,
}) => {
  const [pageSearch, setPageSearch] = useState('');

  // Insert variable into template
  const handleInsertVar = (varName: string) => {
    setCaptionTemplate(captionTemplate + ` {${varName}}`);
  };

  // Toggle page selection
  const handleTogglePage = (pageId: string) => {
    setSelectedPages((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    );
  };

  // Select all / Deselect all
  const handleToggleAllPages = () => {
    if (selectedPages.length === fanpages.length) {
      setSelectedPages([]);
    } else {
      setSelectedPages(fanpages.map((p) => p.pageId));
    }
  };

  const filteredPages = fanpages.filter((p) =>
    p.pageName.toLowerCase().includes(pageSearch.toLowerCase())
  );

  // Sample caption render for preview
  const samplePrice = priceUnit === 'K' ? '149' : priceUnit === 'nghìn đồng' ? '149 nghìn đồng' : '149.000 VNĐ';
  let sampleCaption = captionTemplate
    .replace(/\{product_code\}|\{productCode\}/gi, 'GP1903382')
    .replace(/\{price\}K/gi, priceUnit === 'K' ? '149K' : samplePrice)
    .replace(/\{price\}/gi, samplePrice);

  if (!showCodeLine) {
    sampleCaption = sampleCaption
      .split('\n')
      .filter((l) => !/^(?:MS|MÃ)[:\s]*GP1903382$/i.test(l.trim()) && l.trim() !== 'GP1903382')
      .join('\n');
  }

  const totalTasks = totalProducts * selectedPages.length;
  const estimatedHours = ((totalProducts * intervalMinutes) / 60).toFixed(1);

  const handleNext = () => {
    if (!campaignName.trim()) {
      const now = new Date();
      const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      setCampaignName(`Chiến dịch SKU - ${dateStr}`);
    }
    onNextTab();
  };

  return (
    <div className="space-y-8">
      {/* Campaign Name */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            Tên chiến dịch đăng bài theo mã:
          </label>
          <span className="text-[11px] text-slate-500">Tự động gợi ý hoặc chỉnh sửa theo ý bạn</span>
        </div>
        <input
          type="text"
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          placeholder="Ví dụ: Đợt xả kho mùa hè - 100 mã đầm váy"
          className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT COLUMN: CAPTION COMPOSER */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Cấu hình nội dung bài đăng</span>
            </h3>
            <span className="text-xs text-slate-400">Dùng chung cho tất cả mã</span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            {/* Quick Variables */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Chèn biến:</span>
              <button
                type="button"
                onClick={() => handleInsertVar('product_code')}
                className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 rounded-lg text-xs font-mono transition-colors"
              >
                {`{product_code}`}
              </button>
              <button
                type="button"
                onClick={() => handleInsertVar('price')}
                className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 rounded-lg text-xs font-mono transition-colors"
              >
                {`{price}`}
              </button>
            </div>

            {/* Caption Textarea */}
            <textarea
              rows={7}
              value={captionTemplate}
              onChange={(e) => setCaptionTemplate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 font-sans focus:outline-none focus:border-indigo-500 leading-relaxed"
            />

            {/* Options: Unit & Code Line Toggle */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-slate-400">Đơn vị giá:</span>
                {(['K', 'nghìn đồng', 'VNĐ'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setPriceUnit(unit)}
                    className={`px-2.5 py-1 rounded-md font-bold text-xs transition-all ${
                      priceUnit === unit ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>

              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showCodeLine}
                  onChange={(e) => setShowCodeLine(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span className="text-slate-300">Hiển thị dòng mã sản phẩm</span>
              </label>
            </div>

            {/* Live Caption Sample Preview */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Xem trước mẫu caption tự sinh:
              </span>
              <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed font-sans">
                {sampleCaption}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SELECT FANPAGES */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Facebook className="w-4 h-4 text-blue-400" />
              <span>Chọn Fanpage đăng bài ({selectedPages.length}/{fanpages.length})</span>
            </h3>

            {fanpages.length > 0 && (
              <button
                type="button"
                onClick={handleToggleAllPages}
                className="text-xs text-indigo-400 hover:underline font-semibold"
              >
                {selectedPages.length === fanpages.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            {/* Search Fanpages */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm Fanpage..."
                value={pageSearch}
                onChange={(e) => setPageSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Fanpage List */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {filteredPages.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  {fanpages.length === 0
                    ? 'Chưa có Fanpage nào được kết nối. Hãy vào mục "Quản lý Fanpage" để kết nối.'
                    : 'Không tìm thấy Fanpage nào phù hợp.'}
                </p>
              ) : (
                filteredPages.map((page) => {
                  const isSelected = selectedPages.includes(page.pageId);
                  return (
                    <div
                      key={page.pageId}
                      onClick={() => handleTogglePage(page.pageId)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-600/10 border-blue-500/40 text-white'
                          : 'bg-slate-950/70 border-slate-800/80 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-slate-700 text-blue-600 focus:ring-0"
                        />
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center text-white shrink-0">
                          {page.avatarUrl ? (
                            <img src={page.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Facebook className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-100">{page.pageName}</p>
                          <p className="text-[10px] text-slate-500">ID: {page.pageId}</p>
                        </div>
                      </div>

                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                        Sẵn sàng
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SCHEDULE CONFIGURATION CARD */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>Cấu hình lịch đăng bài</span>
          </h3>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setScheduleMode('immediate')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                scheduleMode === 'immediate'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Đăng ngay
            </button>
            <button
              type="button"
              onClick={() => setScheduleMode('scheduled')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                scheduleMode === 'scheduled'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Lên lịch tự động
            </button>
          </div>
        </div>

        {scheduleMode === 'scheduled' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Ngày bắt đầu:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Giờ bắt đầu:</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Khoảng cách giữa các bài:</label>
              <div className="flex items-center space-x-1.5">
                {[5, 10, 15, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setIntervalMinutes(mins)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-all ${
                      intervalMinutes === mins
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-950 border border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    {mins}p
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Schedule Summary Box */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-200">
              Tổng số tác vụ dự kiến:{' '}
              <span className="text-indigo-400 font-bold">{totalProducts} mã</span> &times;{' '}
              <span className="text-blue-400 font-bold">{selectedPages.length} Fanpage</span> ={' '}
              <span className="text-emerald-400 font-bold">{totalTasks} bài đăng</span>
            </p>
            <p className="text-[11px] text-slate-400">
              {scheduleMode === 'immediate'
                ? 'Các bài đăng sẽ được đưa vào hàng đợi BullMQ và lần lượt xuất bản.'
                : `Mỗi Fanpage có lịch đăng độc lập, bài sau cách bài trước ${intervalMinutes} phút. Dự kiến hoàn thành sau ~${estimatedHours} giờ.`}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {selectedPages.length === 0 && (
              <span className="text-xs text-amber-400 font-medium flex items-center space-x-1.5 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                <Info className="w-3.5 h-3.5" />
                <span>Vui lòng chọn ít nhất 1 Fanpage</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={selectedPages.length === 0}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all ${
                selectedPages.length > 0
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/40 cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
              }`}
            >
              <span>Sang bước Xem trước & Xác nhận</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

