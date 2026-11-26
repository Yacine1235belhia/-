/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard, Calendar, DoorOpen, Settings as SettingsIcon, Building2,
  BookOpen, Menu, Save, CheckCircle2, Trash2, AlertTriangle, X, Sun, Moon, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import {
  api,
  getWorkspaceStatus,
  initializeWorkspaceOnBoot,
  saveWorkspaceSnapshot,
  clearSavedWorkspace,
  syncPendingWorkspaceIfOnline,
  WORKSPACE_STATUS_EVENT,
  WorkspaceStatus
} from './lib/api';
import { useI18n } from './lib/i18n';

type SystemRoleKey = 'manager' | 'principal' | 'advisor';

const ROLE_DISPLAY: Record<SystemRoleKey, { topLabel: string; bottomLabel: string; initial: string }> = {
  manager: { topLabel: 'المدير', bottomLabel: 'مدير', initial: 'م' },
  principal: { topLabel: 'الناظر', bottomLabel: 'ناظر', initial: 'ن' },
  advisor: { topLabel: 'مستشار التربية', bottomLabel: 'مستشار التربية', initial: 'م' },
};

// Components
import ClassCouncilsPage from './components/ClassCouncilsPage';
import ExamsPage from './components/ExamsPage';
import HallsPage from './components/HallsPage';
import AllocationPage from './components/AllocationPage';
import SettingsPage from './components/SettingsPage';
import PreferencesPage from './components/PreferencesPage';

