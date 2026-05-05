/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Calendar, DoorOpen, Settings as SettingsIcon, LogIn, LogOut, Loader2, BarChart3, Menu, X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import { getToken, removeToken, getUser, removeUser } from './lib/api';

// Components
import TeachersPage from './components/TeachersPage';
import ExamsPage from './components/ExamsPage';
import HallsPage from './components/HallsPage';
import AllocationPage from './components/AllocationPage';
import StatsPage from './components/StatsPage';
import SettingsPage from './components/SettingsPage';
import AuthPage from './components/AuthPage';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
  
  const user = getUser();

  // Close sidebar on mobile when tab changes
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeTab]);

  const handleLogout = () => {
    removeToken();
    removeUser();
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="top-center" />
        <AuthPage onLogin={() => setIsAuthenticated(true)} />
      </>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'teachers', label: 'الأساتذة', icon: Users },
    { id: 'exams', label: 'الاختبارات', icon: Calendar },
    { id: 'halls', label: 'القاعات', icon: DoorOpen },
    { id: 'stats', label: 'الإحصائيات', icon: BarChart3 },
    { id: 'settings', label: 'الإعدادات', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex font-sans text-gray-900 overflow-x-hidden print:overflow-visible print:bg-white print:min-h-0 print:block" dir="rtl">
      <div className="print:hidden">
        <Toaster position="top-center" />
      </div>
      
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar for Desktop */}
      <aside className={`
        fixed inset-y-0 right-0 z-50 w-72 bg-white border-l border-gray-200 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static hidden lg:flex print:hidden
      `}>
        <div className="p-8 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3 text-blue-600 font-bold text-xl">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-100">
              <LayoutDashboard size={24} />
            </div>
            <span>نظام الحراسة</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group ${
                  activeTab === tab.id 
                    ? 'bg-blue-50 text-blue-700 font-bold shadow-sm' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 font-medium'
                }`}
              >
                <tab.icon className={`w-5 h-5 transition-colors ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center justify-between px-4 py-3 mb-2 bg-gray-50 rounded-2xl group cursor-pointer hover:bg-red-50 transition-colors" onClick={handleLogout}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm bg-blue-100 group-hover:bg-red-100 flex items-center justify-center text-blue-600 group-hover:text-red-600 font-bold transition-colors">
                {user?.username?.[0]?.toUpperCase() || 'م'}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-gray-900 group-hover:text-red-700 truncate transition-colors">{user?.username || 'المستخدم'}</p>
                <p className="text-[10px] text-gray-500 group-hover:text-red-500 truncate transition-colors">{user?.role || 'الإدارة'} • تسجيل الخروج</p>
              </div>
            </div>
            <LogOut className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-colors" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen pb-24 lg:pb-0 print:pb-0 print:bg-white print:m-0">
        <header className="h-16 lg:h-20 bg-white/80 border-b border-gray-100 flex items-center justify-between px-5 lg:px-10 sticky top-0 z-30 backdrop-blur-md print:hidden">
          <div className="flex items-center gap-3">
            <div className="lg:hidden bg-blue-600 p-1.5 rounded-lg text-white">
              <LayoutDashboard size={18} />
            </div>
            <h2 className="text-lg lg:text-2xl font-bold text-gray-900">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">تسجيل الخروج</span>
            </button>
            <div className="hidden lg:flex w-8 h-8 rounded-full border border-gray-200 shadow-sm bg-blue-100 items-center justify-center text-blue-600 font-bold text-sm">
              {user?.username?.[0]?.toUpperCase() || 'م'}
            </div>
            <span className="hidden md:inline-block bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-xs font-bold border border-blue-100">
              الموسم الدراسي 2025-2026
            </span>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-10 max-w-[1600px] mx-auto w-full print:p-0 print:m-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <AllocationPage />}
              {activeTab === 'teachers' && <TeachersPage />}
              {activeTab === 'exams' && <ExamsPage />}
              {activeTab === 'halls' && <HallsPage />}
              {activeTab === 'stats' && <StatsPage />}
              {activeTab === 'settings' && <SettingsPage />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Navigation for Mobile */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 border-t border-gray-100 px-2 pt-2 pb-6 backdrop-blur-lg flex justify-around z-50 print:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1.5 px-3 py-1 transition-all relative ${
                activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'scale-110' : ''} transition-transform`} />
              <span className={`text-[10px] font-bold ${activeTab === tab.id ? 'opacity-100' : 'opacity-80'}`}>
                {tab.label.split(' ')[0]}
              </span>
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="bottomNav-indicator"
                  className="absolute -top-2 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
                />
              )}
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}
