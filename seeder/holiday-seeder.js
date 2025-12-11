const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const axios = require('axios');
const mysql = require('mysql2/promise');

/**
 * 공휴일 정보 Seeder
 * - Local 환경: Docker MySQL
 * - Production 환경: RDS MySQL
 * - 공공데이터포털 특일정보 API 활용
 */

class HolidaySeeder {
    constructor(isProduction) {
        this.isProduction = isProduction;
        this.db = null;
        this.apiKey = process.env.HOLIDAY_API_KEY;
        this.baseUrl = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService';
    }

    async connect() {
        console.log('🔌 Connecting to MySQL...');
        this.db = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        console.log(`✓ Connected to MySQL at ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`);
    }

    async disconnect() {
        if (this.db) {
            await this.db.end();
            console.log('🔌 Database connection closed');
        }
    }

    /**
     * 공휴일 정보 API 호출
     * @param {number} year - 조회 연도
     * @param {number} month - 조회 월 (선택)
     * @returns {Promise<Array>} 공휴일 목록
     */
    async fetchHolidays(year, month = null) {
        try {
            const url = `${this.baseUrl}/getRestDeInfo`;
            const params = {
                ServiceKey: decodeURIComponent(this.apiKey),
                solYear: year,
                numOfRows: 100,
                _type: 'json' // JSON 형식으로 받기
            };

            if (month) {
                params.solMonth = String(month).padStart(2, '0');
            }

            console.log(`📡 Fetching holidays for ${year}${month ? `-${month}` : ''}...`);
            const response = await axios.get(url, { params });

            // API 응답 처리
            const body = response.data.response?.body;

            if (!body || !body.items) {
                console.log(`  ℹ️  No holidays found for ${year}${month ? `-${month}` : ''}`);
                return [];
            }

            // items가 객체인 경우와 배열인 경우 처리
            let items = body.items.item;
            if (!items) {
                return [];
            }

            // 단일 아이템인 경우 배열로 변환
            if (!Array.isArray(items)) {
                items = [items];
            }

            // 데이터 변환
            const holidays = items
                .filter(item => item.isHoliday === 'Y') // 공휴일만 필터링
                .map(item => ({
                    holiday_date: this.formatDate(item.locdate),
                    name_ko: this.normalizeHolidayName(item.dateName)
                }));

            console.log(`  ✓ Found ${holidays.length} holidays`);
            return holidays;

        } catch (error) {
            if (error.response) {
                console.error(`  ❌ API Error: ${error.response.status} - ${error.response.statusText}`);
                console.error(`  Response:`, error.response.data);
            } else {
                console.error(`  ❌ Error fetching holidays:`, error.message);
            }
            throw error;
        }
    }

    /**
     * 날짜 포맷 변환 (YYYYMMDD -> YYYY-MM-DD)
     */
    formatDate(locdate) {
        const dateStr = String(locdate);
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }

    /**
     * 공휴일 이름 정규화 (더 친숙한 이름으로 변경)
     */
    normalizeHolidayName(name) {
        const nameMap = {
            '기독탄신일': '크리스마스',
            '석가탄신일': '부처님 오신 날',
            '1월1일': '신정',
            '3·1절': '삼일절'
        };

        // 완전 일치하는 경우
        if (nameMap[name]) {
            return nameMap[name];
        }

        // 부분 일치 처리
        if (name.includes('기독탄신일')) {
            return '크리스마스';
        }
        if (name.includes('석가탄신일')) {
            return '부처님 오신 날';
        }
        if (name.includes('대체공휴일')) {
            // "설날 대체공휴일" -> "설날 대체 공휴일"
            return name.replace('대체공휴일', '대체 공휴일');
        }

        // 매핑되지 않은 경우 원본 반환
        return name;
    }

