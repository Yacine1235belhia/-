import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Trash2, Save, BookOpen, GraduationCap, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { SECONDARY_SUBJECTS, getOfficialSubjectsForStreamName } from '../lib/constants';
import { markWorkspaceDirty } from '../lib/api';

interface SubjectManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (selectedByStream: Record<string, string[]>) => void;
}

const ALL_HIRASA_SUBJECTS = SECONDARY_SUBJECTS;

const STREAMS_BY_LEVEL: Record<string, { id: string; name: string }[]> = {
  third: [
    { id: '3_exp_sciences', name: 'علوم تجريبية' },
    { id: '3_math', name: 'رياضيات' },
    { id: '3_math_tech', name: 'تقني رياضي' },
    { id: '3_management', name: 'تسيير واقتصاد' },
    { id: '3_arts_philo', name: 'آداب وفلسفة' },
    { id: '3_foreign_languages', name: 'لغات أجنبية' },
    { id: '3_arts', name: 'فنون' },
  ],
  second: [
    { id: '2_exp_sciences', name: 'علوم تجريبية' },
    { id: '2_math', name: 'رياضيات' },
    { id: '2_math_tech', name: 'تقني رياضي' },
    { id: '2_management', name: 'تسيير واقتصاد' },
    { id: '2_arts_philo', name: 'آداب وفلسفة' },
    { id: '2_foreign_languages', name: 'لغات أجنبية' },
    { id: '2_arts', name: 'فنون' },
  ],
  first: [
    { id: '1_common_science', name: 'جذع مشترك علوم وتكنولوجيا' },
    { id: '1_common_arts', name: 'جذع مشترك آداب' },
  ],
};

const DEFAULT_SELECTED: Record<string, string[]> = {
  '1_common_science': [
    'اللغة العربية وآدابها', 'العلوم الإسلامية', 'الرياضيات', 'اللغة الإنجليزية',
    'اللغة الفرنسية', 'التاريخ والجغرافيا', 'علوم الطبيعة والحياة', 'العلوم الفيزيائية',
    'التكنولوجيا', 'الإعلام الآلي'
  ],
  '1_common_arts': [
    'اللغة العربية وآدابها', 'العلوم الإسلامية', 'الرياضيات', 'اللغة الإنجليزية',
    'اللغة الفرنسية', 'التاريخ والجغرافيا', 'الفلسفة', 'اللغة الأمازيغية'
  ],
  '3_exp_sciences': [
    'اللغة العربية وآدابها', 'العلوم الإسلامية', 'الرياضيات', 'اللغة الإنجليزية',
    'اللغة الفرنسية', 'الفلسفة', 'التاريخ والجغرافيا', 'علوم الطبيعة والحياة',
    'العلوم الفيزيائية', 'اللغة الأمازيغية'
  ]
};

