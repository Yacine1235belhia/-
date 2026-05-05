import { Teacher, Exam, Hall, Assignment } from '../types';

export interface AllocationResult {
  assignments: Omit<Assignment, 'id'>[];
  stats: Record<string, number>; // teacherId -> totalHours
}

export function generateAssignments(
  teachers: Teacher[],
  exams: Exam[],
  halls: Hall[]
): AllocationResult {
  const assignments: Omit<Assignment, 'id'>[] = [];
  const hoursMap: Record<string, number> = {};
  const lastPeriodMap: Record<string, string> = {}; // teacherId -> lastPeriod

  teachers.forEach(t => (hoursMap[t.id!] = 0));

  // Sort exams by date and period (morning then afternoon)
  const sortedExams = [...exams].sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    return a.period === 'morning' ? -1 : 1;
  });

  for (const exam of sortedExams) {
    const requiredProctors = exam.hallCount * exam.proctorsPerHall;
    const currentPeriodKey = `${exam.date}-${exam.period}`;

    // Filter available teachers
    let candidates = teachers.filter(t => {
      // 1. Specialty avoidance
      if (t.specialty.toLowerCase() === exam.subject.toLowerCase()) return false;
      
      // 2. Availability exceptions (assumed format: 'YYYY-MM-DD-period')
      if (t.availabilityExceptions?.includes(currentPeriodKey)) return false;

      return true;
    });

    // Shuffle candidates to break ties
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Sort candidates by hours (ascending)
    candidates.sort((a, b) => hoursMap[a.id!] - hoursMap[b.id!]);

    // Select teachers
    const selected = candidates.slice(0, requiredProctors);

    // If not enough teachers, we have to reuse or warn (for now just slice)
    // In a real app we might relax constraints or show an error
    
    selected.forEach((t, index) => {
      const hallIndex = Math.floor(index / exam.proctorsPerHall);
      const hall = halls[hallIndex] || halls[0];

      assignments.push({
        examId: exam.id!,
        teacherId: t.id!,
        hallId: hall?.id || 'default',
        period: exam.period,
        date: exam.date
      });

      hoursMap[t.id!] += exam.duration;
      lastPeriodMap[t.id!] = currentPeriodKey;
    });
  }

  return { assignments, stats: hoursMap };
}
