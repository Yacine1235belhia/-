import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, ShieldAlert, FileSpreadsheet, AlertCircle, Layers, TableProperties, FileUp } from 'lucide-react';
import * as XLSX from 'xlsx';

export interface ColumnDef {
  key: string;
  label: string;
  required?: boolean;
  aliases?: string[];
}

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileBuffer?: ArrayBuffer | null;
  data?: any[];
  expectedColumns: ColumnDef[];
  onConfirm: (mappedData: any[]) => void;
  title: string;
}

export default function ExcelImportModal({ isOpen, onClose, fileBuffer, data, expectedColumns, onConfirm, title }: ExcelImportModalProps) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);
  const [columnMap, setColumnMap] = useState<Record<string, number>>({});
  const [showAllRows, setShowAllRows] = useState(false);

  // 1. Read workbook whenever fileBuffer changes
  useEffect(() => {
    if (!fileBuffer) {
      setWorkbook(null);
      return;
    }
    try {
      const wb = XLSX.read(fileBuffer, { type: 'array' });
      setWorkbook(wb);
      if (wb.SheetNames.length > 0) {
        setActiveSheetName(wb.SheetNames[0]);
      }
    } catch (e) {
      console.error('Failed to parse workbook:', e);
      setWorkbook(null);
    }
  }, [fileBuffer]);

  const sheetNames = useMemo(() => workbook ? workbook.SheetNames : [], [workbook]);

  // 2. Read raw 2D array matrix from active sheet OR fallback to passed data
  const rawMatrix = useMemo<any[][]>(() => {
    if (workbook && activeSheetName && workbook.Sheets[activeSheetName]) {
      const ws = workbook.Sheets[activeSheetName];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
      return raw.filter(row => Array.isArray(row) && row.some(cell => String(cell || '').trim() !== ''));
    }
    if (data && data.length > 0) {
      const sample = data[0] || {};
      const keys = Object.keys(sample);
      const rows = data.map(row => keys.map(k => row[k]));
      return [keys, ...rows];
    }
    return [];
  }, [workbook, activeSheetName, data]);

  // 3. Auto-detect best header row
  useEffect(() => {
    if (rawMatrix.length === 0) return;

    let bestScore = -1;
    let bestIdx = 0;

    const titleBannerKeywords = ['الجمهورية الجزائرية', 'وزارة التربية', 'مديرية التربية', 'ثانوية'];
    const columnKeywords = [
      'الاسم واللقب', 'الاسم', 'اللقب', 'المادة', 'التخصص', 'الأستاذ', 'استاذ', 'أستاذ',
      'اسم', 'لقب', 'تخصص', 'مادة', 'اقدمية', 'أقدمية', 'درجة', 'رقم الأستاذ', 'رقم',
      'قاعة', 'سعة', 'اختبار', 'امتحان', 'فترة', 'مدة', 'رمز', 'معرف', 'رقم التسجيل',
      'name', 'subject', 'specialty', 'teacher', 'seniority', 'hall', 'capacity', 'code', 'id'
    ];

    for (let r = 0; r < Math.min(15, rawMatrix.length); r++) {
      const row = rawMatrix[r];
      if (!row) continue;
      let score = 0;
      let nonBlankCount = 0;

      const rowStr = row.map(c => String(c || '').trim()).join(' ');

      // Penalty for top title banner rows that don't contain real table columns
      if (titleBannerKeywords.some(tb => rowStr.includes(tb)) && !columnKeywords.some(ck => rowStr.includes(ck))) {
        score -= 10;
      }

      row.forEach(cell => {
        const str = String(cell || '').trim().toLowerCase();
        if (str !== '') {
          nonBlankCount++;
          if (columnKeywords.some(kw => str.includes(kw))) {
            score += 6;
          }
        }
      });

      if (nonBlankCount >= 2) score += 2;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = r;
      }
    }

    setHeaderRowIndex(bestIdx);
  }, [rawMatrix]);

  // 4. Compute header cell titles for selected headerRowIndex
  const headerRowCells = useMemo<{ index: number; label: string }[]>(() => {
    if (rawMatrix.length === 0 || headerRowIndex < 0 || headerRowIndex >= rawMatrix.length) return [];
    const row = rawMatrix[headerRowIndex] || [];
    
    // Find max column index across sample data rows
    const sampleRows = rawMatrix.slice(headerRowIndex, headerRowIndex + 10);
    const maxCols = Math.max(row.length, ...sampleRows.map(r => r ? r.length : 0));

    const result = [];
    for (let c = 0; c < maxCols; c++) {
      const cellVal = String(row[c] || '').trim();
      result.push({
        index: c,
        label: cellVal || `العمود ${c + 1}`
      });
    }
    return result;
  }, [rawMatrix, headerRowIndex]);

  // 5. Auto-map expected columns to column indices
  useEffect(() => {
    if (headerRowCells.length === 0) return;
    const initialMap: Record<string, number> = {};

    expectedColumns.forEach(exp => {
      const candidates = [
        exp.label,
        exp.key,
        ...(exp.aliases || [])
      ].map(c => c.trim().toLowerCase());

      let matchedColIdx = -1;

      for (const item of headerRowCells) {
        const cleanLabel = item.label.trim().toLowerCase();
        if (cleanLabel.startsWith('العمود ')) continue;

        const isMatch = candidates.some(cand => 
          cleanLabel === cand || 
          cleanLabel.includes(cand) || 
          cand.includes(cleanLabel)
        );

        if (isMatch) {
          matchedColIdx = item.index;
          break;
        }
      }

      initialMap[exp.key] = matchedColIdx;
    });

    setColumnMap(initialMap);
  }, [headerRowCells, expectedColumns]);

  if (!isOpen) return null;

  // 6. Data rows (all non-empty rows AFTER headerRowIndex)
  const dataRows = rawMatrix.slice(headerRowIndex + 1).filter(r => r && r.some(c => String(c || '').trim() !== ''));

  // 7. Map items for confirmation & preview
  const reqKey = expectedColumns.find(c => c.required)?.key || expectedColumns[0]?.key || 'name';

  const mappedData = dataRows.map(row => {
    const item: Record<string, any> = {};
    expectedColumns.forEach(exp => {
      const colIdx = columnMap[exp.key];
      item[exp.key] = colIdx !== undefined && colIdx >= 0 && row[colIdx] !== undefined ? row[colIdx] : '';
    });

    // Auto-combine separate First Name & Last Name if available
    const fullNameVal = item.name ? String(item.name).trim() : '';
    const lastNameVal = item.lastName ? String(item.lastName).trim() : '';
    const firstNameVal = item.firstName ? String(item.firstName).trim() : '';

    if (!fullNameVal && (lastNameVal || firstNameVal)) {
      item.name = `${lastNameVal} ${firstNameVal}`.trim();
    }
    if (!item[reqKey] && (lastNameVal || firstNameVal)) {
      item[reqKey] = `${lastNameVal} ${firstNameVal}`.trim();
    }
    return item;
  }).filter(item => {
    if (item[reqKey] && String(item[reqKey]).trim() !== '') return true;
    if (item.name && String(item.name).trim() !== '') return true;
    if (item.lastName || item.firstName) return true;
    return Object.values(item).some(v => typeof v === 'string' && v.trim().length > 1);
  });

  const handleConfirm = () => {
    onConfirm(mappedData);
  };

  const displayData = showAllRows ? mappedData : mappedData.slice(0, 50);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-100">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b flex justify-between items-center bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 rounded-xl text-blue-400">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">{title} - تحديد وتدقيق أعمدة الملف</h2>
              <p className="text-xs text-slate-300">الربط التلقائي للهيدر واستعراض كافة الصفوف المستخرجة</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-gray-50/50">
          
          {/* Smart Notice */}
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl text-xs sm:text-sm flex items-start gap-3 shadow-xs">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">تنسيق ومعاينة تلقائية للملف:</span>
              يقوم النظام بتحديد سطر العناوين (الهيدر) وتحديد الأعمدة تلقائياً (مثل الاسم واللقب والمادة) لتأكيد البيانات قبل الإدراج المباشر.
            </div>
          </div>

          {/* Controls: Sheet & Header Row selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Sheet selector */}
            {sheetNames.length > 1 && (
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Layers size={16} className="text-blue-600" />
                  <span>اختر ورقة العمل (Sheet):</span>
                </label>
                <select 
                  value={activeSheetName}
                  onChange={(e) => setActiveSheetName(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-sm font-medium"
                >
                  {sheetNames.map(sn => (
                    <option key={sn} value={sn}>{sn}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Header row selector */}
            <div className={`bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs ${sheetNames.length <= 1 ? 'md:col-span-2' : ''}`}>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <TableProperties size={16} className="text-blue-600" />
                <span>سطر العناوين (الهيدر في الملف):</span>
              </label>
              <select 
                value={headerRowIndex}
                onChange={(e) => setHeaderRowIndex(Number(e.target.value))}
                className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-sm font-medium"
              >
                {rawMatrix.slice(0, 15).map((row, idx) => {
                  const previewStr = row.map(c => String(c || '').trim()).filter(Boolean).slice(0, 4).join(' | ');
                  return (
                    <option key={idx} value={idx}>
                      السطر {idx + 1}: {previewStr || '(سطر فارغ)'} {idx === headerRowIndex ? '✓ (مكتشف تلقائياً)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

          </div>

          {/* Column Mappings */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3 shadow-xs">
            <h3 className="font-bold text-gray-800 text-sm sm:text-base flex items-center gap-2">
              <span>مطابقة حقول النظام مع أعمدة ملف الإكسل</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {expectedColumns.map(exp => {
                const currentIdx = columnMap[exp.key];
                return (
                  <div key={exp.key} className="bg-gray-50 p-3 rounded-xl border border-gray-200 hover:border-blue-300 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-gray-800 text-xs sm:text-sm">{exp.label}</span>
                      {exp.required && <span className="text-red-500 text-[11px] font-bold">* مطلوب</span>}
                    </div>
                    <select 
                      value={currentIdx !== undefined ? currentIdx : -1}
                      onChange={(e) => setColumnMap({ ...columnMap, [exp.key]: Number(e.target.value) })}
                      className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-xs sm:text-sm font-medium text-gray-800"
                    >
                      <option value={-1}>-- تجاهل / غير موجود --</option>
                      {headerRowCells.map(col => (
                        <option key={col.index} value={col.index}>
                          {col.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3 shadow-xs">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">
                معاينة الصفوف المستخرجة من الملف ({mappedData.length} صف جاهز)
              </h3>
              {mappedData.length > 50 && (
                <button
                  type="button"
                  onClick={() => setShowAllRows(!showAllRows)}
                  className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-lg border border-blue-200 font-bold hover:bg-blue-100 transition-colors"
                >
                  {showAllRows ? 'عرض أول 50 صف فقط' : `عرض كافة الصفوف (${mappedData.length} صف)`}
                </button>
              )}
            </div>
            
            <div className="overflow-x-auto max-h-80 overflow-y-auto border border-gray-200 rounded-xl bg-white shadow-inner">
              <table className="w-full text-right text-xs sm:text-sm border-collapse min-w-full">
                <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-3 w-12 text-center border-l border-gray-200 text-xs whitespace-nowrap bg-gray-100">#</th>
                    {expectedColumns.map(exp => (
                      <th key={exp.key} className="p-3 border-l border-gray-200 last:border-l-0 whitespace-nowrap bg-gray-100">
                        {exp.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayData.map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                      <td className="p-3 text-center text-xs font-mono text-gray-400 bg-gray-50 border-l border-gray-200 whitespace-nowrap">{i + 1}</td>
                      {expectedColumns.map(exp => {
                        const val = row[exp.key];
                        const isSpecialty = exp.key === 'specialty';
                        return (
                          <td key={exp.key} className="p-3 border-l border-gray-100 last:border-l-0 whitespace-nowrap">
                            {val !== undefined && val !== null && String(val).trim() !== '' ? (
                              isSpecialty ? (
                                <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-bold border border-blue-100 inline-block whitespace-nowrap">
                                  {String(val)}
                                </span>
                              ) : (
                                <span className="font-medium text-gray-900 whitespace-nowrap">{String(val)}</span>
                              )
                            ) : (
                              <span className="text-gray-400 italic text-xs whitespace-nowrap">غير محدد</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {mappedData.length === 0 && (
                    <tr>
                      <td colSpan={expectedColumns.length + 1} className="p-8 text-center text-gray-400">
                        <AlertCircle size={32} className="mx-auto mb-2 opacity-40" />
                        لم يتم العثور على أسطر صالحة وفق الخيارات الحالية
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {mappedData.length > 50 && !showAllRows && (
              <p className="text-center text-xs text-gray-500 pt-1 font-medium">
                تم عرض أول 50 صف للسرعة. + {mappedData.length - 50} صفوف أخرى جاهزة للاستيراد عند الضغط على استرداد.
              </p>
            )}

            {mappedData.length > 0 && (
              <div className="flex flex-wrap items-center justify-between bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl gap-3">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-emerald-900">
                    جاهز للاستيراد: تم فحص {mappedData.length} عنصر وجاهز للإضافة إلى القائمة
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-sm shadow-emerald-200"
                >
                  <FileUp size={16} />
                  <span>استرداد الآن ({mappedData.length})</span>
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center gap-3">
          <p className="text-xs text-gray-500 font-medium hidden sm:block">
            اضغط على زر استرداد لإدراج وإظهار السطور في قائمة الأساتذة فوراً
          </p>
          <div className="flex gap-3 w-full sm:w-auto justify-end">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-colors text-sm"
            >
              إلغاء
            </button>
            <button 
              onClick={handleConfirm}
              disabled={mappedData.length === 0}
              className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm shadow-md shadow-emerald-200"
            >
              <FileUp size={18} />
              <span>استرداد ({mappedData.length} عنصر) إلى القائمة</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
