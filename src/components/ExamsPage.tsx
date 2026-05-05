import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Exam } from '../types';
import { SECONDARY_SUBJECTS } from '../lib/constants';
import { Calendar as CalendarIcon, Clock, Trash2, Edit2, Plus, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import ExcelImportModal from './ExcelImportModal';

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  // Excel Import State
  const [importData, setImportData] = useState<any[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const fetchExams = async () => {
    try {
      const data = await api.get('/api/exams');
      setExams(data);
    } catch(e) {
      console.error(e);
      toast.error('خطأ في جلب الاختبارات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleAddExam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const examData = {
      subject: formData.get('subject') as string,
      date: formData.get('date') as string,
      period: formData.get('period') as 'morning' | 'afternoon',
      duration: Number(formData.get('duration')),
      hallCount: Number(formData.get('hallCount')),
      proctorsPerHall: Number(formData.get('proctorsPerHall')),
    };

    try {
      if (editingExam) {
        await api.put(`/api/exams/${editingExam.id}`, examData);
        toast.success('تم تحديث بيانات الاختبار');
      } else {
        await api.post('/api/exams', { ...examData, id: Date.now().toString() });
        toast.success('تم إضافة الاختبار بنجاح');
      }
      setShowForm(false);
      setEditingExam(null);
      e.currentTarget.reset();
      fetchExams();
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/exams/${id}`);
      toast.success('تم الحذف');
      fetchExams();
    } catch (error) {
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const XLSX = await import('xlsx');
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        setImportData(data);
        setIsImportModalOpen(true);
      } catch (error) {
        toast.error('حدث خطأ أثناء قراءة الملف');
      }
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async (mappedData: any[]) => {
    setIsImportModalOpen(false);
    toast.loading('جاري استيراد الإختبارات...', { id: 'import' });
    try {
      let count = 0;
      for (const row of mappedData) {
        if (row.subject) {
          let parsedDate = row.date;
          if (typeof parsedDate === 'number') {
              const dateObj = new Date((parsedDate - (25567 + 2)) * 86400 * 1000);
              parsedDate = dateObj.toISOString().split('T')[0];
          }
          await api.post('/api/exams', {
            id: Date.now().toString() + Math.random().toString(),
            subject: String(row.subject),
            date: String(parsedDate || new Date().toISOString().split('T')[0]),
            period: (row.period === 'مسائي' || row.period === 'afternoon') ? 'afternoon' : 'morning',
            duration: Number(row.duration) || 2,
            hallCount: Number(row.hallCount) || 1,
            proctorsPerHall: Number(row.proctorsPerHall) || 2,
          });
          count++;
        }
      }
      toast.success(`تم إستيراد ${count} إختبار بنجاح`, { id: 'import' });
      fetchExams();
    } catch (error) {
      toast.error('حدث خطأ أثناء الإستيراد', { id: 'import' });
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="bg-white p-4 lg:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 lg:space-y-6">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
          <div>
            <h3 className="text-lg lg:text-xl font-bold text-gray-900 leading-tight">رزنامة الاختبارات</h3>
            <p className="text-xs lg:text-sm text-gray-500 mt-1">إدارة مواعيد الاختبارات وعدد الحراس المطلوبين</p>
          </div>
          <div className="flex gap-2 lg:gap-3 flex-wrap">
            <label className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-3 lg:py-2 rounded-xl cursor-pointer hover:bg-emerald-100 transition-colors font-bold border border-emerald-200 text-sm">
              <span className="hidden sm:inline">إستيراد إكسل</span>
              <span className="sm:hidden">إكسل</span>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
            <button 
              onClick={() => { setEditingExam(null); setShowForm(!showForm); }}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 lg:py-2 rounded-xl hover:bg-blue-700 transition-colors font-bold shadow-md shadow-blue-200 text-sm"
            >
              <Plus size={18} />
              {showForm ? 'إلغاء الإضافة' : 'إضافة اختبار'}
            </button>
          </div>
        </div>

        <AnimatePresence>
          { (showForm || editingExam) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <form onSubmit={handleAddExam} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-gray-50 rounded-2xl border border-blue-50">
                <div className="lg:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">المادة</label>
                  <input name="subject" list="examSubjects" defaultValue={editingExam?.subject} required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                  <datalist id="examSubjects">
                    {SECONDARY_SUBJECTS.map(sub => <option key={sub} value={sub} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">التاريخ</label>
                  <input type="date" name="date" defaultValue={editingExam?.date} required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">الفترة</label>
                  <select name="period" defaultValue={editingExam?.period} required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="morning">صباحي</option>
                    <option value="afternoon">مسائي</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">المدة (ساعة)</label>
                  <input type="number" step="0.5" name="duration" defaultValue={editingExam?.duration} required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">عدد القاعات</label>
                  <input type="number" name="hallCount" defaultValue={editingExam?.hallCount || 1} required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-gray-700 mb-1">حراس القاعة</label>
                    <input type="number" name="proctorsPerHall" defaultValue={editingExam?.proctorsPerHall || 2} required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <button type="submit" className="bg-blue-600 text-white font-bold py-2.5 px-6 rounded-xl hover:bg-blue-700 transition-all">حفظ</button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams.map((exam) => (
          <div key={exam.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-blue-50 p-2 lg:p-3 rounded-2xl text-blue-600 w-fit">
                <CalendarIcon size={20} className="lg:w-6 lg:h-6" />
              </div>
              <div className="flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingExam(exam); setShowForm(true); }} className="p-2 text-gray-400 hover:text-blue-600 bg-gray-50 rounded-lg lg:bg-transparent">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(exam.id!)} className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 rounded-lg lg:bg-transparent">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <h4 className="text-lg font-bold text-gray-900 mb-2">{exam.subject}</h4>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Clock size={16} className="text-gray-400" />
                <span>{exam.date} • {exam.period === 'morning' ? 'صباحي' : 'مسائي'}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Clock size={16} className="text-gray-400" />
                <span>المدة: {exam.duration} ساعات</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Users size={16} className="text-gray-400" />
                <span>المطلوب: {exam.hallCount * exam.proctorsPerHall} حراس ({exam.hallCount} قاعات)</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
              <span className={`px-2 py-1 rounded-md ${exam.period === 'morning' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                {exam.period === 'morning' ? 'فترة صباحية' : 'فترة مسائية'}
              </span>
              <span className="text-gray-400">ID: {exam.id?.slice(0, 5)}</span>
            </div>
          </div>
        ))}
      </div>

      {exams.length === 0 && !loading && (
        <div className="p-20 text-center text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <CalendarIcon size={48} className="mx-auto mb-4 opacity-20" />
          <p>لم يتم تحديد أي اختبارات بعد</p>
        </div>
      )}

      <ExcelImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        data={importData}
        title="استيراد الاختبارات"
        expectedColumns={[
          { key: 'subject', label: 'المادة', required: true },
          { key: 'date', label: 'التاريخ' },
          { key: 'period', label: 'الفترة (صباحي/مسائي)' },
          { key: 'duration', label: 'المدة (ساعة)' },
          { key: 'hallCount', label: 'عدد القاعات' },
          { key: 'proctorsPerHall', label: 'حراس القاعة' }
        ]}
        onConfirm={handleConfirmImport}
      />
    </div>
  );
}
