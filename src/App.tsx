/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import XLSX from 'xlsx-js-style';
import { Candidate, CategoryType } from './types';
import { INITIAL_CANDIDATES } from './data/sampleData';
import CandidateTable from './components/CandidateTable';
import CandidateDetailModal from './components/CandidateDetailModal';
import ExcelImporter from './components/ExcelImporter';
import { 
  FileSpreadsheet, 
  Printer, 
  UserPlus, 
  Download, 
  Settings, 
  Filter,
  Calendar,
  Users,
  Grid,
  FileDown,
  ChevronRight,
  TrendingDown,
  Trash2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('2025'); // default to 2025 or total
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [showImporter, setShowImporter] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ 
    isOpen: boolean; 
    title: string; 
    message: string; 
    onConfirm: () => void; 
    actionText?: string;
    isWarning?: boolean;
  } | null>(null);

  // Initialize data from localStorage or initial templates
  useEffect(() => {
    const saved = localStorage.getItem('waitlist_candidates');
    if (saved) {
      try {
        setCandidates(JSON.parse(saved));
      } catch (e) {
        setCandidates(INITIAL_CANDIDATES);
      }
    } else {
      setCandidates(INITIAL_CANDIDATES);
      localStorage.setItem('waitlist_candidates', JSON.stringify(INITIAL_CANDIDATES));
    }
  }, []);

  // Save changes to localStorage helper
  const updateCandidatesList = (newList: Candidate[]) => {
    setCandidates(newList);
    localStorage.setItem('waitlist_candidates', JSON.stringify(newList));
  };

  // YEAR SEGREGATION LOGIC:
  // "접수일을 기준으로 나누되 상담내역에 그 다음 연도에 대한 상담내역이 있을 시 그 연도에 포함해서 보여주는거지."
  const getCandidatesByYear = (year: string) => {
    if (year === '전체') return candidates;
    return candidates.filter(cand => {
      // 1. Check if Registration date matches target year
      const regYear = cand.registrationDate.split('-')[0];
      if (regYear === year) return true;

      // 2. Check if ANY consultation log date falls in the target year
      const hasLogYear = cand.consultationLogs && cand.consultationLogs.some(log => {
        return log.date.split('-')[0] === year;
      });
      
      return hasLogYear;
    });
  };

  // Add or updates a candidate entry
  const handleSaveCandidate = (savedCand: Candidate) => {
    const existsIndex = candidates.findIndex(c => c.id === savedCand.id);
    let updatedList = [...candidates];
    
    if (existsIndex >= 0) {
      updatedList[existsIndex] = savedCand;
    } else {
      updatedList.push(savedCand);
    }
    
    updateCandidatesList(updatedList);
  };

  // Switch category status directly from list view
  const handleUpdateCategory = (id: string, category: CategoryType) => {
    const updatedList = candidates.map(c => {
      if (c.id === id) {
        return { ...c, category };
      }
      return c;
    });
    updateCandidatesList(updatedList);
  };

  // Delete a candidate entry instantly as requested
  const handleDeleteCandidate = (id: string) => {
    const filtered = candidates.filter(c => c.id !== id);
    updateCandidatesList(filtered);
  };

  // Mass Import handler
  const handleMassImport = (newCandidates: Candidate[]) => {
    // Append or overwrite
    const mergedList = [...candidates, ...newCandidates];
    updateCandidatesList(mergedList);
    setShowImporter(false);
  };

  // Helper to calculate last consultation log matching status
  const getLastLogMatching = (candidate: Candidate): 'O' | 'X' => {
    if (!candidate.consultationLogs || candidate.consultationLogs.length === 0) return 'X';
    const sortedLogs = [...candidate.consultationLogs].sort((a, b) => a.date.localeCompare(b.date));
    const lastLog = sortedLogs[sortedLogs.length - 1];
    if (!lastLog) return 'X';
    const text = lastLog.content || '';
    
    const hasServiceStart = text.includes('서비스 시작') || text.includes('서비스시작');
    const hasConnection = text.includes('연계'); 
    const hasOtherConnection = text.includes('타기관 연계') || text.includes('타기관연계');
    const hasReWait = text.includes('재대기');
    const hasEnd = text.includes('종결');
    const hasConfirm = text.includes('상황 확인') || text.includes('상황확인');
    const hasHope = text.includes('희망');
    
    if (hasOtherConnection || hasReWait || hasEnd || hasConfirm || hasHope) {
      return 'X';
    }
    
    if (hasServiceStart || (hasConnection && !hasOtherConnection)) {
      return 'O';
    }
    
    return 'X';
  };

  // Export to Styled Excel (.xlsx) file, center-aligned except column 15 & 16, with auto-fitting widths
  const handleExportExcel = () => {
    const listToExport = getCandidatesByYear(selectedYear);
    if (listToExport.length === 0) {
      alert('다운로드할 명단 데이터가 해당 연도에 존재하지 않습니다.');
      return;
    }

    // Precise Korean columns requested by user:
    const headers = [
      '순번', '구분', '접수일', '접수자', '성명', '생년월일', '성별', '장애유형', '급수', '국비', '도비', '시비', '주소', '연락처', '서비스내용', '추가상담', '매칭여부'
    ];

    const rows = listToExport.map((cand, idx) => {
      // Smart address combination with "OO동" inclusion rule
      const addressParts = [];
      if (cand.addressCity) addressParts.push(cand.addressCity.trim());
      if (cand.addressDistrict) addressParts.push(cand.addressDistrict.trim());
      if (cand.addressDong && cand.addressDong.trim()) {
        const tDong = cand.addressDong.trim();
        if (tDong.endsWith('동') || tDong.endsWith('읍') || tDong.endsWith('면')) {
          addressParts.push(tDong);
        }
      }
      if (cand.addressDetail) addressParts.push(cand.addressDetail.trim());
      const combinedAddress = addressParts.join(' ').replace(/\s+/g, ' ').trim();

      const serviceCombined = `${cand.serviceContent || ''}${cand.specialNotes ? `\n[특이사항]: ${cand.specialNotes}` : ''}`.trim();
      
      const logsCombined = cand.consultationLogs && cand.consultationLogs.length > 0 
        ? cand.consultationLogs.map(l => `[${l.date}] ${l.content}`).join('\r\n')
        : '상담기록 없음';

      const matchedVal = getLastLogMatching(cand);

      return [
        idx + 1,
        cand.category,
        cand.registrationDate,
        cand.registrar || '미기재',
        cand.name,
        cand.birthDate || '미기재',
        cand.gender,
        cand.disabilityType || '미지정',
        cand.disabilityGrade || '미상',
        cand.fundingNational || '-',
        cand.fundingProvincial || '-',
        cand.fundingCity || '-',
        combinedAddress || '-',
        cand.phone || '-',
        serviceCombined || '-',
        logsCombined,
        matchedVal
      ];
    });

    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Calculate columns widths based on content lengths
    const colWidths = headers.map((header, colIdx) => {
      let maxLength = 0;
      for (let i = 0; i < header.length; i++) {
        maxLength += header.charCodeAt(i) > 127 ? 2 : 1;
      }
      maxLength += 4; // Add comfortable layout buffer of 4 characters

      rows.forEach((row) => {
        const val = row[colIdx];
        if (val !== null && val !== undefined) {
          const valStr = String(val);
          let charLength = 0;
          for (let i = 0; i < valStr.length; i++) {
            charLength += valStr.charCodeAt(i) > 127 ? 2 : 1;
          }
          if (charLength > maxLength) {
            maxLength = charLength;
          }
        }
      });

      // Special wrap settings for heavy descriptive texts (Index 14: 서비스내용, Index 15: 추가상담)
      if (colIdx === 14) return { wch: 40 };
      if (colIdx === 15) return { wch: 45 };
      return { wch: Math.min(Math.max(maxLength + 2, 7), 55) };
    });
    ws['!cols'] = colWidths;

    // Apply stunning and high-craftsmanship cells alignments and styles
    for (const key in ws) {
      if (key.startsWith('!')) continue;
      const cell = ws[key];
      if (!cell) continue;

      const colLetter = key.replace(/[0-9]/g, '');
      const rowNum = parseInt(key.replace(/[^0-9]/g, ''), 10);
      const isHeader = rowNum === 1;

      let colIndex = 0;
      if (colLetter.length === 1) {
        colIndex = colLetter.charCodeAt(0) - 65;
      } else if (colLetter.length === 2) {
        colIndex = (colLetter.charCodeAt(0) - 65 + 1) * 26 + (colLetter.charCodeAt(1) - 65);
      }

      // Center all cells except: Column Index 14 (서비스내용) and 15 (추가상담)
      const isLeftAligned = colIndex === 14 || colIndex === 15;

      cell.s = {
        font: {
          name: '맑은 고딕',
          sz: isHeader ? 10.5 : 9.5,
          bold: isHeader,
          color: isHeader ? { rgb: 'FFFFFF' } : { rgb: '1E293B' }
        },
        fill: {
          fgColor: isHeader ? { rgb: '059669' } : (rowNum % 2 === 0 ? { rgb: 'F8FAFC' } : { rgb: 'FFFFFF' })
        },
        alignment: {
          horizontal: isHeader ? 'center' : (isLeftAligned ? 'left' : 'center'),
          vertical: 'center',
          wrapText: true
        },
        border: {
          top: { style: 'thin', color: { rgb: 'CBD5E1' } },
          bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
          left: { style: 'thin', color: { rgb: 'CBD5E1' } },
          right: { style: 'thin', color: { rgb: 'CBD5E1' } }
        }
      };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '이용대기명단');

    const displayYear = selectedYear === '전체' ? '전체연도' : `${selectedYear}년도`;
    const formatToday = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `이용대기명단정리_${displayYear}_${formatToday}.xlsx`);
  };

  // Clean direct native print invocation
  const handlePrint = () => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.warn('Print print failed', e);
    }
  };

  const activeCandidates = getCandidatesByYear(selectedYear);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans transition-colors antialiased">
      
      {/* APP TITLE / HEADER AREA (Hidden on print) */}
      <header className="bg-white border-b border-slate-100 shadow-sm shrink-0 print:hidden sticky top-0 z-40">
        <div className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black shadow-md shadow-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">이용대기명단 정리 프로그램</h1>
              <p className="text-xs text-slate-400 font-medium">연도별 자동 분류 · 엑셀 연동 및 인쇄 지원 시스템</p>
            </div>
          </div>

          {/* Action item buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingCandidate(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/10 hover:shadow-lg transition-all flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              신규 대기자 등록
            </button>

            <button
              onClick={() => setShowImporter(!showImporter)}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
                showImporter 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              엑셀 일괄 추가
            </button>

            <button
              onClick={handleExportExcel}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5"
              title="이용 대기 현황 인쇄"
            >
              <Download className="w-4 h-4" />
              엑셀 저장
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              대기목록 인쇄
            </button>

            <button
              type="button"
              onClick={() => {
                setConfirmDialog({
                  isOpen: true,
                  title: '전체 데이터 영구 초기화',
                  message: '⚠️ 경고: 정말로 등록된 모든 연도의 대기명단 데이터를 영구히 완전히 삭제하고 초기화하시겠습니까? 이 작업은 데이터를 완전히 지워 복구할 수 없습니다.',
                  actionText: '전체 초기화 실행',
                  isWarning: true,
                  onConfirm: () => {
                    updateCandidatesList([]);
                  }
                });
              }}
              className="px-4 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              title="로컬 데이터베이스 초기화"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              전체 리스트 초기화
            </button>
          </div>

        </div>
      </header>

      {/* DYNAMIC CONTENT CONTAINER */}
      <main className="flex-1 max-w-[1650px] w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* YEAR SELECTION TABS & LIVE STATISTICS CARDS (Hidden on print) */}
        <section className="space-y-4 print:hidden">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                분류 기준 선택 (보고 싶은 연도를 클릭하세요)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">※ 최초 접수일 기준 혹은 상담 일지가 존재할 경우 해당 연도 리스트에 통합 합산출현됩니다.</p>
            </div>
            
            {/* Year tabs */}
            <div className="flex bg-slate-200/80 p-1 rounded-xl w-full sm:w-auto shrink-0 border border-slate-100 shadow-inner">
              {['2024', '2025', '2026', '전체'].map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                    selectedYear === year
                      ? 'bg-white text-slate-900 shadow'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {year === '전체' ? '전체 연도' : `${year}년`}
                </button>
              ))}
            </div>
          </div>

          {/* Quick interactive dashboard metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5 Card">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-400 uppercase">누적 등록 명단</span>
                <span className="text-xl font-extrabold text-slate-800">{candidates.length} <span className="text-xs font-normal text-slate-500">명</span></span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5 Card">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100">
                <Grid className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-400 uppercase">대기 상태 수</span>
                <span className="text-xl font-extrabold text-slate-800">{candidates.filter(c => c.category === '대기').length} <span className="text-xs font-normal text-slate-500">명</span></span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5 Card">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                <Grid className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-400 uppercase">연계 및 조치 완료</span>
                <span className="text-xl font-extrabold text-slate-800">{candidates.filter(c => c.category === '연계').length} <span className="text-xs font-normal text-slate-500">명</span></span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-50 shrink-0 shadow-sm flex items-center justify-between Card">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow shadow-emerald-500/10">
                  {selectedYear === '전체' ? 'ALL' : selectedYear}
                </div>
                <div>
                  <span className="block text-[11px] font-bold text-slate-400 uppercase">{selectedYear === '전체' ? '전체 리스트' : `${selectedYear}년도 결과`}</span>
                  <span className="text-xl font-black text-emerald-700">{activeCandidates.length} <span className="text-xs font-normal text-slate-500">명</span></span>
                </div>
              </div>
            </div>

          </div>

        </section>

        {/* EXCEL/CSV IMPORTER TAB (Hidden on print) */}
        <AnimatePresence>
          {showImporter && (
            <motion.section
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden print:hidden"
            >
              <ExcelImporter onImport={handleMassImport} />
            </motion.section>
          )}
        </AnimatePresence>

        {/* PRINT ONLY HEADER DESIGN */}
        <div className="hidden print:block mb-8 border-b-2 border-slate-850 pb-4 text-center">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 border-b border-double border-slate-500 pb-2 mb-2">
            이용대기명단 대장 및 통계대장
          </h1>
          <div className="flex justify-between items-center text-xs text-slate-600 font-medium px-2">
            <div>
              <span>기준 연도: <strong>{selectedYear === '전체' ? '전개 연도 합산' : `${selectedYear}년도`}</strong></span>
              <span className="ml-4">출력 일자: <strong>{new Date().toISOString().split('T')[0]}</strong></span>
            </div>
            <div>
              <span>총계: <strong>{activeCandidates.length}명</strong> (대기 {activeCandidates.filter(c => c.category === '대기').length}명, 보류 {activeCandidates.filter(c => c.category === '보류').length}명, 연계 {activeCandidates.filter(c => c.category === '연계').length}명, 삭제 {activeCandidates.filter(c => c.category === '삭제').length}명)</span>
            </div>
          </div>
        </div>

        {/* MAIN RESULTS SHEET CONTAINER */}
        <section className="space-y-4">
          <div className="flex items-center justify-between print:hidden">
            <h3 className="text-sm font-bold text-slate-600 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full inline-block" />
              {selectedYear === '전체' ? '전체 이용대기자 상세명부' : `${selectedYear}년도 이용대기자 상세명부`}
            </h3>
            <span className="text-xs font-medium text-slate-400">
              필터링 완료: <strong>{activeCandidates.length}</strong> 명
            </span>
          </div>

          <CandidateTable
            candidates={activeCandidates}
            onSelect={(cand) => {
              setEditingCandidate(cand);
              setIsModalOpen(true);
            }}
            onUpdateCategory={handleUpdateCategory}
            onDelete={handleDeleteCandidate}
            selectedYear={selectedYear}
          />
        </section>

      </main>

      {/* FOOTER (Hidden on print) */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400 print:hidden mt-auto">
        <div className="max-w-[1650px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 복지 기관 이용대기명단 관리 센터. All rights reserved.</p>
          <div className="flex gap-4 text-slate-400">
            <span>로컬 데이터 상시 세이브 저장됨</span>
            <span>•</span>
            <span>크롬 브라우저 최적화</span>
          </div>
        </div>
      </footer>

      {/* CRUD MODAL FOR VIEWING AND WRITING LOGS / UPDATES */}
      <CandidateDetailModal
        candidate={editingCandidate}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCandidate(null);
        }}
        onSave={handleSaveCandidate}
        onDelete={handleDeleteCandidate}
      />

      {/* PERFECT CUSTOM IN-APP CONFIRMATION DIALOG */}
      <AnimatePresence>
        {confirmDialog && confirmDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden z-50"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto border border-rose-100">
                  <AlertTriangle className="w-6 h-6 shrink-0" />
                </div>
                
                <h3 className="text-base font-black text-slate-800">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  {confirmDialog.message}
                </p>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDialog(null)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      confirmDialog.onConfirm();
                      setConfirmDialog(null);
                    }}
                    className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/10 cursor-pointer"
                  >
                    {confirmDialog.actionText || '삭제 실행'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
