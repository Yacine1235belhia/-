import { Teacher, Exam, Hall, Assignment } from '../types';
import { AppLanguage, translateArabicText } from '../lib/translations';

export interface PrintSettings {
  institutionName: string;
  wilaya: string;
  schoolYear: string;
  selectedTerm: string;
  morningTime: string;
  afternoonTime: string;
  customExamTitle?: string;
  separateLevelTimings?: boolean;
}

export function getArabicDayName(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[date.getDay()];
  }
  return '';
}

// 1. Convocations Document HTML (Strictly 4 per page A4 portrait)
export function generateConvocationsHtml(
  cards: Array<{
    teacher: Teacher;
    sessionTitle: string;
    assignedSubjects: Array<{
      date: string;
      period: string;
      subject: string;
      hallName: string;
      timeRange?: string;
      levelLabel?: string;
    }>;
    weekDates: string[];
  }>,
  settings: PrintSettings
): string {
  // Chunk cards into groups of 4 per A4 page
  const pages: typeof cards[] = [];
  for (let i = 0; i < cards.length; i += 4) {
    pages.push(cards.slice(i, i + 4));
  }

  let pagesHtml = '';

  const renderSlotItems = (
    items: Array<{
      date: string;
      period: string;
      subject: string;
      hallName: string;
      timeRange?: string;
      levelLabel?: string;
    }>
  ) => {
    if (items.length === 0) return '<span style="color:#aaa;">-</span>';
    const showTimeBadge = Boolean(settings.separateLevelTimings) || items.length > 1;
    return items
      .map((item) => {
        const isRes = item.hallName.includes('احتياط');
        const badgeStyle = isRes
          ? 'color:#b45309; background:#fef3c7; border-radius:3px; padding:1px 4px; display:inline-block;'
          : '';
        const timeLine =
          showTimeBadge && item.timeRange
            ? `<div style="font-size:6.5pt; font-family:monospace; color:#334155; font-weight:700; margin-top:1px;" dir="ltr">${item.timeRange}${item.levelLabel ? ` (${item.levelLabel})` : ''}</div>`
            : '';
        return `
          <div style="${items.length > 1 ? 'margin:2px 0; border-bottom:1px dotted #cbd5e1; padding-bottom:1px;' : ''}">
            <div style="font-weight:800; font-size:${items.length > 1 ? '8.5pt' : '9.5pt'}; color:#000; ${badgeStyle}">${item.hallName}</div>
            ${timeLine}
          </div>
        `;
      })
      .join('');
  };

  pages.forEach((pageCards, pageIdx) => {
    let cardsInPageHtml = '';

    pageCards.forEach((card, idx) => {
      const isLastInPage = idx === pageCards.length - 1;

      let morningCells = '';
      let afternoonCells = '';

      card.weekDates.forEach((d) => {
        const ms = card.assignedSubjects.filter(a => a.date === d && a.period === 'morning');
        const afs = card.assignedSubjects.filter(a => a.date === d && a.period === 'afternoon');

        morningCells += `
          <td style="border:1.5px solid #000; padding:6px 4px; vertical-align:middle; text-align:center; line-height:1.25;">
            ${renderSlotItems(ms)}
          </td>
        `;

        afternoonCells += `
          <td style="border:1.5px solid #000; padding:6px 4px; vertical-align:middle; text-align:center; line-height:1.25;">
            ${renderSlotItems(afs)}
          </td>
        `;
      });

      const headerDays = card.weekDates.map((d) => `
        <th style="border:1.5px solid #000; padding:5px 3px; background:#f3f4f6; text-align:center; vertical-align:middle; line-height:1.3;">
          <div style="font-size:8pt; font-weight:800; line-height:1.2;">${getArabicDayName(d)}</div>
          <div style="font-size:7pt; font-family:monospace; margin-top:2px; line-height:1.1; color:#333;" dir="ltr">${d}</div>
        </th>
      `).join('');

      cardsInPageHtml += `
        <div style="height: 6.7cm; max-height: 6.7cm; padding: 0.15cm 0.3cm; border-bottom: ${isLastInPage ? 'none' : '1.5px dashed #555'}; box-sizing: border-box; overflow: hidden; page-break-inside: avoid; break-inside: avoid; display: flex; flex-direction: column; justify-content: flex-start;">
          
          <!-- Top Institutional Header Table -->
          <table style="width:100%; border-bottom:2px solid #000; border-collapse:collapse; margin-bottom:10px;">
            <tr>
              <td style="text-align:right; font-size:8.5pt; font-weight:bold; line-height:1.6; vertical-align:bottom; padding:0 0 8px 0; border:none;">
                <div style="margin-bottom:4px; font-weight:800; color:#000;">الجمهورية الجزائرية الديمقراطية الشعبية — وزارة التربية الوطنية</div>
                <div style="font-weight:700; color:#111;">مديرية التربية لولاية ${settings.wilaya} | ${settings.institutionName}</div>
              </td>
              <td style="text-align:left; font-size:8.5pt; font-weight:bold; line-height:1.6; vertical-align:bottom; padding:0 0 8px 0; border:none; white-space:nowrap; color:#000;">
                السنة الدراسية: ${settings.schoolYear}
              </td>
            </tr>
          </table>

          <!-- Document Title & Teacher Name Table -->
          <table style="width:100%; margin-bottom:5px; border-collapse:collapse;">
            <tr>
              <td style="text-align:right; font-size:8.5pt; font-weight:bold; line-height:1.3; vertical-align:middle; border:none; padding:0;">
                استدعاء لحراسة: <span style="font-weight:800; text-decoration:underline;">${card.sessionTitle}</span>
              </td>
              <td style="text-align:left; font-size:8.5pt; font-weight:bold; line-height:1.3; vertical-align:middle; border:none; padding:0; white-space:nowrap;">
                الأستاذ(ة): <span style="font-size:9.5pt; font-weight:800; text-decoration:underline;">${card.teacher.name}</span> (${card.teacher.specialty})
              </td>
            </tr>
          </table>

          <!-- Timetable Matrix -->
          <table style="width:100%; border-collapse:collapse; text-align:center; font-size:7.5pt; margin:2px 0 0 0; table-layout:fixed;">
            <thead>
              <tr>
                <th style="border:1.5px solid #000; padding:5px 3px; width:75px; background:#f3f4f6; vertical-align:middle; text-align:center; line-height:1.3;">
                  <div style="font-size:8pt; font-weight:800;">الفترة والتوقيت</div>
                </th>
                ${headerDays}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border:1.5px solid #000; padding:5px 3px; background:#fafafa; font-weight:bold; font-size:7.5pt; text-align:center; vertical-align:middle; line-height:1.3;">
                  <div style="font-weight:800;">صباحاً</div>
                  <div style="font-family:monospace; font-size:6pt; margin-top:2px; color:#333; line-height:1.25;" dir="auto">${settings.morningTime}</div>
                </td>
                ${morningCells}
              </tr>
              <tr>
                <td style="border:1.5px solid #000; padding:5px 3px; background:#fafafa; font-weight:bold; font-size:7.5pt; text-align:center; vertical-align:middle; line-height:1.3;">
                  <div style="font-weight:800;">مساءً</div>
                  <div style="font-family:monospace; font-size:6pt; margin-top:2px; color:#333; line-height:1.25;" dir="auto">${settings.afternoonTime}</div>
                </td>
                ${afternoonCells}
              </tr>
            </tbody>
          </table>

          <!-- Signatures Section - Placed IMMEDIATELY under the table -->
          <table style="width:100%; margin-top:6px; border-top:1.5px solid #000; border-collapse:collapse; letter-spacing:normal; word-spacing:normal;">
            <tr>
              <td style="text-align:right; font-size:8.5pt; font-weight:800; vertical-align:middle; border:none; padding:4px 0 0 0; width:50%; letter-spacing:normal; word-spacing:normal;">
                تأشيرة وتوقيع مدير المؤسسة
              </td>
              <td style="text-align:left; font-size:8.5pt; font-weight:800; vertical-align:middle; border:none; padding:4px 0 0 0; width:50%; letter-spacing:normal; word-spacing:normal;">
                تأشيرة وتوقيع الناظر
              </td>
            </tr>
          </table>

        </div>
      `;
    });

    const isLastPage = pageIdx === pages.length - 1;

    pagesHtml += `
      <div class="convocations-page" style="height:27.5cm; max-height:27.5cm; padding:0.2cm; box-sizing:border-box; display:flex; flex-direction:column; justify-content:flex-start; ${isLastPage ? '' : 'page-break-after:always; break-after:page;'}">
        ${cardsInPageHtml}
      </div>
    `;
  });

  return wrapHtmlPage(pagesHtml, `استدعاءات الحراسة (${cards.length} استدعاء)`, 'A4 portrait');
}

