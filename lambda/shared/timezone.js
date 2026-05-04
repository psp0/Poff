/**
 * 타임존 유틸리티 모듈
 * 
 * 모든 시간 처리를 UTC 기준으로 하되, KST 변환이 필요한 경우 명시적으로 처리
 * 
 * Best Practice:
 * 1. 서버/Lambda에서는 항상 UTC로 처리
 * 2. KST가 필요한 경우 이 모듈의 함수 사용
 * 3. DB 저장은 항상 UTC
 * 4. 프론트엔드 표시용으로만 KST 변환
 */

// KST offset: UTC + 9시간
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KST_OFFSET_HOURS = 9;

/**
 * 현재 UTC 타임스탬프 반환
 * @returns {number} UTC 타임스탬프 (밀리초)
 */
function getUtcTimestamp() {
  return Date.now();
}

/**
 * 현재 시간을 UTC Date 객체로 반환
 * @returns {Date} UTC Date 객체
 */
function getUtcNow() {
  return new Date();
}

/**
 * UTC 타임스탬프를 KST Date로 변환
 * 주의: 반환된 Date의 getHours(), getDate() 등은 KST 값을 UTC 메서드로 접근해야 함
 * @param {number} [utcTimestamp] - UTC 타임스탬프 (밀리초). 생략 시 현재 시간
 * @returns {Date} KST 시간이 적용된 Date 객체
 */
function toKstDate(utcTimestamp = Date.now()) {
  return new Date(utcTimestamp + KST_OFFSET_MS);
}

/**
 * 현재 KST 기준 날짜 문자열 반환 (YYYY-MM-DD)
 * @returns {string} KST 기준 날짜 문자열
 */
function getKstDateString() {
  const kst = toKstDate();
  return kst.toISOString().split('T')[0];
}

/**
 * 현재 KST 기준 시간 반환 (0-23)
 * @returns {number} KST 기준 시간
 */
function getKstHour() {
  const kst = toKstDate();
  return kst.getUTCHours();
}

/**
 * 현재 KST 기준 요일 반환 (0=일요일, 6=토요일)
 * @returns {number} KST 기준 요일
 */
function getKstDayOfWeek() {
  const kst = toKstDate();
  return kst.getUTCDay();
}

/**
 * 현재 KST 기준 월 반환 (1-12)
 * @returns {number} KST 기준 월
 */
function getKstMonth() {
  const kst = toKstDate();
  return kst.getUTCMonth() + 1;
}

/**
 * 현재 KST 기준 일 반환 (1-31)
 * @returns {number} KST 기준 일
 */
function getKstDay() {
  const kst = toKstDate();
  return kst.getUTCDate();
}

/**
 * KST 새벽 4시 기준 "오늘"의 시작 시간을 UTC로 반환
 * - 현재 KST가 04:00 이후면: 오늘 KST 04:00 → UTC로 변환
 * - 현재 KST가 04:00 이전이면: 어제 KST 04:00 → UTC로 변환
 * @returns {Date} UTC Date 객체
 */
function getTodayStartUtc() {
  const now = Date.now();
  const kst = toKstDate(now);
  const kstHour = kst.getUTCHours();

  // KST 날짜의 00:00:00
  const kstMidnight = new Date(kst);
  kstMidnight.setUTCHours(0, 0, 0, 0);

  // KST 04:00 = kstMidnight + 4시간
  let kst4am = new Date(kstMidnight.getTime() + 4 * 60 * 60 * 1000);

  // 현재 KST가 04:00 이전이면 어제 04:00으로
  if (kstHour < 4) {
    kst4am = new Date(kst4am.getTime() - 24 * 60 * 60 * 1000);
  }

  // KST → UTC 변환 (KST에서 9시간 빼기)
  return new Date(kst4am.getTime() - KST_OFFSET_MS);
}

/**
 * KST 새벽 4시 기준 "오늘"의 끝 시간을 UTC로 반환 (내일 04:00)
 * @returns {Date} UTC Date 객체
 */
