import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FolderOpen,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Trash2,
  Sliders,
  ChevronRight,
  Layers,
  Sparkles,
} from 'lucide-react';

export interface SkuImageItem {
  mediaAssetId?: string;
  fileName: string;
  originalName: string;
  url: string;
  imageIndex: number;
  file?: File;
}

export interface SkuGroup {
  productCode: string;
  price: number;
  imageCount: number;
  targetCount: number;
  status: 'ready' | 'missing_images' | 'excess_images' | 'no_images';
  files: SkuImageItem[];
  inExcel?: boolean;
}

interface UploadImagesTabProps {
  groups: SkuGroup[];
  setGroups: React.Dispatch<React.SetStateAction<SkuGroup[]>>;
  imagesPerPost: number;
  setImagesPerPost: (val: number) => void;
  onNextTab: () => void;
  onScanServer: (files: File[]) => Promise<void>;
  scanning: boolean;
}

export const UploadImagesTab: React.FC<UploadImagesTabProps> = ({
  groups,
  setGroups,
  imagesPerPost,
  setImagesPerPost,
  onNextTab,
  onScanServer,
  scanning,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [showAdvancedRegex, setShowAdvancedRegex] = useState(false);
  const [customRegex, setCustomRegex] = useState('');
  const [unclassifiedCodeInput, setUnclassifiedCodeInput] = useState<{ [fileName: string]: string }>({});

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      await onScanServer(filesArray);
      e.target.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/')
      );
      if (filesArray.length > 0) {
        await onScanServer(filesArray);
      }
    }
  };

  const handleRemoveImage = (productCode: string, fileName: string) => {
    setGroups((prev) =>
      prev
        .map((g) => {
          if (g.productCode !== productCode) return g;
          const updatedFiles = g.files.filter((f) => f.fileName !== fileName);
          const newStatus: 'ready' | 'missing_images' | 'excess_images' =
            updatedFiles.length === imagesPerPost
              ? 'ready'
              : updatedFiles.length < imagesPerPost
              ? 'missing_images'
              : 'excess_images';
          return {
            ...g,
            files: updatedFiles,
            imageCount: updatedFiles.length,
            status: newStatus,
          };
        })
        .filter((g) => g.files.length > 0)
    );
  };

  const handleAssignUnclassified = (oldFileName: string) => {
    const newCode = (unclassifiedCodeInput[oldFileName] || '').trim().toUpperCase();
    if (!newCode) return;

    setGroups((prev) => {
      const unclassifiedGroup = prev.find((g) => g.productCode === 'Chưa phân loại');
      if (!unclassifiedGroup) return prev;

      const fileItem = unclassifiedGroup.files.find((f) => f.fileName === oldFileName);
      if (!fileItem) return prev;

      const restUnclassified = unclassifiedGroup.files.filter((f) => f.fileName !== oldFileName);

      let targetGroup = prev.find((g) => g.productCode === newCode);
      let updatedGroups: SkuGroup[];

      if (targetGroup) {
        const newFiles = [...targetGroup.files, { ...fileItem, imageIndex: targetGroup.files.length + 1 }];
        const newStatus: 'ready' | 'missing_images' | 'excess_images' =
          newFiles.length === imagesPerPost
            ? 'ready'
            : newFiles.length < imagesPerPost
            ? 'missing_images'
            : 'excess_images';
        updatedGroups = prev.map((g) =>
          g.productCode === newCode
            ? {
                ...g,
                files: newFiles,
                imageCount: newFiles.length,
                status: newStatus,
              }
            : g
        );
      } else {
        const newGroup: SkuGroup = {
          productCode: newCode,
          price: 0,
          imageCount: 1,
          targetCount: imagesPerPost,
          status: imagesPerPost === 1 ? 'ready' : 'missing_images',
          files: [{ ...fileItem, imageIndex: 1 }],
          inExcel: false,
        };
        updatedGroups = [...prev, newGroup];
      }

      return updatedGroups
        .map((g) => (g.productCode === 'Chưa phân loại' ? { ...g, files: restUnclassified, imageCount: restUnclassified.length } : g))
        .filter((g) => g.files.length > 0);
    });

    setUnclassifiedCodeInput((prev) => {
      const next = { ...prev };
      delete next[oldFileName];
      return next;
    });
  };

  const totalImages = groups.reduce((acc, g) => acc + g.imageCount, 0);
  const validGroups = groups.filter((g) => g.productCode !== 'Chưa phân loại');
  const unclassifiedGroup = groups.find((g) => g.productCode === 'Chưa phân loại');

  const readyCount = validGroups.filter((g) => g.status === 'ready').length;
  const missingCount = validGroups.filter((g) => g.status === 'missing_images').length;
  const excessCount = validGroups.filter((g) => g.status === 'excess_images').length;

  return (
    <div className="space-y-6">
      {/* Upload Drop Zone Card */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="p-8 border-2 border-dashed border-slate-700 hover:border-indigo-500/80 bg-slate-900/50 hover:bg-slate-900/80 rounded-2xl transition-all text-center space-y-4"
      >
        <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center">
          <UploadCloud className="w-8 h-8" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-white">Kéo thả ảnh hoặc chọn thư mục chứa ảnh sản phẩm</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-xl mx-auto">
            Hỗ trợ JPG, JPEG, PNG, WEBP. Tự động nhận diện mã sản phẩm từ tên file (Ví dụ:{' '}
            <code className="text-indigo-300">AE0309436.jpg</code>,{' '}
            <code className="text-indigo-300">AE0309436 2.jpg</code>, v.v.)
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFilesSelected}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            <ImageIcon className="w-4 h-4" />
            <span>{scanning ? 'Đang quét ảnh...' : 'Chọn nhiều ảnh từ máy'}</span>
          </button>

          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            disabled={scanning}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-sm flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <span>Chọn cả thư mục</span>
          </button>

          {groups.length > 0 && (
            <button
              type="button"
              onClick={() => setGroups([])}
              className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-sm font-medium transition-all"
            >
              Xóa tất cả
            </button>
          )}
        </div>
      </div>

      {/* Control Bar: Images Per Post & Advanced Regex */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-slate-200">Số ảnh mỗi bài đăng:</span>
          <div className="flex items-center space-x-1.5">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setImagesPerPost(num)}
                className={`w-8 h-8 rounded-lg font-bold text-xs transition-all ${
                  imagesPerPost === num
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500">(Mặc định: 4 ảnh / bài)</span>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvancedRegex(!showAdvancedRegex)}
          className="text-xs text-slate-400 hover:text-indigo-400 flex items-center space-x-1"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{showAdvancedRegex ? 'Ẩn cấu hình Regex' : 'Tùy chỉnh nhận diện mã (Regex)'}</span>
        </button>
      </div>

      {/* Advanced Regex Input */}
      {showAdvancedRegex && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <label className="text-xs font-semibold text-slate-300 block">
            Biểu thức Regex tùy chỉnh nhận diện mã sản phẩm:
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={customRegex}
              onChange={(e) => setCustomRegex(e.target.value)}
              placeholder="Ví dụ: ^([A-Z0-9]+)[_\s-](\d+)$"
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={() => {
                // Trigger re-group with custom regex if needed
              }}
              className="px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-500"
            >
              Áp dụng
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Mặc định: Tự động tách phần số thứ tự ảnh sau dấu cách, gạch dưới, gạch ngang, ngoặc đơn (Ví dụ: Mã SP = Group 1, Số thứ tự = Group 2).
          </p>
        </div>
      )}

      {/* Summary Stat Badges */}
      {groups.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <p className="text-xs text-slate-400">Tổng số ảnh</p>
            <p className="text-xl font-bold text-white mt-1">{totalImages}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <p className="text-xs text-slate-400">Tổng mã sản phẩm</p>
            <p className="text-xl font-bold text-indigo-400 mt-1">{validGroups.length}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-xs text-emerald-400">Đủ {imagesPerPost} ảnh</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">{readyCount}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-xs text-amber-400">Thiếu ảnh ({`< ${imagesPerPost}`})</p>
            <p className="text-xl font-bold text-amber-400 mt-1">{missingCount}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
            <p className="text-xs text-purple-400">Thừa ảnh ({`> ${imagesPerPost}`})</p>
            <p className="text-xl font-bold text-purple-400 mt-1">{excessCount}</p>
          </div>
        </div>
      )}

      {/* Unclassified Images Section (if any) */}
      {unclassifiedGroup && unclassifiedGroup.files.length > 0 && (
        <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Ảnh chưa phân loại được mã ({unclassifiedGroup.files.length} ảnh)</span>
            </div>
            <p className="text-xs text-slate-400">Nhập mã sản phẩm để đưa vào bài đăng tương ứng</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {unclassifiedGroup.files.map((file) => (
              <div key={file.fileName} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="aspect-square rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center relative">
                  <img src={file.url} alt={file.fileName} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 px-1.5 py-0.5 rounded text-white truncate max-w-[90%]">
                    {file.originalName}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <input
                    type="text"
                    placeholder="Nhập mã SP..."
                    value={unclassifiedCodeInput[file.fileName] || ''}
                    onChange={(e) =>
                      setUnclassifiedCodeInput({ ...unclassifiedCodeInput, [file.fileName]: e.target.value })
                    }
                    className="w-full px-2 py-1 text-xs bg-slate-950 border border-slate-700 rounded text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleAssignUnclassified(file.fileName)}
                    className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded"
                  >
                    Gán
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grouped Thumbnails Grid */}
      {validGroups.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Danh sách nhóm ảnh theo mã ({validGroups.length} mã)
            </h3>
            <button
              type="button"
              onClick={onNextTab}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-indigo-600/30 transition-all"
            >
              <span>Tiếp tục sang bước Danh sách & Giá</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {validGroups.map((group) => {
              const isReady = group.imageCount === imagesPerPost;
              const isMissing = group.imageCount < imagesPerPost;

              return (
                <div
                  key={group.productCode}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-white tracking-wide">{group.productCode}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          isReady
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : isMissing
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                        }`}
                      >
                        {group.imageCount}/{imagesPerPost} ảnh
                      </span>
                    </div>

                    {isReady && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {isMissing && <AlertCircle className="w-4 h-4 text-amber-400" />}
                  </div>

                  {/* Thumbnail Row */}
                  <div className="grid grid-cols-4 gap-2">
                    {group.files.map((file, idx) => (
                      <div
                        key={file.fileName}
                        className="relative aspect-square rounded-lg overflow-hidden bg-slate-950 border border-slate-800 group"
                      >
                        <img
                          src={file.url}
                          alt={file.fileName}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-black/70 text-[9px] font-bold text-white flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(group.productCode, file.fileName)}
                          title="Xóa ảnh khỏi mã này"
                          className="absolute inset-0 bg-rose-600/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Placeholder slots if missing */}
                    {Array.from({ length: Math.max(0, imagesPerPost - group.imageCount) }).map((_, i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-lg border border-dashed border-slate-800 flex items-center justify-center text-slate-600 text-[10px]"
                      >
                        +{group.imageCount + i + 1}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-slate-500 border border-slate-800 rounded-2xl">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Chưa có ảnh nào được tải lên. Hãy chọn ảnh hoặc thư mục ở trên để bắt đầu.</p>
        </div>
      )}
    </div>
  );
};