// 2. Hall Proctoring Timetable (جدول توزيع الأساتذة على القاعات - صفحة واحدة A4 Landscape)
export function generateHallTimetableHtml(
  halls: Hall[],
  exams: Exam[],
  assignments: Assignment[],
  teachers: Teacher[],
  settings: PrintSettings
): string {
  const sortedExams = [...exams].sort((a, b) => {
    const dComp = a.date.localeCompare(b.date);
    if (dComp !== 0) return dComp;
    return a.period === 'morning' ? -1 : 1;
  });

  // Calculate compact dynamic font size & cell padding based on hall count
  const hallCount = halls.length;
  const examCount = sortedExams.length;

  const fontSize = hallCount > 18 ? '7.5pt' : (hallCount > 12 ? '8.5pt' : '9.5pt');
  const subFontSize = hallCount > 18 ? '6.5pt' : '7.5pt';
  const cellPadding = hallCount > 18 ? '1.5px 2px' : '3px 4px';

  let thExams = sortedExams.map(e => {
    const tStr = e.timeRange || (e.period === 'morning' ? settings.morningTime : settings.afternoonTime);
    return `
    <th style="border:1px solid #000; padding:${cellPadding}; background:#f1f5f9; text-align:center; vertical-align:middle;">
      <div style="font-weight:bold; font-size:${fontSize};">${e.subject}</div>
      <div style="font-size:${subFontSize}; color:#334155; font-weight:600;">${getArabicDayName(e.date)} ${e.date} (${e.period === 'morning' ? 'صباح' : 'مساء'})</div>
      <div style="font-size:${subFontSize}; color:#0369a1; font-family:monospace; font-weight:700;" dir="ltr">${tStr}</div>
    </th>
  `;
  }).join('');

  let rowsHtml = halls.map(hall => {
    let cells = sortedExams.map(exam => {
      const hallAssigns = assignments.filter(a => String(a.hallId) === String(hall.id) && String(a.examId) === String(exam.id));
      const proctorNames = hallAssigns.map(a => {
        const t = teachers.find(t => String(t.id) === String(a.teacherId));
        return t ? t.name : 'غير محدد';
      });

      return `
        <td style="border:1px solid #000; padding:${cellPadding}; font-size:${fontSize}; vertical-align:middle; text-align:center;">
          ${proctorNames.length > 0 
            ? proctorNames.map(n => `<div style="font-weight:bold; margin:1px 0; white-space:nowrap;">• ${n}</div>`).join('') 
            : '<span style="color:#94a3b8;">-</span>'}
        </td>
      `;
    }).join('');

    return `
      <tr>
        <td style="border:1px solid #000; padding:${cellPadding}; background:#f8fafc; font-weight:bold; font-size:${fontSize}; text-align:center; white-space:nowrap;">
          ${hall.name.includes('قاعة') ? hall.name : `قاعة ${hall.name}`}
        </td>
        ${cells}
      </tr>
    `;
  }).join('');

  // Add Reserve Row to Hall Timetable
  let reserveCells = sortedExams.map(exam => {
    const reserveAssigns = assignments.filter(a => String(a.hallId) === 'reserve' && String(a.examId) === String(exam.id));
    const reserveNames = reserveAssigns.map(a => {
      const t = teachers.find(t => String(t.id) === String(a.teacherId));
      return t ? t.name : 'غير محدد';
    });

    return `
      <td style="border:1px solid #000; padding:${cellPadding}; font-size:${fontSize}; vertical-align:middle; text-align:center; background:#fffbeb;">
        ${reserveNames.length > 0 
          ? reserveNames.map(n => `<div style="font-weight:bold; color:#b45309; margin:1px 0; white-space:nowrap;">🛡️ ${n}</div>`).join('') 
          : '<span style="color:#94a3b8;">-</span>'}
      </td>
    `;
  }).join('');

  const reserveRowHtml = `
    <tr style="border-top:2px solid #000; background:#fef3c7;">
      <td style="border:1px solid #000; padding:${cellPadding}; font-weight:bold; font-size:${fontSize}; text-align:center; color:#92400e; background:#fef3c7; white-space:nowrap;">
        حراس الاحتياط
      </td>
      ${reserveCells}
    </tr>
  `;

  const bodyContent = `
    <div style="text-align:center; margin-bottom:12px; border-bottom:2px solid #000; padding-bottom:8px; line-height:1.6;">
      <h2 style="margin:0 0 4px 0; font-size:13.5px; font-weight:800; line-height:1.5;">الجمهورية الجزائرية الديمقراطية الشعبية — وزارة التربية الوطنية</h2>
      <h3 style="margin:0 0 6px 0; font-size:12.5px; font-weight:700; line-height:1.5;">مديرية التربية لولاية ${settings.wilaya} | ${settings.institutionName}</h3>
      <h4 style="margin:6px 0 0 0; font-size:14.5px; font-weight:800; text-decoration:underline; line-height:1.5;">جدول توزيع الأساتذة الحراس حسب القاعات والاحتياط — ${settings.selectedTerm} (${settings.schoolYear})</h4>
    </div>

    <table style="width:100%; border-collapse:collapse; text-align:center; table-layout:auto;">
      <thead>
        <tr>
          <th style="border:1px solid #000; padding:${cellPadding}; background:#e2e8f0; font-size:${fontSize}; font-weight:bold; min-width:80px;">القاعة / الاختبار</th>
          ${thExams}
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        ${reserveRowHtml}
      </tbody>
    </table>

    <table style="width:100%; margin-top:12px; margin-bottom:12px; border:none; border-top:1px solid #000; padding-top:8px; letter-spacing:normal; word-spacing:normal; page-break-inside:avoid; break-inside:avoid;">
      <tr>
        <td style="border:none; text-align:right; font-weight:800; font-size:11px; color:#000; width:50%; padding-right:12px; letter-spacing:normal; word-spacing:normal;">
          تأشيرة وتوقيع مدير المؤسسة
        </td>
        <td style="border:none; text-align:left; font-weight:800; font-size:11px; color:#000; width:50%; padding-left:12px; letter-spacing:normal; word-spacing:normal;">
          تأشيرة وتوقيع الناظر
        </td>
      </tr>
    </table>
  `;

  return wrapHtmlPage(bodyContent, 'جدول توزيع القاعات والتفويجات', 'A4 landscape');
}

