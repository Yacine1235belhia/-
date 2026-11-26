import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Calendar, Clock, DoorOpen, Download, Edit2, Plus,
  Printer, Search, Sparkles, Trash2, Users, ArrowLeft, X, CheckCircle2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import { ALGERIAN_STREAMS } from '../lib/constants';
import { Hall, Teacher } from '../types';
import { getArabicDayName, printHtmlDirectly } from '../utils/printHelpers';

export interface ClassCouncilItem {
  id: string;
  level: '1ثا' | '2ثا' | '3ثا';
  className: string;
  date: string;
  timeRange: string;
  room: string;
  president: string;
  headTeacher: string;
  notes?: string;
}

const STORAGE_KEY = 'hirasa_class_councils';

const LEVEL_TABS: Array<{ id: 'all' | '1ثا' | '2ثا' | '3ثا'; label: string }> = [
  { id: 'all', label: 'كل المستويات' },
  { id: '1ثا', label: 'السنة الأولى ثانوي (1 ثا)' },
  { id: '2ثا', label: 'السنة الثانية ثانوي (2 ثا)' },
  { id: '3ثا', label: 'السنة الثالثة ثانوي (3 ثا)' },
];

const DEFAULT_TIME_SLOTS = ['08:30 - 09:30', '09:30 - 10:30', '10:30 - 11:30', '13:30 - 14:30', '14:30 - 15:30'];

