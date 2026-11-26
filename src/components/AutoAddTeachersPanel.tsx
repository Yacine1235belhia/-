import React, { useState } from 'react';
import { api } from '../lib/api';
import { SECONDARY_SUBJECTS } from '../lib/constants';
import {
  Sparkles, Plus, Trash2, CheckCircle2, Wand2, ListPlus, X, FileText, Users
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export interface AutoTeacherDraftRow {
  id: string;
  name: string;
  specialty: string;
}

interface AutoAddTeachersPanelProps {
  onSuccess: () => Promise<void> | void;
  onClose?: () => void;
  existingNames?: string[];
  compact?: boolean;
}

const SUBJECT_ALIAS_RULES: Array<{ keywords: string[]; target: string }> = [
  { keywords: ['رياضيات', 'math'], target: 'الرياضيات' },
  { keywords: ['فيزياء', 'فيزيائية', 'ع فيزيائية', 'physique', 'physics'], target: 'العلوم الفيزيائية' },
  { keywords: ['طبيعة', 'طبيعية', 'حياة', 'علوم طبيعية', 'ع ط ح', 'svt', 'sciences'], target: 'علوم الطبيعة والحياة' },
  { keywords: ['عربية', 'أدب', 'ادب', 'عربي', 'arabe'], target: 'اللغة العربية وآدابها' },
  { keywords: ['فرنسية', 'فرنسي', 'francais', 'français', 'french'], target: 'اللغة الفرنسية' },
  { keywords: ['إنجليزية', 'انجليزية', 'انجليزي', 'إنجليزي', 'english', 'anglais'], target: 'اللغة الإنجليزية' },
  { keywords: ['تاريخ', 'جغرافيا', 'اجتماعيات', 'histoire'], target: 'التاريخ والجغرافيا' },
  { keywords: ['إسلامية', 'اسلامية', 'تربية إسلامية', 'تربية اسلامية', 'شريعة', 'islamique'], target: 'العلوم الإسلامية' },
  { keywords: ['فلسفة', 'philo'], target: 'الفلسفة' },
  { keywords: ['إعلام', 'اعلام', 'معلوماتية', 'informatique'], target: 'إعلام آلي' },
  { keywords: ['تسيير', 'محاسب', 'محاسبي', 'gestion', 'comptabilite'], target: 'التسيير المالي والمحاسبي' },
  { keywords: ['اقتصاد', 'مناجمنت', 'economie'], target: 'الاقتصاد والمناجمنت' },
  { keywords: ['قانون', 'droit'], target: 'القانون' },
  { keywords: ['مدنية', 'هندسة مدنية', 'genie civil'], target: 'الهندسة المدنية' },
  { keywords: ['ميكانيك', 'ميكانيكية'], target: 'الهندسة الميكانيكية' },
  { keywords: ['كهرباء', 'كهربائية'], target: 'الهندسة الكهربائية' },
  { keywords: ['طرائق', 'هندسة الطرائق'], target: 'هندسة الطرائق' },
  { keywords: ['ألمانية', 'المانية', 'allemand'], target: 'اللغة الألمانية' },
  { keywords: ['إسبانية', 'اسبانية', 'espagnol'], target: 'اللغة الإسبانية' },
  { keywords: ['إيطالية', 'ايطالية', 'italien'], target: 'اللغة الإيطالية' },
  { keywords: ['أمازيغية', 'امازيغية', 'tamazight'], target: 'اللغة الأمازيغية' },
  { keywords: ['بدنية', 'رياضة', 'تربية بدنية', 'eps', 'sport'], target: 'التربية البدنية والرياضية' },
  { keywords: ['فنون', 'موسيقى', 'رسم', 'مسرح', 'سمعي'], target: 'فنون (سمعي بصري / موسيقى / مسرح / رسم)' },
];

export function matchSecondarySubject(raw: string, fallback = SECONDARY_SUBJECTS[0]): string {
  const clean = (raw || '').trim();
  if (!clean) return fallback;
  const exact = SECONDARY_SUBJECTS.find(
    (s) => s.toLowerCase() === clean.toLowerCase()
  );
  if (exact) return exact;

  const lower = clean.toLowerCase();
  for (const rule of SUBJECT_ALIAS_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.target;
    }
  }
  return clean;
}

