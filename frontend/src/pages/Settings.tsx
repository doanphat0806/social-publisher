import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Shield,
  Key,
  Server,
  Database,
  Cloud,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore.js';

export const Settings: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Cài Đặt Hệ Thống</h1>
        <p className="text-sm text-slate-400 mt-1">
          Cấu hình môi trường Meta Developer, Object Storage và thông tin tài khoản quản trị
        </p>
      </div>

      {/* Account Info */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center space-x-2">
          <Shield className="w-4 h-4 text-indigo-400" />
          <span>Thông Tin Người Dùng</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-500 font-semibold uppercase">Họ và tên</span>
            <p className="text-sm font-bold text-white mt-1">{user?.name}</p>
          </div>
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-500 font-semibold uppercase">Email</span>
            <p className="text-sm font-bold text-white mt-1">{user?.email}</p>
          </div>
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-500 font-semibold uppercase">Vai trò (Role)</span>
            <p className="text-sm font-bold text-indigo-400 mt-1 capitalize">{user?.role}</p>
          </div>
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-500 font-semibold uppercase">Mã hóa Token Facebook</span>
            <p className="text-sm font-bold text-emerald-400 mt-1">AES-256-GCM Kích hoạt</p>
          </div>
        </div>
      </div>

      {/* Meta Developer Integration Guide */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center space-x-2">
          <Key className="w-4 h-4 text-blue-400" />
          <span>Cấu Hình Meta Developer App (Facebook Graph API)</span>
        </h2>

        <p className="text-xs text-slate-300 leading-relaxed">
          Để kết nối Fanpage và đăng bài tự động, hệ thống sử dụng Meta Graph API v22.0. Hãy đảm bảo bạn đã tạo App trên Meta for Developers và điền thông tin vào file <code className="text-indigo-400 bg-slate-950 px-2 py-0.5 rounded">.env</code>:
        </p>

        <div className="space-y-2 text-xs font-mono bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-300">
          <p><span className="text-indigo-400">FACEBOOK_APP_ID</span>=your_meta_app_id</p>
          <p><span className="text-indigo-400">FACEBOOK_APP_SECRET</span>=your_meta_app_secret</p>
          <p><span className="text-indigo-400">FACEBOOK_REDIRECT_URI</span>=http://localhost:5000/api/v1/facebook/oauth/callback</p>
          <p><span className="text-indigo-400">FACEBOOK_GRAPH_VERSION</span>=v22.0</p>
        </div>

        <div className="space-y-1.5 text-xs text-slate-400">
          <p className="font-semibold text-slate-300">Các quyền (Permissions) bắt buộc cần cấp:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><code className="text-slate-200">pages_show_list</code>: Xem danh sách các Fanpage bạn quản lý</li>
            <li><code className="text-slate-200">pages_read_engagement</code>: Đọc dữ liệu tương tác của Fanpage</li>
            <li><code className="text-slate-200">pages_manage_posts</code>: Đăng bài viết và ảnh thay mặt Fanpage</li>
          </ul>
        </div>
      </div>

      {/* Object Storage */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center space-x-2">
          <Cloud className="w-4 h-4 text-cyan-400" />
          <span>Hệ Thống Lưu Trữ Hình Ảnh (Storage)</span>
        </h2>

        <p className="text-xs text-slate-300 leading-relaxed">
          Hệ thống hỗ trợ cả <strong>Local Storage</strong> (mặc định lưu tại thư mục <code className="text-cyan-400">/uploads</code>) và <strong>S3-Compatible Object Storage</strong> (AWS S3, Cloudflare R2, MinIO, Wasabi, DigitalOcean Spaces):
        </p>

        <div className="space-y-2 text-xs font-mono bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-300">
          <p><span className="text-cyan-400">STORAGE_TYPE</span>=local # hoặc 's3'</p>
          <p><span className="text-cyan-400">S3_BUCKET</span>=xeko-media</p>
          <p><span className="text-cyan-400">S3_REGION</span>=us-east-1</p>
          <p><span className="text-cyan-400">S3_ACCESS_KEY_ID</span>=your_s3_key</p>
          <p><span className="text-cyan-400">S3_SECRET_ACCESS_KEY</span>=your_s3_secret</p>
        </div>
      </div>
    </div>
  );
};

