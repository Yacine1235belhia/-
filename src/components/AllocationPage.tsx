import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Teacher, Exam, Hall, Assignment } from '../types';
import { generateAssignments } from '../lib/allocation';
import { Wand2, Download, Printer, Trash2, Calendar, User, DoorOpen, ListFilter, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AllocationPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [institutionName, setInstitutionName] = useState('المؤسسة التعليمية');
  const [wilaya, setWilaya] = useState('..........................');
  const [schoolYear, setSchoolYear] = useState('2025-2026');
  const [selectedTerm, setSelectedTerm] = useState('الفصل الثالث');
  const [selectedYears, setSelectedYears] = useState<string[]>(['الأولى', 'الثانية']);
  const [morningTime, setMorningTime] = useState('08:00 - 12:00');
  const [afternoonTime, setAfternoonTime] = useState('13:00 - 17:00');
  const [showPrintModal, setShowPrintModal] = useState(false);

  const examType = `${selectedTerm}${selectedYears.length > 0 ? (selectedYears.length > 1 ? ' - السنوات ' : ' - السنة ') + selectedYears.join(' و ') : ''}`;

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
      if (sData) {
        if (sData.institutionName) setInstitutionName(sData.institutionName);
        if (sData.morningTime) setMorningTime(sData.morningTime);
        if (sData.afternoonTime) setAfternoonTime(sData.afternoonTime);
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

  const handlePrintClick = () => {
    setShowPrintModal(true);
  };

  const executePrint = () => {
    setShowPrintModal(false);
    toast.success('تم طلب الطباعة. إذا لم تفتح نافذة الطباعة تلقائياً، يرجى فتح التطبيق في المتصفح المباشر عبر الزر أعلى يمين الشاشة.', { duration: 8000, icon: '🖨️' });
    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        toast.error('المتصفح يمنع الطباعة من هذه النافذة.');
      }
    }, 500);
  };

  const getExamName = (id: any) => exams.find(e => String(e.id) === String(id))?.subject || 'مادة محذوفة';
  const getTeacherName = (id: any) => teachers.find(t => String(t.id) === String(id))?.name || 'أستاذ محذوف';
  const getHallName = (id: any) => halls.find(h => String(h.id) === String(id))?.name || 'قاعة محذوفة';

  // Helper to get the Sunday starting date of a week for a given date
  const getWeekStart = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() - d.getDay()); // Always Sunday
    return d.toISOString().split('T')[0];
  };

  // Group assignments by week (Sunday start date)
  const assignmentsByWeek: Record<string, string[]> = {};
  exams.forEach(exam => {
    const weekStart = getWeekStart(exam.date);
    if (weekStart && !assignmentsByWeek[weekStart]) {
      // Create week dates (Sunday to Thursday)
      const dates: string[] = [];
      const startD = new Date(weekStart);
      for (let i = 0; i < 5; i++) {
        const d = new Date(startD);
        d.setDate(startD.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
      }
      assignmentsByWeek[weekStart] = dates;
    }
  });

  const uniqueWeeks = Object.keys(assignmentsByWeek).sort();
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
            onClick={handlePrintClick}
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

      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Printer size={24} className="text-blue-600" />
                إعدادات الطباعة
              </h2>
              <button 
                onClick={() => setShowPrintModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">مديرية التربية لولاية</label>
                <input 
                  type="text" 
                  value={wilaya} 
                  onChange={(e) => setWilaya(e.target.value)} 
                  className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">المؤسسة التعليمية</label>
                <input 
                  type="text" 
                  value={institutionName} 
                  onChange={(e) => setInstitutionName(e.target.value)} 
                  className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الموسم الدراسي</label>
                <input 
                  type="text" 
                  value={schoolYear} 
                  onChange={(e) => setSchoolYear(e.target.value)} 
                  className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-left" dir="ltr"
                />
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">الفصل الدراسي</label>
                  <select
                    value={selectedTerm}
                    onChange={(e) => setSelectedTerm(e.target.value)}
                    className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    <option value="الفصل الأول">الفصل الأول</option>
                    <option value="الفصل الثاني">الفصل الثاني</option>
                    <option value="الفصل الثالث">الفصل الثالث</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">المستويات المعنية</label>
                  <div className="flex flex-wrap gap-3">
                    {['الأولى', 'الثانية', 'الثالثة'].map(year => (
                      <label key={year} className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg hover:border-blue-400 transition-all">
                        <input
                          type="checkbox"
                          checked={selectedYears.includes(year)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedYears([...selectedYears, year]);
                            } else {
                              setSelectedYears(selectedYears.filter(y => y !== year));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">السنة {year}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 flex justify-end gap-3 rounded-b-2xl shrink-0">
              <button 
                onClick={() => setShowPrintModal(false)}
                className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-all"
              >
                إلغاء
              </button>
              <button 
                onClick={executePrint}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
              >
                <Printer size={18} />
                تأكيد وطباعة
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-transparent print:bg-white overflow-hidden print:overflow-visible print:border-none print:shadow-none">
        {assignments.length === 0 && !loading && (
          <div className="p-10 lg:p-20 text-center print:hidden bg-white rounded-2xl border border-gray-100 shadow-sm mt-4">
            <div className="w-16 h-16 lg:w-24 lg:h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Printer size={32} className="text-gray-200 lg:w-12 lg:h-12" />
            </div>
            <p className="text-gray-400 font-medium text-sm lg:text-base">لم يتم توليد أي تكليفات بعد. اضغط على أزرار التوليد للبدء.</p>
          </div>
        )}

        {/* On-Screen & Printable Cards */}
        <div id="print-area" className="p-4 lg:p-6 font-serif w-full text-black print:p-0 print:m-0" dir="rtl">
          {teachers.map((teacher, idx) => {
            const teacherAssignments = assignments.filter(a => String(a.teacherId) === String(teacher.id));
            const isLastOnPage = (idx + 1) % 4 === 0;
            
            return (
              <div key={teacher.id} className={`mb-12 p-4 lg:p-8 border-2 border-gray-300 rounded-xl bg-white print:m-0 print:flex print:flex-col print:py-3 print:px-4 print:border-0 print:break-inside-avoid print:h-[6.8cm] print:min-h-[6.8cm] print:box-border print:overflow-hidden ${!isLastOnPage ? 'print:border-b-2 print:border-dashed print:border-gray-800' : 'print:break-after-page'}`}>
                <div>
                  <div className="flex justify-between items-start mb-1 font-bold text-sm lg:text-base print:text-[11px] leading-tight text-black">
                    <div className="text-right">
                      <p>مديرية التربية لولاية {wilaya}</p>
                      <p>مؤسسة: {institutionName}</p>
                    </div>
                    <div className="text-left" dir="ltr">
                      <p>الموسم الدراسي : {schoolYear}</p>
                    </div>
                  </div>
                  
                  <div className="text-center font-bold mb-1 text-xl lg:text-2xl print:text-[15px] mt-2 print:mt-1 leading-tight text-black">
                    استدعاء لحراسة {examType}
                  </div>

                  <div className="text-right font-bold mb-1 text-base lg:text-lg print:text-[12px] space-y-0.5 leading-tight text-black">
                    <p>إلى الأستاذ(ة): <span className="text-xl print:text-[14px] ml-2 border-b border-black pb-0.5 inline-block">{teacher.name}</span></p>
                    <p className="font-normal print:text-[11px]">أنتم مدعوون لحراسة الإختبارات حسب الجدول التالي :</p>
                  </div>
                </div>

                <div className="flex-grow flex flex-col justify-center">
                  {uniqueWeeks.map((weekStart, wIndex) => {
                    const weekDates = assignmentsByWeek[weekStart];
                    
                    return (
                      <div key={weekStart} className={wIndex > 0 ? "mt-4 print:mt-2" : ""}>
                        {uniqueWeeks.length > 1 && (
                          <div className="mb-1 text-sm print:text-[10px] font-bold p-0 text-black">
                            الأسبوع {wIndex + 1}
                          </div>
                        )}
                        <table className="w-full text-center border-collapse border-b border-l border-black text-sm print:text-[10px] text-black">
                          <thead>
                            <tr>
                              <th className="border-t border-r border-black p-1 lg:p-2 bg-gray-50 print:bg-gray-100 align-middle whitespace-nowrap w-24 print:w-16 print:p-0.5">اليوم</th>
                              {weekDates.map((date, index) => (
                                <th key={`day-${date}`} className="border-t border-r border-black p-1 lg:p-2 bg-gray-50 print:bg-gray-100 font-bold print:p-0.5">
                                  {dayNames[index]}
                                </th>
                              ))}
                            </tr>
                            <tr>
                              <th className="border-t border-r border-black p-1 lg:p-2 bg-gray-50 print:bg-gray-100 align-middle whitespace-nowrap print:p-0.5">التوقيت</th>
                              {weekDates.map((date) => (
                                 <th key={`date-${date}`} className="border-t border-r border-black p-1 lg:p-2 bg-gray-50 print:bg-gray-100 font-normal text-xs print:text-[10px] print:p-0.5 leading-none">
                                  {date}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <th className="border-t border-r border-black p-1 lg:p-2 print:p-0.5 align-middle font-mono font-bold leading-none bg-gray-50 print:bg-gray-100" dir="ltr">
                                {morningTime}
                              </th>
                              {weekDates.map(date => {
                                const morning = teacherAssignments.find(a => a.date === date && a.period === 'morning');
                                const mExam = morning ? exams.find(e => String(e.id) === String(morning.examId)) : null;
                                const mHall = morning ? halls.find(h => String(h.id) === String(morning.hallId)) : null;
                                return (
                                  <td key={`m-${date}`} className="border-t border-r border-black p-1 lg:p-2 print:p-1 min-h-[50px] lg:h-16 print:h-[26px] align-middle">
                                    {morning ? (
                                      <div className="leading-tight flex flex-col items-center justify-center">
                                        <div className="font-bold text-sm lg:text-base print:text-[12px] whitespace-nowrap text-black">
                                          {mHall?.name.includes('قاعة') ? mHall?.name : `القاعة ${mHall?.name}`}
                                        </div>
                                        {mExam && <div className="text-[10px] lg:text-xs print:text-[10px] mt-0.5 text-gray-800 print:text-black font-medium leading-[1.1] max-w-[120px] lg:max-w-[100%] mx-auto overflow-hidden text-ellipsis px-1">{mExam?.subject}</div>}
                                      </div>
                                    ) : '-'}
                                  </td>
                                )
                              })}
                            </tr>
                            <tr>
                              <th className="border-t border-r border-black p-1 lg:p-2 print:p-0.5 align-middle font-mono font-bold leading-none bg-gray-50 print:bg-gray-100" dir="ltr">
                                {afternoonTime}
                              </th>
                              {weekDates.map(date => {
                                const afternoon = teacherAssignments.find(a => a.date === date && a.period === 'afternoon');
                                const aExam = afternoon ? exams.find(e => String(e.id) === String(afternoon.examId)) : null;
                                const aHall = afternoon ? halls.find(h => String(h.id) === String(afternoon.hallId)) : null;
                                return (
                                  <td key={`a-${date}`} className="border-t border-r border-black p-1 lg:p-2 print:p-1 min-h-[50px] lg:h-16 print:h-[26px] align-middle">
                                    {afternoon ? (
                                      <div className="leading-tight flex flex-col items-center justify-center">
                                        <div className="font-bold text-sm lg:text-base print:text-[12px] whitespace-nowrap text-black">
                                          {aHall?.name.includes('قاعة') ? aHall?.name : `القاعة ${aHall?.name}`}
                                        </div>
                                        {aExam && <div className="text-[10px] lg:text-xs print:text-[10px] mt-0.5 text-gray-800 print:text-black font-medium leading-[1.1] max-w-[120px] lg:max-w-[100%] mx-auto overflow-hidden text-ellipsis px-1">{aExam?.subject}</div>}
                                      </div>
                                    ) : '-'}
                                  </td>
                                )
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 flex justify-between items-center px-4 lg:px-12 font-bold text-base print:text-[11px] leading-tight text-black pt-1">
                  <div>توقيع الناظر</div>
                  <div className="text-left">حرر بـ...................... بتاريخ: {new Date().toLocaleDateString('ar-DZ')}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
