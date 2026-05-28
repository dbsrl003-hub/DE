/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Candidate, CategoryType } from '../types';
import { Eye, Edit, Trash, Plus, Search, MapPin, Phone, HelpCircle, ArrowUpDown, ChevronDown, Check, ArrowUpRight, Printer } from 'lucide-react';
import { motion } from 'motion/react';

interface CandidateTableProps {
  candidates: Candidate[];
  onSelect: (cand: Candidate) => void;
  onUpdateCategory: (id: string, category: CategoryType) => void;
  onDelete: (id: string) => void;
  selectedYear: string;
  onPrintTrigger?: () => void;
}

// Helper to evaluate matching status based on keywords from the last consultation log
const getLastLogMatching = (candidate: Candidate): 'O' | 'X' => {
  if (!candidate.consultationLogs || candidate.consultationLogs.length === 0) return 'X';
  // Sort logs by date ascending to find the absolute last one
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

export default function CandidateTable({
  candidates,
  onSelect,
  onUpdateCategory,
  onDelete,
  selectedYear,
  onPrintTrigger
}: CandidateTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'전체' | CategoryType>('전체');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Drag-to-scroll anywhere horizontal scroll handlers
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'SELECT' || 
      target.tagName === 'INPUT' || 
      target.tagName === 'BUTTON' || 
      target.closest('button') ||
      target.closest('select') ||
      target.closest('input')
    ) {
      return;
    }
    const container = scrollRef.current;
    if (!container) return;
    setIsDragging(true);
    setStartX(e.pageX - container.offsetLeft);
    setScrollLeft(container.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const container = scrollRef.current;
    if (!container) return;
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5;
    container.scrollLeft = scrollLeft - walk;
  };

  // Split phone numbers on whitespace or standard delimiters when multiple exist
  const formatPhoneNumbers = (phoneStr: string) => {
    if (!phoneStr) return [];
    // Pattern to match Korean phone sequence possibly with parenthesized annotations: 
    // e.g., "010-1234-5678 (남동생)" or "010-5321-9999(사회복지사)"
    const phonePattern = /01[0-9]-\d{3,4}-\d{4}(?:\s*\([^)]+\))?/gi;
    const matches = phoneStr.match(phonePattern);
    if (matches && matches.length > 0) {
      return matches.map(m => m.trim());
    }
    // fallback for items without standard phone format
    return phoneStr.split(/[\n,;]/).map(p => p.trim()).filter(Boolean);
  };

  // Multi-column search implementation
  const filteredCandidates = candidates.filter(cand => {
    // Category filter
    if (categoryFilter !== '전체' && cand.category !== categoryFilter) {
      return false;
    }

    // Text search
    const term = searchTerm.toLowerCase();
    if (!term) return true;

    // Treat funding as search targets as well since they are now strings!
    const fundingMatch = (
      (cand.fundingNational && cand.fundingNational.toLowerCase().includes(term)) ||
      (cand.fundingProvincial && cand.fundingProvincial.toLowerCase().includes(term)) ||
      (cand.fundingCity && cand.fundingCity.toLowerCase().includes(term))
    );

    // Combine address with smart "OO동" inclusion logic
    const addressParts = [];
    if (cand.addressCity) addressParts.push(cand.addressCity.trim());
    if (cand.addressDistrict) addressParts.push(cand.addressDistrict.trim());
    if (cand.addressDong && cand.addressDong.trim()) {
      const trimmedDong = cand.addressDong.trim();
      if (trimmedDong.endsWith('동') || trimmedDong.endsWith('읍') || trimmedDong.endsWith('면')) {
        addressParts.push(trimmedDong);
      }
    }
    if (cand.addressDetail) addressParts.push(cand.addressDetail.trim());
    const combinedAddress = addressParts.join(' ').toLowerCase();

    const serviceNotesCombined = `${cand.serviceContent} ${cand.specialNotes}`.toLowerCase();
    
    return (
      (cand.name || '').toLowerCase().includes(term) ||
      (cand.registrar || '').toLowerCase().includes(term) ||
      (cand.phone || '').includes(term) ||
      (cand.disabilityType || '').toLowerCase().includes(term) ||
      (cand.disabilityGrade || '').toLowerCase().includes(term) ||
      combinedAddress.includes(term) ||
      serviceNotesCombined.includes(term) ||
      fundingMatch ||
      (cand.remarks || '').toLowerCase().includes(term)
    );
  });

  // Sort candidates
  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    let checkA = '';
    let checkB = '';

    if (sortBy === 'date') {
      checkA = a.registrationDate;
      checkB = b.registrationDate;
    } else if (sortBy === 'name') {
      checkA = a.name;
      checkB = b.name;
    } else if (sortBy === 'category') {
      checkA = a.category;
      checkB = b.category;
    }

    if (sortOrder === 'asc') {
      return checkA.localeCompare(checkB);
    } else {
      return checkB.localeCompare(checkA);
    }
  });

  const handleDirectPrint = () => {
    if (onPrintTrigger) {
      onPrintTrigger();
    } else {
      try {
        window.focus();
        window.print();
      } catch (e) {
        console.warn('Print print failed', e);
      }
    }
  };

  const toggleSort = (type: 'date' | 'name' | 'category') => {
    if (sortBy === type) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortOrder('asc');
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-100 shadow-xl overflow-hidden print:shadow-none print:border-none">
      
      {/* Search & Filter Header (Hidden in Print) */}
      <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 justify-between items-center bg-slate-50/50 print:hidden">
        
        {/* Left Side: Category filtering tabs & Contextual Print Button */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto shrink-0">
            {(['전체', '대기', '삭제', '보류', '연계'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {cat}
                {cat !== '전체' && (
                  <span className={`ml-1 px-1 rounded text-[10px] ${
                    cat === '대기' ? 'bg-orange-50 text-orange-600' :
                    cat === '삭제' ? 'bg-rose-50 text-rose-600' :
                    cat === '보류' ? 'bg-amber-50 text-amber-600' :
                    'bg-emerald-50 text-emerald-600'
                  }`}>
                    {candidates.filter(c => c.category === cat).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleDirectPrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border border-slate-200 shadow-sm"
            title="현재 선택한 분류 및 필터 기준으로 출력물을 인쇄합니다."
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>선택 목록 인쇄</span>
          </button>
        </div>

        {/* Right Side: Search Input with helper indicators */}
        <div className="relative w-full md:max-w-md flex items-center">
          <span className="absolute left-3.5 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            className="w-full text-xs pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm transition-all text-slate-800 placeholder-slate-400"
            placeholder="성명, 연락처, 주소, 장애유형, 재원수치 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 text-xs text-slate-400 hover:text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded cursor-pointer"
            >
              초기화
            </button>
          )}
        </div>

      </div>

      {/* Main Table Area */}
      <div 
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className={`overflow-auto select-none print:overflow-visible transition-all duration-150 border border-slate-100 rounded-xl shadow-inner scrollbar-thin scrollbar-thumb-slate-200 ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        } max-h-[72vh]`}
        title="마우스로 클릭 후 드래그하여 가로 방향으로 편리하게 스크롤 하실 수 있습니다."
      >
        <table className="w-full border-collapse text-left text-[11px] min-w-[1125px] table-fixed print:min-w-full print:table-auto">
          <thead>
            {/* Headers */}
            <tr className="bg-slate-100/90 text-slate-705 border-b border-rose-100 font-bold print:bg-white text-[11px] whitespace-nowrap sticky top-0 z-10 shadow-sm">
              <th className="py-3 px-3 text-left w-[440px] align-middle">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-slate-700 font-black">순번, 인적사항 / 재원·주소·연락처</span>
                  <div className="flex items-center gap-1.5 print:hidden mr-2">
                    <span className="text-[10px] text-slate-400 font-bold">정렬:</span>
                    <button
                      onClick={() => toggleSort('date')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all flex items-center gap-0.5 cursor-pointer ${
                        sortBy === 'date'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-black'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      접수일{sortBy === 'date' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </button>
                    <button
                      onClick={() => toggleSort('name')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all flex items-center gap-0.5 cursor-pointer ${
                        sortBy === 'name'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-black'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      성명{sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </button>
                    <button
                      onClick={() => toggleSort('category')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all flex items-center gap-0.5 cursor-pointer ${
                        sortBy === 'category'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-black'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      구분{sortBy === 'category' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </button>
                  </div>
                </div>
              </th>
              <th className="py-3 px-3 w-[240px] align-middle text-left font-black text-slate-700">서비스 내용 (*특이사항)</th>
              <th className="py-3 px-3 w-[280px] align-middle text-left font-black text-slate-700">추가상담 (전체 이력)</th>
              <th className="py-3 px-2 text-center w-[65px] align-middle font-black text-slate-700">매칭여부</th>
              <th className="py-3 px-2 text-center w-[100px] print:hidden align-middle font-black text-slate-700">관리액션</th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-slate-300">
            {sortedCandidates.length > 0 ? (
              sortedCandidates.map((cand, idx) => {
                const matchedVal = getLastLogMatching(cand);

                return (
                  <tr 
                    key={cand.id} 
                    className="hover:bg-slate-50/50 transition-colors group print:hover:bg-white border-b border-slate-300/90"
                  >
                    
                    {/* Aligned Left Block (Sequence, dropdown, registrar, basic card, sub-card layout) */}
                    <td className="py-3 px-3 align-top w-[440px]">
                      
                      {/* Top Bar basic details */}
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 py-1 px-1 bg-white/40 rounded-t-lg text-[11px] w-full">
                        {/* Sequence */}
                        <span className="text-slate-400 font-mono font-bold text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded px-1.5 py-0.5 rounded-md min-w-[20px] text-center shrink-0">
                          {idx + 1}
                        </span>

                        {/* Category Dropdown Selection */}
                        <div className="shrink-0 print:hidden">
                          <select
                            value={cand.category}
                            onChange={(e) => onUpdateCategory(cand.id, e.target.value as CategoryType)}
                            className={`inline-block px-1.5 py-0.5 text-[10px] font-black rounded cursor-pointer transition-all border outline-none font-sans text-center ${
                              cand.category === '대기' ? 'bg-orange-50 text-orange-600 border-orange-200 focus:ring-1 focus:ring-orange-400' :
                              cand.category === '삭제' ? 'bg-rose-50 text-rose-600 border-rose-200 focus:ring-1 focus:ring-rose-400' :
                              cand.category === '보류' ? 'bg-amber-50 text-amber-600 border-amber-200 focus:ring-1 focus:ring-amber-400' :
                              'bg-emerald-50 text-emerald-600 border-emerald-200 focus:ring-1 focus:ring-emerald-400'
                            }`}
                          >
                            <option value="대기">대기</option>
                            <option value="보류">보류</option>
                            <option value="연계">연계</option>
                            <option value="삭제">삭제</option>
                          </select>
                        </div>
                        <div className="hidden print:block font-extrabold text-[11px] bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded text-center shrink-0">
                          {cand.category}
                        </div>

                        {/* Client Name */}
                        <span className="text-slate-900 font-extrabold text-[12.5px] whitespace-nowrap px-2 py-0.5 shrink-0 bg-emerald-50/70 rounded-md border border-emerald-200/50">
                          {cand.name}
                        </span>

                        {/* Birthdate */}
                        {cand.birthDate ? (
                          <span className="text-slate-600 font-mono text-[10.5px] whitespace-nowrap bg-slate-100/60 px-2 py-0.5 rounded border border-slate-200/40 shrink-0 font-medium">
                            {cand.birthDate}
                          </span>
                        ) : (
                          <span className="text-slate-400/30 font-mono text-[10.5px] px-2 py-0.5 shrink-0 select-none">
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                          </span>
                        )}

                        {/* Gender */}
                        <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold shrink-0 ${
                          cand.gender === '남' ? 'bg-sky-50 text-sky-600 border border-sky-100' :
                          cand.gender === '여' ? 'bg-pink-50 text-pink-600 border border-pink-100' :
                          'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {cand.gender}
                        </span>

                        {/* Disability type & Grade */}
                        <div className="flex items-center gap-1 bg-violet-50/70 border border-violet-100 px-2 py-0.5 rounded-md shrink-0">
                          <span className="font-extrabold text-violet-950 text-[10.5px]">{cand.disabilityType || '미지정'}</span>
                          {cand.disabilityGrade && cand.disabilityGrade !== '미분류' && cand.disabilityGrade !== '미지정' && (
                            <span className="text-[9.5px] text-violet-700 font-bold bg-white border border-violet-200/50 px-1 py-0.2 rounded">
                              {cand.disabilityGrade}
                            </span>
                          )}
                        </div>

                        {/* Registrar with receipt date at the end */}
                        <span className="text-slate-500 font-semibold text-[10px] whitespace-nowrap bg-slate-100 border border-slate-200/50 px-2 py-0.5 rounded-md shrink-0 sm:ml-auto">
                          접수: {cand.registrar || '미지정'} ({cand.registrationDate})
                        </span>
                      </div>

                      {/* Compact Sub-Grid matching the 2nd mockup screenshot exactly (국비, 도비, 시비, 주소, 연락처) */}
                      <div className="mt-2 bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 shadow-sm">
                        {/* Small Table Header Row */}
                        <div className="flex items-center text-[10px] text-slate-400 font-bold border-b border-slate-200 pb-1 mb-1 bg-slate-100/40 -mx-2.5 px-2.5 rounded-t-xl">
                          <div className="w-[100px] flex gap-1 justify-center shrink-0">
                            <span className="text-emerald-800">국비</span>
                            <span className="text-sky-800">도비</span>
                            <span className="text-purple-800">시비</span>
                          </div>
                          <div className="flex-1 pl-3 text-slate-500 text-left">주소</div>
                          <div className="w-[110px] pl-2 text-slate-500 text-left shrink-0">연락처</div>
                        </div>
                        
                        {/* Small Table Data Row */}
                        <div className="flex items-start">
                          {/* Funding Values Side by Side */}
                          <div className="w-[100px] flex gap-1.5 justify-center items-center pt-1 shrink-0">
                            {cand.fundingNational ? (
                              <span className="text-[9px] font-black bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded border border-emerald-150 leading-none">
                                {cand.fundingNational}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-mono text-[9px]">-</span>
                            )}
                            {cand.fundingProvincial ? (
                              <span className="text-[9px] font-black bg-sky-50 text-sky-700 px-1 py-0.5 rounded border border-sky-150 leading-none">
                                {cand.fundingProvincial}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-mono text-[9px]">-</span>
                            )}
                            {cand.fundingCity ? (
                              <span className="text-[9px] font-black bg-purple-50 text-purple-700 px-1 py-0.5 rounded border border-purple-150 leading-none">
                                {cand.fundingCity}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-mono text-[9px]">-</span>
                            )}
                          </div>

                          {/* Address Block */}
                          <div className="flex-1 pl-3 text-left">
                            <div className="flex gap-1 items-start text-[11px] text-slate-705 leading-normal">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5 print:hidden" />
                              <span className="keep-all break-keep whitespace-normal leading-relaxed text-[11px] font-medium text-slate-800">
                                {(() => {
                                  const parts = [];
                                  if (cand.addressCity) parts.push(cand.addressCity.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim());
                                  if (cand.addressDistrict) parts.push(cand.addressDistrict.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim());
                                  if (cand.addressDong && cand.addressDong.trim()) {
                                    parts.push(cand.addressDong.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim());
                                  }
                                  if (cand.addressDetail) parts.push(cand.addressDetail.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim());
                                  return parts.join(' ').replace(/\s+/g, ' ').trim() || '시/도 상세 주소 없음';
                                })()}
                              </span>
                            </div>
                          </div>

                          {/* Contact */}
                          <div className="w-[110px] pl-2 text-left shrink-0">
                            {(() => {
                              const parsedPhones = formatPhoneNumbers(cand.phone);
                              if (parsedPhones.length > 0) {
                                return (
                                  <div className="flex flex-col gap-1 w-full text-[10px]">
                                    {parsedPhones.map((phone, pIdx) => (
                                      <div key={pIdx} className="flex gap-1 px-1.5 py-0.5 bg-slate-100/90 border border-slate-200/60 rounded text-slate-800 items-center justify-start shrink-0">
                                        <Phone className="w-2 h-2 text-slate-400 shrink-0" />
                                        <span className="text-[9px] font-mono leading-tight whitespace-normal font-bold">{phone}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              return <span className="text-slate-300 text-[10px]">-</span>;
                            })()}
                          </div>
                        </div>
                      </div>

                    </td>

                    {/* Combined Service description & Special notes (Fully visible with elegant larger size text-[13px]) */}
                    <td className="py-3 px-3 leading-relaxed align-top w-[240px] text-[13px]">
                      <div className="space-y-2">
                        {cand.serviceContent ? (
                          <div className="text-slate-800 font-medium whitespace-pre-wrap break-all leading-relaxed text-[13px]">
                            {cand.serviceContent}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                        {cand.specialNotes && (
                          <div className="text-[11.5px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-2.5 break-all whitespace-pre-wrap leading-normal shadow-sm">
                            <strong className="font-semibold">*특이사항:</strong> {cand.specialNotes}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Additional logs (Fully rendered by Date Ascending - 위에서 밑으로 흘러감 with larger base size) */}
                    <td className="py-3 px-3 leading-relaxed align-top w-[280px] text-[13px]">
                      {cand.consultationLogs && cand.consultationLogs.length > 0 ? (
                        <div className="space-y-2.5">
                          {[...cand.consultationLogs]
                            .sort((a, b) => a.date.localeCompare(b.date))
                            .map((log) => {
                              const isYearTrigger = selectedYear !== '전체' && log.date.startsWith(selectedYear);
                              return (
                                <div 
                                  key={log.id} 
                                  className={`text-[12.5px] border-l-2 pl-2.5 py-1 transition-all leading-relaxed ${
                                    isYearTrigger 
                                      ? 'border-emerald-500 text-emerald-990 bg-emerald-50/60 p-1.5 rounded-r-lg font-semibold' 
                                      : 'border-slate-300 text-slate-750 hover:border-emerald-300'
                                  }`}
                                >
                                  <span className="font-bold text-[10px] text-slate-400 block mb-0.5">{log.date}</span>
                                  <span className="break-all whitespace-pre-wrap leading-relaxed">{log.content}</span>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-[11px] whitespace-nowrap">상담 이력 없음</span>
                      )}
                    </td>

                    {/* Matching status O/X column */}
                    <td className="py-3 px-2 text-center align-top w-[65px]">
                      <div className="pt-2">
                        <span className={`inline-block px-2 py-0.5 text-xs font-black rounded-lg border-2 ${
                          matchedVal === 'O' 
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        }`}>
                          {matchedVal}
                        </span>
                      </div>
                    </td>

                    {/* Quick CRUD action items (Hidden in Print) */}
                    <td className="py-3 px-2 text-center print:hidden align-top w-[100px]">
                      <div className="pt-2 flex flex-col items-center justify-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                           type="button"
                           onClick={() => onSelect(cand)}
                           className="w-full px-2 py-1 text-[10px] font-bold text-emerald-750 bg-emerald-50 border border-emerald-150 hover:bg-emerald-600 hover:text-white rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                           title="상담 관리 및 수정"
                        >
                          <Edit className="w-2.5 h-2.5" />
                          수정
                        </button>
                        <button
                           type="button"
                           onClick={() => onDelete(cand.id)}
                           className="w-full px-2 py-1 text-[10px] font-bold text-rose-750 bg-rose-50 border border-rose-150 hover:bg-rose-600 hover:text-white rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                           title="영구 삭제"
                        >
                          <Trash className="w-2.5 h-2.5" />
                          삭제
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-12 bg-white text-center text-slate-400 font-medium">
                  {searchTerm ? '검색 필터와 완벽 매칭된 접수자가 부재합니다.' : '해당 필터 조건에 응답하는 이용대기자가 등록되지 않았습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Footer showing total list status information */}
      <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center print:hidden gap-2">
        <div>
          전체 이용대기명단 분류: 총 <span className="text-slate-800 font-semibold">{filteredCandidates.length}명</span>의 이용자가 나열 중입니다.
        </div>
        <div className="flex gap-4">
          <span className="flex items-center gap-1">• <span className="font-bold text-orange-600">대기</span>: {candidates.filter(c => c.category === '대기').length}명</span>
          <span className="flex items-center gap-1">• <span className="font-bold text-amber-600">보류</span>: {candidates.filter(c => c.category === '보류').length}명</span>
          <span className="flex items-center gap-1">• <span className="font-bold text-rose-600">삭제</span>: {candidates.filter(c => c.category === '삭제').length}명</span>
          <span className="flex items-center gap-1">• <span className="font-bold text-emerald-600">연계</span>: {candidates.filter(c => c.category === '연계').length}명</span>
        </div>
      </div>

    </div>
  );
}