// 3. Color-Coded Master Timetable Grid (الجدول العام الملون لجميع الأساتذة - صفحة واحدة A4 Landscape)
export function generateMasterGridHtml(
  teachers: Teacher[],
  exams: Exam[],
  assignments: Assignment[],
  halls: Hall[],
  settings: PrintSettings
): string {
  const sortedExams = [...exams].sort((a, b) => {
    const dComp = a.date.localeCompare(b.date);
    if (dComp !== 0) return dComp;
    return a.period === 'morning' ? -1 : 1;
  });

  const teacherCount = teachers.length;
  const examCount = sortedExams.length;

  // Auto-fit font size and padding so all teachers fit on ONE page
  const fontSize = teacherCount > 25 ? '7pt' : (teacherCount > 16 ? '8pt' : '9pt');
  const subFontSize = teacherCount > 25 ? '6pt' : '7pt';
  const cellPadding = teacherCount > 25 ? '1px 2px' : (teacherCount > 16 ? '2px 3px' : '3px 4px');

  const colors = [
    { bg: '#dbeafe', text: '#1e40af' }, // blue
    { bg: '#f3e8ff', text: '#6b21a8' }, // purple
    { bg: '#dcfce7', text: '#166534' }, // green
    { bg: '#ffedd5', text: '#9a3412' }, // orange
    { bg: '#fce7f3', text: '#9d174d' }, // pink
    { bg: '#e0e7ff', text: '#3730a3' }, // indigo
    { bg: '#ccfbf1', text: '#115e59' }, // teal
    { bg: '#fef3c7', text: '#92400e' }  // yellow
  ];

  const hallColorMap: Record<string, { bg: string; text: string }> = {};
  halls.forEach((h, i) => {
    hallColorMap[h.id || h.name] = colors[i % colors.length];
  });

  let thExams = sortedExams.map(e => {
    const tStr = e.timeRange || (e.period === 'morning' ? settings.morningTime : settings.afternoonTime);
    return `
    <th style="border:1px solid #000; padding:${cellPadding}; background:#f1f5f9; text-align:center;">
      <div style="font-weight:bold; font-size:${fontSize};">${e.subject}</div>
      <div style="font-size:${subFontSize}; color:#475569;">${getArabicDayName(e.date)} ${e.date} (${e.period === 'morning' ? 'صباح' : 'مساء'})</div>
      <div style="font-size:${subFontSize}; color:#0369a1; font-family:monospace; font-weight:700;" dir="ltr">${tStr}</div>
    </th>
  `;
  }).join('');

  let rowsHtml = teachers.map((t, idx) => {
    let cells = sortedExams.map(exam => {
      const assign = assignments.find(a => String(a.teacherId) === String(t.id) && String(a.examId) === String(exam.id));
      if (!assign) return `<td style="border:1px solid #000; padding:${cellPadding}; text-align:center; color:#cbd5e1; font-size:${fontSize};">-</td>`;

      if (assign.hallId === 'reserve') {
        return `
          <td style="border:1px solid #000; padding:${cellPadding}; text-align:center; vertical-align:middle; background:#fffbeb;">
            <div style="background:#fef3c7; color:#92400e; font-weight:bold; font-size:${fontSize}; padding:1px 3px; border-radius:3px; border:1px solid #f59e0b; white-space:nowrap;">
              احتياط
            </div>
          </td>
        `;
      }

      const hall = halls.find(h => String(h.id) === String(assign.hallId));
      const hallName = hall ? (hall.name.includes('قاعة') ? hall.name : `قاعة ${hall.name}`) : 'محذوفة';
      const color = hallColorMap[assign.hallId] || { bg: '#e2e8f0', text: '#0f172a' };

      return `
        <td style="border:1px solid #000; padding:${cellPadding}; text-align:center; vertical-align:middle;">
          <div style="background:${color.bg}; color:${color.text}; font-weight:bold; font-size:${fontSize}; padding:1px 3px; border-radius:3px; border:1px solid rgba(0,0,0,0.1); white-space:nowrap;">
            ${hallName}
          </div>
        </td>
      `;
    }).join('');

    return `
      <tr>
        <td style="border:1px solid #000; padding:${cellPadding}; font-weight:bold; font-size:${fontSize}; text-align:center; background:#f8fafc;">${idx + 1}</td>
        <td style="border:1px solid #000; padding:${cellPadding}; font-weight:bold; font-size:${fontSize}; text-align:right; white-space:nowrap;">${t.name}</td>
        <td style="border:1px solid #000; padding:${cellPadding}; font-size:${subFontSize}; text-align:right; color:#475569; white-space:nowrap;">${t.specialty}</td>
        ${cells}
      </tr>
    `;
  }).join('');

  const bodyContent = `
    <div style="text-align:center; margin-bottom:12px; border-bottom:2px solid #000; padding-bottom:8px; line-height:1.6;">
      <h2 style="margin:0 0 4px 0; font-size:13px; font-weight:800; line-height:1.5;">الجمهورية الجزائرية الديمقراطية الشعبية — وزارة التربية الوطنية</h2>
      <h3 style="margin:0 0 6px 0; font-size:12px; font-weight:700; line-height:1.5;">مديرية التربية لولاية ${settings.wilaya} | ${settings.institutionName}</h3>
      <h4 style="margin:6px 0 0 0; font-size:14px; font-weight:800; text-decoration:underline; line-height:1.5;">الجدول العام الملون لحراسة الأساتذة — ${settings.selectedTerm} (${settings.schoolYear})</h4>
    </div>

    <table style="width:100%; border-collapse:collapse; table-layout:auto;">
      <thead>
        <tr>
          <th style="border:1px solid #000; padding:${cellPadding}; background:#e2e8f0; font-size:${fontSize}; width:20px;">#</th>
          <th style="border:1px solid #000; padding:${cellPadding}; background:#e2e8f0; font-size:${fontSize}; text-align:right; min-width:110px;">اسم ولقب الأستاذ</th>
          <th style="border:1px solid #000; padding:${cellPadding}; background:#e2e8f0; font-size:${fontSize}; text-align:right; min-width:80px;">التخصص</th>
          ${thExams}
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <table style="width:100%; margin-top:12px; margin-bottom:12px; border:none; border-top:1px solid #000; padding-top:6px; letter-spacing:normal; word-spacing:normal; page-break-inside:avoid; break-inside:avoid;">
      <tr>
        <td style="border:none; text-align:right; font-weight:800; font-size:10.5px; color:#000; width:50%; padding-right:10px; letter-spacing:normal; word-spacing:normal;">
          تأشيرة وتوقيع مدير المؤسسة
        </td>
        <td style="border:none; text-align:left; font-weight:800; font-size:10.5px; color:#000; width:50%; padding-left:10px; letter-spacing:normal; word-spacing:normal;">
          تأشيرة وتوقيع الناظر
        </td>
      </tr>
    </table>
  `;

  return wrapHtmlPage(bodyContent, 'الجدول العام الملون لجميع الأساتذة', 'A4 landscape');
}

