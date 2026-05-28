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
  selectedYear
}: CandidateTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'전체' | CategoryType>('전체');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
      cand.name.toLowerCase().includes(term) ||
      cand.registrar.toLowerCase().includes(term) ||
      cand.phone.includes(term) ||
      cand.disabilityType.toLowerCase().includes(term) ||
      cand.disabilityGrade.toLowerCase().includes(term) ||
      combinedAddress.includes(term) ||
      serviceNotesCombined.includes(term) ||
      fundingMatch ||
      cand.remarks.toLowerCase().includes(term)
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
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.warn('Print print failed', e);
    }
  };

  const toggleSort = (type: 'date' | 'name' | 'category') => {
    if (sortBy === type) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortOrder('desc');
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
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse text-left text-[11px] min-w-[1100px] print:min-w-full">
          <thead>
            {/* Headers */}
            <tr className="bg-slate-50/85 text-slate-600 border-b border-rose-100 font-bold print:bg-white text-[11px] whitespace-nowrap">
              <th className="py-2.5 px-1 text-center w-10 font-mono align-middle">순번</th>
              <th className="py-2.5 px-1.5 text-center w-16 cursor-pointer hover:bg-slate-100 transition-colors print:hover:bg-white align-middle" onClick={() => toggleSort('category')}>
                <div className="flex items-center justify-center gap-1">
                  구분
                  <ArrowUpDown className="w-3 h-3 text-slate-400 print:hidden" />
                </div>
              </th>
              <th className="py-2.5 px-1.5 text-center w-24 cursor-pointer hover:bg-slate-100 transition-colors print:hover:bg-white align-middle animate-pulse-subtle" onClick={() => toggleSort('date')}>
                <div className="flex items-center justify-center gap-1">
                  접수일
                  <ArrowUpDown className="w-3 h-3 text-slate-400 print:hidden" />
                </div>
              </th>
              <th className="py-2.5 px-1.5 text-center w-16 align-middle">접수자</th>
              <th className="py-2.5 px-1.5 text-center w-20 cursor-pointer hover:bg-slate-100 transition-colors print:hover:bg-white align-middle" onClick={() => toggleSort('name')}>
                <div className="flex items-center justify-center gap-1">
                  성명
                  <ArrowUpDown className="w-3 h-3 text-slate-400 print:hidden" />
                </div>
              </th>
              <th className="py-2.5 px-1.5 text-center w-20 align-middle font-mono">생년월일</th>
              <th className="py-2.5 px-1 align-middle text-center w-10">성별</th>
              <th className="py-2.5 px-1.5 w-32 align-middle">장애유형 / 급수</th>
              <th className="py-2.5 px-1 text-center w-12 align-middle text-emerald-800">국비</th>
              <th className="py-2.5 px-1 text-center w-12 align-middle text-sky-800">도비</th>
              <th className="py-2.5 px-1 text-center w-12 align-middle text-purple-800">시비</th>
              <th className="py-2.5 px-2 w-48 align-middle">주소</th>
              <th className="py-2.5 px-1.5 w-24 align-middle">연락처</th>
              <th className="py-2.5 px-2 w-56 align-middle">서비스 내용 (*특이사항)</th>
              <th className="py-2.5 px-2 w-56 align-middle">추가상담</th>
              <th className="py-2.5 px-1.5 text-center w-16 align-middle">매칭여부</th>
              <th className="py-2.5 px-1.5 text-center w-24 print:hidden align-middle">관리액션</th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-slate-100">
            {sortedCandidates.length > 0 ? (
              sortedCandidates.map((cand, idx) => {
                // Combine address dynamically
                const fullAddress = `${cand.addressCity} ${cand.addressDistrict} ${cand.addressDong} ${cand.addressDetail}`.replace(/\s+/g, ' ').trim();
                const matchedVal = getLastLogMatching(cand);

                return (
                  <tr 
                    key={cand.id} 
                    className="hover:bg-slate-50/70 transition-colors group print:hover:bg-white hover:shadow-inner"
                  >
                    
                    {/* Render sequence count (1-based index) */}
                    <td className="py-2.5 px-1 text-center font-bold text-slate-400 font-mono align-middle">
                      {idx + 1}
                    </td>

                    {/* Category Column (Interactive Dropdown Select) */}
                    <td className="py-2 px-1.5 text-center align-middle print:py-2">
                      <div className="print:hidden">
                        <select
                          value={cand.category}
                          onChange={(e) => onUpdateCategory(cand.id, e.target.value as CategoryType)}
                          className={`inline-block px-2 py-0.5 text-[11px] font-extrabold rounded-lg cursor-pointer transition-all border outline-none font-sans text-center ${
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
                      <div className="hidden print:block font-extrabold text-[11px] text-center">
                        {cand.category}
                      </div>
                    </td>

                    {/* Registration Date */}
                    <td className="py-2.5 px-1.5 text-center text-slate-500 font-medium whitespace-nowrap align-middle">
                      {cand.registrationDate}
                    </td>

                    {/* Registrar */}
                    <td className="py-2.5 px-1.5 text-center font-medium text-slate-700 whitespace-nowrap align-middle">
                      {cand.registrar || '미지정'}
                    </td>

                    {/* Client Name */}
                    <td className="py-2.5 px-1.5 text-center font-bold text-slate-900 whitespace-nowrap align-middle">
                      {cand.name}
                    </td>

                    {/* Birthdate */}
                    <td className="py-2.5 px-1.5 text-center text-slate-500 font-mono whitespace-nowrap align-middle">
                      {cand.birthDate || '미상'}
                    </td>

                    {/* Gender */}
                    <td className="py-2.5 px-1 text-center align-middle">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        cand.gender === '남' ? 'bg-sky-50 text-sky-600' :
                        cand.gender === '여' ? 'bg-pink-50 text-pink-600' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {cand.gender}
                      </span>
                    </td>

                    {/* Disability type & Grade */}
                    <td className="py-2.5 px-1.5 align-middle">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 whitespace-nowrap">{cand.disabilityType || '미지정'}</span>
                        {cand.disabilityGrade && (
                          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{cand.disabilityGrade}</span>
                        )}
                      </div>
                    </td>

                    {/* Funding indicators / Numerical values */}
                    <td className="py-2.5 px-1 text-center align-middle font-semibold text-slate-600">
                      {cand.fundingNational ? (
                        <span className="inline-block text-emerald-700 font-extrabold text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 whitespace-nowrap">
                          {cand.fundingNational}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-1 text-center align-middle font-semibold text-slate-600">
                      {cand.fundingProvincial ? (
                        <span className="inline-block text-sky-700 font-extrabold text-[11px] bg-sky-50 px-2 py-0.5 rounded border border-sky-100 whitespace-nowrap">
                          {cand.fundingProvincial}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-1 text-center align-middle font-semibold text-slate-600">
                      {cand.fundingCity ? (
                        <span className="inline-block text-purple-700 font-extrabold text-[11px] bg-purple-50 px-2 py-0.5 rounded border border-purple-100 whitespace-nowrap">
                          {cand.fundingCity}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Address Column */}
                    <td className="py-2.5 px-2 text-slate-600 leading-normal max-w-[190px] align-middle">
                      <div className="flex gap-1 items-start">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5 print:hidden" />
                        <span className="break-all leading-tight">
                          {(() => {
                            const parts = [];
                            if (cand.addressCity) parts.push(cand.addressCity.trim());
                            if (cand.addressDistrict) parts.push(cand.addressDistrict.trim());
                            if (cand.addressDong && cand.addressDong.trim()) {
                              const tdong = cand.addressDong.trim();
                              if (tdong.endsWith('동') || tdong.endsWith('읍') || tdong.endsWith('면')) {
                                parts.push(tdong);
                              }
                            }
                            if (cand.addressDetail) parts.push(cand.addressDetail.trim());
                            return parts.join(' ').replace(/\s+/g, ' ').trim() || '시/도 상세 주소 없음';
                          })()}
                        </span>
                      </div>
                    </td>

                    {/* Phone Column */}
                    <td className="py-2.5 px-1.5 text-slate-700 font-semibold font-mono whitespace-nowrap align-middle">
                      {cand.phone ? (
                        <div className="flex gap-1 items-center">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0 print:hidden" />
                          <span>{cand.phone}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Combined Service description & Special notes */}
                    <td className="py-2.5 px-2 max-w-[220px] leading-snug align-middle">
                      <div className="space-y-1">
                        {cand.serviceContent ? (
                          <div className="text-slate-700 font-medium whitespace-pre-wrap break-all">
                            {cand.serviceContent}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                        {cand.specialNotes && (
                          <div className="text-[10px] text-rose-600 bg-rose-50/50 p-1 rounded border border-rose-100/40 break-all whitespace-pre-wrap">
                            <strong>*특이사항:</strong> {cand.specialNotes}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Additional logs */}
                    <td className="py-2.5 px-2 max-w-[220px] leading-snug align-middle">
                      {cand.consultationLogs && cand.consultationLogs.length > 0 ? (
                        <div className="space-y-1.5">
                          {cand.consultationLogs.slice(0, 3).map((log) => {
                            // Highlight log if it triggers the selectedYear
                            const isYearTrigger = selectedYear !== '전체' && log.date.startsWith(selectedYear);
                            return (
                              <div 
                                key={log.id} 
                                className={`text-[10px] border-l-2 pl-1.5 transition-all ${
                                  isYearTrigger 
                                    ? 'border-emerald-500 text-emerald-900 bg-emerald-50/50 p-1 rounded-r-lg' 
                                    : 'border-slate-200 text-slate-500'
                                }`}
                              >
                                <span className="font-bold text-[9px] block mb-0.5">{log.date}</span>
                                <span className="line-clamp-2 leading-tight break-all whitespace-pre-wrap">{log.content}</span>
                              </div>
                            );
                          })}
                          {cand.consultationLogs.length > 3 && (
                            <span className="text-[9px] text-slate-400 font-bold block mt-0.5 hover:text-emerald-600 cursor-pointer print:hidden" onClick={() => onSelect(cand)}>
                              외 {cand.consultationLogs.length - 3}개 이력 더보기 →
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-[10px] whitespace-nowrap">상담 이력 없음</span>
                      )}
                    </td>

                    {/* Matching status O/X column */}
                    <td className="py-2.5 px-1.5 text-center align-middle">
                      <span className={`inline-block px-2 py-0.5 text-xs font-black rounded-lg border-2 ${
                        matchedVal === 'O' 
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      }`}>
                        {matchedVal}
                      </span>
                    </td>

                    {/* Quick CRUD action items (Hidden in Print) */}
                    <td className="py-2.5 px-1.5 text-center print:hidden align-middle">
                      <div className="flex flex-row items-center justify-center flex-nowrap whitespace-nowrap gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onSelect(cand)}
                          className="px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-150 hover:bg-emerald-600 hover:text-white rounded-md transition-all flex items-center gap-0.5 cursor-pointer"
                          title="상담 관리 및 수정"
                        >
                          <Edit className="w-2.5 h-2.5" />
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(cand.id)}
                          className="px-2 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-150 hover:bg-rose-600 hover:text-white rounded-md transition-all flex items-center gap-0.5 cursor-pointer"
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
                <td colSpan={17} className="py-12 bg-white text-center text-slate-400 font-medium">
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
