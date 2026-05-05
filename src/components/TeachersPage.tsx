import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Teacher, Exam } from '../types';
import { SECONDARY_SUBJECTS } from '../lib/constants';
import { UserPlus, Trash2, Edit2, Search, FileUp, Download, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import ExcelImportModal from './ExcelImportModal';

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [selectedExceptions, setSelectedExceptions] = useState<string[]>([]);
  
  // Excel Import State
  const [importData, setImportData] = useState<any[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  useEffect(() => {
    if (editingTeacher) {
      setSelectedExceptions(editingTeacher.availabilityExceptions || []);
    } else {
      setSelectedExceptions([]);
    }
  }, [editingTeacher]);

  const fetchLists = async () => {
    try {
      const [tData, eData] = await Promise.all([
        api.get('/api/teachers'),
        api.get('/api/exams')
      ]);
      setTeachers(tData.map((d: any) => ({
        ...d,
        availabilityExceptions: typeof d.availabilityExceptions === 'string' ? JSON.parse(d.availabilityExceptions) : d.availabilityExceptions || [],
        totalHours: d.totalHours || 0
      })));
      setExams(eData);
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
    const formData = new FormData(e.currentTarget);
    const teacherData = {
      name: formData.get('name') as string,
      specialty: formData.get('specialty') as string,
      seniority: Number(formData.get('seniority')) || 0,
      email: "",
      availabilityExceptions: JSON.stringify(selectedExceptions)
    };

    try {
      if (editingTeacher) {
        await api.put(`/api/teachers/${editingTeacher.id}`, teacherData);
        toast.success('تم تحديث بيانات الأستاذ');
      } else {
        const res = await api.post('/api/teachers', { ...teacherData, totalHours: 0, id: Date.now().toString() });
        toast.success('تم إضافة الأستاذ بنجاح');
      }
      setShowForm(false);
      setEditingTeacher(null);
      setSelectedExceptions([]);
      e.currentTarget.reset();
      fetchLists();
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  const generateMockData = async () => {
    toast.error('هذه الميزة غير مدعومة في النسخة الحالية');
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        setImportData(data);
        setIsImportModalOpen(true);
      } catch (error) {
        toast.error('حدث خطأ أثناء قراءة الملف');
      }
      // Reset input
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async (mappedData: any[]) => {
    setIsImportModalOpen(false);
    toast.loading('جاري استيراد الأساتذة...', { id: 'import' });
    try {
      let count = 0;
      for (const row of mappedData) {
        if (row.name) {
          await api.post('/api/teachers', {
            id: Date.now().toString() + Math.random().toString(),
            name: String(row.name),
            specialty: row.specialty ? String(row.specialty) : 'عام',
            seniority: Number(row.seniority) || 0,
            email: "",
            totalHours: 0,
            availabilityExceptions: "[]"
          });
          count++;
        }
      }
      toast.success(`تم استيراد ${count} أستاذ بنجاح`, { id: 'import' });
      fetchLists();
    } catch(e) {
      toast.error('خطأ أثنا الاستيراد', { id: 'import' });
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.specialty.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const examSessions: string[] = Array.from(new Set<string>(exams.map((e: Exam) => `${e.date}-${e.period}`))).sort();

  const toggleException = (sessionKey: string) => {
    setSelectedExceptions(prev => 
      prev.includes(sessionKey) 
        ? prev.filter(k => k !== sessionKey)
        : [...prev, sessionKey]
    );
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="bg-white p-4 lg:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 lg:space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="بحث عن أستاذ أو تخصص..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-3 lg:py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
          </div>
          
          <div className="flex gap-2 lg:gap-3 flex-wrap">
            <button
              onClick={generateMockData}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-purple-50 text-purple-700 px-4 py-3 lg:py-2 rounded-xl hover:bg-purple-100 transition-colors font-bold border border-purple-200 text-sm"
              disabled={loading}
            >
              <Users size={18} />
              <span className="hidden sm:inline">بيانات تجريبية</span>
            </button>
            <label className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-3 lg:py-2 rounded-xl cursor-pointer hover:bg-emerald-100 transition-colors font-bold border border-emerald-200 text-sm">
              <FileUp size={18} />
              <span className="hidden sm:inline">استيراد</span>
              <span className="sm:hidden">إكسل</span>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
            <button 
              onClick={() => { setEditingTeacher(null); setShowForm(!showForm); }}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 lg:py-2 rounded-xl hover:bg-blue-700 transition-colors font-bold shadow-md shadow-blue-200 text-sm"
            >
              <UserPlus size={18} />
              {showForm ? 'إلغاء' : 'إضافة'}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {(showForm || editingTeacher) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <form onSubmit={handleAddTeacher} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-gray-50 rounded-2xl border border-blue-100">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">الاسم الكامل</label>
                  <input
                    name="name"
                    defaultValue={editingTeacher?.name}
                    required
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">التخصص</label>
                  <input
                    name="specialty"
                    list="subjects"
                    defaultValue={editingTeacher?.specialty}
                    required
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="subjects">
                    {SECONDARY_SUBJECTS.map(sub => <option key={sub} value={sub} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">الأقدمية</label>
                  <div className="flex gap-2">
                    <input
                      name="seniority"
                      type="number"
                      defaultValue={editingTeacher?.seniority}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button type="submit" className="bg-blue-600 text-white px-6 rounded-xl font-bold hover:bg-blue-700 transition-all">حفظ</button>
                  </div>
                </div>
                {examSessions.length > 0 && (
                  <div className="md:col-span-4 mt-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">غيابات الأستاذ (استثناءات الحراسة)</label>
                    <div className="flex flex-wrap gap-2">
                      {examSessions.map(session => (
                        <label 
                          key={session} 
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                            selectedExceptions.includes(session) 
                              ? 'bg-red-50 border-red-200 text-red-700' 
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            className="hidden"
                            checked={selectedExceptions.includes(session)}
                            onChange={() => toggleException(session)}
                          />
                          <span className="font-bold">{session.split('-').slice(0, 3).join('-')}</span>
                          <span className="text-xs">{session.endsWith('morning') ? 'صباحاً' : 'مساءً'}</span>
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hidden lg:block">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="p-4 font-bold text-gray-600">اسم الأستاذ</th>
              <th className="p-4 font-bold text-gray-600">التخصص</th>
              <th className="p-4 font-bold text-gray-600 text-center">الأقدمية</th>
              <th className="p-4 font-bold text-gray-600 text-center">ساعات الحراسة</th>
              <th className="p-4 font-bold text-gray-600 text-left">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeachers.map((teacher) => (
              <tr key={teacher.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="p-4 font-medium">{teacher.name}</td>
                <td className="p-4">
                  <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                    {teacher.specialty}
                  </span>
                </td>
                <td className="p-4 text-center text-gray-500 font-mono">{teacher.seniority}</td>
                <td className="p-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`font-mono font-bold ${teacher.totalHours! > 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {teacher.totalHours} س
                    </span>
                    {teacher.availabilityExceptions && teacher.availabilityExceptions.length > 0 && (
                      <span className="bg-red-50 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {teacher.availabilityExceptions.length} غيابات
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-left">
                  <div className="flex gap-2 justify-end">
                    <button 
                      onClick={() => { setEditingTeacher(teacher); setShowForm(true); }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(teacher.id!)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredTeachers.length === 0 && !loading && (
          <div className="p-20 text-center text-gray-400">
            <Users size={48} className="mx-auto mb-4 opacity-20" />
            <p>لا يوجد أساتذة مضافين حالياً</p>
          </div>
        )}
      </div>

      {/* Mobile Vertical View (Cards) */}
      <div className="lg:hidden space-y-3 pb-20">
        {filteredTeachers.map((teacher) => (
          <div key={teacher.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-gray-900 text-sm mb-1">{teacher.name}</h3>
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  {teacher.specialty}
                </span>
              </div>
              <div className="flex gap-1.5">
                <button 
                  onClick={() => { setEditingTeacher(teacher); setShowForm(true); }}
                  className="p-2 text-blue-600 bg-blue-50 rounded-xl"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(teacher.id!)}
                  className="p-2 text-red-600 bg-red-50 rounded-xl"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50">
              <div className="bg-gray-50 p-2.5 rounded-xl text-center">
                <p className="text-[9px] text-gray-400 font-bold mb-1 uppercase">الأقدمية</p>
                <p className="text-xs font-bold text-gray-700 font-mono">{teacher.seniority}</p>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-xl text-center">
                <p className="text-[9px] text-gray-400 font-bold mb-1 uppercase">ساعات الحراسة</p>
                <div className="flex flex-col items-center gap-1">
                  <p className={`text-xs font-bold font-mono ${teacher.totalHours! > 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {teacher.totalHours} س
                  </p>
                  {teacher.availabilityExceptions && teacher.availabilityExceptions.length > 0 && (
                    <span className="bg-red-50 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      {teacher.availabilityExceptions.length} غيابات
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {filteredTeachers.length === 0 && !loading && (
          <div className="py-10 text-center text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-sm">لا يوجد نتائج للبحث</p>
          </div>
        )}
      </div>

      <ExcelImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        data={importData}
        title="استيراد الأساتذة"
        expectedColumns={[
          { key: 'name', label: 'الاسم واللقب', required: true },
          { key: 'specialty', label: 'التخصص' },
          { key: 'seniority', label: 'الأقدمية' }
        ]}
        onConfirm={handleConfirmImport}
      />
    </div>
  );
}