// 4. Daily Attendance & Signature Sheet (محضر حضور وإمضاء الأساتذة اليومي)
export function generateDailySignSheetHtml(
  exam: Exam,
  assignments: Assignment[],
  teachers: Teacher[],
  halls: Hall[],
  settings: PrintSettings
): string {
  const examAssigns = assignments.filter(a => String(a.examId) === String(exam.id));
  
  // Split into Hall Proctors and Reserve Proctors
  const hallAssigns = examAssigns.filter(a => a.hallId !== 'reserve').map(a => {
    const t = teachers.find(teacher => String(teacher.id) === String(a.teacherId));
    const h = halls.find(hall => String(hall.id) === String(a.hallId));
    return { assignment: a, teacher: t, hall: h };
  }).sort((a, b) => {
    const hA = a.hall?.name || '';
    const hB = b.hall?.name || '';
    return hA.localeCompare(hB, 'ar', { numeric: true });
  });

  const reserveAssigns = examAssigns.filter(a => a.hallId === 'reserve').map(a => {
    const t = teachers.find(teacher => String(teacher.id) === String(a.teacherId));
    return { assignment: a, teacher: t };
  });

  const timeSlot = exam.timeRange || (exam.period === 'morning' ? settings.morningTime : settings.afternoonTime);

  let hallRowsHtml = hallAssigns.map((item, idx) => `
    <tr>
      <td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold; font-size:10px;">${idx + 1}</td>
      <td style="border:1px solid #000; padding:4px; font-weight:bold; font-size:10.5px;">${item.teacher?.name || 'محذوف'}</td>
      <td style="border:1px solid #000; padding:4px; font-size:9.5px; color:#334155;">${item.teacher?.specialty || 'غير محدد'}</td>
      <td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold; font-size:10.5px; background:#f8fafc;">
        ${item.hall?.name ? (item.hall.name.includes('قاعة') ? item.hall.name : `قاعة ${item.hall.name}`) : 'غير محددة'}
      </td>
      <td style="border:1px solid #000; padding:4px; text-align:center; font-family:monospace; font-size:9.5px;" dir="ltr">${timeSlot}</td>
      <td style="border:1px solid #000; padding:4px; height:28px;"></td>
    </tr>
  `).join('');

  let reserveRowsHtml = reserveAssigns.map((item, idx) => `
    <tr style="background:#fffbeb;">
      <td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold; font-size:10px; color:#92400e;">احتياط ${idx + 1}</td>
      <td style="border:1px solid #000; padding:4px; font-weight:bold; font-size:10.5px; color:#92400e;">${item.teacher?.name || 'محذوف'}</td>
      <td style="border:1px solid #000; padding:4px; font-size:9.5px; color:#334155;">${item.teacher?.specialty || 'غير محدد'}</td>
      <td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold; font-size:9.5px; background:#fef3c7; color:#92400e;">
        حارس احتياط
      </td>
      <td style="border:1px solid #000; padding:4px; text-align:center; font-family:monospace; font-size:9.5px;" dir="ltr">${timeSlot}</td>
      <td style="border:1px solid #000; padding:4px; height:28px;"></td>
    </tr>
  `).join('');

  const bodyContent = `
    <div style="text-align:center; margin-bottom:12px; border-bottom:2px solid #000; padding-bottom:8px; line-height:1.6;">
      <h2 style="margin:0 0 4px 0; font-size:14px; font-weight:800; line-height:1.5;">الجمهورية الجزائرية الديمقراطية الشعبية — وزارة التربية الوطنية</h2>
      <h3 style="margin:0 0 6px 0; font-size:13px; font-weight:700; line-height:1.5;">مديرية التربية لولاية ${settings.wilaya} | ${settings.institutionName}</h3>
      <h4 style="margin:6px 0 0 0; font-size:15px; font-weight:800; text-decoration:underline; line-height:1.5;">
        محضر حضور وإمضاء الأساتذة الحراس — مادة: <span style="color:#0f172a;">${exam.subject}</span>
      </h4>
      <div style="font-size:10.5px; font-weight:bold; margin-top:4px; display:flex; justify-content:center; gap:20px;">
        <span>التاريخ: ${getArabicDayName(exam.date)} ${exam.date}</span>
        <span>الفترة: ${exam.period === 'morning' ? 'صباحية' : 'مسائية'} (${timeSlot})</span>
        <span>المدة: ${exam.duration} ساعة</span>
      </div>
    </div>

    <table style="width:100%; border-collapse:collapse; margin-bottom: 10px;">
      <thead>
        <tr style="background:#e2e8f0; font-size:9.5px;">
          <th style="border:1px solid #000; padding:4px; width:35px; text-align:center;">#</th>
          <th style="border:1px solid #000; padding:4px; text-align:right;">اسم ولقب الأستاذ الحارس</th>
          <th style="border:1px solid #000; padding:4px; text-align:right; width:120px;">مادة التخصص</th>
          <th style="border:1px solid #000; padding:4px; text-align:center; width:100px;">القاعة المكلف بها</th>
          <th style="border:1px solid #000; padding:4px; text-align:center; width:100px;">التوقيت</th>
          <th style="border:1px solid #000; padding:4px; text-align:center; width:130px;">إمضاء الحضور بالمركز</th>
        </tr>
      </thead>
      <tbody>
        ${hallRowsHtml.length > 0 ? hallRowsHtml : `
          <tr>
            <td colspan="6" style="border:1px solid #000; padding:10px; text-align:center; color:#64748b; font-weight:bold;">
              لا يوجد أساتذة مكلفون بقاعات هذه المادة.
            </td>
          </tr>
        `}
      </tbody>
    </table>

    ${reserveRowsHtml.length > 0 ? `
      <div style="font-weight:bold; font-size:10.5px; margin: 8px 0 3px 0; color:#92400e;">
        قائمة الأساتذة المكلفين بالحراسة الاحتياطية لهذه الفترة:
      </div>
      <table style="width:100%; border-collapse:collapse; margin-bottom: 12px;">
        <thead>
          <tr style="background:#fef3c7; font-size:9.5px;">
            <th style="border:1px solid #000; padding:4px; width:65px; text-align:center;">الصفة</th>
            <th style="border:1px solid #000; padding:4px; text-align:right;">اسم ولقب أستاذ الاحتياط</th>
            <th style="border:1px solid #000; padding:4px; text-align:right; width:120px;">مادة التخصص</th>
            <th style="border:1px solid #000; padding:4px; text-align:center; width:100px;">المهمة المسندة</th>
            <th style="border:1px solid #000; padding:4px; text-align:center; width:100px;">التوقيت</th>
            <th style="border:1px solid #000; padding:4px; text-align:center; width:130px;">إمضاء الحضور بالمركز</th>
          </tr>
        </thead>
        <tbody>
          ${reserveRowsHtml}
        </tbody>
      </table>
    ` : ''}

    <table style="width:100%; margin-top:16px; margin-bottom:12px; border:none; border-top:1px solid #000; padding-top:8px; letter-spacing:normal; word-spacing:normal; page-break-inside:avoid; break-inside:avoid;">
      <tr>
        <td style="border:none; text-align:right; font-weight:800; font-size:11px; color:#000; width:50%; padding-right:10px; letter-spacing:normal; word-spacing:normal;">
          تأشيرة وتوقيع مدير المؤسسة
        </td>
        <td style="border:none; text-align:left; font-weight:800; font-size:11px; color:#000; width:50%; padding-left:10px; letter-spacing:normal; word-spacing:normal;">
          تأشيرة وتوقيع الناظر
        </td>
      </tr>
    </table>
  `;

  return wrapHtmlPage(bodyContent, `محضر حضور - ${exam.subject}`, 'A4 portrait');
}

