import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Teacher, Exam } from '../types';
import { SECONDARY_SUBJECTS, isDemoTeacher } from '../lib/constants';
import { UserPlus, Trash2, Edit2, Search, FileUp, FileDown, Printer, Download, Users, AlertCircle, UserX, UserCheck, Ban, CheckCircle2, X, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { printHtmlDirectly } from '../utils/printHelpers';
import ExcelImportModal from './ExcelImportModal';
import AutoAddTeachersPanel from './AutoAddTeachersPanel';

const parseExemptFromExcel = (statusVal: any, reasonVal: any): { isExempt: boolean; exemptReason: string } => {
  const statusStr = String(statusVal ?? '').trim().toLowerCase();
  const reasonStr = String(reasonVal ?? '').trim();
  const negativeValues = ['لا', 'no', 'false', '0', 'غير معفى', 'متاح', 'حاضر', 'يعمل', '-'];
  const positiveKeywords = ['معفى', 'معفي', 'غائب', 'غياب', 'حجة', 'مبرر', 'عطلة', 'مرض', 'مرضية', 'نعم', 'yes', 'true', '1', 'x', '✓', 'exempt', 'absent'];

  const hasStatusPositive =
    statusStr !== '' &&
    !negativeValues.includes(statusStr) &&
    positiveKeywords.some((kw) => statusStr.includes(kw));

  const hasValidReason = reasonStr !== '' && !negativeValues.includes(reasonStr.toLowerCase());
  const isExempt = hasStatusPositive || hasValidReason;

  return {
    isExempt,
    exemptReason: isExempt ? (reasonStr || (hasStatusPositive ? String(statusVal).trim() : 'غائب / لديه حجة')) : ''
  };
};

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showAutoAddPanel, setShowAutoAddPanel] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [selectedExceptions, setSelectedExceptions] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'exempt'>('all');
  const [formIsExempt, setFormIsExempt] = useState(false);
  const [formExemptReason, setFormExemptReason] = useState('');
  const [exemptTargetTeacher, setExemptTargetTeacher] = useState<Teacher | null>(null);
  const [exemptReasonInput, setExemptReasonInput] = useState('غائب');
  
  // Excel Import State
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  useEffect(() => {
    if (editingTeacher) {
      setSelectedExceptions(editingTeacher.availabilityExceptions || []);
      setFormIsExempt(Boolean(editingTeacher.isExempt));
      setFormExemptReason(editingTeacher.exemptReason || '');
    } else {
      setSelectedExceptions([]);
      setFormIsExempt(false);
      setFormExemptReason('');
    }
  }, [editingTeacher]);

  const fetchLists = async () => {
    try {
      const [tData, eData] = await Promise.all([
        api.get('/api/teachers'),
        api.get('/api/exams')
      ]);
      setTeachers((tData || []).map((d: any) => ({
        ...d,
        availabilityExceptions: typeof d.availabilityExceptions === 'string' ? JSON.parse(d.availabilityExceptions) : d.availabilityExceptions || [],
        totalHours: Number(d.totalHours) || 0,
        isExempt: Boolean(d.isExempt),
        exemptReason: d.exemptReason ? String(d.exemptReason) : ''
      })));
      setExams(eData || []);
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ في جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const handleAddTeacher = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const teacherData = {
      name: formData.get('name') as string,
      specialty: formData.get('specialty') as string,
      seniority: Number(formData.get('seniority')) || 0,
      email: "",
      availabilityExceptions: JSON.stringify(selectedExceptions),
      isExempt: formIsExempt ? 1 : 0,
      exemptReason: formIsExempt ? (formExemptReason.trim() || 'غائب / لديه حجة') : ''
    };

    try {
      if (editingTeacher) {
        await api.put(`/api/teachers/${editingTeacher.id}`, teacherData);
        toast.success('تم تحديث بيانات الأستاذ');
      } else {
        await api.post('/api/teachers', { ...teacherData, totalHours: 0, id: Date.now().toString() });
        toast.success('تم إضافة الأستاذ بنجاح');
      }
      setShowForm(false);
      setEditingTeacher(null);
      setSelectedExceptions([]);
      setFormIsExempt(false);
      setFormExemptReason('');
      form.reset();
      fetchLists();
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  const handleToggleExemption = async (teacher: Teacher, makeExempt: boolean, reason?: string) => {
    if (!teacher.id) return;
    const finalReason = makeExempt ? (reason?.trim() || 'غائب / لديه حجة') : '';
    try {
      await api.put(`/api/teachers/${teacher.id}`, {
        isExempt: makeExempt ? 1 : 0,
        exemptReason: finalReason
      });

      if (makeExempt) {
        try {
          const allAssignments = await api.get('/api/assignments');
          if (Array.isArray(allAssignments)) {
            const remaining = allAssignments.filter((a: any) => String(a.teacherId) !== String(teacher.id));
            if (remaining.length !== allAssignments.length) {
              await api.post('/api/assignments/replace', { assignments: remaining, stats: {} });
            }
          }
        } catch {}
        toast.success(`تم إعفاء الأستاذ(ة) "${teacher.name}" (${finalReason})`);
      } else {
        toast.success(`تم إلغاء الإعفاء وإعادة تفعيل الأستاذ(ة) "${teacher.name}" للحراسة`);
      }
      setExemptTargetTeacher(null);
      setExemptReasonInput('غائب');
      await fetchLists();
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء تحديث حالة الإعفاء');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/teachers/${id}`);
      toast.success('تم الحذف');
      fetchLists();
    } catch (error) {
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const handleClearDemoTeachers = async () => {
    toast.loading('جاري حذف الأساتذة التجريبيين...', { id: 'clean-demo' });
    try {
      await api.delete('/api/teachers/demo');
      toast.success('تم حذف جميع الأساتذة التجريبيين بنجاح', { id: 'clean-demo' });
      fetchLists();
    } catch (e) {
      toast.error('حدث خطأ أثناء حذف الأساتذة التجريبيين', { id: 'clean-demo' });
    }
  };

  const handleClearAllTeachers = async () => {
    toast.loading('جاري مسح قائمة الأساتذة...', { id: 'clean-all' });
    try {
      await api.delete('/api/teachers/all');
      toast.success('تم مسح القائمة بنجاح', { id: 'clean-all' });
      fetchLists();
    } catch (e) {
      toast.error('حدث خطأ أثناء مسح القائمة', { id: 'clean-all' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      if (buffer) {
        setFileBuffer(buffer);
        setIsImportModalOpen(true);
      } else {
        toast.error('تعذر قراءة ملف الإكسل');
      }
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const handleConfirmImport = async (mappedData: any[]) => {
    setIsImportModalOpen(false);
    toast.loading('جاري استيراد الأساتذة...', { id: 'import' });
    try {
      const timestamp = Date.now();
      const validTeachers = mappedData
        .filter(row => {
          const fullName = row.name || `${row.lastName || ''} ${row.firstName || ''}`.trim();
          return fullName && String(fullName).trim() !== '';
        })
        .map((row, idx) => {
          const fullName = String(row.name || `${row.lastName || ''} ${row.firstName || ''}`).trim();
          const customId = (row.num || row.id || row.code) 
            ? String(row.num || row.id || row.code).trim() 
            : `t_${timestamp}_${idx}_${Math.random().toString(36).slice(2, 7)}`;
          const { isExempt, exemptReason } = parseExemptFromExcel(row.exemptStatus, row.exemptReason);
            
          return {
            id: customId,
            name: fullName,
            specialty: row.specialty && String(row.specialty).trim() !== '' ? String(row.specialty).trim() : 'عام',
            seniority: Number(row.seniority) || 0,
            email: "",
            totalHours: 0,
            availabilityExceptions: "[]",
            isExempt,
            exemptReason
          };
        });

      if (validTeachers.length > 0) {
        // Exclude/replace any demo teachers so only uploaded real teachers exist
        await api.post('/api/teachers/bulk', { teachers: validTeachers, replaceExisting: true });
        const exemptCount = validTeachers.filter(t => t.isExempt).length;
        toast.success(
          exemptCount > 0
            ? `تم استيراد ${validTeachers.length} أستاذ بنجاح (منهم ${exemptCount} معفى)`
            : `تم استيراد ${validTeachers.length} أستاذ بنجاح واعتمادهم مع استبعاد كافة الأساتذة التجريبيين`,
          { id: 'import' }
        );
        setSearchTerm('');
        setStatusFilter('all');
        setCurrentPage(1);
        await fetchLists();
      } else {
        toast.error('لم يتم العثور على أسماء أساتذة صالحة للاستيراد', { id: 'import' });
      }
    } catch(e) {
      console.error(e);
      toast.error('خطأ أثناء الاستيراد', { id: 'import' });
    }
  };

  const filteredTeachers = teachers.filter(t => {
    if (statusFilter === 'active' && t.isExempt) return false;
    if (statusFilter === 'exempt' && !t.isExempt) return false;
    const q = searchTerm.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) || 
      t.specialty.toLowerCase().includes(q) ||
      (t.exemptReason && t.exemptReason.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil(filteredTeachers.length / PAGE_SIZE) || 1;
  const paginatedTeachers = filteredTeachers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const examSessions: string[] = Array.from(new Set<string>(exams.map((e: Exam) => `${e.date}-${e.period}`))).sort();

  const toggleException = (sessionKey: string) => {
    setSelectedExceptions(prev => 
      prev.includes(sessionKey) 
        ? prev.filter(k => k !== sessionKey)
        : [...prev, sessionKey]
    );
  };

  const handleExportTeachersExcel = () => {
    if (teachers.length === 0) {
      toast.error('لا يوجد أساتذة لتصديرهم');
      return;
    }
    const data = filteredTeachers.map((t, index) => ({
      'الرقم': index + 1,
      'اسم الأستاذ': t.name,
      'التخصص': t.specialty,
      'الأقدمية': t.seniority || 0,
      'الحالة': t.isExempt ? `معفى (${t.exemptReason || 'غائب / لديه حجة'})` : 'متاح للحراسة',
      'ساعات الحراسة المسندة': `${t.totalHours || 0} ساعة`,
      'عدد الغيابات / الاستثناءات': t.availabilityExceptions ? t.availabilityExceptions.length : 0
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'قائمة_الأساتذة');
    XLSX.writeFile(workbook, `قائمة_أساتذة_ثانوية_محمد_بلخير_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('تم تصدير ملف الإكسل بنجاح');
  };

  const handleDownloadTeacherTemplate = () => {
    const templateData = [
      { 'الاسم واللقب': 'بن علي محمد', 'المادة / التخصص': 'رياضيات', 'الأقدمية': 12, 'الحالة': 'متاح', 'سبب الإعفاء': '' },
      { 'الاسم واللقب': 'عمراني فاطمة', 'المادة / التخصص': 'علوم فيزيائية', 'الأقدمية': 8, 'الحالة': 'معفى', 'سبب الإعفاء': 'عطلة مرضية' },
      { 'الاسم واللقب': 'سليماني أحمد', 'المادة / التخصص': 'لغة عربية', 'الأقدمية': 15, 'الحالة': 'متاح', 'سبب الإعفاء': '' }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'نموذج_الأساتذة');
    XLSX.writeFile(workbook, 'نموذج_استيراد_الأساتذة_ثانوية_محمد_بلخير.xlsx');
    toast.success('تم تحميل نموذج الإكسل');
  };

  const handlePrintTeachers = () => {
    if (filteredTeachers.length === 0) {
      toast.error('لا توجد بيانات للطباعة');
      return;
    }

    const rowsHtml = filteredTeachers.map((t, idx) => `
      <tr style="border-bottom: 1px solid #ddd; text-align: center;">
        <td style="padding: 8px; border: 1px solid #333; font-weight: bold;">${idx + 1}</td>
        <td style="padding: 8px; border: 1px solid #333; text-align: right; font-weight: bold;">${t.name}</td>
        <td style="padding: 8px; border: 1px solid #333;">${t.specialty}</td>
        <td style="padding: 8px; border: 1px solid #333;">${t.seniority || 0}</td>
        <td style="padding: 8px; border: 1px solid #333;">${t.isExempt ? `معفى (${t.exemptReason || 'غائب / لديه حجة'})` : 'متاح'}</td>
        <td style="padding: 8px; border: 1px solid #333; font-weight: bold;">${t.totalHours || 0} س</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>قائمة الأساتذة - ثانوية محمد بلخير</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
          body {
            font-family: 'Cairo', sans-serif;
            padding: 20px;
            color: #000;
            background: #fff;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .header h3 { margin: 2px 0; font-size: 15px; font-weight: 700; }
          .header h4 { margin: 2px 0; font-size: 13px; font-weight: 600; }
          .header h2 { margin: 10px 0 4px 0; font-size: 18px; font-weight: 900; background: #f0f0f0; padding: 6px; border-radius: 4px; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-size: 12px;
          }
          th {
            background-color: #1e293b;
            color: #fff;
            padding: 10px;
            border: 1px solid #000;
            font-weight: bold;
          }
          td {
            padding: 8px;
            border: 1px solid #333;
          }
          .footer {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 13px;
          }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h3>الجمهورية الجزائرية الديمقراطية الشعبية</h3>
          <h3>وزارة التربية الوطنية</h3>
          <h4>مديرية التربية لولاية البيض | ثانوية محمد بلخير</h4>
          <h2>قائمة الأساتذة والتخصصات وحجم الحراسة</h2>
          <p style="font-size: 11px; margin-top: 4px;">إجمالي الأساتذة: ${filteredTeachers.length}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">الرقم</th>
              <th>اسم ولقب الأستاذ</th>
              <th>التخصص / المادة</th>
              <th>الأقدمية</th>
              <th>الحالة / الإعفاء</th>
              <th>ساعات الحراسة المسندة</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <table style="width: 100%; margin-top: 30px; border: none; letter-spacing: normal; word-spacing: normal;">
          <tr>
            <td style="border: none; text-align: right; font-weight: bold; font-size: 13px; color: #111827; width: 50%; padding-right: 10px;">
              تأشيرة وتوقيع مدير المؤسسة
            </td>
            <td style="border: none; text-align: left; font-weight: bold; font-size: 13px; color: #111827; width: 50%; padding-left: 10px;">
              تأشيرة وتوقيع الناظر
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    printHtmlDirectly(htmlContent);
  };

  return (
    <div className="space-y-6 text-slate-100">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-white">قائمة الأساتذة واستثناءات الحراسة</h2>
        <p className="text-xs text-slate-400 mt-1">إدارة بيانات الأساتذة وتخصصاتهم وساعات الحراسة المسندة</p>
      </div>

      <div className="bg-[#0D162A] p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6">
        {teachers.some(t => isDemoTeacher(t)) && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-300 text-xs font-bold">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} className="text-amber-400 shrink-0" />
              <span>تنبيه: تحتوي القائمة على أساتذة تجريبيين ({teachers.filter(t => isDemoTeacher(t)).length} أستاذ). سيتم استبعادهم فور استيرادكم لملف إكسل الخاص بالمؤسسة، أو يمكنكم حذفهم الآن.</span>
            </div>
            <button
              onClick={handleClearDemoTeachers}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2 rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
            >
              حذف الأساتذة التجريبيين
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="بحث عن أستاذ، تخصص، أو سبب إعفاء..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-[#121E36] border border-slate-700/80 rounded-xl focus:border-cyan-400 text-white outline-none text-xs font-bold"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#121E36] p-1 rounded-xl border border-slate-700/80 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-[#0099FF] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                الكل ({teachers.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'active' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                متاح ({teachers.filter(t => !t.isExempt).length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('exempt')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'exempt' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                معفى ({teachers.filter(t => t.isExempt).length})
              </button>
            </div>
          </div>
          
          <div className="flex gap-2 lg:gap-3 flex-wrap">
            {teachers.some(t => isDemoTeacher(t)) && (
              <button
                onClick={handleClearDemoTeachers}
                className="flex items-center justify-center gap-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 px-3.5 py-2.5 rounded-xl hover:bg-amber-500/25 transition-colors font-bold text-xs cursor-pointer"
                title="حذف جميع الأساتذة التجريبيين فقط"
              >
                <Trash2 size={15} />
                <span>حذف التجريبيين</span>
              </button>
            )}

            {teachers.length > 0 && (
              <button
                onClick={handleClearAllTeachers}
                className="flex items-center justify-center gap-1.5 bg-rose-500/15 text-rose-300 border border-rose-500/30 px-3.5 py-2.5 rounded-xl hover:bg-rose-500/25 transition-colors font-bold text-xs cursor-pointer"
                title="مسح كافة الأساتذة"
              >
                <Trash2 size={15} />
                <span>مسح الكل</span>
              </button>
            )}

            <button
              onClick={handleDownloadTeacherTemplate}
              className="flex items-center justify-center gap-1.5 bg-[#121E36] text-slate-300 border border-slate-700 px-3.5 py-2.5 rounded-xl hover:bg-[#182643] transition-colors font-bold text-xs cursor-pointer"
              title="تحميل نموذج ملف إكسل فارغ للاستيراد"
            >
              <Download size={15} />
              <span>النموذج</span>
            </button>

            <label className="flex items-center justify-center gap-1.5 bg-[#121E36] text-emerald-300 border border-emerald-500/30 px-3.5 py-2.5 rounded-xl cursor-pointer hover:bg-[#182643] transition-colors font-bold text-xs" title="استيراد قائمة الأساتذة من ملف إكسل واستبدال التجريبيين">
              <FileUp size={15} />
              <span>استيراد إكسل</span>
              <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
            </label>

            <button
              onClick={handleExportTeachersExcel}
              className="flex items-center justify-center gap-1.5 bg-[#121E36] text-cyan-300 border border-cyan-500/30 px-3.5 py-2.5 rounded-xl hover:bg-[#182643] transition-colors font-bold text-xs cursor-pointer"
            >
              <FileDown size={15} />
              <span>تصدير إكسل</span>
            </button>

            <button
              onClick={handlePrintTeachers}
              className="flex items-center justify-center gap-1.5 bg-[#121E36] text-amber-300 border border-amber-500/30 px-3.5 py-2.5 rounded-xl hover:bg-[#182643] transition-colors font-bold text-xs cursor-pointer"
            >
              <Printer size={15} />
              <span>طباعة القائمة</span>
            </button>

            <button 
              onClick={() => {
                setEditingTeacher(null);
                setShowForm(false);
                setShowAutoAddPanel(!showAutoAddPanel);
              }}
              className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl transition-colors font-black shadow-lg text-xs cursor-pointer border ${
                showAutoAddPanel
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-cyan-500/20'
                  : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25'
              }`}
            >
              <Sparkles size={15} />
              <span>{showAutoAddPanel ? 'إخفاء الإضافة التلقائية' : 'إضافة الأساتذة تلقائياً'}</span>
            </button>

            <button 
              onClick={() => { setShowAutoAddPanel(false); setEditingTeacher(null); setShowForm(!showForm); }}
              className="flex items-center justify-center gap-1.5 bg-[#0099FF] text-white px-4 py-2.5 rounded-xl hover:bg-sky-500 transition-colors font-black shadow-lg shadow-sky-500/20 text-xs cursor-pointer"
            >
              <UserPlus size={15} />
              {showForm ? 'إلغاء' : 'إضافة أستاذ'}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showAutoAddPanel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <AutoAddTeachersPanel
                existingNames={teachers.map(t => t.name)}
                onSuccess={fetchLists}
                onClose={() => setShowAutoAddPanel(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(showForm || editingTeacher) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <form onSubmit={handleAddTeacher} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-[#121E36] rounded-2xl border border-slate-700">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">الاسم الكامل</label>
                  <input
                    name="name"
                    defaultValue={editingTeacher?.name}
                    required
                    className="w-full p-2.5 bg-[#182643] border border-slate-700 rounded-xl text-white outline-none focus:border-cyan-400 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">التخصص</label>
                  <input
                    name="specialty"
                    list="subjects"
                    defaultValue={editingTeacher?.specialty}
                    required
                    className="w-full p-2.5 bg-[#182643] border border-slate-700 rounded-xl text-white outline-none focus:border-cyan-400 text-xs font-bold"
                  />
                  <datalist id="subjects">
                    {SECONDARY_SUBJECTS.map(sub => <option key={sub} value={sub} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الأقدمية</label>
                  <div className="flex gap-2">
                    <input
                      name="seniority"
                      type="number"
                      defaultValue={editingTeacher?.seniority}
                      className="w-full p-2.5 bg-[#182643] border border-slate-700 rounded-xl text-white outline-none focus:border-cyan-400 text-xs font-bold"
                    />
                    <button type="submit" className="bg-[#0099FF] text-white px-5 rounded-xl font-black text-xs hover:bg-sky-500 transition-all cursor-pointer">حفظ</button>
                  </div>
                </div>

                {/* Exempt / Absent with justification fields */}
                <div className="md:col-span-4 bg-[#182643] p-4 rounded-xl border border-slate-700/80 flex flex-col sm:flex-row sm:items-center gap-4">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formIsExempt}
                      onChange={(e) => {
                        setFormIsExempt(e.target.checked);
                        if (e.target.checked && !formExemptReason) {
                          setFormExemptReason('غائب');
                        }
                      }}
                      className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                    />
                    <span className={`text-xs font-black ${formIsExempt ? 'text-rose-300' : 'text-slate-200'}`}>
                      معفى من الحراسة (الأستاذ غائب أو لديه حجة)
                    </span>
                  </label>

                  {formIsExempt && (
                    <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        value={formExemptReason}
                        onChange={(e) => setFormExemptReason(e.target.value)}
                        placeholder="سبب الإعفاء أو الحجة (مثال: غائب، عطلة مرضية، حجة إدارية...)"
                        className="flex-1 p-2 bg-[#091021] border border-rose-500/40 rounded-xl text-white outline-none focus:border-rose-400 text-xs font-bold"
                      />
                    </div>
                  )}
                </div>
                {examSessions.length > 0 && (
                  <div className="md:col-span-4 mt-2">
                    <label className="block text-xs font-bold text-slate-300 mb-2">غيابات الأستاذ (استثناءات الحراسة)</label>
                    <div className="flex flex-wrap gap-2">
                      {examSessions.map(session => (
                        <label 
                          key={session} 
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                            selectedExceptions.includes(session) 
                              ? 'bg-rose-950/60 border-rose-600 text-rose-300 font-bold' 
                              : 'bg-[#182643] border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            className="hidden"
                            checked={selectedExceptions.includes(session)}
                            onChange={() => toggleException(session)}
                          />
                          <span className="font-bold font-mono">{session.split('-').slice(0, 3).join('-')}</span>
                          <span className="text-[10px]">{session.endsWith('morning') ? 'صباحاً' : 'مساءً'}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dedicated Imported Teachers Table */}
      <div className="bg-[#0D162A] rounded-3xl border border-slate-800 shadow-xl overflow-x-auto">
        <table className="w-full text-right border-collapse text-xs">
          <thead>
            <tr className="bg-[#121E36] border-b border-slate-800 text-slate-300">
              <th className="p-4 font-black">اسم الأستاذ</th>
              <th className="p-4 font-black">التخصص</th>
              <th className="p-4 font-black text-center">الأقدمية</th>
              <th className="p-4 font-black">الحالة / الإعفاء</th>
              <th className="p-4 font-black text-center">ساعات الحراسة</th>
              <th className="p-4 font-black text-left">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTeachers.map((teacher) => (
              <tr key={teacher.id} className={`border-b border-slate-800/60 transition-colors ${teacher.isExempt ? 'bg-rose-950/20 hover:bg-rose-950/30' : 'hover:bg-[#121E36]/40'}`}>
                <td className="p-4 font-bold text-white text-sm">
                  <span className={`align-middle ${teacher.isExempt ? 'line-through text-slate-400' : ''}`}>{teacher.name}</span>
                  {isDemoTeacher(teacher) && (
                    <span className="mr-2 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                      بيانات تجريبية
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <span className="bg-[#0099FF]/20 text-cyan-300 border border-cyan-500/30 px-3 py-1 rounded-full text-xs font-bold">
                    {teacher.specialty}
                  </span>
                </td>
                <td className="p-4 text-center text-slate-300 font-mono font-bold">{teacher.seniority}</td>
                <td className="p-4">
                  {teacher.isExempt ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full font-black text-[11px]">
                        <Ban size={12} />
                        معفى
                      </span>
                      <span className="text-[11px] text-rose-200/90 font-bold">
                        ({teacher.exemptReason || 'غائب / لديه حجة'})
                      </span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                      <CheckCircle2 size={12} />
                      متاح للحراسة
                    </span>
                  )}
                </td>
                <td className="p-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`font-mono font-black ${teacher.totalHours! > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {teacher.totalHours} س
                    </span>
                    {teacher.availabilityExceptions && teacher.availabilityExceptions.length > 0 && (
                      <span className="bg-rose-950/60 text-rose-300 border border-rose-800/40 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {teacher.availabilityExceptions.length} غيابات
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-left">
                  <div className="flex gap-1.5 justify-end items-center">
                    {teacher.isExempt ? (
                      <button
                        onClick={() => handleToggleExemption(teacher, false)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-[11px] transition-colors cursor-pointer"
                        title="إلغاء الإعفاء وإعادة التفعيل"
                      >
                        <UserCheck size={13} />
                        <span>إلغاء الإعفاء</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setExemptTargetTeacher(teacher);
                          setExemptReasonInput(teacher.exemptReason || 'غائب');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-[11px] transition-colors cursor-pointer"
                        title="إعفاء الأستاذ (غائب أو لديه حجة)"
                      >
                        <UserX size={13} />
                        <span>معفى</span>
                      </button>
                    )}
                    <button 
                      onClick={() => { setEditingTeacher(teacher); setShowForm(true); }}
                      className="p-1.5 text-slate-400 hover:text-cyan-400 bg-[#121E36] rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button 
                      onClick={() => handleDelete(teacher.id!)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 bg-[#121E36] rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredTeachers.length === 0 && !loading && (
          <div className="p-16 text-center text-slate-500">
            <Users size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-bold">لا يوجد أساتذة مضافين حالياً</p>
          </div>
        )}

        {/* Pagination Bar */}
        {filteredTeachers.length > PAGE_SIZE && (
          <div className="p-4 bg-[#121E36] border-t border-slate-800 flex justify-between items-center text-xs font-medium text-slate-300">
            <span>
              عرض {((currentPage - 1) * PAGE_SIZE) + 1} إلى {Math.min(currentPage * PAGE_SIZE, filteredTeachers.length)} من أصل {filteredTeachers.length} أستاذ
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-[#182643] border border-slate-700 rounded-lg disabled:opacity-30 hover:bg-slate-700 transition-colors font-bold cursor-pointer"
              >
                السابق
              </button>
              <span className="px-3 py-1 bg-[#0099FF] text-white font-black rounded-lg">
                صفحة {currentPage} من {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 bg-[#182643] border border-slate-700 rounded-lg disabled:opacity-30 hover:bg-slate-700 transition-colors font-bold cursor-pointer"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      <ExcelImportModal 
        isOpen={isImportModalOpen}
        onClose={() => { setIsImportModalOpen(false); setFileBuffer(null); }}
        fileBuffer={fileBuffer}
        title="استيراد قائمة الأساتذة"
        expectedColumns={[
          { 
            key: 'num', 
            label: 'رقم الأستاذ / المعرف',
            aliases: ['رقم الأستاذ', 'رقم الاستاذ', 'رقم التسجيل', 'الرقم', 'رقم', 'رمز', 'معرف', 'id', 'num', 'code', 'number']
          },
          { 
            key: 'name', 
            label: 'الاسم واللقب الكامل', 
            required: true,
            aliases: ['الاسم واللقب', 'الاسم و اللقب', 'الاسم واللقب الكامل', 'الاسم الكامل', 'الأستاذ', 'اسم الأستاذ', 'أستاذ', 'اسم ولقب الأستاذ', 'اسم الأستاذ ولقبه', 'name', 'full name', 'teacher']
          },
          { 
            key: 'lastName', 
            label: 'اللقب (في حالة وجود عمود منفصل)',
            aliases: ['اللقب', 'لقب', 'لقب الأستاذ', 'last name', 'lastname', 'family name']
          },
          { 
            key: 'firstName', 
            label: 'الاسم (في حالة وجود عمود منفصل)',
            aliases: ['الاسم', 'اسم', 'اسم الأستاذ الشخصي', 'first name', 'firstname', 'given name']
          },
          { 
            key: 'specialty', 
            label: 'المادة / التخصص', 
            required: true,
            aliases: ['المادة التي يدرسها', 'المادة المدرّسة', 'المادة', 'التخصص', 'تخصص', 'تخصص الأستاذ', 'المادة التخصصية', 'المادة المبرمجة', 'مادة', 'تخصص الأستاد', 'specialty', 'subject']
          },
          { 
            key: 'seniority', 
            label: 'الأقدمية',
            aliases: ['الأقدمية', 'اقدمية', 'الدرجة', 'سنوات الخدمة', 'seniority']
          },
          { 
            key: 'exemptStatus', 
            label: 'الحالة / معفى (اختياري)',
            aliases: ['معفى', 'معفي', 'الحالة', 'الغياب', 'غائب', 'حالة', 'الإعفاء', 'exempt', 'status', 'absent']
          },
          { 
            key: 'exemptReason', 
            label: 'سبب الإعفاء / الحجة (اختياري)',
            aliases: ['السبب', 'سبب الإعفاء', 'سبب الغياب', 'الحجة', 'المبرر', 'مبرر', 'ملاحظات', 'ملاحظة', 'reason', 'note', 'excuse']
          }
        ]}
        onConfirm={handleConfirmImport}
      />

      {/* Quick Teacher Exemption Modal */}
      {exemptTargetTeacher && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
          <div className="bg-[#121E36] border border-rose-500/40 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100">
            <div className="p-4 bg-rose-600/20 border-b border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center">
                  <UserX size={20} />
                </div>
                <div>
                  <h4 className="font-black text-sm text-white">إعفاء أستاذ من الحراسة</h4>
                  <p className="text-xs text-rose-200 font-bold mt-0.5">{exemptTargetTeacher.name}</p>
                </div>
              </div>
              <button
                onClick={() => setExemptTargetTeacher(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-300 leading-relaxed font-medium">
                عند تفعيل خاصية <strong className="text-rose-300">معفى</strong>، يُستثنى الأستاذ من جداول التوزيع الذكي ومن الاستدعاءات أثناء الطباعة.
              </p>

              <div className="space-y-2">
                <label className="block font-bold text-slate-200">اختر سبب الإعفاء السريع:</label>
                <div className="flex flex-wrap gap-1.5">
                  {['غائب', 'عطلة مرضية', 'لديه حجة / مبرر إداري', 'تكوين / تربص', 'إعفاء إداري'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setExemptReasonInput(preset)}
                      className={`px-3 py-1.5 rounded-xl border font-bold text-[11px] transition-all cursor-pointer ${
                        exemptReasonInput === preset
                          ? 'bg-rose-600 text-white border-rose-500'
                          : 'bg-[#091021] text-slate-300 border-slate-700 hover:border-rose-400'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-200">أو اكتب السبب / الحجة:</label>
                <input
                  type="text"
                  value={exemptReasonInput}
                  onChange={(e) => setExemptReasonInput(e.target.value)}
                  placeholder="مثال: عطلة مرضية أو غائب بعذر..."
                  className="w-full p-2.5 bg-[#091021] border border-slate-700 rounded-xl text-white outline-none focus:border-rose-400 text-xs font-bold"
                />
              </div>
            </div>

            <div className="p-4 bg-[#091021] border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setExemptTargetTeacher(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleToggleExemption(exemptTargetTeacher, true, exemptReasonInput)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                <UserX size={15} />
                <span>تأكيد الإعفاء الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
