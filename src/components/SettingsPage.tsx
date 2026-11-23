import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { LevelKey, LevelTimingConfig, SystemSettings } from '../types';
import {
  createDefaultLevelTimings,
  deriveMorningPeriodFromSlots,
  syncExamsAndScheduleWithSettings,
} from '../lib/timings';
import {
  Save, Building2, Calendar, Shield, Database, AlertCircle, UserCheck,
  Clock, Layers, Sparkles, RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    institutionName: 'ثانوية محمد بلخير',
    wilaya: 'البيض',
    schoolYear: '2025-2026',
    selectedTerm: 'الفصل الثالث',
    proctorRatio: 2,
    morningTime: '08:00 - 12:00',
    afternoonTime: '13:00 - 17:00',
    morningSlot1: '08:00 - 10:00',
    morningSlot2: '10:00 - 12:00',
    includeAfternoon: false,
    afternoonSlot: '13:30 - 15:30',
    separateLevelTimings: false,
    levelTimings: createDefaultLevelTimings(),
    examStartDate: new Date().toISOString().split('T')[0],
    selectedLevels: ['1ثا', '2ثا', '3ثا']
  });

  const [activeRole, setActiveRole] = useState<'manager' | 'principal' | 'advisor'>('principal');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [syncingTimings, setSyncingTimings] = useState(false);
  const [baladiya, setBaladiya] = useState('البيض');

  useEffect(() => {
    api.get('/api/settings').then((data) => {
      if (data && Object.keys(data).length > 0) {
        const loaded = data as SystemSettings & { baladiya?: string; activeRole?: 'manager' | 'principal' | 'advisor' };
        const defaults = createDefaultLevelTimings();
        const mergedLevelTimings = {
          first: { ...defaults.first, ...(loaded.levelTimings?.first || {}) },
          second: { ...defaults.second, ...(loaded.levelTimings?.second || {}) },
          third: { ...defaults.third, ...(loaded.levelTimings?.third || {}) },
        };
        setSettings((prev) => ({
          ...prev,
          ...loaded,
          levelTimings: mergedLevelTimings,
          selectedLevels: loaded.selectedLevels || ['1ثا', '2ثا', '3ثا'],
          examStartDate: loaded.examStartDate || new Date().toISOString().split('T')[0]
        }));
        if (loaded.baladiya) {
          setBaladiya(loaded.baladiya === 'مصطفى بن ابراهيم' ? 'البيض' : loaded.baladiya);
        }
        if (loaded.activeRole) setActiveRole(loaded.activeRole);
      }
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const updateAndAutoPersist = (nextSettings: SystemSettings) => {
    setSettings(nextSettings);
    api.post('/api/settings', { ...nextSettings, baladiya, activeRole }).catch(() => {});
  };

  const persistAndSyncTimings = async (nextSettings: SystemSettings, message?: string) => {
    setSyncingTimings(true);
    try {
      setSettings(nextSettings);
      await api.post('/api/settings', { ...nextSettings, baladiya, activeRole });
      const updatedExamsCount = await syncExamsAndScheduleWithSettings(nextSettings);
      if (message) {
        toast.success(
          updatedExamsCount > 0
            ? `${message} (تم تحديث ${updatedExamsCount} اختبار)`
            : message,
          { id: 'timings-sync' }
        );
      }
    } catch {
      toast.error('تعذر مزامنة التوقيتات', { id: 'timings-sync' });
    } finally {
      setSyncingTimings(false);
    }
  };

  const handleToggleSeparateTimings = (enabled: boolean) => {
    const defaults = createDefaultLevelTimings();
    const currentLevels = settings.levelTimings || defaults;
    const nextSettings: SystemSettings = {
      ...settings,
      separateLevelTimings: enabled,
      levelTimings: {
        first: { ...defaults.first, ...currentLevels.first },
        second: { ...defaults.second, ...currentLevels.second },
        third: { ...defaults.third, ...currentLevels.third },
      },
    };
    persistAndSyncTimings(
      nextSettings,
      enabled
        ? 'تم تفعيل فصل توقيت الاختبارات حسب المستويات ومزامنة الجداول'
        : 'تم اعتماد التوقيت الموحد لجميع المستويات ومزامنة الجداول'
    );
  };

  const handleApplySplitPreset = (preset: 'split_morning' | 'standard_two_slots') => {
    const nextLevels =
      preset === 'split_morning'
        ? {
            first: {
              morningSlot1: '08:00 - 10:00',
              morningSlot2: '',
              includeAfternoon: false,
              afternoonSlot: '13:30 - 15:30',
              morningTime: '08:00 - 10:00',
              afternoonTime: '13:30 - 15:30',
            },
            second: {
              morningSlot1: '08:00 - 10:00',
              morningSlot2: '',
              includeAfternoon: false,
              afternoonSlot: '13:30 - 15:30',
              morningTime: '08:00 - 10:00',
              afternoonTime: '13:30 - 15:30',
            },
            third: {
              morningSlot1: '10:00 - 12:00',
              morningSlot2: '',
              includeAfternoon: false,
              afternoonSlot: '15:30 - 17:30',
              morningTime: '10:00 - 12:00',
              afternoonTime: '15:30 - 17:30',
            },
          }
        : createDefaultLevelTimings();

    const nextSettings: SystemSettings = {
      ...settings,
      separateLevelTimings: true,
      levelTimings: nextLevels,
    };

    persistAndSyncTimings(
      nextSettings,
      preset === 'split_morning'
        ? 'تم تطبيق توقيت 08:00-10:00 للسنوات 1و2 و 10:00-12:00 للسنة 3 في الاختبارات والحراسة'
        : 'تم ضبط التوقيت القياسي (حصتين صباحاً) لكل مستوى'
    );
  };

  const handleUnifiedTimingField = (
    field: 'morningSlot1' | 'morningSlot2' | 'includeAfternoon' | 'afternoonSlot' | 'morningTime' | 'afternoonTime',
    value: string | boolean
  ) => {
    const updated: SystemSettings = { ...settings, [field]: value };
    if (field === 'morningSlot1' || field === 'morningSlot2') {
      updated.morningTime = deriveMorningPeriodFromSlots(
        updated.morningSlot1,
        updated.morningSlot2,
        updated.morningTime || '08:00 - 12:00'
      );
    }
    if (field === 'afternoonSlot' && updated.includeAfternoon && typeof value === 'string' && value.trim()) {
      updated.afternoonTime = value.trim();
    }
    updateAndAutoPersist(updated);
  };

  const handleLevelTimingField = (
    level: LevelKey,
    field: keyof LevelTimingConfig,
    value: string | boolean
  ) => {
    const currentLevels = settings.levelTimings || createDefaultLevelTimings();
    const cur = { ...currentLevels[level], [field]: value };
    if (field === 'morningSlot1' || field === 'morningSlot2') {
      cur.morningTime = deriveMorningPeriodFromSlots(
        cur.morningSlot1,
        cur.morningSlot2,
        cur.morningTime || '08:00 - 12:00'
      );
    }
    if (field === 'afternoonSlot' && cur.includeAfternoon && typeof value === 'string' && value.trim()) {
      cur.afternoonTime = value.trim();
    }
    const nextSettings: SystemSettings = {
      ...settings,
      levelTimings: {
        ...currentLevels,
        [level]: cur,
      },
    };
    updateAndAutoPersist(nextSettings);
  };

  const handleRoleSelect = (roleId: 'manager' | 'principal' | 'advisor') => {
    setActiveRole(roleId);
    window.dispatchEvent(new CustomEvent('hirasa:role-change', { detail: roleId }));
    api.post('/api/settings', { ...settings, baladiya, activeRole: roleId }).catch(() => {});
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      await api.post('/api/settings', { ...settings, baladiya, activeRole });
      await syncExamsAndScheduleWithSettings(settings);
      window.dispatchEvent(new CustomEvent('hirasa:role-change', { detail: activeRole }));
      toast.success('تم حفظ معلومات المؤسسة ومزامنة توقيت الاختبارات والحراسة بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  const isThirdTerm = (settings.selectedTerm || 'الفصل الثالث').includes('الثالث') || (settings.selectedTerm || '').includes('3');

  const seedData = async () => {
    setSeeding(true);
    try {
      toast.loading('جاري إضافة البيانات التجريبية...', { id: 'seeding' });
      await api.post('/api/seed', {});
      toast.success('تم إضافة البيانات التجريبية بنجاح', { id: 'seeding' });
    } catch (error: any) {
      console.error(error);
      toast.error('حدث خطأ أثناء إضافة البيانات', { id: 'seeding' });
    } finally {
      setSeeding(false);
    }
  };

  const clearData = async () => {
    setSeeding(true);
    try {
      toast.loading('جاري مسح البيانات...', { id: 'cleaning' });
      await api.delete('/api/clear-all');
      toast.success('تم مسح البيانات بنجاح', { id: 'cleaning' });
    } catch (error: any) {
      console.error(error);
      toast.error('حدث خطأ أثناء مسح البيانات', { id: 'cleaning' });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-6xl mx-auto">
      
      {/* Top Page Header */}
      <div className="mb-2">
        <h2 className="text-2xl font-black text-white">إعداد المؤسسة</h2>
        <p className="text-xs text-slate-400 mt-1">قم بإدخال معلومات المؤسسة وتحديد رتبة مدير النظام</p>
      </div>

      {/* Main Settings Card Container - Hirasa Pro Dark Theme */}
      <div className="bg-[#0D162A] border border-slate-800 rounded-3xl p-6 lg:p-8 space-y-8 shadow-2xl">
        
        {/* Card Header & Save Button */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#0099FF]/20 text-[#0099FF] p-3 rounded-2xl border border-[#0099FF]/30">
              <Building2 size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">معلومات المؤسسة</h3>
              <p className="text-xs text-slate-400">بيانات التعريف ورتبة مستعمل التطبيق</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSave()}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-2.5 rounded-xl text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer w-fit"
          >
            <Save size={18} />
            حفظ المعلومات
          </button>
        </div>

        {/* System Manager Role Tabs Selector matching Screenshot 1 */}
        <div className="bg-[#121E36] border border-slate-700/60 p-5 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
            <UserCheck size={18} />
            <span>مدير النظام</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'advisor', label: 'مستشار التربية' },
              { id: 'principal', label: 'ناظر' },
              { id: 'manager', label: 'مدير' },
            ].map((r) => {
              const isActive = activeRole === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleRoleSelect(r.id as 'manager' | 'principal' | 'advisor')}
                  className={`py-3 px-4 rounded-xl font-black text-sm text-center transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/20'
                      : 'bg-[#182643] text-slate-400 hover:bg-[#1E2F52] border border-slate-700/40'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSave} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">اسم المؤسسة *</label>
              <input
                value={settings.institutionName}
                onChange={e => setSettings({ ...settings, institutionName: e.target.value })}
                className="w-full p-3.5 bg-[#121E36] border border-slate-700/80 rounded-xl outline-none focus:border-cyan-400 text-white text-sm font-bold transition-all"
                placeholder="مثلاً: ثانوية محمد بلخير"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">البلدية</label>
              <input
                value={baladiya}
                onChange={e => setBaladiya(e.target.value)}
                className="w-full p-3.5 bg-[#121E36] border border-slate-700/80 rounded-xl outline-none focus:border-cyan-400 text-white text-sm font-bold transition-all"
                placeholder="مثلاً: البيض"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">مديرية التربية لولاية</label>
              <input
                value={settings.wilaya || ''}
                onChange={e => setSettings({ ...settings, wilaya: e.target.value })}
                className="w-full p-3.5 bg-[#121E36] border border-slate-700/80 rounded-xl outline-none focus:border-cyan-400 text-white text-sm font-bold transition-all"
                placeholder="مثلاً: البيض"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">الموسم الدراسي</label>
              <input
                value={settings.schoolYear || '2025-2026'}
                onChange={e => setSettings({ ...settings, schoolYear: e.target.value })}
                className="w-full p-3.5 bg-[#121E36] border border-slate-700/80 rounded-xl outline-none focus:border-cyan-400 text-white text-sm font-mono text-center font-bold"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">الفصل الدراسي الحالي</label>
              <select
                value={settings.selectedTerm || 'الفصل الثالث'}
                onChange={e => {
                  const newTerm = e.target.value;
                  updateAndAutoPersist({ ...settings, selectedTerm: newTerm });
                  toast.success(`تم اعتماد ${newTerm} ومزامنته مع جدول الحراسة`, { id: 'term-sync' });
                }}
                className="w-full p-3.5 bg-[#121E36] border border-slate-700/80 rounded-xl outline-none focus:border-cyan-400 text-white text-sm font-bold cursor-pointer"
              >
                <option value="الفصل الأول">الفصل الأول</option>
                <option value="الفصل الثاني">الفصل الثاني</option>
                <option value="الفصل الثالث">الفصل الثالث</option>
              </select>
              <p className="text-[11px] font-bold text-cyan-300/90">
                {isThirdTerm
                  ? 'السنة 3: امتحان البكالوريا التجريبي'
                  : `اختبارات ${settings.selectedTerm || 'الفصل الأول'}: السنوات 1 و 2 و 3`}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">نسبة الحراسة لكل قاعة</label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={settings.proctorRatio}
                  onChange={e => updateAndAutoPersist({ ...settings, proctorRatio: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full p-3.5 bg-[#121E36] border border-slate-700/80 rounded-xl outline-none focus:border-cyan-400 text-white text-sm font-bold text-center"
                />
                <Shield className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Exam Schedule Configuration Card */}
          <div className="p-6 bg-[#121E36] rounded-2xl border border-slate-700/60 space-y-6">
            <h4 className="text-sm font-bold text-sky-400 flex items-center gap-2">
              <Calendar size={18} />
              تواريخ بداية ونهاية الاختبارات والسنوات المعنية
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">تاريخ بداية الاختبارات (أول يوم)</label>
                <input
                  type="date"
                  value={settings.examStartDate || ''}
                  onChange={e => setSettings({ ...settings, examStartDate: e.target.value })}
                  className="w-full p-3.5 bg-[#182643] border border-slate-700 rounded-xl outline-none focus:border-cyan-400 text-white text-sm font-mono font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">تاريخ نهاية الاختبارات (آخر يوم)</label>
                <input
                  type="date"
                  value={settings.examEndDate || ''}
                  onChange={e => setSettings({ ...settings, examEndDate: e.target.value })}
                  className="w-full p-3.5 bg-[#182643] border border-slate-700 rounded-xl outline-none focus:border-cyan-400 text-white text-sm font-mono font-bold"
                />
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-700/60">
              <label className="block text-xs font-bold text-slate-300">اختيار السنوات / المستويات المعنية بالامتحان</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: '1ثا', label: 'السنة الأولى ثانوي', badge: '1 ثا' },
                  { id: '2ثا', label: 'السنة الثانية ثانوي', badge: '2 ثا' },
                  { id: '3ثا', label: isThirdTerm ? 'السنة الثالثة (بكالوريا تجريبي)' : 'السنة الثالثة ثانوي', badge: '3 ثا' },
                ].map((lvl) => {
                  const selected = settings.selectedLevels || ['1ثا', '2ثا', '3ثا'];
                  const isChecked = selected.includes(lvl.id);
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => {
                        const current = settings.selectedLevels || ['1ثا', '2ثا', '3ثا'];
                        const updated = isChecked
                          ? current.filter((item) => item !== lvl.id)
                          : [...current, lvl.id];
                        updateAndAutoPersist({ ...settings, selectedLevels: updated });
                      }}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isChecked
                          ? 'border-cyan-400 bg-[#0099FF]/20 text-white font-bold'
                          : 'border-slate-700 bg-[#182643] text-slate-400 hover:bg-[#1E2F52]'
                      }`}
                    >
                      <span className="text-xs font-bold">{lvl.label}</span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-[#0099FF] text-white font-black">
                        {lvl.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Exam & Proctoring Schedule Timings (Unified OR Level-Separated) */}
          <div className="p-6 bg-[#121E36] rounded-2xl border border-slate-700/60 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2 flex-wrap">
                    <span>تحديد توقيت الاختبارات والحراسة</span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black border ${
                      settings.separateLevelTimings
                        ? 'bg-purple-500/20 text-purple-200 border-purple-400/40'
                        : 'bg-[#0099FF]/20 text-cyan-200 border-cyan-400/40'
                    }`}>
                      {settings.separateLevelTimings ? 'توقيت منفصل حسب المستوى' : 'توقيت موحد للكل'}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    يرتبط التوقيت المحدد هنا مباشرةً بخانات <strong className="text-slate-200">جدول الاختبارات</strong> و<strong className="text-slate-200">جدول الحراسة والاستدعاءات</strong>.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleSeparateTimings(!settings.separateLevelTimings)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                    settings.separateLevelTimings
                      ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400 shadow-lg shadow-purple-500/20'
                      : 'bg-[#182643] hover:bg-[#1E2F52] text-cyan-300 border-cyan-500/40'
                  }`}
                >
                  <Layers size={15} />
                  <span>
                    {settings.separateLevelTimings
                      ? 'فصل توقيت المستويات: مفعّل ✓'
                      : 'تفعيل فصل توقيت الاختبارات للمستويات'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={syncingTimings}
                  onClick={() => persistAndSyncTimings(settings, 'تم تحديث ومزامنة التوقيتات في جدول الاختبارات والحراسة')}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  <RefreshCw size={14} className={syncingTimings ? 'animate-spin' : ''} />
                  <span>مزامنة التوقيت الآن</span>
                </button>
              </div>
            </div>

            {!settings.separateLevelTimings ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-300">حصة الاختبار 1 (صباحاً)</label>
                    <input
                      value={settings.morningSlot1 ?? '08:00 - 10:00'}
                      onChange={e => handleUnifiedTimingField('morningSlot1', e.target.value)}
                      onBlur={() => syncExamsAndScheduleWithSettings(settings)}
                      placeholder="08:00 - 10:00"
                      className="w-full p-3 bg-[#182643] border border-slate-700 rounded-xl outline-none focus:border-cyan-400 text-white text-sm font-mono font-bold text-center"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-300">حصة الاختبار 2 (اختياري)</label>
                    <input
                      value={settings.morningSlot2 ?? '10:00 - 12:00'}
                      onChange={e => handleUnifiedTimingField('morningSlot2', e.target.value)}
                      onBlur={() => syncExamsAndScheduleWithSettings(settings)}
                      placeholder="10:00 - 12:00 (أو فارغ)"
                      className="w-full p-3 bg-[#182643] border border-slate-700 rounded-xl outline-none focus:border-cyan-400 text-white text-sm font-mono font-bold text-center"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-cyan-300">الفترة الصباحية (للحراسة)</label>
                    <input
                      value={settings.morningTime || '08:00 - 12:00'}
                      onChange={e => handleUnifiedTimingField('morningTime', e.target.value)}
                      onBlur={() => syncExamsAndScheduleWithSettings(settings)}
                      className="w-full p-3 bg-[#091021] border border-cyan-500/40 rounded-xl outline-none focus:border-cyan-400 text-cyan-200 text-sm font-mono font-bold text-center"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-purple-300">الفترة المسائية (للحراسة)</label>
                    <input
                      value={settings.afternoonTime || '13:00 - 17:00'}
                      onChange={e => handleUnifiedTimingField('afternoonTime', e.target.value)}
                      onBlur={() => syncExamsAndScheduleWithSettings(settings)}
                      className="w-full p-3 bg-[#091021] border border-purple-500/40 rounded-xl outline-none focus:border-purple-400 text-purple-200 text-sm font-mono font-bold text-center"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#182643]/70 p-3.5 rounded-xl border border-slate-700/60">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.includeAfternoon)}
                      onChange={e => {
                        const checked = e.target.checked;
                        const next = { ...settings, includeAfternoon: checked };
                        persistAndSyncTimings(next);
                      }}
                      className="w-4 h-4 text-sky-500 rounded border-slate-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <span>إدراج حصة مسائية تلقائياً في جدول الاختبارات</span>
                  </label>

                  {settings.includeAfternoon && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">توقيت الحصة المسائية:</span>
                      <input
                        value={settings.afternoonSlot || '13:30 - 15:30'}
                        onChange={e => handleUnifiedTimingField('afternoonSlot', e.target.value)}
                        onBlur={() => syncExamsAndScheduleWithSettings(settings)}
                        className="w-36 p-2 bg-[#091021] border border-slate-700 rounded-xl outline-none focus:border-cyan-400 text-white text-xs font-mono font-bold text-center"
                        dir="ltr"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Quick Presets Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#091021]/80 p-3 rounded-xl border border-purple-500/30">
                  <span className="text-xs font-bold text-purple-200">قوالب سريعة لفصل توقيت المستويات:</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplySplitPreset('split_morning')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/25 hover:bg-purple-600/40 text-purple-200 border border-purple-400/40 text-xs font-black transition-all cursor-pointer"
                    >
                      <Sparkles size={13} />
                      <span>1و2 ثا (08:00 - 10:00) • 3 ثا (10:00 - 12:00)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplySplitPreset('standard_two_slots')}
                      className="px-3 py-1.5 rounded-xl bg-[#182643] hover:bg-[#1E2F52] text-slate-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
                    >
                      إرجاع حصتين لكل مستوى
                    </button>
                  </div>
                </div>

                {/* 3 Separate Level Timing Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {([
                    {
                      key: 'first' as LevelKey,
                      title: 'السنة الأولى ثانوي (1 ثا)',
                      badge: '1 ثا',
                      accent: 'border-sky-500/40',
                      badgeCls: 'bg-[#0099FF] text-white',
                    },
                    {
                      key: 'second' as LevelKey,
                      title: 'السنة الثانية ثانوي (2 ثا)',
                      badge: '2 ثا',
                      accent: 'border-cyan-500/40',
                      badgeCls: 'bg-cyan-600 text-white',
                    },
                    {
                      key: 'third' as LevelKey,
                      title: isThirdTerm ? 'السنة الثالثة (تجريبي)' : 'السنة الثالثة ثانوي (3 ثا)',
                      badge: '3 ثا',
                      accent: 'border-purple-500/50',
                      badgeCls: 'bg-purple-600 text-white',
                    },
                  ]).map((lvl) => {
                    const cfg = (settings.levelTimings || createDefaultLevelTimings())[lvl.key];
                    return (
                      <div key={lvl.key} className={`bg-[#182643] rounded-2xl border ${lvl.accent} p-4 space-y-3`}>
                        <div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5">
                          <span className="text-xs font-black text-white">{lvl.title}</span>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-md font-black ${lvl.badgeCls}`}>
                            {lvl.badge}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-300">الحصة الصباحية 1</label>
                            <input
                              value={cfg.morningSlot1}
                              onChange={e => handleLevelTimingField(lvl.key, 'morningSlot1', e.target.value)}
                              onBlur={() => syncExamsAndScheduleWithSettings(settings)}
                              placeholder="08:00 - 10:00"
                              className="w-full p-2.5 bg-[#091021] border border-slate-700 rounded-xl outline-none focus:border-cyan-400 text-white text-xs font-mono font-bold text-center"
                              dir="ltr"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-slate-400">الحصة 2 (اختياري)</label>
                            <input
                              value={cfg.morningSlot2 || ''}
                              onChange={e => handleLevelTimingField(lvl.key, 'morningSlot2', e.target.value)}
                              onBlur={() => syncExamsAndScheduleWithSettings(settings)}
                              placeholder="فارغ لحصة واحدة"
                              className="w-full p-2.5 bg-[#091021] border border-slate-700 rounded-xl outline-none focus:border-cyan-400 text-white text-xs font-mono font-bold text-center placeholder:font-sans placeholder:text-[10px]"
                              dir="ltr"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5 bg-[#091021]/60 p-2.5 rounded-xl border border-slate-700/50">
                          <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-300">
                            <input
                              type="checkbox"
                              checked={Boolean(cfg.includeAfternoon)}
                              onChange={e => {
                                const checked = e.target.checked;
                                const currentLevels = settings.levelTimings || createDefaultLevelTimings();
                                const nextSettings: SystemSettings = {
                                  ...settings,
                                  levelTimings: {
                                    ...currentLevels,
                                    [lvl.key]: { ...currentLevels[lvl.key], includeAfternoon: checked },
                                  },
                                };
                                persistAndSyncTimings(nextSettings);
                              }}
                              className="w-3.5 h-3.5 text-sky-500 rounded border-slate-600 cursor-pointer"
                            />
                            <span>إدراج حصة مسائية في جدول الاختبارات</span>
                          </label>
                          {cfg.includeAfternoon && (
                            <input
                              value={cfg.afternoonSlot || '13:30 - 15:30'}
                              onChange={e => handleLevelTimingField(lvl.key, 'afternoonSlot', e.target.value)}
                              onBlur={() => syncExamsAndScheduleWithSettings(settings)}
                              placeholder="13:30 - 15:30"
                              className="w-full p-2 bg-[#121E36] border border-slate-700 rounded-lg outline-none focus:border-cyan-400 text-white text-xs font-mono font-bold text-center"
                              dir="ltr"
                            />
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-700/50">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-cyan-300">صباحي (الحراسة)</label>
                            <input
                              value={cfg.morningTime}
                              onChange={e => handleLevelTimingField(lvl.key, 'morningTime', e.target.value)}
                              onBlur={() => syncExamsAndScheduleWithSettings(settings)}
                              className="w-full p-2 bg-[#091021] border border-cyan-500/30 rounded-xl outline-none focus:border-cyan-400 text-cyan-200 text-xs font-mono font-bold text-center"
                              dir="ltr"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-purple-300">مسائي (الحراسة)</label>
                            <input
                              value={cfg.afternoonTime}
                              onChange={e => handleLevelTimingField(lvl.key, 'afternoonTime', e.target.value)}
                              onBlur={() => syncExamsAndScheduleWithSettings(settings)}
                              className="w-full p-2 bg-[#091021] border border-purple-500/30 rounded-xl outline-none focus:border-purple-400 text-purple-200 text-xs font-mono font-bold text-center"
                              dir="ltr"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </form>

        {/* Developer & Data Management Tools */}
        <div className="pt-6 border-t border-slate-800 space-y-4">
          <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <Database size={18} className="text-purple-400" />
            أدوات تجربة النظام والنسخ الاحتياطي
          </h4>
          <div className="bg-[#121E36] p-5 rounded-2xl border border-slate-700/60 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-purple-400 shrink-0 mt-1" size={20} />
              <div>
                <p className="font-bold text-xs text-white">بيانات تجريبية (Seed Data)</p>
                <p className="text-xs text-slate-400 mt-0.5">ملء النظام بأساتذة وقاعات واختبارات افتراضية مسبقاً</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={seedData}
                disabled={seeding}
                className="bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 rounded-xl text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {seeding ? 'جاري الإضافة...' : 'إضافة بيانات تجريبية'}
              </button>
              <button
                onClick={clearData}
                disabled={seeding}
                className="bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 border border-rose-700/50 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                مسح البيانات
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