function isLikelySubjectToken(token: string): boolean {
  const lower = (token || '').trim().toLowerCase();
  if (!lower) return false;
  if (SECONDARY_SUBJECTS.some((s) => s.toLowerCase() === lower)) return true;
  return SUBJECT_ALIAS_RULES.some((rule) => rule.keywords.some((kw) => lower.includes(kw)));
}

const SAMPLE_AUTO_TEACHERS: Array<{ name: string; specialty: string }> = [
  { name: 'بن علي محمد', specialty: 'الرياضيات' },
  { name: 'بوزيد فاطمة', specialty: 'العلوم الفيزيائية' },
  { name: 'مختاري عبد القادر', specialty: 'علوم الطبيعة والحياة' },
  { name: 'سليماني أحمد', specialty: 'اللغة العربية وآدابها' },
  { name: 'عمراني سارة', specialty: 'اللغة الفرنسية' },
  { name: 'خليفي ياسين', specialty: 'اللغة الإنجليزية' },
  { name: 'قاسمي نبيل', specialty: 'التاريخ والجغرافيا' },
  { name: 'زيتوني سميرة', specialty: 'العلوم الإسلامية' },
  { name: 'منصوري رشيد', specialty: 'الفلسفة' },
  { name: 'حاجي مريم', specialty: 'إعلام آلي' },
  { name: 'بركاني كمال', specialty: 'الاقتصاد والمناجمنت' },
  { name: 'طاهري ليلى', specialty: 'التسيير المالي والمحاسبي' },
];

const CORE_SUBJECTS_FOR_SCAFFOLD = [
  'الرياضيات',
  'العلوم الفيزيائية',
  'علوم الطبيعة والحياة',
  'اللغة العربية وآدابها',
  'اللغة الفرنسية',
  'اللغة الإنجليزية',
  'التاريخ والجغرافيا',
  'العلوم الإسلامية',
  'الفلسفة',
  'إعلام آلي',
];

