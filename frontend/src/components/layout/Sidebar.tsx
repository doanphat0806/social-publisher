import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  Megaphone,
  Images,
  Stamp,
  Package,
  Facebook,
  Calendar,
  History,
  ListOrdered,
  Settings,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore.js';

export const Sidebar: React.FC = () => {
  const logout = useAuthStore((state) => state.logout);

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Tạo chiến dịch', path: '/campaigns/create', icon: PlusCircle },
    { name: 'Đóng dấu ảnh', path: '/watermark', icon: Stamp },
    { name: 'Đăng bài theo mã', path: '/sku-posting', icon: Package },
    { name: 'Danh sách chiến dịch', path: '/campaigns', icon: Megaphone },
    { name: 'Thư viện ảnh', path: '/media', icon: Images },
    { name: 'Quản lý Fanpage', path: '/fanpages', icon: Facebook },
    { name: 'Lịch đăng bài', path: '/calendar', icon: Calendar },
    { name: 'Lịch sử đăng', path: '/history', icon: History },
    { name: 'Hàng đợi đăng bài', path: '/queue', icon: ListOrdered },
    { name: 'Cài đặt', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 z-30 select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-slate-800 flex items-center space-x-3 bg-slate-900/50 backdrop-blur">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="overflow-hidden">
          <h1 className="font-extrabold text-sm tracking-wider text-white uppercase truncate">
            Xeko Xuka
          </h1>
          <p className="text-[10px] text-indigo-400 font-semibold tracking-widest uppercase">
            Bulk Publisher
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Menu Quản Trị
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Logout Footer */}
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={logout}
          className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
};

