import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Pill,
  Boxes,
  AlertTriangle,
  BrainCircuit,
  TrendingDown,
  ShoppingBag,
  History,
  Truck,
  FileBarChart,
  Bell,
  Users,
  Settings,
  Sparkles,
} from 'lucide-react';
import { APP_NAME } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';

export const navigationItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, allowedRoles: ['admin', 'inventory_manager', 'staff'] },
  { name: 'Medicines', path: '/medicines', icon: Pill, allowedRoles: ['admin', 'inventory_manager', 'staff'] },
  { name: 'Batches & Inventory', path: '/inventory', icon: Boxes, allowedRoles: ['admin', 'inventory_manager', 'staff'] },
  { name: 'Expiry Risk', path: '/expiry-risk', icon: AlertTriangle, allowedRoles: ['admin', 'inventory_manager', 'staff'] },
  { name: 'AI Forecasting', path: '/forecasting', icon: BrainCircuit, badge: 'AI', allowedRoles: ['admin', 'inventory_manager'] },
  { name: 'Stockout Predictions', path: '/stockout-predictions', icon: TrendingDown, allowedRoles: ['admin', 'inventory_manager', 'staff'] },
  { name: 'Reorder Recommendations', path: '/reorders', icon: ShoppingBag, allowedRoles: ['admin', 'inventory_manager'] },
  { name: 'Stock Movements', path: '/stock-movements', icon: History, allowedRoles: ['admin', 'inventory_manager', 'staff'] },
  { name: 'Suppliers & Orders', path: '/suppliers', icon: Truck, allowedRoles: ['admin', 'inventory_manager'] },
  { name: 'Purchase Orders', path: '/purchase-orders', icon: Boxes, allowedRoles: ['admin', 'inventory_manager'] },
  { name: 'Reports', path: '/reports', icon: FileBarChart, allowedRoles: ['admin', 'inventory_manager'] },
  { name: 'Notifications', path: '/notifications', icon: Bell, allowedRoles: ['admin', 'inventory_manager', 'staff'] },
  { name: 'User Management', path: '/users', icon: Users, allowedRoles: ['admin'] },
  { name: 'Settings', path: '/settings', icon: Settings, allowedRoles: ['admin', 'inventory_manager'] },
];

export default function Sidebar({ onCloseMobile }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const res = await notificationService.getUnreadCount();
        if (isMounted && res?.data?.unreadCount !== undefined) {
          setUnreadCount(res.data.unreadCount);
        }
      } catch (err) {
        // Silently handle
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const userRole = user?.role || 'staff';
  const visibleItems = navigationItems.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(userRole)
  );

  return (
    <aside className="w-[230px] h-screen bg-gradient-to-b from-[#0B2A5B] to-[#061B3F] text-white flex flex-col flex-shrink-0 select-none shadow-xl border-r border-[#133E7C]/40">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1F6FEB] to-[#00D2FF] flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z" />
          </svg>
        </div>
        <div>
          <span className="font-bold text-base tracking-tight text-white block leading-tight">{APP_NAME}</span>
          <span className="text-[10px] text-blue-200/70 font-medium block">Inventory & Predictor</span>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isNotificationItem = item.path === '/notifications';
          const badgeValue = isNotificationItem && unreadCount > 0 ? unreadCount : null;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-[#1F6FEB] text-white shadow-sm shadow-blue-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className="w-4 h-4 flex-shrink-0 opacity-80 group-hover:opacity-100" />
                <span className="truncate">{item.name}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-400/20 text-blue-300 uppercase">
                  {item.badge}
                </span>
              )}
              {badgeValue && (
                <span className="px-1.5 py-0.5 rounded-full flex items-center justify-center text-[10px] font-bold bg-status-critical text-white min-w-[18px]">
                  {badgeValue}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* AI Status Footer Indicator */}
      <div className="p-3 border-t border-white/10">
        <div className="bg-white/5 rounded-lg p-2.5 flex items-center gap-2 text-xs border border-white/5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <div className="truncate">
            <p className="text-[11px] font-semibold text-white/90 truncate flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-300" /> AI Engine Ready
            </p>
            <p className="text-[10px] text-slate-400 truncate">FastAPI • Random Forest</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
