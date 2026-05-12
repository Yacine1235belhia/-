export interface Teacher {
  id?: string;
  name: string;
  specialty: string;
  totalHours?: number;
  seniority?: number;
  availabilityExceptions?: string[]; // 'YYYY-MM-DD-morning'
}

export interface Exam {
  id?: string;
  subject: string;
  date: string;
  period: 'morning' | 'afternoon';
  duration: number; // in hours
  hallCount: number;
  proctorsPerHall: number;
}

export interface Hall {
  id?: string;
  name: string;
  capacity?: number;
}

export interface Assignment {
  id?: string;
  examId: string;
  teacherId: string;
  hallId: string;
  period: string;
  date: string;
}

export interface SystemSettings {
  institutionName: string;
  proctorRatio: number;
  morningTime?: string;
  afternoonTime?: string;
}
