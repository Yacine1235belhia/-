import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Teacher, Exam, Hall, Assignment } from '../types';
import { generateAssignments } from '../lib/allocation';
import { Wand2, Download, Printer, Trash2, Calendar, User, DoorOpen, ListFilter } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AllocationPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [institutionName, setInstitutionName] = useState('المؤسسة التعليمية');

  useEffect(() => {
    Promise.all([
      api.get('/api/teachers'),
      api.get('/api/exams'),
      api.get('/api/halls'),
      api.get('/api/settings'),
      api.get('/api/assignments')
    ]).then(([tData, eData, hData, sData, aData]) => {
      setTeachers(tData);
      setExams(eData);
      setHalls(hData);
      if (sData && sData.global && sData.global.institutionName) {
        setInstitutionName(sData.global.institutionName);
      }
      setAssignments(aData);
      setLoading(false);
    }).catch(console.error);
  }, []);

  const handleGenerate = async () => {
    if (exams.length === 0 || teachers.length === 0 || halls.length === 0) {
      toast.error('يرجى التأكد من إضافة الأساتذة والاختبارات والقاعات أولاً');
      return;
    }

    setGenerating(true);
    try {
      // 1. Delete old assignments
      for (const assignment of assignments) {
        if (assignment.id) {
            await api.delete(`/api/assignments/${assignment.id}`);
        }
      }
      
      // 2. Generate new ones
      const result = generateAssignments(teachers, exams, halls);
      
      // 3. Save to Custom Logic
      for (const a of result.assignments) {
        await api.post('/api/assignments', { ...a, id: Date.now().toString() + Math.random().toString() });
      }

      // 4. Update teacher hours
      for (const [teacherId, hours] of Object.entries(result.stats)) {
        await api.put(`/api/teachers/${teacherId}`, { totalHours: hours });
      }
      
      // Fetch latest assignments and teachers
      const newAssignments = await api.get('/api/assignments');
      const newTeachers = await api.get('/api/teachers');
      setAssignments(newAssignments);
      setTeachers(newTeachers);

      toast.success('تم توليد جدول الحراسة بنجاح');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء التوليد');
    } finally {
      setGenerating(false);
    }
  };

  const exportPDF = () => {
    toast.success('تم طلب الطباعة. إذا لم تفتح نافذة الطباعة تلقائياً، يرجى فتح التطبيق في المتصفح المباشر عبر الزر أعلى يمين الشاشة.', { duration: 8000, icon: '🖨️' });
    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        toast.error('المتصفح يمنع الطباعة من هذه النافذة.');
      }
    }, 500);
  };

  const getExamName = (id: string) => exams.find(e => e.id === id)?.subject || 'مادة محذوفة';
  const getTeacherName = (id: string) => teachers.find(t => t.id === id)?.name || 'أستاذ محذوف';
  const getHallName = (id: string) => halls.find(h => h.id === id)?.name || 'قاعة محذوفة';

  const earliestExamDate = exams.length > 0 
    ? new Date(Math.min(...exams.map(e => new Date(e.date).getTime())))
    : new Date();
  
  const weekDates = [0, 1, 2, 3, 4].map(offset => {
    const d = new Date(earliestExamDate);
    d.setDate(earliestExamDate.getDate() - earliestExamDate.getDay() + offset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

  return (
    <div className="space-y-4 lg:space-y-6 print:space-y-0 print:m-0">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center bg-white p-6 lg:p-8 rounded-2xl border border-gray-100 shadow-sm gap-6 print:hidden">
        <div className="flex items-center gap-4">
          <div className="p-2 lg:p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200 shrink-0">
            <Wand2 size={24} className="lg:w-8 lg:h-8" />
          </div>
          <div>
            <h3 className="text-lg lg:text-2xl font-bold text-gray-900 leading-tight">توزيع الحراسة الذكي</h3>
            <p className="text-xs lg:text-base text-gray-500 mt-1">توليد جدول الحراسة بناءً على معايير العدالة والتخصص</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={exportPDF}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 lg:py-2.5 rounded-xl hover:bg-gray-200 transition-all font-bold text-sm"
          >
            <Printer size={18} />
            طباعة الجدول
          </button>
          <button 
            onClick={handleGenerate}
            disabled={generating}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-3 lg:py-2.5 rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-200 active:scale-95 disabled:bg-blue-300 text-sm"
          >
            {generating ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <Wand2 size={18} />}
            توليد التوزيع
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:overflow-visible print:border-none print:shadow-none">
        <div className="p-4 lg:p-6 border-b border-gray-100 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <ListFilter size={18} className="text-gray-400" />
            <span className="font-bold text-gray-700 text-sm lg:text-base">قائمة التكليفات ({assignments.length})</span>
          </div>
        </div>
        
        <div className="hidden lg:block overflow-x-auto print:hidden">
          <table className="w-full text-right border-collapse print:text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 print:bg-white print:border-black">
                <th className="p-4 font-bold text-gray-600">المادة</th>
                <th className="p-4 font-bold text-gray-600">أستاذ الحراسة</th>
                <th className="p-4 font-bold text-gray-600">القاعة</th>
                <th className="p-4 font-bold text-gray-600">التاريخ</th>
                <th className="p-4 font-bold text-gray-600 text-center">الفترة</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="font-bold">{getExamName(assignment.examId)}</span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-700">{getTeacherName(assignment.teacherId)}</td>
                  <td className="p-4">
                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-sm font-bold">
                      {getHallName(assignment.hallId)}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 font-mono text-sm">{assignment.date}</td>
                  <td className="p-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      assignment.period === 'morning' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    }`}>
                      {assignment.period === 'morning' ? 'صباحي' : 'مسائي'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="lg:hidden p-4 space-y-3 print:hidden">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-blue-900 text-sm">{getExamName(assignment.examId)}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{getTeacherName(assignment.teacherId)}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  assignment.period === 'morning' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                }`}>
                  {assignment.period === 'morning' ? 'صباحي' : 'مسائي'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-gray-500 font-medium bg-white/50 p-2 rounded-lg">
                <span className="flex items-center gap-1"><Calendar size={12} /> {assignment.date}</span>
                <span className="flex items-center gap-1 font-bold text-gray-700"><DoorOpen size={12} /> {getHallName(assignment.hallId)}</span>
              </div>
            </div>
          ))}
        </div>
          
        {assignments.length === 0 && !loading && (
          <div className="p-10 lg:p-20 text-center print:hidden">
            <div className="w-16 h-16 lg:w-24 lg:h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Printer size={32} className="text-gray-200 lg:w-12 lg:h-12" />
            </div>
            <p className="text-gray-400 font-medium text-sm lg:text-base">لم يتم توليد أي تكليفات بعد. اضغط على أزرار التوليد للبدء.</p>
          </div>
        )}

        {/* Printable Cards */}
        <div className="hidden print:block font-serif w-full text-black" dir="rtl">
          {teachers.map((teacher) => {
            const teacherAssignments = assignments.filter(a => a.teacherId === teacher.id);
            if (teacherAssignments.length === 0) return null;
            
            return (
              <div key={teacher.id} className="mb-8 p-6 border-2 border-black rounded-xl break-inside-avoid shadow-none pb-12">
                <div className="text-center font-bold mb-4 leading-tight text-sm">
                  <p>الجمهورية الجزائرية الديمقراطية الشعبية</p>
                  <p>وزارة التربية الوطنية</p>
                  <p>المؤسسة: {institutionName}</p>
                  <h3 className="text-lg mt-2 font-bold underline underline-offset-4">تخصيص الحراسة الخاص بالأستاذ</h3>
                </div>
                
                <div className="mb-4 text-base font-bold underline underline-offset-4">
                  الأستاذ(ة): {teacher.name}
                </div>

                <table className="w-full text-center border-collapse border-b-2 border-l-2 border-black text-sm">
                  <thead>
                    <tr>
                      <th className="border-t-2 border-r-2 border-black p-2 bg-gray-100 print:bg-gray-100 align-middle whitespace-nowrap">اليوم / التوقيت</th>
                      {weekDates.map((date, index) => (
                        <th key={date} className="border-t-2 border-r-2 border-black p-2 bg-gray-100 print:bg-gray-100 min-w-[100px]">
                          <div>{dayNames[index]}</div>
                          <div className="font-normal text-xs font-mono mt-1">{date}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th className="border-t-2 border-r-2 border-black p-2 bg-gray-100 print:bg-gray-100 align-middle">الفترة الصباحية</th>
                      {weekDates.map(date => {
                        const morning = teacherAssignments.find(a => a.date === date && a.period === 'morning');
                        const mExam = morning ? exams.find(e => e.id === morning.examId) : null;
                        const mHall = morning ? halls.find(h => h.id === morning.hallId) : null;
                        return (
                          <td key={date} className="border-t-2 border-r-2 border-black p-2">
                            {morning ? (
                              <div className="text-xs">
                                <div className="font-bold mb-1 max-w-[120px] mx-auto break-words">{mExam?.subject}</div>
                                <div>القاعة: <span className="font-bold">{mHall?.name}</span></div>
                              </div>
                            ) : ''}
                          </td>
                        )
                      })}
                    </tr>
                    <tr>
                      <th className="border-t-2 border-r-2 border-black p-2 bg-gray-100 print:bg-gray-100 align-middle">الفترة المسائية</th>
                      {weekDates.map(date => {
                        const afternoon = teacherAssignments.find(a => a.date === date && a.period === 'afternoon');
                        const aExam = afternoon ? exams.find(e => e.id === afternoon.examId) : null;
                        const aHall = afternoon ? halls.find(h => h.id === afternoon.hallId) : null;
                        return (
                          <td key={date} className="border-t-2 border-r-2 border-black p-2">
                            {afternoon ? (
                              <div className="text-xs">
                                <div className="font-bold mb-1 max-w-[120px] mx-auto break-words">{aExam?.subject}</div>
                                <div>القاعة: <span className="font-bold">{aHall?.name}</span></div>
                              </div>
                            ) : ''}
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>

                <div className="mt-8 flex justify-end px-12 font-bold text-sm">
                  <p>توقيع الناظر</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
