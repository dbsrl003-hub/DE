/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CategoryType = '대기' | '삭제' | '보류' | '연계';

export interface ConsultationLog {
  id: string; // unique ID for log entry
  date: string; // YYYY-MM-DD
  content: string; // 상담 내용
}

export interface Candidate {
  id: string;
  category: CategoryType; // 구분 (대기, 삭제, 보류, 연계)
  registrationDate: string; // 최초접수일 (YYYY-MM-DD)
  registrar: string; // 접수자
  name: string; // 이용자성명
  birthDate: string; // 생년월일 (YYYY-MM-DD or custom text like "1990-05-15")
  gender: '남' | '여' | '기타'; // 성별
  disabilityType: string; // 장애유형
  disabilityGrade: string; // 급수
  complexDisability: boolean; // 복합장애 여부
  fundingNational: string; // 국비 (예: 120)
  fundingProvincial: string; // 도비 (예: 120)
  fundingCity: string; // 시비 (예: 120)
  
  // Address fields (to be combined dynamically in UI)
  addressCity: string; // 시 (ex: 수원시, 서울시)
  addressDistrict: string; // 구 (ex: 영통구, 강남구)
  addressDong: string; // 동 (ex: 매탄동, 삼성동)
  addressDetail: string; // 세부주소 (ex: OO로 111번길)
  
  phone: string; // 연락처
  
  serviceContent: string; // 서비스내용
  specialNotes: string; // 특이사항
  
  consultationLogs: ConsultationLog[]; // 추가 상담 내역 (상담내역 포함)
  remarks: string; // 비고
}
