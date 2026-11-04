import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  Layers,
  Palette,
  LayoutGrid,
  Download,
  Share2,
  Trash2,
  RotateCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Check,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Sparkles,
  Save,
  Send,
  Sliders,
  Type,
  FileText,
} from 'lucide-react';
import JSZip from 'jszip';
import { api } from '../services/api.js';
import { useCampaignWizardStore } from '../stores/campaignWizardStore.js';
import { MediaAsset } from '../types/index.js';

interface ImageItem {
  id: string;
  file: File;
  name: string;
  url: string;
  width: number;
  height: number;
  customCode?: string;
}

export const WatermarkEditor: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Images state
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Watermark Settings (State)
  const [text, setText] = useState('XEKO XUKA 99K');
  const [useDynamicCode, setUseDynamicCode] = useState(false);
  const [codeSource, setCodeSource] = useState<'filename' | 'csv'>('filename');
  const [csvCodeMap, setCsvCodeMap] = useState<Record<string, string>>({});

  // Style Settings
  const [textColor, setTextColor] = useState('#ffffff');
  const [fontSizePercent, setFontSizePercent] = useState(5); // 2 - 20%
  const [fontBold, setFontBold] = useState(true);
  const [fontItalic, setFontItalic] = useState(false);
  const [hasBackground, setHasBackground] = useState(true);
  const [bgColor, setBgColor] = useState('#000000');
  const [bgOpacity, setBgOpacity] = useState(65); // 0 - 100
  const [opacity, setOpacity] = useState(90); // 0 - 100
  const [rotation, setRotation] = useState(0); // -180 to 180
  const [padding, setPadding] = useState(12);
  const [borderRadius, setBorderRadius] = useState(8);

  // Layout Settings
  const [layoutMode, setLayoutMode] = useState<'single' | 'repeat'>('single');
  const [position, setPosition] = useState<
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'middle-left'
    | 'center'
    | 'middle-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right'
    | 'custom'
  >('bottom-right');
  const [customX, setCustomX] = useState(80); // percentage 0-100
  const [customY, setCustomY] = useState(85); // percentage 0-100
  const [offsetX, setOffsetX] = useState(4); // percentage margin from edge
  const [offsetY, setOffsetY] = useState(4);

  // Preview Viewer Toolbar State
  const [imageRotation, setImageRotation] = useState(0); // 0, 90, 180, 270
  const [zoomLevel, setZoomLevel] = useState(1); // 0.5 to 3
  const [isDraggingWatermark, setIsDraggingWatermark] = useState(false);

  // Output & Processing State
  const [outputFormat, setOutputFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg');
  const [outputQuality, setOutputQuality] = useState(90);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [processedAssets, setProcessedAssets] = useState<MediaAsset[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Templates
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');

  // Load saved templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await api.get('/watermark/templates');
        setSavedTemplates(res.data.data.templates || []);
      } catch (err) {
        console.error('Error fetching templates:', err);
      }
    };
    fetchTemplates();
  }, []);

  // Handle image files selection
  const handleFiles = (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const newItems: ImageItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) continue;

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        // Extract product code from filename if dynamic code is on
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const match = baseName.match(/^([A-Za-z0-9_-]+)/);
        const code = match ? match[1] : baseName;

        setImages((prev) => [
          ...prev,
          {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            file,
            name: file.name,
            url,
            width: img.naturalWidth || 1200,
            height: img.naturalHeight || 800,
            customCode: code,
          },
        ]);
      };
    }
  };

  // CSV Import for Product Codes
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      const map: Record<string, string> = {};

      lines.forEach((line) => {
        const parts = line.split(/[,\t]/);
        if (parts.length >= 2) {
          const fn = parts[0].trim();
          const cd = parts[1].trim();
          if (fn && cd) map[fn] = cd;
        }
      });

      setCsvCodeMap(map);
      setStatusMessage(`Đã import ${Object.keys(map).length} mã sản phẩm từ file!`);
    };
    reader.readAsText(file);
  };

  const currentImage = images[selectedIndex];

  // Get active text for current image
  const getActiveTextForCurrent = () => {
    if (!useDynamicCode) return text;
    if (codeSource === 'csv' && currentImage && csvCodeMap[currentImage.name]) {
      return csvCodeMap[currentImage.name];
    }
    return currentImage?.customCode || text;
  };

  // Render Realtime Canvas Preview
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !currentImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = currentImage.url;
    img.onload = () => {
      // Determine canvas dimensions based on image rotation
      const is90Rotated = imageRotation === 90 || imageRotation === 270;
      const targetW = is90Rotated ? currentImage.height : currentImage.width;
      const targetH = is90Rotated ? currentImage.width : currentImage.height;

      canvas.width = targetW;
      canvas.height = targetH;

      ctx.clearRect(0, 0, targetW, targetH);

      // Save context for image rotation
      ctx.save();
      ctx.translate(targetW / 2, targetH / 2);
      ctx.rotate((imageRotation * Math.PI) / 180);
      ctx.drawImage(img, -currentImage.width / 2, -currentImage.height / 2);
      ctx.restore();

      // Draw Watermark
      const watermarkText = getActiveTextForCurrent();
      const minDim = Math.min(targetW, targetH);
      const fontSize = Math.max(12, Math.round((minDim * fontSizePercent) / 100));

      const fontStyleStr = `${fontItalic ? 'italic ' : ''}${fontBold ? 'bold ' : ''}${fontSize}px Plus Jakarta Sans, Arial, sans-serif`;
      ctx.font = fontStyleStr;

      const metrics = ctx.measureText(watermarkText);
      const textWidth = metrics.width;
      const textHeight = fontSize * 1.1;

      const pad = Math.max(4, Math.round((fontSize * padding) / 24));
      const radius = Math.max(2, Math.round((fontSize * borderRadius) / 24));
      const boxW = textWidth + pad * 2;
      const boxH = textHeight + pad * 2;

      ctx.save();
      ctx.globalAlpha = opacity / 100;

      if (layoutMode === 'repeat') {
        // Repeated tiled watermark
        const stepX = Math.round(minDim * 0.35);
        const stepY = Math.round(minDim * 0.25);
        const rot = (rotation || -30) * (Math.PI / 180);

        for (let y = -stepY; y < targetH + stepY * 2; y += stepY) {
          for (let x = -stepX; x < targetW + stepX * 2; x += stepX) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rot);

            if (hasBackground) {
              ctx.fillStyle = bgColor;
              ctx.globalAlpha = (opacity / 100) * (bgOpacity / 100);
              drawRoundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, radius);
              ctx.fill();
            }

            ctx.globalAlpha = opacity / 100;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(watermarkText, 0, 0);
            ctx.restore();
          }
        }
      } else {
        // Single Watermark Position
        const marginX = (targetW * offsetX) / 100;
        const marginY = (targetH * offsetY) / 100;

        let posX = targetW - boxW / 2 - marginX;
        let posY = targetH - boxH / 2 - marginY;

        if (position === 'custom') {
          posX = (targetW * customX) / 100;
          posY = (targetH * customY) / 100;
        } else {
          switch (position) {
            case 'top-left':
              posX = marginX + boxW / 2;
              posY = marginY + boxH / 2;
              break;
            case 'top-center':
              posX = targetW / 2;
              posY = marginY + boxH / 2;
              break;
            case 'top-right':
              posX = targetW - marginX - boxW / 2;
              posY = marginY + boxH / 2;
              break;
            case 'middle-left':
              posX = marginX + boxW / 2;
              posY = targetH / 2;
              break;
            case 'center':
              posX = targetW / 2;
              posY = targetH / 2;
              break;
            case 'middle-right':
              posX = targetW - marginX - boxW / 2;
              posY = targetH / 2;
              break;
            case 'bottom-left':
              posX = marginX + boxW / 2;
              posY = targetH - marginY - boxH / 2;
              break;
            case 'bottom-center':
              posX = targetW / 2;
              posY = targetH - marginY - boxH / 2;
              break;
            case 'bottom-right':
            default:
              posX = targetW - marginX - boxW / 2;
              posY = targetH - marginY - boxH / 2;
              break;
          }
        }

        ctx.translate(posX, posY);
        ctx.rotate((rotation * Math.PI) / 180);

        if (hasBackground) {
          ctx.fillStyle = bgColor;
          ctx.globalAlpha = (opacity / 100) * (bgOpacity / 100);
          drawRoundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, radius);
          ctx.fill();
        }

        ctx.globalAlpha = opacity / 100;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(watermarkText, 0, 0);
      }

      ctx.restore();
    };
  }, [
    currentImage,
    text,
    useDynamicCode,
    codeSource,
    csvCodeMap,
    textColor,
    fontSizePercent,
    fontBold,
    fontItalic,
    hasBackground,
    bgColor,
    bgOpacity,
    opacity,
    rotation,
    padding,
    borderRadius,
    layoutMode,
    position,
    customX,
    customY,
    offsetX,
    offsetY,
    imageRotation,
  ]);

  // Helper for rounded rectangle in canvas
  const drawRoundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // Canvas Drag Watermark interaction
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (layoutMode === 'repeat') return;
    setIsDraggingWatermark(true);
    updateCustomCoordsFromMouse(e);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingWatermark) {
      updateCustomCoordsFromMouse(e);
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingWatermark(false);
  };

  const updateCustomCoordsFromMouse = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xPercent = Math.max(0, Math.min(100, Math.round((clickX / rect.width) * 100)));
    const yPercent = Math.max(0, Math.min(100, Math.round((clickY / rect.height) * 100)));

    setPosition('custom');
    setCustomX(xPercent);
    setCustomY(yPercent);
  };

  // Batch Watermark Process
  const handleStartBatchProcess = async () => {
    if (images.length === 0) {
      alert('Vui lòng chọn ít nhất 1 ảnh');
      return;
    }

    try {
      setIsProcessing(true);
      setProgress({ current: 0, total: images.length });
      setStatusMessage('Đang tải và đóng dấu ảnh bằng Sharp...');

      const formData = new FormData();
      images.forEach((item) => {
        formData.append('files', item.file);
      });

      const options = {
        text,
        textColor,
        fontSizePercent,
        fontStyle: `${fontBold ? 'bold' : ''} ${fontItalic ? 'italic' : ''}`.trim() || 'normal',
        hasBackground,
        bgColor,
        bgOpacity,
        padding,
        borderRadius,
        opacity,
        rotation,
        layoutMode,
        position,
        customX,
        customY,
        offsetX,
        offsetY,
        outputFormat,
        outputQuality,
        rotateImageAngle: imageRotation,
      };

      formData.append('options', JSON.stringify(options));
      formData.append('useDynamicCode', String(useDynamicCode));
      formData.append('codeSource', codeSource);

      const codeMap: Record<string, string> = {};
      images.forEach((img) => {
        if (codeSource === 'csv' && csvCodeMap[img.name]) {
          codeMap[img.name] = csvCodeMap[img.name];
        } else if (img.customCode) {
          codeMap[img.name] = img.customCode;
        }
      });
      formData.append('codeMap', JSON.stringify(codeMap));

      const res = await api.post('/watermark/batch-process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const assets: MediaAsset[] = res.data.data.assets;
      setProcessedAssets(assets);
      setStatusMessage(`Đóng dấu thành công ${assets.length} ảnh!`);
      alert(`Đã đóng dấu hoàn tất ${assets.length} ảnh!`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi đóng dấu ảnh');
      setStatusMessage('Đóng dấu thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download All as ZIP
  const handleDownloadZip = async () => {
    if (processedAssets.length === 0) {
      alert('Chưa có ảnh nào được đóng dấu. Hãy bấm "Bắt đầu đóng dấu" trước');
      return;
    }

    try {
      setStatusMessage('Đang đóng gói file ZIP...');
      const zip = new JSZip();

      for (const asset of processedAssets) {
        const response = await fetch(asset.storageUrl);
        const blob = await response.blob();
        zip.file(asset.originalName, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `dong_dau_anh_${Date.now()}.zip`;
      link.click();
      setStatusMessage('Đã tải xuống file ZIP thành công!');
    } catch (err) {
      console.error('Error creating ZIP:', err);
      alert('Lỗi khi tải file ZIP');
    }
  };

  // Transfer stamped images to Facebook Campaign Creation
  const handleUseForCampaign = () => {
    if (processedAssets.length === 0) {
      alert('Vui lòng bấm "Bắt đầu đóng dấu hàng loạt" trước khi chuyển sang tạo chiến dịch');
      return;
    }

    // Populate Zustand wizard store with these MediaAssets
    const wizardStore = useCampaignWizardStore.getState();
    wizardStore.setMediaAssets(processedAssets);
    wizardStore.setStep(3); // Go straight to Step 3: Grouping
    navigate('/campaigns/create');
  };

  // Save Template
  const handleSaveTemplate = async () => {
    const templateName = prompt('Nhập tên mẫu con dấu để lưu:');
    if (!templateName || !templateName.trim()) return;

    try {
      await api.post('/watermark/templates', {
        name: templateName.trim(),
        text,
        useDynamicCode,
        codeSource,
        textColor,
        fontSizePercent,
        fontStyle: `${fontBold ? 'bold' : ''} ${fontItalic ? 'italic' : ''}`.trim() || 'normal',
        hasBackground,
        bgColor,
        bgOpacity,
        padding,
        borderRadius,
        opacity,
        rotation,
        layoutMode,
        position,
        customX,
        customY,
        offsetX,
        offsetY,
        outputFormat,
        outputQuality,
      });

      alert(`Đã lưu mẫu "${templateName}" thành công!`);
      const res = await api.get('/watermark/templates');
      setSavedTemplates(res.data.data.templates || []);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi lưu mẫu');
    }
  };

  // Load selected template
  const handleLoadTemplate = (tpl: any) => {
    if (!tpl) return;
    setText(tpl.text || '');
    setUseDynamicCode(!!tpl.useDynamicCode);
    setCodeSource(tpl.codeSource || 'filename');
    setTextColor(tpl.textColor || '#ffffff');
    setFontSizePercent(tpl.fontSizePercent || 5);
    setFontBold(tpl.fontStyle?.includes('bold') ?? true);
    setFontItalic(tpl.fontStyle?.includes('italic') ?? false);
    setHasBackground(tpl.hasBackground !== false);
    setBgColor(tpl.bgColor || '#000000');
    setBgOpacity(tpl.bgOpacity ?? 65);
    setOpacity(tpl.opacity ?? 90);
    setRotation(tpl.rotation ?? 0);
    setPadding(tpl.padding ?? 12);
    setBorderRadius(tpl.borderRadius ?? 8);
    setLayoutMode(tpl.layoutMode || 'single');
    setPosition(tpl.position || 'bottom-right');
    setCustomX(tpl.customX ?? 80);
    setCustomY(tpl.customY ?? 85);
    setOffsetX(tpl.offsetX ?? 4);
    setOffsetY(tpl.offsetY ?? 4);
    setOutputFormat(tpl.outputFormat || 'jpeg');
    setOutputQuality(tpl.outputQuality ?? 90);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Đóng Dấu Ảnh Hàng Loạt</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              Batch Image Editor
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Chèn watermark, logo, mã sản phẩm tự động cho 100 - 1.000 ảnh đồng thời, chuẩn kích thước và đồng bộ sang Facebook
          </p>
        </div>

        {/* Template Select & Save */}
        <div className="flex items-center space-x-3">
          {savedTemplates.length > 0 && (
            <select
              value={selectedTemplateName}
              onChange={(e) => {
                setSelectedTemplateName(e.target.value);
                const found = savedTemplates.find((t) => t.name === e.target.value);
                if (found) handleLoadTemplate(found);
              }}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Mẫu đã lưu ({savedTemplates.length}) --</option>
              {savedTemplates.map((t) => (
                <option key={t._id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleSaveTemplate}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Lưu mẫu</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Work Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* LEFT SIDE: 4 PANELS (col-span-5) */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 space-y-5 max-h-[860px] overflow-y-auto pr-1">
          {/* PANEL 1: CHỌN ẢNH */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-2">
                <UploadCloud className="w-4 h-4" />
                <span>Panel 1: Chọn Ảnh ({images.length})</span>
              </h2>
              {images.length > 0 && (
                <button
                  onClick={() => {
                    setImages([]);
                    setSelectedIndex(0);
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                >
                  Xóa tất cả
                </button>
              )}
            </div>

            {/* Dropzone & Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center space-x-2 py-3 px-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 text-xs font-semibold text-slate-200 transition-all"
              >
                <UploadCloud className="w-4 h-4 text-indigo-400" />
                <span>Chọn nhiều ảnh</span>
              </button>

              <input
                ref={folderInputRef}
                type="file"
                {...({ webkitdirectory: '', directory: '' } as any)}
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              <button
                onClick={() => folderInputRef.current?.click()}
                className="flex items-center justify-center space-x-2 py-3 px-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 text-xs font-semibold text-slate-200 transition-all"
              >
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <span>Chọn cả thư mục</span>
              </button>
            </div>

            {/* Thumbnail Scroll Strip */}
            {images.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Nhấp vào ảnh để xem trước & kéo con dấu:</span>
                  <span className="font-mono text-indigo-400">
                    {selectedIndex + 1} / {images.length}
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 p-1 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  {images.map((img, idx) => (
                    <div
                      key={img.id}
                      onClick={() => setSelectedIndex(idx)}
                      className={`relative aspect-square w-14 shrink-0 rounded-lg overflow-hidden border cursor-pointer transition-all ${
                        selectedIndex === idx
                          ? 'border-indigo-500 ring-2 ring-indigo-500/40'
                          : 'border-slate-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                      <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[9px] text-white px-1 rounded font-mono">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PANEL 2: NỘI DUNG CON DẤU */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-2 pb-2 border-b border-slate-800/80">
              <Type className="w-4 h-4" />
              <span>Panel 2: Nội Dung & Kiểu Chữ</span>
            </h2>

            {/* Mode: Common Text vs Dynamic Code */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setUseDynamicCode(false)}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  !useDynamicCode
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Nội dung chung
              </button>
              <button
                type="button"
                onClick={() => setUseDynamicCode(true)}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  useDynamicCode
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Mã riêng từng ảnh
              </button>
            </div>

            {/* Content Input or Dynamic Source */}
            {!useDynamicCode ? (
              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1.5">
                  Nội dung con dấu
                </label>
                <textarea
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ví dụ: SALE 99K - XEKO SHOP"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
            ) : (
              <div className="space-y-3 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">Nguồn lấy mã con dấu:</span>
                  <div className="flex space-x-2">
                    <label className="flex items-center space-x-1 cursor-pointer">
                      <input
                        type="radio"
                        checked={codeSource === 'filename'}
                        onChange={() => setCodeSource('filename')}
                        className="text-indigo-600"
                      />
                      <span className="text-slate-300">Từ tên file</span>
                    </label>
                    <label className="flex items-center space-x-1 cursor-pointer ml-2">
                      <input
                        type="radio"
                        checked={codeSource === 'csv'}
                        onChange={() => setCodeSource('csv')}
                        className="text-indigo-600"
                      />
                      <span className="text-slate-300">File CSV/Excel</span>
                    </label>
                  </div>
                </div>

                {codeSource === 'filename' ? (
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Hệ thống sẽ tự động tách mã sản phẩm ở đầu tên file. Ví dụ file <code className="text-indigo-400">SP102_ao_thun.jpg</code> sẽ đóng dấu mã <code className="text-indigo-400 font-bold">SP102</code>.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={handleCsvUpload}
                    />
                    <button
                      type="button"
                      onClick={() => csvInputRef.current?.click()}
                      className="w-full flex items-center justify-center space-x-2 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Chọn file CSV (Cột 1: Tên file, Cột 2: Mã)</span>
                    </button>
                    {Object.keys(csvCodeMap).length > 0 && (
                      <p className="text-[11px] text-emerald-400">
                        ✓ Đã nạp {Object.keys(csvCodeMap).length} mã sản phẩm từ file
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Color & Size & Styles */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1.5">
                  Màu chữ
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <div className="flex gap-1.5">
                    {['#ffffff', '#000000', '#facc15', '#ef4444', '#38bdf8'].map((c) => (
                      <div
                        key={c}
                        onClick={() => setTextColor(c)}
                        style={{ backgroundColor: c }}
                        className="w-5 h-5 rounded-md border border-slate-700 cursor-pointer"
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1.5">
                  Cỡ chữ (% ảnh): {fontSizePercent}%
                </label>
                <input
                  type="range"
                  min={2}
                  max={20}
                  value={fontSizePercent}
                  onChange={(e) => setFontSizePercent(parseInt(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>

            {/* Font Style Toggles */}
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-semibold uppercase text-slate-400 mr-2">
                Kiểu chữ:
              </span>
              <button
                type="button"
                onClick={() => setFontBold(!fontBold)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  fontBold ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'
                }`}
              >
                B (Đậm)
              </button>
              <button
                type="button"
                onClick={() => setFontItalic(!fontItalic)}
                className={`px-3 py-1 rounded-lg text-xs italic transition-colors ${
                  fontItalic ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'
                }`}
              >
                I (Nghiêng)
              </button>

              <div className="ml-auto flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hasBg"
                  checked={hasBackground}
                  onChange={(e) => setHasBackground(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800"
                />
                <label htmlFor="hasBg" className="text-xs text-slate-300 font-semibold cursor-pointer">
                  Nền sau chữ
                </label>
              </div>
            </div>

            {/* Background Color & Opacity & Rotation */}
            {hasBackground && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1.5">
                    Màu nền & Độ mờ nền ({bgOpacity}%)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={bgOpacity}
                      onChange={(e) => setBgOpacity(parseInt(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1.5">
                    Bo góc nền: {borderRadius}px
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={borderRadius}
                    onChange={(e) => setBorderRadius(parseInt(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Opacity & Rotation Sliders */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1.5">
                  Độ mờ tổng thể: {opacity}%
                </label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={opacity}
                  onChange={(e) => setOpacity(parseInt(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1.5">
                  Góc xoay chữ: {rotation}°
                </label>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={rotation}
                  onChange={(e) => setRotation(parseInt(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* PANEL 3: KIỂU BỐ TRÍ */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-2 pb-2 border-b border-slate-800/80">
              <LayoutGrid className="w-4 h-4" />
              <span>Panel 3: Kiểu Bố Trí & Vị Trí</span>
            </h2>

            {/* Mode: Single vs Repeat Pattern */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setLayoutMode('single')}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  layoutMode === 'single'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Một vị trí
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('repeat')}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  layoutMode === 'repeat'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Lặp toàn ảnh (Pattern)
              </button>
            </div>

            {layoutMode === 'single' ? (
              <div className="space-y-4">
                {/* 3x3 Grid Buttons */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">
                    Chọn nhanh 9 vị trí:
                  </span>
                  <div className="grid grid-cols-3 gap-2 w-48 mx-auto p-2 bg-slate-950 rounded-xl border border-slate-800">
                    {[
                      { key: 'top-left', label: '↖' },
                      { key: 'top-center', label: '↑' },
                      { key: 'top-right', label: '↗' },
                      { key: 'middle-left', label: '←' },
                      { key: 'center', label: '•' },
                      { key: 'middle-right', label: '→' },
                      { key: 'bottom-left', label: '↙' },
                      { key: 'bottom-center', label: '↓' },
                      { key: 'bottom-right', label: '↘' },
                    ].map((pos) => (
                      <button
                        key={pos.key}
                        type="button"
                        onClick={() => setPosition(pos.key as any)}
                        className={`h-9 rounded-lg font-bold text-sm transition-all flex items-center justify-center ${
                          position === pos.key
                            ? 'bg-indigo-600 text-white shadow'
                            : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                        title={pos.key}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-center text-slate-400">
                  💡 <em>Mẹo: Bạn cũng có thể nhấp và kéo chuột trực tiếp trên khung ảnh xem trước bên phải để đặt con dấu vào bất kỳ vị trí nào!</em>
                </p>

                {/* Offsets */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                      Khoảng cách mép X: {offsetX}%
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={25}
                      value={offsetX}
                      onChange={(e) => setOffsetX(parseInt(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                      Khoảng cách mép Y: {offsetY}%
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={25}
                      value={offsetY}
                      onChange={(e) => setOffsetY(parseInt(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400">
                Chế độ lặp chéo sẽ đóng dấu watermark mờ phủ đều khắp toàn bộ diện tích ảnh, chống sao chép bản quyền hiệu quả.
              </div>
            )}
          </div>

          {/* PANEL 4: XUẤT FILE & XỬ LÝ HÀNG LOẠT */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-2 pb-2 border-b border-slate-800/80">
              <Download className="w-4 h-4" />
              <span>Panel 4: Xuất File & Xử Lý Hàng Loạt</span>
            </h2>

            {/* Format & Quality */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1.5">
                  Định dạng xuất
                </label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value="jpeg">JPG / JPEG (Phổ biến)</option>
                  <option value="png">PNG (Trong suốt)</option>
                  <option value="webp">WEBP (Nén dung lượng cao)</option>
                </select>
              </div>

              {outputFormat === 'jpeg' && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1.5">
                    Chất lượng JPG: {outputQuality}%
                  </label>
                  <input
                    type="range"
                    min={60}
                    max={100}
                    value={outputQuality}
                    onChange={(e) => setOutputQuality(parseInt(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Batch Progress Bar */}
            {isProcessing && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-indigo-400 animate-pulse">Đang xử lý đóng dấu...</span>
                  <span className="text-white">
                    {progress.current} / {progress.total}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 transition-all duration-150"
                    style={{
                      width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                disabled={isProcessing || images.length === 0}
                onClick={handleStartBatchProcess}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isProcessing ? 'Đang đóng dấu...' : `Bắt đầu đóng dấu (${images.length} ảnh)`}
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={processedAssets.length === 0}
                  onClick={handleDownloadZip}
                  className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải file ZIP</span>
                </button>

                {/* Integration button: Go directly to Campaign Creator */}
                <button
                  type="button"
                  disabled={processedAssets.length === 0}
                  onClick={handleUseForCampaign}
                  className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Đăng Facebook</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT SIDE: LARGE INTERACTIVE PREVIEW & TOOLBAR (col-span-7) */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 sticky top-20">
          {/* Top Viewer Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            {/* Prev / Next & Index */}
            <div className="flex items-center space-x-2">
              <button
                disabled={selectedIndex <= 0}
                onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-mono font-bold text-white px-2">
                {images.length > 0 ? `${selectedIndex + 1} / ${images.length}` : '0 / 0'}
              </span>

              <button
                disabled={selectedIndex >= images.length - 1}
                onClick={() => setSelectedIndex((i) => Math.min(images.length - 1, i + 1))}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Current Image Details */}
            {currentImage && (
              <div className="text-center truncate max-w-xs">
                <p className="text-xs font-bold text-white truncate" title={currentImage.name}>
                  {currentImage.name}
                </p>
                <p className="text-[10px] text-indigo-400 font-mono">
                  Mã: {getActiveTextForCurrent()} · {currentImage.width}×{currentImage.height}px
                </p>
              </div>
            )}

            {/* Rotate & Zoom Actions */}
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setImageRotation((r) => (r - 90 + 360) % 360)}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                title="Xoay trái 90°"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setImageRotation((r) => (r + 90) % 360)}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                title="Xoay phải 90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <div className="h-4 w-px bg-slate-800 mx-1" />
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.2))}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.2))}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                title="Phóng to"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white text-[10px] font-bold"
                title="Reset Zoom"
              >
                100%
              </button>
            </div>
          </div>

          {/* Interactive Large Canvas Viewport */}
          <div
            ref={previewContainerRef}
            className="w-full h-[580px] bg-slate-950 rounded-xl border border-slate-800 overflow-auto flex items-center justify-center relative p-4 select-none"
          >
            {images.length === 0 ? (
              <div className="text-center text-slate-500 text-xs space-y-2">
                <UploadCloud className="w-12 h-12 text-slate-700 mx-auto" />
                <p className="font-semibold text-slate-400">Chưa có ảnh nào được chọn</p>
                <p>Hãy tải ảnh ở Panel 1 bên trái để bắt đầu đóng dấu xem trước</p>
              </div>
            ) : (
              <div
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                className="transition-transform duration-100 max-w-full max-h-full flex items-center justify-center cursor-crosshair"
              >
                <canvas
                  ref={previewCanvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  className="rounded-lg shadow-2xl max-w-full max-h-[540px] object-contain border border-slate-800"
                />
              </div>
            )}
          </div>

          {/* Preview Footer Info */}
          <div className="flex flex-wrap justify-between items-center text-[11px] text-slate-400 px-1">
            <span>
              Tọa độ con dấu:{' '}
              <strong className="text-white">
                {position === 'custom' ? `X: ${customX}%, Y: ${customY}%` : position}
              </strong>
            </span>
            <span>
              Định dạng xuất dự kiến:{' '}
              <strong className="text-indigo-400 uppercase">
                {outputFormat} ({outputQuality}%)
              </strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

