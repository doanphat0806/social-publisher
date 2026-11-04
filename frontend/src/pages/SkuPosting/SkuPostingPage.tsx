import React, { useEffect, useState } from 'react';
import {
  UploadCloud,
  ListOrdered,
  Sliders,
  Eye,
  Activity,
  CheckCircle,
  Package,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { getSocket } from '../../services/socket.js';
import { FacebookPage } from '../../types/index.js';
import { UploadImagesTab, SkuGroup } from './tabs/UploadImagesTab.js';
import { ProductListTab } from './tabs/ProductListTab.js';
import { ConfigFanpageTab } from './tabs/ConfigFanpageTab.js';
import { PreviewPostsTab, PreviewPostItem } from './tabs/PreviewPostsTab.js';
import { CampaignTrackerTab } from './tabs/CampaignTrackerTab.js';

export const SkuPostingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'products' | 'config' | 'preview' | 'tracker'>('upload');

  // Tab 1 & 2 State: SKU Groups & Images
  const [groups, setGroups] = useState<SkuGroup[]>([]);
  const [imagesPerPost, setImagesPerPost] = useState<number>(4);
  const [scanning, setScanning] = useState(false);

  // Tab 3 State: Campaign & Fanpage Config
  const [campaignName, setCampaignName] = useState<string>('');
  const [captionTemplate, setCaptionTemplate] = useState<string>(
    `MS {product_code}\n\n👉 Sale cực sốc chỉ còn {price}K\n👉 Số lượng chỉ còn vài chiếc thôi ạ...\n\nNhanh tay inbox ngay cho shop ạ 👌👌👌`
  );
  const [priceUnit, setPriceUnit] = useState<'K' | 'nghìn đồng' | 'VNĐ'>('K');
  const [showCodeLine, setShowCodeLine] = useState<boolean>(true);
  const [fanpages, setFanpages] = useState<FacebookPage[]>([]);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [scheduleMode, setScheduleMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState<string>('08:00');
  const [intervalMinutes, setIntervalMinutes] = useState<number>(15);

  // Tab 4 State: Preview Posts
  const [previewPosts, setPreviewPosts] = useState<PreviewPostItem[]>([]);
  const [launching, setLaunching] = useState(false);

  // Tab 5 State: Active Campaign Tracker
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  // Fetch connected Fanpages on mount
  useEffect(() => {
    const loadPages = async () => {
      try {
        const res = await api.get('/facebook/pages');
        setFanpages(res.data.data.pages || []);
        if (res.data.data.pages?.length > 0 && selectedPages.length === 0) {
          setSelectedPages(res.data.data.pages.map((p: any) => p.pageId));
        }
      } catch (err) {
        console.error('Failed to load fanpages:', err);
      }
    };
    loadPages();
  }, []);

  // Listen to Socket.IO real-time SKU events
  useEffect(() => {
    const socket = getSocket();
    const handleSuccess = (data: any) => {
      console.log('SKU published success event:', data);
    };

    const handleFailed = (data: any) => {
      console.warn('SKU published failed event:', data);
    };

    socket.on('sku:publish:success', handleSuccess);
    socket.on('sku:publish:failed', handleFailed);

    return () => {
      socket.off('sku:publish:success', handleSuccess);
      socket.off('sku:publish:failed', handleFailed);
    };
  }, []);

  // Scan & Upload images directly to backend
  const handleScanServer = async (files: File[]) => {
    try {
      setScanning(true);
      const formData = new FormData();
      formData.append('imagesPerPost', imagesPerPost.toString());

      files.forEach((file) => {
        formData.append('files', file);
      });

      const res = await api.post('/sku-posting/scan-images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success && res.data.data.groups) {
        setGroups(res.data.data.groups);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi tải và phân loại ảnh');
    } finally {
      setScanning(false);
    }
  };

  // Generate preview when transitioning to preview tab
  const handleGeneratePreview = async () => {
    try {
      const validProducts = groups
        .filter((g) => g.productCode !== 'Chưa phân loại' && g.files.length > 0)
        .map((g) => ({
          productCode: g.productCode,
          price: g.price || 0,
          files: g.files,
        }));

      if (validProducts.length === 0) {
        alert('Chưa có mã sản phẩm nào có ảnh để xem trước');
        return;
      }

      const res = await api.post('/sku-posting/preview', {
        captionTemplate,
        priceUnit,
        showCodeLine,
        products: validProducts,
        selectedPages,
        scheduleConfig: {
          mode: scheduleMode,
          startAt: scheduleMode === 'scheduled' ? new Date(`${startDate}T${startTime}:00`) : undefined,
          intervalMinutes,
        },
      });

      if (res.data.success && res.data.data.previewPosts) {
        setPreviewPosts(res.data.data.previewPosts);
        setActiveTab('preview');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi tạo bản xem trước');
    }
  };

  // Launch Campaign
  const handleLaunchCampaign = async () => {
    if (!campaignName.trim()) {
      alert('Vui lòng nhập tên chiến dịch');
      setActiveTab('config');
      return;
    }

    try {
      setLaunching(true);

      const activePosts = previewPosts.filter((p) => !p.skipped);
      const uniqueCodes = Array.from(new Set(activePosts.map((p) => p.productCode)));

      const campaignProducts = uniqueCodes.map((code) => {
        const matchingGroup = groups.find((g) => g.productCode === code);
        const matchingPost = activePosts.find((p) => p.productCode === code);
        return {
          productCode: code,
          price: matchingGroup?.price || 0,
          files: matchingGroup?.files || [],
          caption: matchingPost?.caption,
        };
      });

      const res = await api.post('/sku-posting/campaigns', {
        name: campaignName.trim(),
        captionTemplate,
        priceUnit,
        showCodeLine,
        imagesPerPost,
        selectedPages,
        scheduleConfig: {
          mode: scheduleMode,
          startAt: scheduleMode === 'scheduled' ? new Date(`${startDate}T${startTime}:00`) : undefined,
          intervalMinutes,
        },
        products: campaignProducts,
      });

      if (res.data.success) {
        const newCampaign = res.data.data.campaign;
        setActiveCampaignId(newCampaign._id);
        setActiveTab('tracker');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi khởi chạy chiến dịch');
    } finally {
      setLaunching(false);
    }
  };

  const navTabs = [
    { id: 'upload', label: '1. Chọn ảnh sản phẩm', icon: UploadCloud, badge: groups.length },
    { id: 'products', label: '2. Danh sách & Giá bán', icon: ListOrdered },
    { id: 'config', label: '3. Cấu hình & Fanpage', icon: Sliders },
    { id: 'preview', label: '4. Xem trước bài đăng', icon: Eye },
    { id: 'tracker', label: '5. Theo dõi tiến trình', icon: Activity },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Package className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Đăng Bài Facebook Theo Mã Sản Phẩm (SKU)
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1.5">
            Tự động ghép ảnh theo mã, nhập giá bán từ Excel, ghép caption và xuất bản hàng loạt lên nhiều Fanpage theo lịch riêng biệt.
          </p>
        </div>
      </div>

      {/* 5-Tab Navigation Bar */}
      <div className="flex items-center space-x-2 border-b border-slate-800/80 overflow-x-auto pb-px">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'preview') {
                  handleGeneratePreview();
                } else {
                  setActiveTab(tab.id as any);
                }
              }}
              className={`flex items-center space-x-2 px-4 py-3 rounded-t-xl font-bold text-xs whitespace-nowrap transition-all border-b-2 ${
                isActive
                  ? 'border-indigo-500 text-indigo-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-[10px] text-white flex items-center justify-center font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: UPLOAD & PHÂN NHÓM ẢNH */}
      {activeTab === 'upload' && (
        <UploadImagesTab
          groups={groups}
          setGroups={setGroups}
          imagesPerPost={imagesPerPost}
          setImagesPerPost={setImagesPerPost}
          onNextTab={() => setActiveTab('products')}
          onScanServer={handleScanServer}
          scanning={scanning}
        />
      )}

      {/* TAB 2: DANH SÁCH MÃ & GIÁ BÁN */}
      {activeTab === 'products' && (
        <ProductListTab
          groups={groups}
          setGroups={setGroups}
          imagesPerPost={imagesPerPost}
          onNextTab={() => setActiveTab('config')}
          priceUnit={priceUnit}
        />
      )}

      {/* TAB 3: CẤU HÌNH CAPTION & FANPAGE */}
      {activeTab === 'config' && (
        <ConfigFanpageTab
          campaignName={campaignName}
          setCampaignName={setCampaignName}
          captionTemplate={captionTemplate}
          setCaptionTemplate={setCaptionTemplate}
          priceUnit={priceUnit}
          setPriceUnit={setPriceUnit}
          showCodeLine={showCodeLine}
          setShowCodeLine={setShowCodeLine}
          fanpages={fanpages}
          selectedPages={selectedPages}
          setSelectedPages={setSelectedPages}
          scheduleMode={scheduleMode}
          setScheduleMode={setScheduleMode}
          startDate={startDate}
          setStartDate={setStartDate}
          startTime={startTime}
          setStartTime={setStartTime}
          intervalMinutes={intervalMinutes}
          setIntervalMinutes={setIntervalMinutes}
          totalProducts={groups.filter((g) => g.productCode !== 'Chưa phân loại').length}
          onNextTab={handleGeneratePreview}
        />
      )}

      {/* TAB 4: PREVIEW BÀI ĐĂNG FACEBOOK */}
      {activeTab === 'preview' && (
        <PreviewPostsTab
          previewPosts={previewPosts}
          setPreviewPosts={setPreviewPosts}
          selectedPages={selectedPages}
          fanpages={fanpages}
          onLaunchCampaign={handleLaunchCampaign}
          launching={launching}
          onBackTab={() => setActiveTab('config')}
        />
      )}

      {/* TAB 5: THEO DÕI TIẾN TRÌNH REALTIME */}
      {activeTab === 'tracker' && (
        <CampaignTrackerTab
          activeCampaignId={activeCampaignId}
          onSelectCampaign={(id) => setActiveCampaignId(id)}
        />
      )}
    </div>
  );
};
