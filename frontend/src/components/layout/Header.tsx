import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore.js';
import { getSocket } from '../../services/socket.js';
import { Radio, Bell, User as UserIcon } from 'lucide-react';

export const Header: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    if (socket.connected) {
      setSocketConnected(true);
    }

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center space-x-4">
        {/* Realtime Live indicator */}
        <div className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-slate-300 font-medium">
            {socketConnected ? 'Realtime Kết nối' : 'Mất kết nối Socket'}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* User Profile */}
        <div className="flex items-center space-x-3 pl-4 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-semibold text-xs">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : <UserIcon className="w-4 h-4" />}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-slate-200">{user?.name || 'Người dùng'}</p>
            <p className="text-[10px] text-slate-400 font-mono capitalize">{user?.role || 'Staff'}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