const makeRowId = () => `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export default function AutoAddTeachersPanel({
  onSuccess,
  onClose,
  existingNames = [],
  compact = false,
}: AutoAddTeachersPanelProps) {
  const [rows, setRows] = useState<AutoTeacherDraftRow[]>([
    { id: makeRowId(), name: '', specialty: SECONDARY_SUBJECTS[0] },
    { id: makeRowId(), name: '', specialty: SECONDARY_SUBJECTS[1] },
    { id: makeRowId(), name: '', specialty: SECONDARY_SUBJECTS[3] },
  ]);
  const [bulkText, setBulkText] = useState('');
  const [defaultSpecialty, setDefaultSpecialty] = useState<string>(SECONDARY_SUBJECTS[0]);
  const [batchSpecialty, setBatchSpecialty] = useState<string>(SECONDARY_SUBJECTS[0]);
  const [batchCount, setBatchCount] = useState<number>(3);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  const parseBulkLinesToRows = (text: string): AutoTeacherDraftRow[] => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const parsed: AutoTeacherDraftRow[] = [];

    for (const rawLine of lines) {
      // Remove leading numbering like "1-", "1.", "01)", "•"
      const line = rawLine.replace(/^\s*(?:\d+\s*[-.)/]|[-•*])\s*/, '').trim();
      if (!line) continue;

      let namePart = '';
      let specPart = '';

      if (line.includes('\t')) {
        const parts = line.split('\t').map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          // Support [id, name, specialty] or [name, specialty] or [specialty, name]
          if (/^\d+$/.test(parts[0]) && parts.length >= 3) {
            namePart = parts[1];
            specPart = parts[2];
          } else if (isLikelySubjectToken(parts[0]) && !isLikelySubjectToken(parts[1])) {
            specPart = parts[0];
            namePart = parts[1];
          } else {
            namePart = parts[0];
            specPart = parts[1];
          }
        } else {
          namePart = parts[0] || '';
        }
      } else {
        const sepMatch = line.match(/^(.+?)\s*(?:-|–|—|\||\/|:|،|,|;)\s*(.+)$/);
        if (sepMatch) {
          const left = sepMatch[1].trim();
          const right = sepMatch[2].trim();
          if (isLikelySubjectToken(left) && !isLikelySubjectToken(right)) {
            specPart = left;
            namePart = right;
          } else {
            namePart = left;
            specPart = right;
          }
        } else {
          namePart = line;
        }
      }

      namePart = namePart.trim();
      if (!namePart) continue;

      parsed.push({
        id: makeRowId(),
        name: namePart,
        specialty: matchSecondarySubject(specPart, defaultSpecialty),
      });
    }

    return parsed;
  };

  const handleExtractFromText = () => {
    if (!bulkText.trim()) {
      toast.error('يرجى لصق أو كتابة أسماء الأساتذة أولاً');
      return;
    }
    const extracted = parseBulkLinesToRows(bulkText);
    if (extracted.length === 0) {
      toast.error('لم يتم التعرف على أسماء صالحة في النص');
      return;
    }

    setRows((prev) => {
      const nonEmpty = prev.filter((r) => r.name.trim() !== '');
      return [...nonEmpty, ...extracted];
    });
    setBulkText('');
    toast.success(`تم استخراج ${extracted.length} أستاذ وتخصصه إلى القائمة تلقائياً`);
  };

  const handleAddBatchBySpecialty = () => {
    const safeCount = Math.max(1, Math.min(30, Number(batchCount) || 1));
    const added: AutoTeacherDraftRow[] = Array.from({ length: safeCount }, () => ({
      id: makeRowId(),
      name: '',
      specialty: batchSpecialty,
    }));
    setRows((prev) => {
      const hasOnlyInitialEmpty = prev.every((r) => r.name.trim() === '');
      return hasOnlyInitialEmpty ? [...prev.filter((r) => r.name.trim() !== ''), ...added] : [...prev, ...added];
    });
    toast.success(`تمت إضافة ${safeCount} صفوف لتخصص ${batchSpecialty}`);
  };

  const handleGenerateCoreSubjectRows = () => {
    const generated = CORE_SUBJECTS_FOR_SCAFFOLD.map((sub) => ({
      id: makeRowId(),
      name: '',
      specialty: sub,
    }));
    setRows((prev) => {
      const nonEmpty = prev.filter((r) => r.name.trim() !== '');
      return [...nonEmpty, ...generated];
    });
    toast.success('تم توليد صف تلقائي لكل مادة تخصص أساسية — أدخل اسم ولقب كل أستاذ فقط');
  };

  const handleFillSampleRoster = () => {
    const existingSet = new Set(existingNames.map((n) => n.trim().toLowerCase()));
    const sampleRows = SAMPLE_AUTO_TEACHERS.filter(
      (s) => !existingSet.has(s.name.trim().toLowerCase())
    ).map((s) => ({
      id: makeRowId(),
      name: s.name,
      specialty: s.specialty,
    }));
    const targetRows =
      sampleRows.length > 0
        ? sampleRows
        : SAMPLE_AUTO_TEACHERS.map((s) => ({
            id: makeRowId(),
            name: s.name,
            specialty: s.specialty,
          }));
    setRows(targetRows);
    toast.success(`تم تجهيز قائمة من ${targetRows.length} أستاذ مع تخصصاتهم للمعاينة والتعديل`);
  };

  const handleRowChange = (id: string, field: 'name' | 'specialty', value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleCellPaste = (id: string, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text || (!text.includes('\n') && !text.includes('\t'))) return;

    e.preventDefault();
    const extracted = parseBulkLinesToRows(text);
    if (extracted.length === 0) return;

    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx === -1) return [...prev, ...extracted];
      const next = [...prev];
      next.splice(idx, 1, ...extracted);
      return next;
    });
    toast.success(`تم توزيع ${extracted.length} أسطر تلقائياً في القائمة`);
  };

  const handleDeleteRow = (id: string) => {
    setRows((prev) => (prev.length <= 1 ? [{ id: makeRowId(), name: '', specialty: defaultSpecialty }] : prev.filter((r) => r.id !== id)));
  };

  const handleAddEmptyRow = () => {
    setRows((prev) => [...prev, { id: makeRowId(), name: '', specialty: batchSpecialty }]);
  };

  const validRows = rows.filter((r) => r.name.trim() !== '');

  const handleSaveAll = async () => {
    if (validRows.length === 0) {
      toast.error('يرجى إدخال اسم ولقب أستاذ واحد على الأقل في القائمة');
      return;
    }

    setSaving(true);
    toast.loading(`جاري إضافة ${validRows.length} أستاذ تلقائياً...`, { id: 'auto-add-teachers' });
    try {
      const ts = Date.now();
      const payload = validRows.map((r, idx) => ({
        id: `t_${ts}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        name: r.name.trim(),
        specialty: (r.specialty || defaultSpecialty).trim(),
        seniority: 0,
        email: '',
        totalHours: 0,
        availabilityExceptions: '[]',
        isExempt: false,
        exemptReason: '',
      }));

      await api.post('/api/teachers/bulk', {
        teachers: payload,
        replaceExisting,
      });

      toast.success(`تمت إضافة ${payload.length} أستاذ بنجاح مع تخصصاتهم!`, {
        id: 'auto-add-teachers',
      });
      await onSuccess();
      if (onClose) onClose();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ القائمة', { id: 'auto-add-teachers' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`bg-[#121E36] border border-cyan-500/35 rounded-2xl ${compact ? 'p-4' : 'p-5'} space-y-4 shadow-xl text-slate-100`}>
      {/* Top Panel Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/70 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h4 className="text-sm font-black text-white">إضافة الأساتذة تلقائياً</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              قائمة سريعة تتضمن <strong className="text-cyan-300">اسم ولقب الأستاذ</strong> و<strong className="text-cyan-300">مادة التخصص</strong> — باللصق الذكي أو التوليد التلقائي.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateCoreSubjectRows}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#182643] hover:bg-[#1E2F52] text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition-all cursor-pointer"
          >
            <Wand2 size={13} />
            <span>توليد صف لكل تخصص</span>
          </button>

          <button
            type="button"
            onClick={handleFillSampleRoster}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/35 text-purple-200 border border-purple-500/35 text-[11px] font-bold transition-all cursor-pointer"
          >
            <Users size={13} />
            <span>تجهيز قائمة نموذجية (12 أستاذ)</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Extraction & Batch Generators Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Smart Bulk Text Paste */}
        <div className="lg:col-span-7 bg-[#091021]/80 border border-slate-700/70 rounded-xl p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-black text-sky-300 flex items-center gap-1.5">
              <FileText size={14} />
              <span>لصق واستخراج تلقائي (الاسم واللقب + مادة التخصص)</span>
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold">التخصص الافتراضي:</span>
              <select
                value={defaultSpecialty}
                onChange={(e) => setDefaultSpecialty(e.target.value)}
                className="bg-[#182643] border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-bold text-white outline-none focus:border-cyan-400 cursor-pointer"
              >
                {SECONDARY_SUBJECTS.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={3}
            placeholder={"ألصق قائمة الأساتذة هنا (كل أستاذ في سطر)، مثال:\nبن علي محمد - الرياضيات\nعمراني فاطمة | العلوم الفيزيائية\nسليماني أحمد\tاللغة العربية وآدابها"}
            className="w-full p-2.5 bg-[#121E36] border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:border-cyan-400 placeholder:text-slate-500 resize-y"
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleExtractFromText}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black transition-all cursor-pointer shadow-md"
            >
              <Sparkles size={14} />
              <span>استخراج تلقائي إلى القائمة</span>
            </button>
          </div>
        </div>

        {/* Batch Add Rows by Specialty */}
        <div className="lg:col-span-5 bg-[#091021]/80 border border-slate-700/70 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
          <div className="space-y-2.5">
            <label className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
              <ListPlus size={14} />
              <span>توليد صفوف تلقائية حسب مادة التخصص</span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block">مادة التخصص</span>
                <select
                  value={batchSpecialty}
                  onChange={(e) => setBatchSpecialty(e.target.value)}
                  className="w-full p-2 bg-[#182643] border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:border-cyan-400 cursor-pointer"
                >
                  {SECONDARY_SUBJECTS.map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block">العدد</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={batchCount}
                  onChange={(e) => setBatchCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                  className="w-full p-2 bg-[#182643] border border-slate-700 rounded-xl text-xs font-mono font-bold text-center text-white outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddBatchBySpecialty}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 text-xs font-black transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>إضافة {batchCount} صفوف لهذا التخصص</span>
          </button>
        </div>
      </div>

      {/* Live Preview & Edit Table: Name + Specialty */}
      <div className="bg-[#091021] border border-slate-700/80 rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 bg-[#182643] border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-black text-white">
            قائمة الإضافة التلقائية ({validRows.length} أستاذ جاهز من {rows.length} صف)
          </span>
          <button
            type="button"
            onClick={handleAddEmptyRow}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#0099FF] hover:bg-sky-500 text-white text-[11px] font-black transition-colors cursor-pointer"
          >
            <Plus size={13} />
            <span>صف جديد</span>
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto custom-scrollbar">
          <table className="w-full text-right border-collapse text-xs">
            <thead className="sticky top-0 bg-[#121E36] border-b border-slate-700 text-slate-300 z-10">
              <tr>
                <th className="p-2.5 w-12 text-center font-black">#</th>
                <th className="p-2.5 font-black">اسم ولقب الأستاذ</th>
                <th className="p-2.5 font-black w-56 sm:w-64">مادة التخصص</th>
                <th className="p-2.5 w-12 text-center font-black">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {rows.map((row, idx) => {
                const isCustomSpec =
                  row.specialty && !SECONDARY_SUBJECTS.includes(row.specialty);
                return (
                  <tr key={row.id} className="hover:bg-[#121E36]/60">
                    <td className="p-2 text-center font-mono font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => handleRowChange(row.id, 'name', e.target.value)}
                        onPaste={(e) => handleCellPaste(row.id, e)}
                        placeholder="أدخل اسم ولقب الأستاذ..."
                        className="w-full p-2 bg-[#121E36] border border-slate-700/80 rounded-xl text-white text-xs font-bold outline-none focus:border-cyan-400 placeholder:text-slate-500"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={row.specialty}
                        onChange={(e) => handleRowChange(row.id, 'specialty', e.target.value)}
                        className="w-full p-2 bg-[#121E36] border border-slate-700/80 rounded-xl text-cyan-200 text-xs font-bold outline-none focus:border-cyan-400 cursor-pointer"
                      >
                        {isCustomSpec && (
                          <option value={row.specialty}>{row.specialty}</option>
                        )}
                        {SECONDARY_SUBJECTS.map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="حذف الصف"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300 select-none">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => setReplaceExisting(e.target.checked)}
            className="w-4 h-4 text-sky-500 rounded border-slate-600 cursor-pointer"
          />
          <span>استبدال القائمة الحالية بالأساتذة الجدد (يُستبعد التجريبيون تلقائياً في كل الأحوال)</span>
        </label>

        <div className="flex items-center gap-2 justify-end">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
            >
              إلغاء
            </button>
          )}
          <button
            type="button"
            disabled={saving || validRows.length === 0}
            onClick={handleSaveAll}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-40"
          >
            <CheckCircle2 size={15} />
            <span>حفظ وإضافة القائمة تلقائياً ({validRows.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