export default function App() {
  const { language, setLanguage, theme, toggleTheme, dir, t } = useI18n();
  const [activeTab, setActiveTab] = useState('exams');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceEpoch, setWorkspaceEpoch] = useState(0);
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>(() => getWorkspaceStatus());
  const [isSaving, setIsSaving] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [systemRole, setSystemRole] = useState<SystemRoleKey>('principal');

  // Initialize workspace on app boot: wipe unsaved data or restore last saved snapshot
  useEffect(() => {
    let mounted = true;
    initializeWorkspaceOnBoot()
      .then(() => {
        if (mounted) {
          setWorkspaceStatus(getWorkspaceStatus());
          setWorkspaceReady(true);
        }
      })
      .catch(() => {
        if (mounted) {
          setWorkspaceStatus(getWorkspaceStatus());
          setWorkspaceReady(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Load saved/current activeRole whenever workspace boots or resets
  useEffect(() => {
    if (!workspaceReady) return;
    api.get('/api/settings')
      .then((data) => {
        const r = data?.activeRole;
        if (r === 'manager' || r === 'principal' || r === 'advisor') {
          setSystemRole(r);
        } else {
          setSystemRole('principal');
        }
      })
      .catch(() => {});
  }, [workspaceReady, workspaceEpoch]);

  // Listen to dirty/saved status and live role changes across tabs & components
  useEffect(() => {
    const onStatusChange = (e: Event) => {
      const custom = e as CustomEvent<WorkspaceStatus>;
      setWorkspaceStatus(custom.detail || getWorkspaceStatus());
    };
    const onRoleChange = (e: Event) => {
      const custom = e as CustomEvent<SystemRoleKey>;
      if (custom.detail === 'manager' || custom.detail === 'principal' || custom.detail === 'advisor') {
        setSystemRole(custom.detail);
      }
    };
    window.addEventListener(WORKSPACE_STATUS_EVENT, onStatusChange);
    window.addEventListener('hirasa:role-change', onRoleChange);
    return () => {
      window.removeEventListener(WORKSPACE_STATUS_EVENT, onStatusChange);
      window.removeEventListener('hirasa:role-change', onRoleChange);
    };
  }, []);

  // Listen to online/offline transitions and auto-sync offline saved snapshots
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const synced = await syncPendingWorkspaceIfOnline();
      if (synced) {
        toast.success('عادت الشبكة — تمت مزامنة البيانات المحفوظة تلقائياً');
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast('أنت الآن في وضع عدم الاتصال — سيتم الحفظ محلياً بدون إنترنت', { icon: '📡' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Warn user on tab close / refresh if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (workspaceStatus.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [workspaceStatus.hasUnsavedChanges]);

  // Close sidebar on mobile when tab changes
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeTab]);

  const handleSaveWorkspace = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    toast.loading('جاري حفظ جميع بيانات التطبيق...', { id: 'workspace-save' });
    try {
      const { syncedOnline } = await saveWorkspaceSnapshot();
      setWorkspaceStatus(getWorkspaceStatus());
      if (syncedOnline) {
        toast.success('تم حفظ جميع البيانات بنجاح! لن تُفقد عند التحديث أو الإغلاق.', { id: 'workspace-save' });
      } else {
        toast.success('تم الحفظ محلياً (بدون إنترنت)! ستبقى بياناتك محفوظة عند التحديث أو الإغلاق.', { id: 'workspace-save' });
      }
    } catch {
      toast.error('تعذر إتمام عملية الحفظ', { id: 'workspace-save' });
    } finally {
      setIsSaving(false);
    }
  }, [isSaving]);

  // Keyboard shortcut Ctrl+S / Cmd+S to save workspace
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveWorkspace();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSaveWorkspace]);

  const handleConfirmResetWorkspace = async () => {
    setIsResetting(true);
    toast.loading('جاري إفراغ التطبيق ومسح البيانات المحفوظة...', { id: 'workspace-reset' });
    try {
      await clearSavedWorkspace();
      setWorkspaceStatus(getWorkspaceStatus());
      setWorkspaceEpoch(prev => prev + 1);
      setIsResetModalOpen(false);
      toast.success('تم مسح المحفوظ وإفراغ التطبيق بالكامل', { id: 'workspace-reset' });
    } catch {
      toast.error('حدث خطأ أثناء إفراغ التطبيق', { id: 'workspace-reset' });
    } finally {
      setIsResetting(false);
    }
  };

  const tabs = [
    { id: 'settings', label: 'معلومات المؤسسة', icon: Building2 },
    { id: 'exams', label: 'جداول الاختبارات', icon: Calendar },
    { id: 'halls', label: 'إعداد قاعات الامتحان', icon: DoorOpen },
    { id: 'dashboard', label: 'ضبط جداول حراسة الأساتذة', icon: LayoutDashboard },
    { id: 'teachers', label: 'مجالس الأقسام', icon: BookOpen },
    { id: 'preferences', label: 'الإعدادات', icon: SettingsIcon },
  ];

  if (!workspaceReady) {
    return (
      <div className="min-h-screen bg-[#0B132B] flex flex-col items-center justify-center text-slate-200 gap-4 font-sans" dir={dir}>
        <div className="w-14 h-14 rounded-2xl bg-[#0099FF]/20 border border-sky-500/40 flex items-center justify-center animate-pulse">
          <span className="text-2xl font-black text-sky-400">H</span>
        </div>
        <p className="text-sm font-bold text-slate-300">جاري تهيئة بيئة العمل والتحقق من البيانات المحفوظة...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B132B] flex font-sans text-slate-100 overflow-x-hidden print:overflow-visible print:bg-white print:min-h-0 print:block" dir={dir}>
      <div className="print:hidden">
        <Toaster position="top-center" />
      </div>

      {/* Mobile Overlay & Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: dir === 'rtl' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: dir === 'rtl' ? '100%' : '-100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className={`fixed inset-y-0 ${dir === 'rtl' ? 'right-0 border-l' : 'left-0 border-r'} z-50 w-72 bg-[#091021] border-slate-800 flex flex-col lg:hidden shadow-2xl`}
            >
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0099FF] text-white flex items-center justify-center font-black text-lg">
                    H
                  </div>
                  <span className="text-base font-black text-white">Hirasa Pro</span>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-right cursor-pointer ${
                        isActive
                          ? 'bg-[#0099FF] text-white font-black'
                          : 'text-slate-400 hover:bg-[#121E36] hover:text-white font-bold'
                      }`}
                    >
                      <tab.icon className="w-5 h-5 shrink-0" />
                      <span className="text-xs truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Hirasa Pro Desktop Sidebar */}
      <aside className={`fixed inset-y-0 ${dir === 'rtl' ? 'right-0 border-l' : 'left-0 border-r'} z-50 w-72 bg-[#091021] border-slate-800/80 flex-col transition-transform duration-300 lg:translate-x-0 lg:static hidden lg:flex print:hidden shadow-2xl`}>
        {/* Logo & Header */}
        <div className="p-6 border-b border-slate-800/80 text-center space-y-1">
          <div className="w-12 h-12 rounded-full bg-[#0099FF] text-white flex items-center justify-center font-black text-2xl mx-auto shadow-lg shadow-sky-500/30 ring-4 ring-sky-500/20">
            H
          </div>
          <h1 className="text-xl font-black tracking-wide text-white mt-2">Hirasa Pro</h1>
          <p className="text-[11px] text-slate-400 font-medium">نظام إدارة الاختبارات</p>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto space-y-1.5 custom-scrollbar">
          <div className="text-[10px] font-bold text-slate-500 px-3 mb-2">القائمة الرئيسية</div>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-200 group text-right cursor-pointer ${
                  isActive
                    ? 'bg-[#0099FF] text-white font-black shadow-lg shadow-sky-500/20'
                    : 'text-slate-400 hover:bg-[#121E36] hover:text-white font-bold'
                }`}
              >
                <tab.icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-cyan-400'}`} />
                <span className="text-xs truncate">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Role Card Footer */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
          <div className="bg-[#121E36] border border-slate-800 p-3 rounded-2xl flex items-center justify-center">
            <span className="text-xs font-black text-slate-300 px-3 py-1 rounded-xl bg-[#182643] border border-slate-700">
              {ROLE_DISPLAY[systemRole].bottomLabel}
            </span>
          </div>

          <div className="text-center text-[11px] text-slate-400 font-mono tracking-wider">
            created by <span data-no-translate="true" className="text-cyan-400 font-bold">prof belhia yacine</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen pb-24 lg:pb-0 print:pb-0 print:bg-white print:m-0">

        {/* Top Header Bar */}
        <header className="py-3 px-4 sm:px-6 bg-[#091021]/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between sticky top-0 z-30 backdrop-blur-md print:hidden gap-3">

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-300 hover:text-white bg-[#121E36] rounded-xl cursor-pointer"
            >
              <Menu size={20} />
            </button>

            {/* Save & Session Status Controls */}
            <button
              type="button"
              onClick={handleSaveWorkspace}
              disabled={isSaving}
              title={
                workspaceStatus.hasUnsavedChanges
                  ? 'لديك تغييرات غير محفوظة — اضغط للحفظ وتثبيت البيانات (Ctrl+S)'
                  : 'حفظ نسخة من جميع بيانات التطبيق للعمل أوفلاين وعند التحديث'
              }
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md disabled:opacity-60 ${
                workspaceStatus.hasUnsavedChanges
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-amber-400/80'
                  : workspaceStatus.hasSavedSnapshot
                  ? 'bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40'
                  : 'bg-[#0099FF] hover:bg-sky-500 text-white'
              }`}
            >
              {workspaceStatus.hasUnsavedChanges ? (
                <>
                  <Save size={15} />
                  <span>{isSaving ? 'جاري الحفظ...' : 'حفظ البيانات (تغييرات غير محفوظة)'}</span>
                </>
              ) : workspaceStatus.hasSavedSnapshot ? (
                <>
                  <CheckCircle2 size={15} />
                  <span>تم الحفظ</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>{isSaving ? 'جاري الحفظ...' : 'حفظ البيانات'}</span>
                </>
              )}
            </button>

            {(workspaceStatus.hasSavedSnapshot || workspaceStatus.hasUnsavedChanges) && (
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-600/15 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                title="مسح البيانات المحفوظة وإفراغ التطبيق بالكامل"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">إفراغ التطبيق</span>
              </button>
            )}
          </div>

          {/* Center Top Republic Banner */}
          <div className="hidden md:flex flex-col items-center justify-center bg-[#0099FF]/20 border border-sky-500/40 px-5 py-1 rounded-2xl text-center shadow-lg shadow-sky-500/10">
            <span className="text-[10px] font-bold text-sky-300 tracking-wide">الجمهورية الجزائرية الديمقراطية الشعبية</span>
            <span className="text-xs font-black text-white">وزارة التربية الوطنية</span>
          </div>

          {/* Right Action Bar: Theme, Language & User */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? t('الوضع النهاري', 'Mode clair', 'Light Mode') : t('الوضع الليلي', 'Mode sombre', 'Dark Mode')}
              className="flex items-center gap-1.5 bg-[#121E36] hover:bg-[#182643] px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-sky-600" />}
              <span className="hidden xl:inline">
                {theme === 'dark' ? t('الوضع النهاري', 'Mode clair', 'Light') : t('الوضع الليلي', 'Mode sombre', 'Dark')}
              </span>
            </button>

            <div className="flex items-center bg-[#121E36] p-0.5 rounded-xl border border-slate-800" data-no-translate="true">
              <Globe size={13} className="text-cyan-400 mx-1.5 hidden sm:inline shrink-0" />
              {(['ar', 'fr', 'en'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-black uppercase transition-all cursor-pointer ${
                    language === code
                      ? 'bg-[#0099FF] text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>

            <div className="hidden sm:flex items-center gap-2 bg-[#121E36] px-3 py-1.5 rounded-xl border border-slate-800">
              <div className="w-6 h-6 rounded-lg bg-[#0099FF] text-white flex items-center justify-center font-bold text-xs">
                {ROLE_DISPLAY[systemRole].initial}
              </div>
              <span className="text-xs font-bold text-slate-300">{ROLE_DISPLAY[systemRole].topLabel}</span>
            </div>
          </div>

        </header>

        {/* Unsaved Warning Strip */}
        {workspaceStatus.hasUnsavedChanges && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-1.5 text-[11px] text-amber-200 font-bold flex items-center justify-center gap-2 print:hidden">
            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
            <span>تنبيه: التعديلات الحالية مؤقتة وستُمسح تلقائياً عند تحديث الصفحة أو الخروج ما لم تضغط على «حفظ البيانات».</span>
          </div>
        )}

        {/* Viewport Content Container */}
        <div className="flex-1 p-4 lg:p-8 max-w-[1600px] mx-auto w-full print:p-0 print:m-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}_${workspaceEpoch}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'settings' && <SettingsPage />}
              {activeTab === 'exams' && <ExamsPage />}
              {activeTab === 'halls' && <HallsPage />}
              {activeTab === 'dashboard' && <AllocationPage />}
              {activeTab === 'teachers' && <ClassCouncilsPage onGoToProctoring={() => setActiveTab('dashboard')} />}
              {activeTab === 'preferences' && <PreferencesPage />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Global Page Footer */}
        <footer className="mt-auto py-3 px-6 border-t border-slate-800/80 bg-[#091021]/80 text-center text-xs text-slate-400 font-mono print:hidden">
          created by <span data-no-translate="true" className="text-cyan-400 font-bold">prof belhia yacine</span>
        </footer>

        {/* Bottom Navigation for Mobile */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#091021]/95 border-t border-slate-800 px-1 pt-2 pb-6 backdrop-blur-lg flex justify-around z-50 print:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 px-2 py-1 transition-all relative ${
                activeTab === tab.id ? 'text-cyan-400' : 'text-slate-400'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'scale-110' : ''} transition-transform`} />
              <span className={`text-[9px] font-bold ${activeTab === tab.id ? 'opacity-100' : 'opacity-70'}`}>
                {t(tab.label).split(' ')[0]}
              </span>
            </button>
          ))}
        </nav>

      </main>

      {/* Offline Floating Indicator */}
      {!isOnline && (
        <div className="fixed bottom-20 lg:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-black text-slate-950 shadow-xl print:hidden">
          <span className="h-2 w-2 rounded-full bg-slate-950 animate-pulse" />
          <span>وضع عدم الاتصال — يتم العمل والحفظ محلياً بدون إنترنت</span>
        </div>
      )}

      {/* Clear & Reset Workspace Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md print:hidden" dir={dir}>
          <div className="bg-[#121E36] border border-rose-500/40 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100">
            <div className="p-4 bg-rose-600/20 border-b border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h4 className="font-black text-sm text-white">إفراغ التطبيق ومسح المحفوظ</h4>
                  <p className="text-[11px] text-rose-200 mt-0.5">العودة إلى تطبيق خالٍ تماماً</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setIsResetModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 text-xs text-slate-300 leading-relaxed">
              هل أنت متأكد من مسح جميع البيانات الحالية والمحفوظة (الأساتذة، التلاميذ، القاعات، الأفواج، الاختبارات، والحراسة) ليصبح التطبيق خالياً بالكامل؟
            </div>

            <div className="p-4 bg-[#091021] border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleConfirmResetWorkspace}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={15} />
                <span>{isResetting ? 'جاري الإفراغ...' : 'نعم، إفراغ التطبيق بالكامل'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
