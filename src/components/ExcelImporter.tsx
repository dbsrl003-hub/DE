/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Candidate, CategoryType, ConsultationLog } from '../types';
import { Upload, Clipboard, Info, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface ExcelImporterProps {
  onImport: (newCandidates: Candidate[]) => void;
}

export default function ExcelImporter({ onImport }: ExcelImporterProps) {
  const [inputText, setInputText] = useState('');
  const [importType, setImportType] = useState<'paste' | 'file'>('paste');
  const [parsedCount, setParsedCount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Partial<Candidate>[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const expectedHeaders = [
    '구분', '접수일', '접수자', '성명', '생년월일', '성별', 
    '장애유형', '급수', '복합장애', '국비', '도비', '시비', 
    '시', '구', '동', '세부주소', '연락처', '서비스내용', 
    '특이사항', '상담내역', '비고'
  ];

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
    setErrorMessage(null);
    if (!text.trim()) {
      setPreviewData([]);
      setParsedCount(null);
      return;
    }
    parsePreview(text);
  };

  // Helper to parse CSV or TSV string
  const parseDataString = (text: string): Candidate[] => {
    const rows = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (rows.length === 0) return [];

    // Detect separator (Tab if TSV, comma if CSV)
    const firstRow = rows[0];
    const isTab = firstRow.includes('\t');
    const separator = isTab ? '\t' : ',';

    // Parse each line (respecting quotes in case of CSV)
    const parseLine = (line: string): string[] => {
      if (isTab) {
        return line.split('\t').map(cell => cell.trim().replace(/^"|"$/g, ''));
      }
      // Simple CSV cell parsing with quote handling
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result.map(cell => cell.replace(/^"|"$/g, ''));
    };

    const headerFields = parseLine(rows[0]);
    
    // Check if the first row is actually a header row
    const hasHeader = headerFields.some(field => 
      expectedHeaders.some(expected => field.includes(expected) || expected.includes(field))
    );

    const startIndex = hasHeader ? 1 : 0;
    
    // Default mapping index maps
    let map: Record<string, number> = {};
    
    if (hasHeader) {
      headerFields.forEach((field, idx) => {
        const cleanField = field.replace(/\s+/g, '');
        if (cleanField.includes('구분')) map.category = idx;
        else if (cleanField.includes('접수일')) map.registrationDate = idx;
        else if (cleanField.includes('접수자')) map.registrar = idx;
        else if (cleanField.includes('성명') || cleanField.includes('이름')) map.name = idx;
        else if (cleanField.includes('생년')) map.birthDate = idx;
        else if (cleanField.includes('성별')) map.gender = idx;
        else if (cleanField.includes('장애유형') || cleanField.includes('장애명')) map.disabilityType = idx;
        else if (cleanField.includes('급수') || cleanField.includes('등급')) map.disabilityGrade = idx;
        else if (cleanField.includes('복합')) map.complexDisability = idx;
        else if (cleanField.includes('국비')) map.fundingNational = idx;
        else if (cleanField.includes('도비')) map.fundingProvincial = idx;
        else if (cleanField.includes('시비')) map.fundingCity = idx;
        else if (cleanField.includes('시') && !cleanField.includes('시비') && !cleanField.includes('시간')) map.addressCity = idx;
        else if (cleanField.includes('구') && !cleanField.includes('구분') && !cleanField.includes('상담')) map.addressDistrict = idx;
        else if (cleanField.includes('동') && !cleanField.includes('복동')) map.addressDong = idx;
        else if (cleanField.includes('세부주소') || cleanField.includes('상세주소') || cleanField.includes('주소')) {
          if (map.addressDetail === undefined) map.addressDetail = idx;
        }
        else if (cleanField.includes('연락처') || cleanField.includes('전화')) map.phone = idx;
        else if (cleanField.includes('서비스')) map.serviceContent = idx;
        else if (cleanField.includes('특이')) map.specialNotes = idx;
        else if (cleanField.includes('상담')) map.consultationLogs = idx;
        else if (cleanField.includes('비고')) map.remarks = idx;
      });
    } else {
      // Fallback straight sequential mapping based on Excel description:
      // 0: 구분, 1: 접수일, 2: 접수자, 3: 성명, 4: 생년월일, 5: 성별, 6: 장애유형, 7: 급수, 8: 복합장애,
      // 9: 국비, 10: 도비, 11: 시비, 12: 시, 13: 구, 14: 동, 15: 세부주소, 16: 연락처, 17: 서비스내용, 18: 특이사항, 19: 상담내역, 20: 비고
      map = {
        category: 0,
        registrationDate: 1,
        registrar: 2,
        name: 3,
        birthDate: 4,
        gender: 5,
        disabilityType: 6,
        disabilityGrade: 7,
        complexDisability: 8,
        fundingNational: 9,
        fundingProvincial: 10,
        fundingCity: 11,
        addressCity: 12,
        addressDistrict: 13,
        addressDong: 14,
        addressDetail: 15,
        phone: 16,
        serviceContent: 17,
        specialNotes: 18,
        consultationLogs: 19,
        remarks: 20
      };
    }

    const fetchedItems: Candidate[] = [];

    for (let i = startIndex; i < rows.length; i++) {
      const columns = parseLine(rows[i]);
      if (columns.length < 2 || columns.every(col => col === '')) continue;

      const getColVal = (key: string, defaultVal: string = ''): string => {
        const idx = map[key];
        if (idx !== undefined && columns[idx] !== undefined) {
          return columns[idx].trim();
        }
        return defaultVal;
      };

      const getBoolVal = (key: string): boolean => {
        const val = getColVal(key).toLowerCase();
        return val === 'y' || val === 'yes' || val === 'o' || val === '참' || val === 'true' || val === '대상' || val === '유' || val === '1';
      };

      // Raw date parsing & formatting (ensure YYYY-MM-DD or keep raw if invalid, try fallback)
      let rawRegDate = getColVal('registrationDate');
      let selectRegDate = formatRawDate(rawRegDate);

      // Category parsing
      let catSelect = getColVal('category') as CategoryType;
      if (!['대기', '삭제', '보류', '연계'].includes(catSelect)) {
        catSelect = '대기'; // fallback default
      }

      // Gender parsing
      let genderVal: '남' | '여' | '기타' = '기타';
      const rawGender = getColVal('gender');
      if (rawGender.includes('남') || rawGender.toLowerCase() === 'm' || rawGender.toLowerCase() === 'male' || rawGender === '1') {
        genderVal = '남';
      } else if (rawGender.includes('여') || rawGender.toLowerCase() === 'f' || rawGender.toLowerCase() === 'female' || rawGender === '2') {
        genderVal = '여';
      }

      // Parse Consultation Log. Excel logs usually are a single text.
      // We parse it into an array. If there are dates formatted inside (e.g. 2025/03/12: some text), we split by newline or date format.
      const rawLogs = getColVal('consultationLogs');
      const consultationLogs: ConsultationLog[] = [];
      
      if (rawLogs) {
        // Let's try splitting standard newline-delimited histories.
        // Try to identify dates like "24.03.11:..." or "2025-03-12 - ..."
        const logLines = rawLogs.split(/\n+/).filter(line => line.trim() !== '');
        
        logLines.forEach((logLine, logIdx) => {
          // Detect if line contains a date
          const dateMatch = logLine.match(/(\d{4}[-./]\d{1,2}[-./]\d{1,2})|(\d{2}[-./]\d{1,2}[-./]\d{1,2})/);
          let logDate = selectRegDate; // Fallback to registration date
          let logText = logLine;
          
          if (dateMatch) {
            const rawMatchedDate = dateMatch[0];
            const formattedLogDate = formatRawDate(rawMatchedDate);
            if (formattedLogDate !== '2026-05-28') { // if not empty fallback
              logDate = formattedLogDate;
            }
          }
          
          consultationLogs.push({
            id: `imported-log-${i}-${logIdx}`,
            date: logDate,
            content: logText
          });
        });

        // If split returned nothing but rawLogs is full
        if (consultationLogs.length === 0) {
          consultationLogs.push({
            id: `imported-log-${i}-0`,
            date: selectRegDate,
            content: rawLogs
          });
        }
      } else {
        // Default initial log
        consultationLogs.push({
          id: `imported-log-${i}-0`,
          date: selectRegDate,
          content: '[최초 등록] 이용대기 접수 완료'
        });
      }

      // Birthdate formatting
      const rawBirth = getColVal('birthDate');
      const formattedBirth = formatRawDate(rawBirth);

      fetchedItems.push({
        id: `imported-cand-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        category: catSelect,
        registrationDate: selectRegDate,
        registrar: getColVal('registrar', '미기재'),
        name: getColVal('name', '이름없음'),
        birthDate: formattedBirth !== 'Invalid Date' ? formattedBirth : rawBirth || '1990-01-01',
        gender: genderVal,
        disabilityType: getColVal('disabilityType', '미지정'),
        disabilityGrade: getColVal('disabilityGrade', '미분류'),
        complexDisability: getBoolVal('complexDisability'),
        fundingNational: getColVal('fundingNational'),
        fundingProvincial: getColVal('fundingProvincial'),
        fundingCity: getColVal('fundingCity'),
        addressCity: getColVal('addressCity'),
        addressDistrict: getColVal('addressDistrict'),
        addressDong: getColVal('addressDong'),
        addressDetail: getColVal('addressDetail'),
        phone: formatPhoneNumber(getColVal('phone')),
        serviceContent: getColVal('serviceContent'),
        specialNotes: getColVal('specialNotes'),
        consultationLogs,
        remarks: getColVal('remarks')
      });
    }

    return fetchedItems;
  };

  const formatRawDate = (dateStr: string): string => {
    if (!dateStr) return '2026-05-28'; // fallback
    const digits = dateStr.replace(/[^\d]/g, '');
    
    // YYYYMMDD
    if (digits.length === 8) {
      return `${digits.substring(0, 4)}-${digits.substring(4, 6)}-${digits.substring(6, 8)}`;
    }
    // YYMMDD
    if (digits.length === 6) {
      const prefix = parseInt(digits.substring(0, 2)) > 50 ? '19' : '20';
      return `${prefix}${digits.substring(0, 2)}-${digits.substring(2, 4)}-${digits.substring(4, 6)}`;
    }
    
    // Regular splits
    const parts = dateStr.split(/[-./_]/).map(p => p.trim());
    if (parts.length === 3) {
      let year = parts[0];
      if (year.length === 2) {
        year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      }
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return dateStr; // return original if failed
  };

  const formatPhoneNumber = (phoneStr: string): string => {
    if (!phoneStr) return '';
    const cleanNum = phoneStr.replace(/[^\d]/g, '');
    if (cleanNum.length === 11) {
      return `${cleanNum.substring(0, 3)}-${cleanNum.substring(3, 7)}-${cleanNum.substring(7, 11)}`;
    }
    if (cleanNum.length === 10) {
      return `${cleanNum.substring(0, 3)}-${cleanNum.substring(3, 6)}-${cleanNum.substring(6, 10)}`;
    }
    return phoneStr;
  };

  const parsePreview = (text: string) => {
    try {
      const candidates = parseDataString(text);
      if (candidates.length > 0) {
        setPreviewData(candidates.slice(0, 3)); // show top 3 as preview
        setParsedCount(candidates.length);
        setErrorMessage(null);
      } else {
        setPreviewData([]);
        setParsedCount(0);
      }
    } catch (err: any) {
      setErrorMessage('데이터 해석 과정성 오류가 발생했습니다. 규격을 확인해주세요: ' + err.message);
      setPreviewData([]);
      setParsedCount(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(content);
      parsePreview(content);
    };
    reader.readAsText(file, 'EUC-KR'); // Many Korean CSV files exported from Excel are in EUC-KR
  };

  const executeImport = () => {
    if (!inputText.trim()) return;
    const finalCandidates = parseDataString(inputText);
    if (finalCandidates.length === 0) {
      setErrorMessage('가져올 유효한 데이터가 없습니다.');
      return;
    }
    
    onImport(finalCandidates);
    setInputText('');
    setPreviewData([]);
    setParsedCount(null);
    alert(`성공적으로 ${finalCandidates.length}명의 대기명단 데이터를 정렬 및 등록 완료하였습니다!`);
  };

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-xl overflow-hidden mb-8">
      {/* Tab Select Header */}
      <div className="flex border-b border-slate-100 bg-slate-50/70 p-1">
        <button
          type="button"
          onClick={() => { setImportType('paste'); setErrorMessage(null); }}
          className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all ${
            importType === 'paste' 
              ? 'bg-white text-emerald-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
          }`}
        >
          <Clipboard className="w-4 h-4" />
          엑셀 복사-붙여넣기 (추천)
        </button>
        <button
          type="button"
          onClick={() => { setImportType('file'); setErrorMessage(null); }}
          className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all ${
            importType === 'file' 
              ? 'bg-white text-emerald-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
          }`}
        >
          <Upload className="w-4 h-4" />
          CSV 파일 업로드
        </button>
      </div>

      <div className="p-6">
        <div className="mb-4 bg-emerald-50/50 rounded-xl p-4 text-xs text-emerald-800 border border-emerald-100 flex items-start gap-2.5 leading-relaxed">
          <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold mb-1 col-span-2 text-emerald-900 text-sm">스마트 정리 방법 안내</p>
            <p className="mb-1">
              • 엑셀의 헤더(첫 열)를 그대로 전체 드래그 복사(Ctrl+C)하여 붙여넣으면 한글 열 이름을 기준으로 <strong>자동 매핑</strong>됩니다.
            </p>
            <p className="mb-1">
              • 헤더 열 이름이 다르면 자동 탐색하여 <strong>[시, 구, 동, 세부주소 → 주소 결합] [서비스내용, 특이사항 → 서비스내용 결합]</strong>로 스마트 구성됩니다.
            </p>
            <p>
              • 접수일 및 상담일지에 다음 연도 내역이 있을 시, <strong>2024, 2025, 2026 연도별 명단에 자동 분배</strong>하여 나타납니다.
            </p>
          </div>
        </div>

        {importType === 'paste' ? (
          <div>
            <textarea
              className="w-full h-44 p-4 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 outline-none transition-all placeholder-slate-400"
              placeholder={`엑셀 시트에서 범위를 드래그 복사한 뒤 여기에 붙여넣으세요. (Ctrl + V)\n\n[권장 헤더 구성]\n구분\t접수일\t접수자\t성명\t생년월일\t성별\t장애유형\t급수\t국비\t도비\t시비\t시\t구\t동\t세부주소\t연락처\t서비스내용\t특이사항\t상담내역\t비고`}
              value={inputText}
              onChange={handleTextChange}
            />
          </div>
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 hover:border-emerald-500 bg-slate-50/30 text-center cursor-pointer transition-all hover:bg-emerald-50/20 group"
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".csv" 
              className="hidden" 
            />
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 mb-3 transition-colors">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-700 group-hover:text-emerald-700">여기를 클릭하여 대기명단 CSV 파일 선택</p>
            <p className="text-xs text-slate-400 mt-1">EUC-KR(한국어 인코딩) 및 일반 UTF-8 형식 지원</p>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <div>{errorMessage}</div>
          </div>
        )}

        {parsedCount !== null && parsedCount > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 border border-slate-100 rounded-xl bg-slate-50/40 p-4"
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Check className="w-4.5 h-4.5 text-emerald-600 bg-emerald-100 rounded-full p-0.5" />
                <span className="text-sm font-bold text-slate-800">
                  성공적으로 해석됨: <span className="text-emerald-600 font-extrabold">{parsedCount}건</span>
                </span>
              </div>
              <span className="text-xs text-slate-400">데이터 상위 3건 실시간 미리보기</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-1">구분</th>
                    <th className="py-2 px-1">성명</th>
                    <th className="py-2 px-1">접수일</th>
                    <th className="py-2 px-1">장애유형</th>
                    <th className="py-2 px-1">주소</th>
                    <th className="py-2 px-1">서비스 내용</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((cand, idx) => (
                    <tr key={idx} className="border-b border-slate-100 text-slate-700 hover:bg-slate-50">
                      <td className="py-2 px-1">
                        <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded font-medium ${
                          cand.category === '대기' ? 'bg-orange-50 text-orange-600' :
                          cand.category === '삭제' ? 'bg-rose-50 text-rose-600' :
                          cand.category === '보류' ? 'bg-amber-50 text-amber-600' :
                          'bg-emerald-50 text-emerald-600'
                        }`}>
                          {cand.category}
                        </span>
                      </td>
                      <td className="py-2 px-1 font-semibold">{cand.name}</td>
                      <td className="py-2 px-1 text-slate-500">{cand.registrationDate}</td>
                      <td className="py-2 px-1">{cand.disabilityType} ({cand.disabilityGrade})</td>
                      <td className="py-2 px-1 max-w-[150px] truncate">
                        {cand.addressCity} {cand.addressDistrict} {cand.addressDong} {cand.addressDetail}
                      </td>
                      <td className="py-2 px-1 max-w-[180px] truncate">
                        {cand.serviceContent || cand.specialNotes ? (
                          <>
                            {cand.serviceContent}
                            {cand.specialNotes ? ` / ${cand.specialNotes}` : ''}
                          </>
                        ) : '생략됨'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  setPreviewData([]);
                  setParsedCount(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg transition-all"
              >
                초기화
              </button>
              <button
                type="button"
                onClick={executeImport}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                정리된 대기명단에 통합 반영하기
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
