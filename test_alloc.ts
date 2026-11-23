import { generateAssignments } from './src/lib/allocation';
import { Teacher, Exam, Hall } from './src/types';

const teachers: Teacher[] = Array.from({length: 50}).map((_, i) => ({ id: `t${i}`, name: `T${i}`, specialty: i % 2 === 0 ? 'Math' : 'Physics', totalHours: 0 }));
const exams: Exam[] = Array.from({length: 10}).map((_, i) => ({ id: `e${i}`, subject: i % 2 === 0 ? 'Math' : 'Physics', date: `2026-09-${10+i}`, period: 'morning', duration: 2, hallCount: 5, proctorsPerHall: 2 }));
const halls: Hall[] = Array.from({length: 10}).map((_, i) => ({ id: `h${i}`, name: `H${i}`, capacity: 30 }));

const res = generateAssignments(teachers, exams, halls);
const counts = res.assignments.reduce((acc, a) => {
  acc[a.teacherId] = (acc[a.teacherId] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

console.log(Object.values(counts).sort((a,b)=>a-b));
