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
      // 1. Specialty avoidance (case/space tolerant and substring match)
      const specialty = t.specialty.trim().toLowerCase();
      const subject = exam.subject.trim().toLowerCase();
      if (specialty === subject || subject.includes(specialty) || specialty.includes(subject)) return false;
      
      // 2. Availability exceptions (assumed format: 'YYYY-MM-DD-period')
      if (t.availabilityExceptions?.includes(currentPeriodKey)) return false;

      // 3. Already assigned in this period
      const isAssigned = assignments.some(a => a.teacherId === t.id && a.date === exam.date && a.period === exam.period);
      if (isAssigned) return false;

      return true;
    });

    // Shuffle candidates to break ties
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Sort candidates by hours (ascending), then by total count of assignments to further balance
    const assignmentCountsMap = assignments.reduce((acc, a) => {
      acc[a.teacherId] = (acc[a.teacherId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    candidates.sort((a, b) => {
      if (hoursMap[a.id!] !== hoursMap[b.id!]) {
        return hoursMap[a.id!] - hoursMap[b.id!];
      }
      return (assignmentCountsMap[a.id!] || 0) - (assignmentCountsMap[b.id!] || 0);
    });

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
