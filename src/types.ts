export interface Teacher {
  id?: string;
  name: string;
  specialty: string;
  totalHours?: number;
  seniority?: number;
  availabilityExceptions?: string[]; // 'YYYY-MM-DD-morning'
  isExempt?: boolean; // معفى كلياً من الحراسة (غائب / لديه حجة)
  exemptReason?: string; // سبب الإعفاء أو الحجة
}

export type ExamTargetLevel = 'first' | 'second' | 'first_second' | 'third';

export interface Exam {
  id?: string;
  subject: string;
  date: string;
  period: 'morning' | 'afternoon';
  timeRange?: string; // e.g. '08:00 - 10:00', '10:00 - 12:00', '13:30 - 15:30'
  duration: number; // in hours
  hallCount: number;
  proctorsPerHall: number;
  targetLevel?: ExamTargetLevel; // 'first_second' = السنوات الأولى والثانية | 'third' = السنوات الثالثة
  stream?: string; // e.g. 'علوم تجريبية', 'رياضيات', 'تقني رياضي', 'تسيير واقتصاد', 'آداب وفلسفة', 'لغات أجنبية', 'جذع مشترك علوم', 'جذع مشترك آداب'
  order?: number; // Order specified by Director of Studies (الناظر)
}

export interface Hall {
  id?: string;
  name: string;
  capacity?: number;
  proctorsCount?: number | null;
}

export interface Assignment {
  id?: string;
  examId: string;
  teacherId: string;
  hallId: string;
  period: string;
  date: string;
}

export type LevelKey = 'first' | 'second' | 'third';

export interface LevelTimingConfig {
  morningSlot1: string;       // e.g. '08:00 - 10:00'
  morningSlot2?: string;      // e.g. '10:00 - 12:00' or ''
  includeAfternoon?: boolean; // show afternoon exam slot in schedule grid
  afternoonSlot?: string;     // e.g. '13:30 - 15:30'
  morningTime: string;        // e.g. '08:00 - 12:00' (proctoring header)
  afternoonTime: string;      // e.g. '13:00 - 17:00' (proctoring header)
}

export interface SystemSettings {
  institutionName: string;
  wilaya?: string;
  schoolYear?: string;
  selectedTerm?: string;
  proctorRatio: number;
  morningTime?: string;
  afternoonTime?: string;
  morningSlot1?: string;
  morningSlot2?: string;
  includeAfternoon?: boolean;
  afternoonSlot?: string;
  separateLevelTimings?: boolean;
  levelTimings?: {
    first: LevelTimingConfig;
    second: LevelTimingConfig;
    third: LevelTimingConfig;
  };
  examStartDate?: string;
  examEndDate?: string;
  selectedLevels?: string[];
}

export interface Student {
  id?: string;
  matricule?: string; // رقم التسجيل / رقم التعريف المدرسي
  name: string; // اللقب والاسم
  gender: 'ذكر' | 'أنثى' | 'M' | 'F' | string;
  level: 'first' | 'second' | 'third' | string;
  stream: string; // الشعبة
  subSpecialty?: string; // هندسة ميكانيكية، هندسة كهربائية، لغة ألمانية، إلخ
  classGroup?: string; // القسم / الفوج التربوي الأصلي
  examHallId?: string; // القاعة المخصصة
  examGroupId?: string; // الفوج الامتحاني
  seatNumber?: number; // رقم المقعد / الطاولة
}

export interface ExamGroup {
  id: string;
  name: string;
  level: 'first' | 'second' | 'third' | string;
  stream: string;
  hallId?: string;
  hallName?: string;
  studentCount?: number;
  duration?: number;
}
