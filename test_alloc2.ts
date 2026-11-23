import { generateAssignments } from './src/lib/allocation';
import { SECONDARY_SUBJECTS } from './src/lib/constants';
import { Teacher, Exam, Hall } from './src/types';

const teachers: Teacher[] = [];
let tId = 1;
SECONDARY_SUBJECTS.forEach((subject) => {
  for (let i = 0; i < 2; i++) {
    teachers.push({ id: `t${tId}`, name: `أستاذ ${tId}`, specialty: subject });
    tId++;
  }
});

const exams: Exam[] = [];
const baseDate = new Date();
SECONDARY_SUBJECTS.forEach((subject, index) => {
  const examDate = new Date(baseDate);
  examDate.setDate(baseDate.getDate() + Math.floor(index / 2));
  const dateStr = examDate.toISOString().split('T')[0];
  const period = index % 2 === 0 ? "morning" : "afternoon";
  exams.push({ id: `e${index + 1}`, subject: subject, date: dateStr, period: period, duration: 2, hallCount: 10, proctorsPerHall: 2 });
});

const halls: Hall[] = Array.from({length: 33}).map((_, i) => ({ id: `h${i}`, name: `H${i}` }));

const res = generateAssignments(teachers, exams, halls);
const counts = res.assignments.reduce((acc, a) => {
  acc[a.teacherId] = (acc[a.teacherId] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

console.log('Assignment Counts:', Object.values(counts).sort((a,b)=>a-b));
