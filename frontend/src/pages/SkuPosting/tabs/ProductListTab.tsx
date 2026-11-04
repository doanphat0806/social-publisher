import React, { useState } from 'react';
import {
  FileSpreadsheet,
  ClipboardPaste,
  Plus,
  Trash2,
  Edit2,
  Check,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import { parseExcelText } from '../../../utils/excelParser.js';
import { SkuGroup } from './UploadImagesTab.js';

interface ProductListTabProps {
  groups: SkuGroup[];
  setGroups: React.Dispatch<React.SetStateAction<SkuGroup[]>>;
  imagesPerPost: number;
  onNextTab: () => void;
  priceUnit: 'K' | 'nghìn đồng' | 'VNĐ';
}

export const ProductListTab: React.FC<ProductListTabProps> = ({
  groups,
  setGroups,
  imagesPerPost,
  onNextTab,
  priceUnit,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'missing' | 'excess' | 'no_images' | 'no_price'>('all');

  // Modal states
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newPrice, setNewPrice] = useState<number | ''>('');

  // Editing state
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editPriceVal, setEditPriceVal] = useState<number>(0);

  // Bulk set price state
  const [showBulkPrice, setShowBulkPrice] = useState(false);
  const [bulkPriceVal, setBulkPriceVal] = useState<number | ''>('');

  // Handle Copy-Paste from Excel
  const handleApplyPaste = () => {
    if (!pasteContent.trim()) return;
    const parsedRows = parseExcelText(pasteContent);

    if (parsedRows.length === 0) {
      alert('Không nhận diện được dòng dữ liệu nào từ nội dung dán');
      return;
    }

    setGroups((prev) => {
      const map = new Map<string, SkuGroup>();
      prev.forEach((g) => map.set(g.productCode, { ...g }));

      for (const row of parsedRows) {
        if (!row.product_code) continue;
        const code = row.product_code.toUpperCase().trim();

        if (map.has(code)) {
          const item = map.get(code)!;
          item.price = row.price;
          item.inExcel = true;
        } else {
          // SKU in Excel without photos
          map.set(code, {
            productCode: code,
            price: row.price,
            imageCount: 0,
            targetCount: imagesPerPost,
            status: 'no_images',
            files: [],
            inExcel: true,
          });
        }
      }

      return Array.from(map.values());
    });

    setShowPasteModal(false);
    setPasteContent('');
  };

  // Add single SKU manually
  const handleAddSku = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCode.trim().toUpperCase();
    if (!code) return;

    setGroups((prev) => {
      if (prev.some((g) => g.productCode === code)) {
        alert(`Mã sản phẩm ${code} đã tồn tại trong danh sách`);
        return prev;
      }

      const newItem: SkuGroup = {
        productCode: code,
        price: typeof newPrice === 'number' ? newPrice : 0,
        imageCount: 0,
        targetCount: imagesPerPost,
        status: 'no_images',
        files: [],
        inExcel: true,
      };

      return [...prev, newItem];
    });

    setNewCode('');
    setNewPrice('');
    setShowAddModal(false);
  };

  // Remove SKU
  const handleDeleteSku = (code: string) => {
    if (confirm(`Bạn có chắc muốn xóa mã sản phẩm ${code}?`)) {
      setGroups((prev) => prev.filter((g) => g.productCode !== code));
    }
  };

  // Save inline edit price
  const handleSavePrice = (code: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.productCode === code ? { ...g, price: editPriceVal } : g))
    );
    setEditingCode(null);
  };

  // Apply bulk price
  const handleApplyBulkPrice = () => {
    if (typeof bulkPriceVal !== 'number') return;
    setGroups((prev) => prev.map((g) => ({ ...g, price: bulkPriceVal })));
    setShowBulkPrice(false);
  };

  // Filtered rows
  const filteredList = groups.filter((g) => {
    if (g.productCode === 'Chưa phân loại') return false;
    const matchesSearch = g.productCode.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === 'ready') return g.imageCount === imagesPerPost;
    if (statusFilter === 'missing') return g.imageCount > 0 && g.imageCount < imagesPerPost;
    if (statusFilter === 'excess') return g.imageCount > imagesPerPost;
    if (statusFilter === 'no_images') return g.imageCount === 0;
    if (statusFilter === 'no_price') return g.price === 0;

    return true;
  });

  const totalWithoutPrice = groups.filter((g) => g.productCode !== 'Chưa phân loại' && g.price === 0).length;
  const totalNoImages = groups.filter((g) => g.productCode !== 'Chưa phân loại' && g.imageCount === 0).length;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Danh Sách Mã Sản Phẩm & Giá Bán</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ghép mã ảnh với bảng giá Excel/CSV. Kiểm tra số lượng ảnh trước khi cấu hình bài đăng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Button: Dán từ Excel */}
          <button
            type="button"
            onClick={() => setShowPasteModal(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 transition-all"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Dán từ Excel</span>
          </button>

          {/* Button: Đặt giá đồng loạt */}
          <button
            type="button"
            onClick={() => setShowBulkPrice(!showBulkPrice)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-all"
          >
            <span>Áp giá chung</span>
          </button>

          {/* Button: Thêm thủ công */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-md shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm mã SP</span>
          </button>
        </div>
      </div>

      {/* Bulk Price Input Box (if open) */}
      {showBulkPrice && (
        <div className="p-4 rounded-xl bg-slate-900 border border-indigo-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-300 font-semibold">Nhập giá áp dụng cho tất cả mã ({priceUnit}):</span>
            <input
              type="number"
              value={bulkPriceVal}
              onChange={(e) => setBulkPriceVal(e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="Ví dụ: 149000"
              className="w-36 px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white"
            />
            <button
              type="button"
              onClick={handleApplyBulkPrice}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg"
            >
              Áp dụng tất cả
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowBulkPrice(false)}
            className="text-xs text-slate-400 hover:text-white"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Warnings & Alerts */}
      {(totalWithoutPrice > 0 || totalNoImages > 0) && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Lưu ý:{' '}
              {totalWithoutPrice > 0 && <strong className="underline mr-2">{totalWithoutPrice} mã chưa có giá bán.</strong>}
              {totalNoImages > 0 && <strong>{totalNoImages} mã trong Excel chưa có ảnh tương ứng.</strong>}
            </span>
          </div>
          <span className="text-[11px] text-amber-400/80">Bạn vẫn có thể tiếp tục hoặc sửa đổi bất kỳ lúc nào.</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo mã sản phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] text-slate-400 uppercase font-semibold mr-1">Lọc:</span>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'ready', label: `Đủ ${imagesPerPost} ảnh` },
            { id: 'missing', label: 'Thiếu ảnh' },
            { id: 'excess', label: 'Thừa ảnh' },
            { id: 'no_images', label: 'Chưa có ảnh' },
            { id: 'no_price', label: 'Chưa có giá' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === f.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3.5 px-4 w-12 text-center">STT</th>
              <th className="py-3.5 px-4">Mã sản phẩm</th>
              <th className="py-3.5 px-4">Giá bán ({priceUnit})</th>
              <th className="py-3.5 px-4">Số ảnh</th>
              <th className="py-3.5 px-4">Ảnh thu nhỏ</th>
              <th className="py-3.5 px-4">Trạng thái</th>
              <th className="py-3.5 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-500">
                  Không tìm thấy mã sản phẩm nào phù hợp
                </td>
              </tr>
            ) : (
              filteredList.map((item, idx) => {
                const isReady = item.imageCount === imagesPerPost;
                const isMissing = item.imageCount > 0 && item.imageCount < imagesPerPost;
                const isExcess = item.imageCount > imagesPerPost;
                const isNoImages = item.imageCount === 0;

                return (
                  <tr key={item.productCode} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-center text-slate-500 font-mono">{idx + 1}</td>

                    {/* Product Code */}
                    <td className="py-3 px-4 font-bold text-slate-100 tracking-wide">
                      <span className="font-mono text-indigo-300">{item.productCode}</span>
                    </td>

                    {/* Price with inline edit */}
                    <td className="py-3 px-4">
                      {editingCode === item.productCode ? (
                        <div className="flex items-center space-x-1.5">
                          <input
                            type="number"
                            value={editPriceVal}
                            onChange={(e) => setEditPriceVal(parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 bg-slate-950 border border-indigo-500 rounded text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleSavePrice(item.productCode)}
                            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setEditingCode(item.productCode);
                            setEditPriceVal(item.price);
                          }}
                          className="cursor-pointer group flex items-center space-x-2"
                        >
                          <span className={`font-semibold ${item.price === 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {item.price > 0 ? item.price.toLocaleString('vi-VN') : '0 (Chưa có giá)'}
                          </span>
                          <Edit2 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </td>

                    {/* Image Count */}
                    <td className="py-3 px-4 font-semibold text-slate-300">
                      <span>{item.imageCount} / {imagesPerPost}</span>
                    </td>

                    {/* Thumbnails preview */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1">
                        {item.files.slice(0, 4).map((f) => (
                          <div
                            key={f.fileName}
                            className="w-7 h-7 rounded-md overflow-hidden bg-slate-950 border border-slate-800"
                          >
                            <img src={f.url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                        {item.files.length > 4 && (
                          <span className="text-[10px] text-slate-400 font-bold">+{item.files.length - 4}</span>
                        )}
                        {item.files.length === 0 && (
                          <span className="text-[10px] text-slate-600 italic">Không có ảnh</span>
                        )}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">
                      {isReady && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Đủ {imagesPerPost} ảnh</span>
                        </span>
                      )}
                      {isMissing && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Thiếu ảnh ({item.imageCount})</span>
                        </span>
                      )}
                      {isExcess && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          <span>Thừa ảnh ({item.imageCount})</span>
                        </span>
                      )}
                      {isNoImages && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3 h-3" />
                          <span>Chưa có ảnh</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteSku(item.productCode)}
                        title="Xóa mã sản phẩm này"
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Bar: Next Step */}
      <div className="flex justify-between items-center pt-2">
        <p className="text-xs text-slate-500">
          Tổng cộng: <strong>{filteredList.length}</strong> mã hiển thị
        </p>

        <button
          type="button"
          onClick={onNextTab}
          disabled={groups.length === 0}
          className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
        >
          <span>Sang bước Cấu hình nội dung & Fanpage</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* MODAL: DÁN DỮ LIỆU TỪ EXCEL */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <ClipboardPaste className="w-4 h-4 text-emerald-400" />
                <span>Dán danh sách Mã sản phẩm & Giá bán từ Excel</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Copy 2 cột (Cột 1: Mã sản phẩm, Cột 2: Giá bán) từ Excel rồi dán (Ctrl+V) vào ô bên dưới.
              </p>
            </div>

            <textarea
              rows={8}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="GP1903382	149000&#10;GP1903383	129000&#10;GP1903384	159000"
              className="w-full px-3.5 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
            />

            <div className="flex justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApplyPaste}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30"
              >
                Nhập dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: THÊM MÃ THỦ CÔNG */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddSku}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-white">Thêm mã sản phẩm mới</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Mã sản phẩm:</label>
                <input
                  type="text"
                  required
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Ví dụ: GP1903382"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white uppercase focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Giá bán ({priceUnit}):</label>
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="Ví dụ: 149000"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
              >
                Thêm vào danh sách
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