function getTodayEndUtc() {
  const todayStart = getTodayStartUtc();
  return new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * 주어진 날짜 문자열을 KST 기준 주의 시작일(일요일)과 종료일(토요일)로 반환
 * @param {string} dateStr - 날짜 문자열 (YYYY-MM-DD)
 * @returns {{ weekStart: string, weekEnd: string }} 주의 시작일과 종료일 (YYYY-MM-DD)
 */
function getWeekRangeKst(dateStr) {
  // dateStr을 KST 날짜로 해석
  const date = new Date(dateStr + 'T00:00:00+09:00');
  const dayOfWeek = date.getUTCDay(); // 이미 KST 기준

  // 주의 시작 (일요일)
  const weekStart = new Date(date);
  weekStart.setUTCDate(date.getUTCDate() - dayOfWeek);

  // 주의 끝 (토요일)
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  return {
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0]
  };
}

/**
 * 현재 KST 기준 이번 주 시작일(일요일)과 종료일(토요일) 반환
 * @returns {{ weekStart: string, weekEnd: string }}
 */
function getCurrentWeekRangeKst() {
  return getWeekRangeKst(getKstDateString());
}

/**
 * 현재 KST 기준 지난 주 시작일(일요일)과 종료일(토요일) 반환
 * @returns {{ weekStart: string, weekEnd: string }}
 */
function getLastWeekRangeKst() {
  const kst = toKstDate();
  const dayOfWeek = kst.getUTCDay();

  // 이번 주 일요일
  const thisSunday = new Date(kst);
  thisSunday.setUTCDate(kst.getUTCDate() - dayOfWeek);
  thisSunday.setUTCHours(0, 0, 0, 0);

  // 지난 주 일요일
  const lastSunday = new Date(thisSunday);
  lastSunday.setUTCDate(thisSunday.getUTCDate() - 7);

  // 지난 주 토요일
  const lastSaturday = new Date(lastSunday);
  lastSaturday.setUTCDate(lastSunday.getUTCDate() + 6);

  return {
    weekStart: lastSunday.toISOString().split('T')[0],
    weekEnd: lastSaturday.toISOString().split('T')[0]
  };
}

/**
 * MySQL 쿼리용: UTC_TIMESTAMP()를 KST로 변환하는 SQL 표현식
 * @returns {string} SQL 표현식
 */
function sqlUtcToKst() {
  return "CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00')";
}

/**
 * MySQL 쿼리용: KST 새벽 4시 기준 오늘 시작 시간 (UTC)
 * @returns {string} SQL CASE 표현식
 */
function sqlTodayStartUtc() {
  return `(
    CASE 
      WHEN HOUR(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00')) >= 4 
      THEN DATE_ADD(DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00')), INTERVAL -5 HOUR)
      ELSE DATE_ADD(DATE_SUB(DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00')), INTERVAL 1 DAY), INTERVAL -5 HOUR)
    END
  )`;
}

/**
 * MySQL 쿼리용: KST 새벽 4시 기준 오늘 끝 시간 (UTC)
 * @returns {string} SQL CASE 표현식
 */
function sqlTodayEndUtc() {
  return `(
    CASE 
      WHEN HOUR(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00')) >= 4 
      THEN DATE_ADD(DATE_ADD(DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00')), INTERVAL 1 DAY), INTERVAL -5 HOUR)
      ELSE DATE_ADD(DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00')), INTERVAL -5 HOUR)
    END
  )`;
}

/**
 * MySQL 쿼리용: UTC_TIMESTAMP() 기준 KST 날짜 (YYYY-MM-DD)
 * @returns {string} SQL 표현식
 */
function sqlKstDate() {
  return "DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00'))";
}

module.exports = {
  // Constants
  KST_OFFSET_MS,
  KST_OFFSET_HOURS,
  
  // UTC functions
  getUtcTimestamp,
  getUtcNow,
  
  // KST conversion functions
  toKstDate,
  getKstDateString,
  getKstHour,
  getKstDayOfWeek,
  getKstMonth,
  getKstDay,
  
  // 4AM boundary functions
  getTodayStartUtc,
  getTodayEndUtc,
  
  // Week range functions
  getWeekRangeKst,
  getCurrentWeekRangeKst,
  getLastWeekRangeKst,
  
  // SQL helpers
  sqlUtcToKst,
  sqlTodayStartUtc,
  sqlTodayEndUtc,
  sqlKstDate
};