function addDaysToIso(dateStr: string, daysToAdd: number): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    const today = new Date();
    today.setDate(today.getDate() + daysToAdd);
    return today.toISOString().split('T')[0];
  }
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  dt.setDate(dt.getDate() + daysToAdd);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function ClassCouncilsPage({ onGoToProctoring }: { onGoToProctoring?: () => void }) {
  const [councils, setCouncils] = useState<ClassCouncilItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore invalid stored payload
    }
    return [];
  });

  const [halls, setHalls] = useState<Hall[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [settings, setSettings] = useState<any>({
    institutionName: 'ثانوية الأمير عبد القادر',
    wilaya: 'البيض',
    schoolYear: '2025/2026',
    selectedTerm: 'الفصل الأول',
    examEndDate: '',
  });

  const [levelFilter, setLevelFilter] = useState<'all' | '1ثا' | '2ثا' | '3ثا'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ClassCouncilItem | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Controlled form state
  const [formLevel, setFormLevel] = useState<'1ثا' | '2ثا' | '3ثا'>('1ثا');
  const [formClassName, setFormClassName] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formTimeRange, setFormTimeRange] = useState('08:30 - 09:30');
  const [formRoom, setFormRoom] = useState('قاعة الأساتذة');
  const [formPresident, setFormPresident] = useState('المدير');
  const [formHeadTeacher, setFormHeadTeacher] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(councils));
    } catch {
      // ignore storage quota errors
    }
  }, [councils]);

  useEffect(() => {
    Promise.all([
      api.get('/api/settings').catch(() => null),
      api.get('/api/halls').catch(() => []),
      api.get('/api/teachers').catch(() => []),
    ]).then(([sData, hData, tData]) => {
      if (sData) {
        setSettings((prev: any) => ({ ...prev, ...sData }));
        if (sData.examEndDate) {
          setFormDate(addDaysToIso(sData.examEndDate, 2));
        }
      }
      setHalls(Array.isArray(hData) ? hData : []);
      setTeachers(Array.isArray(tData) ? tData : []);
    });
  }, []);

  const openAddForm = (item?: ClassCouncilItem | null) => {
    if (item) {
      setEditingItem(item);
      setFormLevel(item.level);
      setFormClassName(item.className);
      setFormDate(item.date);
      setFormTimeRange(item.timeRange);
      setFormRoom(item.room);
      setFormPresident(item.president);
      setFormHeadTeacher(item.headTeacher);
      setFormNotes(item.notes || '');
      setShowForm(true);
    } else {
      setEditingItem(null);
      setFormLevel('1ثا');
      setFormClassName('');
      setFormDate(settings.examEndDate ? addDaysToIso(settings.examEndDate, 2) : new Date().toISOString().split('T')[0]);
      setFormTimeRange('08:30 - 09:30');
      setFormRoom(halls[0]?.name || 'قاعة الأساتذة');
      setFormPresident('المدير');
      setFormHeadTeacher('');
      setFormNotes('');
      setShowForm(prev => (editingItem ? true : !prev));
    }
  };

  const handleSaveCouncil = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedClass = formClassName.trim();
    if (!trimmedClass) {
      toast.error('يرجى إدخال اسم القسم أو الشعبة');
      return;
    }

    const payload: ClassCouncilItem = {
      id: editingItem ? editingItem.id : `cc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      level: formLevel,
      className: trimmedClass,
      date: formDate,
      timeRange: formTimeRange.trim() || '08:30 - 09:30',
      room: formRoom.trim() || 'قاعة الأساتذة',
      president: formPresident.trim() || 'المدير',
      headTeacher: formHeadTeacher.trim() || '-',
      notes: formNotes.trim(),
    };

    if (editingItem) {
      setCouncils(prev => prev.map(c => (c.id === editingItem.id ? payload : c)));
      toast.success('تم تحديث موعد مجلس القسم');
    } else {
      setCouncils(prev => [...prev, payload]);
      toast.success('تم إضافة مجلس القسم بنجاح');
    }

    setShowForm(false);
    setEditingItem(null);
  };

  const handleDeleteCouncil = (id: string) => {
    setCouncils(prev => prev.filter(c => c.id !== id));
    toast.success('تم حذف الجلسة');
  };

  const handleAutoGenerateSchedule = () => {
    const startDate = settings.examEndDate
      ? addDaysToIso(settings.examEndDate, 2)
      : new Date().toISOString().split('T')[0];

    const classesToBuild: Array<{ level: '1ثا' | '2ثا' | '3ثا'; className: string }> = [
      { level: '1ثا', className: '1 ج م ع ت 1' },
      { level: '1ثا', className: '1 ج م ع ت 2' },
      { level: '1ثا', className: '1 ج م آ 1' },
      { level: '2ثا', className: '2 علوم تجريبية' },
      { level: '2ثا', className: '2 رياضيات وتقني رياضي' },
      { level: '2ثا', className: '2 تسيير واقتصاد' },
      { level: '2ثا', className: '2 آداب ولغات' },
      { level: '3ثا', className: '3 علوم تجريبية' },
      { level: '3ثا', className: '3 تقني رياضي ورياضيات' },
      { level: '3ثا', className: '3 تسيير واقتصاد' },
      { level: '3ثا', className: '3 آداب وفلسفة ولغات' },
    ];

    const roomDefault = halls[0]?.name || 'قاعة الأساتذة';
    const secondRoom = halls[1]?.name || 'قاعة الاجتماعات';
    const generated: ClassCouncilItem[] = classesToBuild.map((cls, idx) => {
      const dayOffset = Math.floor(idx / DEFAULT_TIME_SLOTS.length);
      const slot = DEFAULT_TIME_SLOTS[idx % DEFAULT_TIME_SLOTS.length];
      const president = idx % 2 === 0 ? 'المدير' : 'الناظر';
      const room = idx % 2 === 0 ? roomDefault : secondRoom;
      const candidateTeacher = teachers[idx]?.name || '';
      return {
        id: `cc_auto_${Date.now()}_${idx}`,
        level: cls.level,
        className: cls.className,
        date: addDaysToIso(startDate, dayOffset),
        timeRange: slot,
        room,
        president,
        headTeacher: candidateTeacher || '-',
        notes: 'مجلس نهاية الفصل',
      };
    });

    setCouncils(generated);
    toast.success(`تم توليد رزنامة مقترحة لـ ${generated.length} مجلس قسم`);
  };

  const filteredCouncils = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return councils
      .filter(item => {
        if (levelFilter !== 'all' && item.level !== levelFilter) return false;
        if (!q) return true;
        return (
          item.className.toLowerCase().includes(q) ||
          item.president.toLowerCase().includes(q) ||
          item.headTeacher.toLowerCase().includes(q) ||
          item.room.toLowerCase().includes(q) ||
          item.date.includes(q)
        );
      })
      .sort((a, b) => {
        const dComp = a.date.localeCompare(b.date);
        if (dComp !== 0) return dComp;
        return a.timeRange.localeCompare(b.timeRange);
      });
  }, [councils, levelFilter, searchTerm]);

  const handleExportExcel = () => {
    if (filteredCouncils.length === 0) {
      toast.error('لا توجد مجالس لتصديرها');
      return;
    }
    const rows = filteredCouncils.map((c, idx) => ({
      'الرقم': idx + 1,
      'المستوى': c.level,
      'القسم / الشعبة': c.className,
      'اليوم': getArabicDayName(c.date),
      'التاريخ': c.date,
      'التوقيت': c.timeRange,
      'القاعة': c.room,
      'رئيس المجلس': c.president,
      'الأستاذ الرئيسي': c.headTeacher,
      'ملاحظات': c.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'مجالس الأقسام');
    XLSX.writeFile(wb, `رزنامة_مجالس_الأقسام_${settings.selectedTerm || 'الفصل'}.xlsx`);
    toast.success('تم تصدير جدول مجالس الأقسام إلى Excel');
  };

  const handlePrintCouncils = () => {
    if (filteredCouncils.length === 0) {
      toast.error('لا توجد مجالس للطباعة');
      return;
    }

    const rowsHtml = filteredCouncils
      .map(
        (c, i) => `
      <tr>
        <td style="border:1px solid #000;padding:6px;text-align:center;font-weight:700;">${i + 1}</td>
        <td style="border:1px solid #000;padding:6px;text-align:center;font-weight:700;">${c.level}</td>
        <td style="border:1px solid #000;padding:6px;text-align:right;font-weight:800;">${c.className}</td>
        <td style="border:1px solid #000;padding:6px;text-align:center;">${getArabicDayName(c.date)} <span dir="ltr" style="font-family:monospace;">${c.date}</span></td>
        <td style="border:1px solid #000;padding:6px;text-align:center;font-family:monospace;font-weight:700;" dir="ltr">${c.timeRange}</td>
        <td style="border:1px solid #000;padding:6px;text-align:center;font-weight:700;">${c.room}</td>
        <td style="border:1px solid #000;padding:6px;text-align:center;">${c.president}</td>
        <td style="border:1px solid #000;padding:6px;text-align:center;">${c.headTeacher}</td>
      </tr>`
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>رزنامة مجالس الأقسام</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: 'Cairo', system-ui, sans-serif; color:#000; background:#fff; margin:0; padding:16px; direction:rtl; }
          @page { size: A4 landscape; margin: 0.6cm; }
          table { width:100%; border-collapse:collapse; font-size:11px; }
        </style>
      </head>
      <body>
        <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:14px;">
          <div style="font-size:13px;font-weight:800;">الجمهورية الجزائرية الديمقراطية الشعبية — وزارة التربية الوطنية</div>
          <div style="font-size:12px;font-weight:700;margin-top:2px;">مديرية التربية لولاية ${settings.wilaya || ''} | ${settings.institutionName || ''}</div>
          <div style="font-size:15px;font-weight:900;text-decoration:underline;margin-top:6px;">
            رزنامة انعقاد مجالس الأقسام — ${settings.selectedTerm || ''} (${settings.schoolYear || ''})
          </div>
        </div>

        <table>
          <thead>
            <tr style="background:#e2e8f0;">
              <th style="border:1px solid #000;padding:6px;width:32px;">#</th>
              <th style="border:1px solid #000;padding:6px;width:65px;">المستوى</th>
              <th style="border:1px solid #000;padding:6px;text-align:right;">القسم / الشعبة</th>
              <th style="border:1px solid #000;padding:6px;">اليوم والتاريخ</th>
              <th style="border:1px solid #000;padding:6px;">التوقيت</th>
              <th style="border:1px solid #000;padding:6px;">القاعة</th>
              <th style="border:1px solid #000;padding:6px;">رئيس المجلس</th>
              <th style="border:1px solid #000;padding:6px;">الأستاذ الرئيسي</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <table style="width:100%;margin-top:18px;border:none;">
          <tr>
            <td style="border:none;text-align:right;font-weight:800;font-size:11px;width:50%;">تأشيرة وتوقيع مدير المؤسسة</td>
            <td style="border:none;text-align:left;font-weight:800;font-size:11px;width:50%;">تأشيرة وتوقيع الناظر</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    printHtmlDirectly(html);
  };

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <div className="bg-[#121E36] p-5 lg:p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3.5 bg-[#0099FF] rounded-2xl text-white shadow-lg shadow-sky-500/30 shrink-0">
              <BookOpen size={26} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl lg:text-2xl font-black text-white leading-tight">
                مجالس الأقسام
              </h3>
              <p className="text-xs lg:text-sm text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                <span>تنظيم وبرمجة رزنامة مجالس الأقسام لنهاية الفصل</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-cyan-300 font-bold">
                  {councils.length} جلسة مبرمجة
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onGoToProctoring && (
              <button
                type="button"
                onClick={onGoToProctoring}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[#182643] hover:bg-[#1f3054] text-cyan-300 border border-cyan-500/30 font-bold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <Users size={15} />
                <span>قائمة الأساتذة وإضافة أستاذ (ضبط الحراسة)</span>
                <ArrowLeft size={14} />
              </button>
            )}

            <button
              type="button"
              onClick={handleAutoGenerateSchedule}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 font-black text-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sparkles size={15} />
              <span>توليد رزنامة مقترحة</span>
            </button>

            <button
              type="button"
              onClick={() => openAddForm(null)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#0099FF] hover:bg-sky-500 text-white font-black text-xs shadow-lg shadow-sky-500/25 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus size={16} />
              <span>{showForm && !editingItem ? 'إلغاء' : 'إضافة مجلس قسم'}</span>
            </button>
          </div>
        </div>

        {/* Add / Edit Form */}
        {showForm && (
          <form onSubmit={handleSaveCouncil} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-4 border-t border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">المستوى</label>
              <select
                value={formLevel}
                onChange={(e) => setFormLevel(e.target.value as '1ثا' | '2ثا' | '3ثا')}
                className="w-full p-2.5 bg-[#091021] border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-cyan-400"
              >
                <option value="1ثا">السنة الأولى ثانوي (1 ثا)</option>
                <option value="2ثا">السنة الثانية ثانوي (2 ثا)</option>
                <option value="3ثا">السنة الثالثة ثانوي (3 ثا)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">القسم / الشعبة *</label>
              <input
                type="text"
                list="council-stream-suggestions"
                value={formClassName}
                onChange={(e) => setFormClassName(e.target.value)}
                placeholder="مثال: 1 ج م ع ت 1"
                required
                className="w-full p-2.5 bg-[#091021] border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-cyan-400"
              />
              <datalist id="council-stream-suggestions">
                {ALGERIAN_STREAMS.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">التاريخ</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
                className="w-full p-2.5 bg-[#091021] border border-slate-700 rounded-xl text-white text-xs font-mono font-bold outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">التوقيت</label>
              <input
                type="text"
                value={formTimeRange}
                onChange={(e) => setFormTimeRange(e.target.value)}
                placeholder="08:30 - 09:30"
                dir="ltr"
                className="w-full p-2.5 bg-[#091021] border border-slate-700 rounded-xl text-white text-xs font-mono font-bold text-center outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">القاعة</label>
              <input
                type="text"
                list="council-rooms-list"
                value={formRoom}
                onChange={(e) => setFormRoom(e.target.value)}
                placeholder="قاعة الأساتذة"
                className="w-full p-2.5 bg-[#091021] border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-cyan-400"
              />
              <datalist id="council-rooms-list">
                <option value="قاعة الأساتذة" />
                <option value="قاعة الاجتماعات" />
                {halls.map((h) => (
                  <option key={h.id} value={h.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">رئيس المجلس</label>
              <input
                type="text"
                list="council-presidents-list"
                value={formPresident}
                onChange={(e) => setFormPresident(e.target.value)}
                placeholder="المدير أو الناظر"
                className="w-full p-2.5 bg-[#091021] border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-cyan-400"
              />
              <datalist id="council-presidents-list">
                <option value="المدير" />
                <option value="الناظر" />
                <option value="مستشار التربية" />
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">الأستاذ الرئيسي</label>
              <input
                type="text"
                list="council-teachers-list"
                value={formHeadTeacher}
                onChange={(e) => setFormHeadTeacher(e.target.value)}
                placeholder="اسم الأستاذ الرئيسي..."
                className="w-full p-2.5 bg-[#091021] border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-cyan-400"
              />
              <datalist id="council-teachers-list">
                {teachers.map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="اختياري..."
                  className="w-full p-2.5 bg-[#091021] border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-cyan-400"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#0099FF] hover:bg-sky-500 text-white rounded-xl font-black text-xs cursor-pointer shrink-0"
              >
                {editingItem ? 'حفظ التعديلات' : 'حفظ'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Toolbar: Filter + Search + Print/Export */}
      <div className="bg-[#121E36] p-4 rounded-3xl border border-slate-800 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث عن قسم، قاعة، أو أستاذ..."
              className="w-full pr-9 pl-3 py-2 bg-[#091021] border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#091021] p-1 rounded-xl border border-slate-800 overflow-x-auto">
            {LEVEL_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setLevelFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  levelFilter === tab.id
                    ? 'bg-[#0099FF] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {councils.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClearOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
            >
              <Trash2 size={14} />
              <span>مسح الكل</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#182643] hover:bg-[#1f3054] text-emerald-300 border border-emerald-500/30 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download size={14} />
            <span>تصدير إكسل</span>
          </button>

          <button
            type="button"
            onClick={handlePrintCouncils}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0099FF] hover:bg-sky-500 text-white text-xs font-black cursor-pointer whitespace-nowrap shrink-0"
          >
            <Printer size={14} />
            <span>طباعة الرزنامة</span>
          </button>
        </div>
      </div>

      {/* Councils Table */}
      {filteredCouncils.length === 0 ? (
        <div className="bg-[#121E36] p-10 rounded-3xl border border-slate-800 text-center space-y-4">
          <BookOpen size={40} className="mx-auto text-slate-500 opacity-60" />
          <div className="space-y-1">
            <h4 className="text-base font-black text-white">لا توجد جلسات لمجالس الأقسام حالياً</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              يمكنك إضافة جلسة مجلس قسم يدوياً أو توليد رزنامة مقترحة جاهزة لجميع الأقسام بنقرة واحدة.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleAutoGenerateSchedule}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 font-black text-xs cursor-pointer"
            >
              <Sparkles size={15} />
              <span>توليد رزنامة مقترحة</span>
            </button>
            <button
              type="button"
              onClick={() => openAddForm(null)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0099FF] hover:bg-sky-500 text-white font-black text-xs cursor-pointer"
            >
              <Plus size={15} />
              <span>إضافة مجلس قسم</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#121E36] rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-[#182643] border-b border-slate-700 text-slate-300">
                  <th className="p-3.5 w-12 text-center font-black">#</th>
                  <th className="p-3.5 font-black">المستوى</th>
                  <th className="p-3.5 font-black">القسم / الشعبة</th>
                  <th className="p-3.5 font-black">اليوم والتاريخ</th>
                  <th className="p-3.5 text-center font-black">التوقيت</th>
                  <th className="p-3.5 font-black">القاعة</th>
                  <th className="p-3.5 font-black">رئيس المجلس</th>
                  <th className="p-3.5 font-black">الأستاذ الرئيسي</th>
                  <th className="p-3.5 text-left font-black">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredCouncils.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-[#182643]/50 transition-colors">
                    <td className="p-3.5 text-center font-mono tabular-nums font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="p-3.5 font-bold text-cyan-300 whitespace-nowrap">{item.level}</td>
                    <td className="p-3.5 font-black text-white">{item.className}</td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="text-slate-200 font-bold">{getArabicDayName(item.date)}</span>
                      <span className="mx-1.5 text-slate-500">·</span>
                      <span className="font-mono tabular-nums text-cyan-300" dir="ltr">{item.date}</span>
                    </td>
                    <td className="p-3.5 text-center font-mono tabular-nums font-bold text-slate-200 whitespace-nowrap" dir="ltr">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} className="text-sky-400" />
                        {item.timeRange}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-slate-200 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <DoorOpen size={13} className="text-emerald-400" />
                        {item.room}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-slate-300">{item.president}</td>
                    <td className="p-3.5 font-bold text-slate-300">{item.headTeacher}</td>
                    <td className="p-3.5 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openAddForm(item)}
                          className="p-1.5 text-slate-400 hover:text-cyan-400 bg-[#182643] rounded-lg transition-colors cursor-pointer"
                          title="تعديل"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCouncil(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#121E36] border border-rose-500/40 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 bg-rose-600/20 border-b border-rose-500/30 flex items-center justify-between">
              <h4 className="font-black text-sm text-white">تأكيد مسح رزنامة مجالس الأقسام</h4>
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 text-xs text-slate-300 leading-relaxed">
              هل تريد مسح جميع جلسات مجالس الأقسام المبرمجة حالياً؟ يمكنك إعادة توليدها لاحقاً في أي وقت.
            </div>
            <div className="p-4 bg-[#091021] border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  setCouncils([]);
                  setConfirmClearOpen(false);
                  toast.success('تم مسح رزنامة مجالس الأقسام');
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs cursor-pointer"
              >
                <CheckCircle2 size={14} />
                <span>نعم، مسح الكل</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