// Wrapper to create clean printable HTML with standard Cairo font
function wrapHtmlPage(contentHtml: string, title: string, pageFormat: 'A4 portrait' | 'A4 landscape'): string {
  const isLandscape = pageFormat === 'A4 landscape';

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; }
        html, body {
          font-family: 'Cairo', system-ui, -apple-system, 'Segoe UI', Roboto, Tahoma, Geneva, sans-serif !important;
          margin: 0;
          padding: 0;
          background: #ffffff !important;
          color: #000000 !important;
          direction: rtl;
          width: 100%;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @page {
          size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
          margin: ${isLandscape ? '0.3cm 0.4cm' : '0.3cm 0.4cm'};
        }
        .page {
          width: 100%;
          margin: 0 auto;
          background: #ffffff;
          padding: 0.2cm 0.3cm;
          page-break-inside: avoid;
        }
        button, nav, header, footer, .print-hidden, .print\\:hidden {
          display: none !important;
        }
        @media print {
          body { background: #ffffff !important; }
          .page {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          button, nav, header, footer, .print-hidden, .print\\:hidden {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="page">
        ${contentHtml}
      </div>
    </body>
    </html>
  `;
}

export const EXIT_PRINT_EVENT = 'hirasa:exit-print';

export function printHtmlDirectly(htmlContent: string) {
  const existingOverlay = document.getElementById('hirasa-print-overlay');
  if (existingOverlay && document.body.contains(existingOverlay)) {
    try { document.body.removeChild(existingOverlay); } catch (e) {}
  }
  const existingFrame = document.getElementById('hirasa-print-iframe');
  if (existingFrame && document.body.contains(existingFrame)) {
    try { document.body.removeChild(existingFrame); } catch (e) {}
  }
  const existingBar = document.getElementById('hirasa-print-exit-bar');
  if (existingBar && document.body.contains(existingBar)) {
    try { document.body.removeChild(existingBar); } catch (e) {}
  }

  const prevBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const activeLang = ((typeof localStorage !== 'undefined' ? localStorage.getItem('hirasa_lang') : null) || 'ar') as AppLanguage;
  const activeDir = activeLang === 'ar' ? 'rtl' : 'ltr';

  const overlay = document.createElement('div');
  overlay.id = 'hirasa-print-overlay';
  overlay.setAttribute('dir', activeDir);
  overlay.style.cssText = [
    'position: fixed',
    'inset: 0',
    'z-index: 2147483640',
    'display: flex',
    'flex-direction: column',
    'background: #091021'
  ].join(';');

  // Top Control Bar (always visible above print preview in browser & standalone PWA, never printed)
  const exitBar = document.createElement('div');
  exitBar.id = 'hirasa-print-exit-bar';
  exitBar.setAttribute('dir', activeDir);
  exitBar.className = 'print:hidden';
  exitBar.style.cssText = [
    'display: flex',
    'flex-wrap: wrap',
    'align-items: center',
    'justify-content: space-between',
    'gap: 10px',
    'background: #091021',
    'border-bottom: 1px solid rgba(56, 189, 248, 0.25)',
    'padding: max(10px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) 10px max(14px, env(safe-area-inset-left))',
    'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45)',
    'font-family: Cairo, system-ui, sans-serif',
    'box-sizing: border-box',
    'width: 100%',
    'flex-shrink: 0'
  ].join(';');

  const titleWrap = document.createElement('div');
  titleWrap.style.cssText = 'display: flex; align-items: center; gap: 10px; color: #f8fafc;';

  const cornerCloseBtn = document.createElement('button');
  cornerCloseBtn.type = 'button';
  cornerCloseBtn.textContent = '✕';
  const closeTitle = translateArabicText('إغلاق الطباعة والعودة إلى التطبيق', activeLang);
  cornerCloseBtn.title = closeTitle;
  cornerCloseBtn.setAttribute('aria-label', closeTitle);
  cornerCloseBtn.style.cssText = [
    'width: 40px',
    'height: 40px',
    'display: inline-flex',
    'align-items: center',
    'justify-content: center',
    'background: #e11d48',
    'color: #ffffff',
    'border: 1px solid rgba(255, 255, 255, 0.25)',
    'border-radius: 12px',
    'font-weight: 900',
    'font-size: 20px',
    'line-height: 1',
    'cursor: pointer',
    'box-shadow: 0 4px 14px rgba(225, 29, 72, 0.45)',
    'flex-shrink: 0'
  ].join(';');

  const titleLabel = document.createElement('span');
  titleLabel.textContent = translateArabicText('وضع الطباعة والمعاينة', activeLang);
  titleLabel.style.cssText = 'font-weight: 800; font-size: 13px; color: #e2e8f0;';

  titleWrap.appendChild(cornerCloseBtn);
  titleWrap.appendChild(titleLabel);

  const actionsWrap = document.createElement('div');
  actionsWrap.style.cssText = 'display: flex; flex-wrap: wrap; align-items: center; gap: 8px;';

  const reprintBtn = document.createElement('button');
  reprintBtn.type = 'button';
  reprintBtn.textContent = translateArabicText('🖨️ طباعة الآن', activeLang);
  reprintBtn.style.cssText = [
    'background: #0099ff',
    'color: #ffffff',
    'border: none',
    'padding: 8px 14px',
    'border-radius: 10px',
    'font-weight: 800',
    'font-size: 13px',
    'cursor: pointer',
    'font-family: inherit'
  ].join(';');

  const exitBtn = document.createElement('button');
  exitBtn.type = 'button';
  exitBtn.textContent = translateArabicText('✕ خروج والعودة للتطبيق', activeLang);
  exitBtn.style.cssText = [
    'background: #e11d48',
    'color: #ffffff',
    'border: none',
    'padding: 8px 16px',
    'border-radius: 10px',
    'font-weight: 900',
    'font-size: 13px',
    'cursor: pointer',
    'font-family: inherit',
    'box-shadow: 0 4px 12px rgba(225, 29, 72, 0.4)'
  ].join(';');

  actionsWrap.appendChild(reprintBtn);
  actionsWrap.appendChild(exitBtn);

  exitBar.appendChild(titleWrap);
  exitBar.appendChild(actionsWrap);

  const printFrame = document.createElement('iframe');
  printFrame.id = 'hirasa-print-iframe';
  printFrame.style.cssText = [
    'flex: 1 1 auto',
    'min-height: 0',
    'width: 100%',
    'border: none',
    'background: #ffffff'
  ].join(';');

  overlay.appendChild(exitBar);
  overlay.appendChild(printFrame);
  document.body.appendChild(overlay);

  let cleanedUp = false;
  const cleanupImmediate = (notifyAppExit = false) => {
    if (cleanedUp) return;
    cleanedUp = true;
    document.body.style.overflow = prevBodyOverflow;
    try { window.removeEventListener('keydown', onKeyDown); } catch (e) {}
    try {
      if (overlay && document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    } catch (e) {}
    try { window.focus(); } catch (e) {}
    if (notifyAppExit) {
      try {
        window.dispatchEvent(new CustomEvent(EXIT_PRINT_EVENT));
      } catch (e) {}
    }
  };

  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      cleanupImmediate(true);
    }
  };

  const cleanupAfterPrint = () => {
    setTimeout(() => cleanupImmediate(false), 350);
  };

  cornerCloseBtn.addEventListener('click', () => cleanupImmediate(true));
  exitBtn.addEventListener('click', () => cleanupImmediate(true));
  window.addEventListener('keydown', onKeyDown);

  const frameWin = printFrame.contentWindow;
  const frameDoc = frameWin?.document || printFrame.contentDocument;

  if (frameDoc && frameWin) {
    frameDoc.open();
    frameDoc.write(htmlContent);
    frameDoc.close();

    reprintBtn.addEventListener('click', () => {
      try {
        frameWin.focus();
        frameWin.print();
      } catch (e) {
        window.print();
      }
    });

    try {
      frameWin.addEventListener('keydown', onKeyDown);
      frameWin.addEventListener('afterprint', cleanupAfterPrint, { once: true });
    } catch (e) {}

    // Instant non-blocking trigger for 100% offline reliability
    setTimeout(() => {
      if (cleanedUp) return;
      try {
        frameWin.focus();
        frameWin.print();
      } catch (e) {
        console.error('Print iframe error:', e);
        window.print();
      }
    }, 150);
  }
}

/**
 * Utility to sanitize cloned DOM nodes for html2canvas to eliminate 'oklch' CSS parsing errors
 */
export function sanitizeOklchInClonedDoc(clonedDoc: Document) {
  try {
    // 1. Remove all print:hidden elements, buttons, style sheets, and interactive UI toolbars
    const hiddenEls = clonedDoc.querySelectorAll('.print\\:hidden, .print-hidden, button, script, iframe');
    hiddenEls.forEach((el) => el.remove());

    const styleEls = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
    styleEls.forEach((s) => s.remove());

    // 2. Walk all elements in the cloned document and replace any oklch color references
    const allNodes = clonedDoc.querySelectorAll('*');
    allNodes.forEach((node) => {
      const el = node as HTMLElement;
      
      // Clean style attribute text
      const styleAttr = el.getAttribute('style');
      if (styleAttr && styleAttr.includes('oklch')) {
        const cleaned = styleAttr.replace(/oklch\([^)]+\)/gi, '#0099FF');
        el.setAttribute('style', cleaned);
      }

      // Clean SVG & color attributes
      ['fill', 'stroke', 'color', 'background', 'background-color'].forEach((attr) => {
        const attrVal = el.getAttribute(attr);
        if (attrVal && attrVal.includes('oklch')) {
          el.setAttribute(attr, '#0099FF');
        }
      });

      // Override inline style properties
      if (el.style) {
        if (el.style.color && el.style.color.includes('oklch')) el.style.color = '#000000';
        if (el.style.backgroundColor && el.style.backgroundColor.includes('oklch')) el.style.backgroundColor = '#ffffff';
        if (el.style.borderColor && el.style.borderColor.includes('oklch')) el.style.borderColor = '#000000';
      }
    });

    // 3. Inject clean Cairo font + basic table print styles
    const cleanStyle = clonedDoc.createElement('style');
    cleanStyle.textContent = `
      * { 
        font-family: 'Cairo', system-ui, -apple-system, 'Segoe UI', Roboto, Tahoma, Geneva, sans-serif !important; 
        box-sizing: border-box !important; 
        letter-spacing: normal !important; 
        word-spacing: normal !important; 
      }
      body { 
        background-color: #ffffff !important; 
        color: #000000 !important; 
        margin: 0 !important; 
        padding: 0 !important; 
        letter-spacing: normal !important; 
        word-spacing: normal !important; 
      }
      table { border-collapse: collapse !important; width: 100% !important; }
      th, td { border-color: #000000 !important; letter-spacing: normal !important; word-spacing: normal !important; }
    `;
    clonedDoc.head.appendChild(cleanStyle);
  } catch (err) {
    console.warn('Failed to sanitize oklch in cloned document:', err);
  }
}