    /**
     * 공휴일 데이터를 DB에 삽입/업데이트 (UPSERT)
     */
    async upsertHolidays(holidays) {
        if (holidays.length === 0) {
            console.log('  ℹ️  No holidays to insert');
            return { inserted: 0, updated: 0 };
        }

        console.log(`💾 Upserting ${holidays.length} holidays...`);

        let inserted = 0;
        let updated = 0;

        for (const holiday of holidays) {
            try {
                // MySQL: ON DUPLICATE KEY UPDATE
                const [result] = await this.db.query(`
                    INSERT INTO holidays (holiday_date, name_ko)
                    VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE 
                        name_ko = VALUES(name_ko)
                `, [holiday.holiday_date, holiday.name_ko]);

                // affectedRows가 1이면 INSERT, 2면 UPDATE
                if (result.affectedRows === 1) {
                    inserted++;
                } else if (result.affectedRows === 2) {
                    updated++;
                }
            } catch (error) {
                console.error(`  ❌ Error upserting holiday ${holiday.holiday_date}:`, error.message);
                throw error;
            }
        }

        console.log(`  ✓ Inserted: ${inserted}, Updated: ${updated}`);
        return { inserted, updated };
    }

    /**
     * 연도별 공휴일 수집 및 DB 저장
     */
    async seedYear(year) {
        console.log(`\n📅 Processing year ${year}...`);
        const holidays = await this.fetchHolidays(year);
        const result = await this.upsertHolidays(holidays);
        return result;
    }

    /**
     * 여러 연도의 공휴일 수집
     */
    async seedYears(years) {
        const totalResult = { inserted: 0, updated: 0 };

        for (const year of years) {
            try {
                const result = await this.seedYear(year);
                totalResult.inserted += result.inserted;
                totalResult.updated += result.updated;

                // API 호출 제한을 고려한 딜레이
                await this.delay(500);

            } catch (error) {
                console.error(`❌ Failed to seed year ${year}:`, error.message);
                // 계속 진행
            }
        }

        return totalResult;
    }

    /**
     * 딜레이 함수 (API rate limiting 방지)
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * DB의 기존 공휴일 목록 조회
     */
    async getExistingHolidays() {
        const [rows] = await this.db.query(
            'SELECT holiday_date, name_ko FROM holidays ORDER BY holiday_date'
        );

        console.log(`\n📊 Current holidays in database: ${rows.length}`);
        if (rows.length > 0) {
            console.log(`   First: ${rows[0].holiday_date} - ${rows[0].name_ko}`);
            console.log(`   Last: ${rows[rows.length - 1].holiday_date} - ${rows[rows.length - 1].name_ko}`);
        }

        return rows;
    }
}

// ==========================================
// CLI 실행
// ==========================================
async function main() {
    const isProduction = process.env.NODE_ENV === 'production';

    console.log('==========================================');
    console.log('Holiday Data Seeder');
    console.log('==========================================');
    console.log(`Environment: ${isProduction ? 'PRODUCTION (RDS MySQL)' : 'DEVELOPMENT (Local MySQL)'}`);

    const seeder = new HolidaySeeder(isProduction);

    try {
        // DB 연결
        await seeder.connect();

        // 기존 데이터 조회
        await seeder.getExistingHolidays();

        // 현재 연도와 다음 연도의 공휴일 수집
        const currentYear = new Date().getFullYear();
        const years = [currentYear, currentYear + 1];

        console.log(`\n🔄 Fetching holidays for years: ${years.join(', ')}`);

        const result = await seeder.seedYears(years);

        console.log('\n==========================================');
        console.log('✅ Holiday seeding completed!');
        console.log(`   Total inserted: ${result.inserted}`);
        console.log(`   Total updated: ${result.updated}`);
        console.log('==========================================');

        // 최종 결과 조회
        await seeder.getExistingHolidays();

    } catch (error) {
        console.error('\n❌ Holiday seeding failed:', error);
        process.exit(1);
    } finally {
        await seeder.disconnect();
    }
}

// 모듈로 export (GHA에서 재사용 가능)
module.exports = HolidaySeeder;

// CLI에서 직접 실행시
if (require.main === module) {
    main().catch(console.error);
}