export default function SubjectManagementModal({ isOpen, onClose, onSave }: SubjectManagementModalProps) {
  const [selectedLevel, setSelectedLevel] = useState<'third' | 'second' | 'first'>('first');
  const [selectedStreamId, setSelectedStreamId] = useState<string>('1_common_science');
  const [streamSubjects, setStreamSubjects] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('hirasa_stream_subjects');
    return saved ? JSON.parse(saved) : DEFAULT_SELECTED;
  });

  useEffect(() => {
    // Update active stream when level changes if current stream is not in level
    const available = STREAMS_BY_LEVEL[selectedLevel];
    if (available && !available.some(s => s.id === selectedStreamId)) {
      setSelectedStreamId(available[0].id);
    }
  }, [selectedLevel]);

  if (!isOpen) return null;

  const currentStreamName = STREAMS_BY_LEVEL[selectedLevel]?.find(s => s.id === selectedStreamId)?.name || '';
  const levelLabel = selectedLevel === 'third' ? 'ثالثة' : selectedLevel === 'second' ? 'ثانية' : 'أولى';
  const activeSubjects = streamSubjects[selectedStreamId] || getOfficialSubjectsForStreamName(currentStreamName);

  const toggleSubject = (subjectName: string) => {
    const current = streamSubjects[selectedStreamId] || [];
    const updated = current.includes(subjectName)
      ? current.filter(s => s !== subjectName)
      : [...current, subjectName];

    const newMap = { ...streamSubjects, [selectedStreamId]: updated };
    setStreamSubjects(newMap);
  };

  const selectAll = () => {
    setStreamSubjects({ ...streamSubjects, [selectedStreamId]: [...ALL_HIRASA_SUBJECTS] });
  };

  const deselectAll = () => {
    setStreamSubjects({ ...streamSubjects, [selectedStreamId]: [] });
  };

  const handleSaveChanges = () => {
    localStorage.setItem('hirasa_stream_subjects', JSON.stringify(streamSubjects));
    markWorkspaceDirty();
    if (onSave) onSave(streamSubjects);
    toast.success(`تم تخصيص المواد لـ ${levelLabel} ${currentStreamName} (تذكّر الضغط على حفظ البرنامج للتثبيت النهائي)`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#0D162A] border border-cyan-500/30 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="bg-[#0099FF] text-white px-6 py-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <BookOpen size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black">إدارة المواد</h3>
              <p className="text-xs text-sky-100">تخصيص المواد حسب المستوى والشعبة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          {/* Top Selectors: Level & Stream Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Level Selector Card */}
            <div className="bg-[#121E36] border border-slate-700/60 p-5 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <GraduationCap size={18} />
                <span>المستوى</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['third', 'second', 'first'] as const).map((lvl) => {
                  const label = lvl === 'third' ? 'ثالثة' : lvl === 'second' ? 'ثانية' : 'أولى';
                  const isActive = selectedLevel === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSelectedLevel(lvl)}
                      className={`py-3 px-4 rounded-xl font-black text-center transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#0099FF] text-white shadow-lg shadow-sky-500/20'
                          : 'bg-[#182643] text-slate-300 hover:bg-[#1E2F52] border border-slate-700/40'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stream Selector Card */}
            <div className="bg-[#121E36] border border-slate-700/60 p-5 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <Users size={18} />
                <span>الشعبة</span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 custom-scrollbar">
                {STREAMS_BY_LEVEL[selectedLevel]?.map((st) => {
                  const isActive = selectedStreamId === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStreamId(st.id)}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs text-right transition-all truncate cursor-pointer ${
                        isActive
                          ? 'bg-[#0099FF] text-white shadow-md'
                          : 'bg-[#182643] text-slate-300 hover:bg-[#1E2F52] border border-slate-700/40'
                      }`}
                    >
                      {st.name}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Subjects Grid Section */}
          <div className="bg-[#121E36] border border-slate-700/60 p-5 rounded-2xl space-y-4">
            
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-700/60 pb-3">
              <div>
                <h4 className="font-black text-sky-400 text-sm">
                  المواد الخاصة بـ: {levelLabel} {currentStreamName}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  {activeSubjects.length} مادة محددة
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="flex items-center gap-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <CheckCircle2 size={15} />
                  تحديد الكل
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="flex items-center gap-1.5 bg-rose-600/80 hover:bg-rose-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 size={15} />
                  إلغاء الكل
                </button>
              </div>
            </div>

            {/* Checkbox Grid matching Screenshot 2 & 3 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ALL_HIRASA_SUBJECTS.map((sub) => {
                const isChecked = activeSubjects.includes(sub);
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => toggleSubject(sub)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-right transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-[#0099FF]/20 border-cyan-400 text-cyan-200 shadow-sm'
                        : 'bg-[#182643]/60 border-slate-700/50 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-xs font-bold">{sub}</span>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                      isChecked ? 'bg-[#0099FF] text-white' : 'bg-slate-700/60 border border-slate-600'
                    }`}>
                      {isChecked && <CheckCircle2 size={14} className="stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#091021] border-t border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSaveChanges}
            className="flex items-center gap-2 bg-[#0099FF] hover:bg-sky-500 text-white font-black px-6 py-2.5 rounded-xl text-xs shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
          >
            <Save size={16} />
            حفظ التغييرات
          </button>
        </div>

      </div>
    </div>
  );
}
