# Poff (포켓몬 습관 수집) - 전체 아키텍처 문서

**목적**: 전체 시스템 엘리먼트를 명확히 하고 문제 발생 지점 탐지

**작성일**: 2026년 1월 2일

---

## 📋 목차
1. [시스템 개요](#시스템-개요)
2. [프론트엔드 아키텍처](#프론트엔드-아키텍처)
3. [백엔드 아키텍처](#백엔드-아키텍처)
4. [데이터베이스 계층](#데이터베이스-계층)
5. [배포 인프라](#배포-인프라)
6. [주요 데이터 흐름](#주요-데이터-흐름)
7. [인증 및 보안](#인증-및-보안)
8. [에러 처리 및 로깅](#에러-처리-및-로깅)
9. [비즈니스 로직 모듈](#비즈니스-로직-모듈)

---

## 시스템 개요

### 프로젝트 개요
- **앱 이름**: Poff (포켓몬 수집 기반 디지털 디톡스 앱)
- **플랫폼**: PWA (Progressive Web App) + 모바일 웹
- **기술 스택**:
  - Frontend: Vanilla JavaScript + Vite
  - Backend: Node.js + Express + AWS Lambda
  - Database: MySQL 8.0
  - Authentication: Google Firebase Auth
  - Infrastructure: Docker (로컬) + Terraform (AWS)

### 핵심 기능
1. **포켓몬 수집**: 화면 시간 조절을 통해 포켓몬 수집
2. **진화 시스템**: 포켓몬 캔디로 진화 및 형태 변경
3. **스크린 타임 관리**: 사용자 화면 사용 시간 추적
4. **수면 관리**: 수면 기록 추적
5. **달걀 관리**: 알에서 부화하는 포켓몬 시스템
6. **게스트 모드**: 로그인 없이 체험 가능

---

## 프론트엔드 아키텍처

### 📁 프론트엔드 폴더 구조
```
pokehabit/
├── index.html              # 메인 HTML (PWA 설정 포함)
├── index.js                # 메인 JavaScript (5800+ 줄)
├── index.css               # 스타일시트
├── firebase-config.js      # Firebase 초기화
├── pwa.js                  # PWA & Service Worker 관리
├── vite.config.js          # Vite 빌드 설정
└── public/
    ├── manifest.json       # PWA 매니페스트
    └── sw.js               # Service Worker
```

### 핵심 기술 스택

| 레이어 | 기술 | 버전 |
|--------|------|------|
| **번들러** | Vite | ^7.2.6 |
| **인증** | Firebase Auth | 12.6.0 |
| **상태 관리** | Window Global | 커스텀 |
| **스타일** | CSS3 (vanilla) | - |
| **테스트** | Jest | ^30.2.0 |

### 주요 전역 상태 객체

```javascript
// 인증 상태
window.authState = 'loading' | 'authenticated' | 'guest' | 'unauthenticated'
window.isGuestMode = boolean
window.getCurrentUserId() => userId (UUID)

// 포켓몬 컬렉션 상태
userPokemonList[] = { display_stable_id, base_image_name, icon_url, ... }
currentDisplayStableId = string
currentDisplayIsShiny = boolean

// 필터 및 정렬
currentFilter = { sort, type, generation, ... }
```

### 컴포넌트 계층

#### 1. 인증 계층 (`index.js` - 초기화)
**책임**: Firebase 인증 상태 관리, 사용자 온보딩

```
┌─────────────────────────────────┐
│   Firebase onAuthStateChanged    │
├─────────────────────────────────┤
│  ├─ getAuthHeaders()            │ 토큰 발급
│  ├─ syncUserBackend()           │ 백엔드 동기화
│  └─ setupGuestMode()            │ 게스트 모드 셋업
└─────────────────────────────────┘
```

**주요 함수**:
- `initializeFirebaseListener()`: Firebase 초기화 및 상태 감지
- `getAuthHeaders()`: Authorization 헤더 생성
- `syncUserBackend()`: `/api/auth/sync` 호출 후 userId 받기

**문제 지점**:
- ❌ Firebase 초기화 실패 → 로그인 버튼 비활성화
- ❌ 토큰 발급 실패 → API 호출 불가
- ❌ 타임아웃 (최대 10초) → 게스트 모드로 폴백

---

#### 2. 포켓몬 디스플레이 계층
**책임**: 포켓몬 데이터 조회 및 화면에 표시

```
┌──────────────────────────────────────────────────────┐
│     displayPokemon(stableId, isShiny)                 │
├──────────────────────────────────────────────────────┤
│ 1. fetchPokemonData()                                │
│    └─ GET /api/collection/pokemon/{id}               │
│ 2. renderUI()                                        │
│    ├─ 스프라이트 설정 (front/back)                   │
│    ├─ 배경 이미지 로드 (fallback 처리)               │
│    ├─ 타입/해시태그 렌더링                           │
│    └─ 즐겨찾기/이로치 버튼 이벤트 바인딩             │
└──────────────────────────────────────────────────────┘
```

**API 엔드포인트**:
- `GET /api/collection/pokemon/{pokemonStableId}` - 포켓몬 상세 정보
- `GET /api/guest/pokemon/{pokemonStableId}` - 게스트 모드용

**응답 데이터 구조**:
```javascript
{
  success: true,
  data: {
    pokemon: {
      name, pokedex, category, habitat, flags,
      type1, type2, front_animation_speed, back_animation_speed
    },
    front_image: "URL",
    back_image: "URL",
    background_image: "URL",
    fallback_backgrounds: ["URL1", "URL2"],
    cry_sound: "URL",
    is_favorite: boolean,
    is_shiny: boolean,
    has_shiny: boolean,
    icon_url: "URL"
  }
}
```

**스프라이트 애니메이션**:
- 이미지 URL → 로드 → 프레임 수 계산 → CSS 애니메이션 생성
- 함수: `setupSprite(spriteId, imageUrl, animationSpeed)`

**문제 지점**:
- ❌ 이미지 로드 실패 → fallback 불가 → 공백 화면
- ❌ 배경 이미지 못 찾음 → 부모의 fallback 사용
- ❌ 울음소리 재생 실패 → 무음 (사용자 설정으로 제어: `isCrySoundEnabled`)

---

#### 3. 포켓몬 컬렉션 계층
**책임**: 사용자 보유 포켓몬 목록 표시 및 필터링

```
┌──────────────────────────────────────────────────────┐
│   loadUserPokemonIcons()                              │
├──────────────────────────────────────────────────────┤
│ 1. fetchIcons()                                      │
│    └─ GET /api/collection/icons                      │
│ 2. filterAndSort()                                   │
│    ├─ 필터 적용 (type, generation, etc.)             │
│    └─ 정렬 적용 (default / generation)               │
│ 3. renderGrid()                                      │
│    ├─ 포켓몬 카드 생성                               │
│    ├─ 진척도 바 (일반/이로치)                        │
│    └─ 완료 아이콘 (완료율에 따라)                    │
└──────────────────────────────────────────────────────┘
```

**API 엔드포인트**:
- `GET /api/collection/icons` - 포켓몬 목록
- `GET /api/collection/all-pokemon` - 세대별 정렬용

**카드 데이터 구조**:
```javascript
{
  base_image_name: string,
  display_stable_id: string,
  icon_url: string,
  completion_percentage: 0-100,
  shiny_owned_count: number,
  total_count: number,
  is_favorite: boolean,
  is_shiny: boolean,
  generation: 1-9
}
```

**필터 & 정렬**:
- 상태: `currentFilter = { sort, type, generation, ... }`
- 정렬: `default` (수집순) / `generation` (세대별)
- 필터링 함수: `getFilteredPokemonList(icons)`

**문제 지점**:
- ❌ API 호출 실패 → 로그인 필요 메시지
- ❌ 필터 조건 미충족 → "필터 조건에 맞는 포켓몬이 없습니다" 메시지
- ❌ 스프라이트 로드 실패 → 플레이스홀더 이미지 표시

---

#### 4. 진화 트리 계층
**책임**: 포켓몬 진화 라인 표시 및 진화/폼 해제 기능

```
┌──────────────────────────────────────────────────────┐
│   showIconGroupDetail(baseImageName)                  │
├──────────────────────────────────────────────────────┤
│ 1. fetchEvolutionTree()                              │
│    └─ GET /api/collection/evolution/{baseImageName}  │
│ 2. renderEvolutionDiagram()                          │
│    ├─ 각 진화 단계별 폼 렌더링                        │
│    ├─ owned / unlockable / locked 상태 처리          │
│    └─ 진화 화살표 드로우                             │
│ 3. displayPokemon()                                  │
│    └─ 선택된 포켓몬 상세 표시                         │
└──────────────────────────────────────────────────────┘
```

**API 응답 구조**:
```javascript
{
  success: true,
  data: {
    evolution_tree: {
      levels: [
        {
          forms: [
            {
              stable_id, name, image_name, form_suffix,
              icon_url, is_owned, is_shiny,
              pre_evolution_pokemon, flags
            }
          ]
        }
      ]
    },
    completion: { completion_percentage, is_complete }
  }
}
```

**상태 처리 로직**:
1. **owned**: 초록색, 클릭 → 상세 표시
2. **unlockable**: 노란색 배지, 클릭 → 진화/폼 해제 모달
3. **locked**: 회색, 클릭 불가

**진화 조건**:
- 이전 진화체가 있어야 함 (`pre_evolution_pokemon`)
- 비용: Rare Candy 기본(레벨별), 희귀 포켓몬은 3개
- 폼 해제: Mystic Charm (일반) 또는 Awakening Charm (희귀)

**문제 지점**:
- ❌ 진화 트리 데이터 없음 → API 에러
- ❌ 스켈레톤 로딩 중 화면 깜빡임
- ❌ 진화 조건 판단 오류 → unlockable로 표시되지 않는 포켓몬

---

#### 5. 네비게이션 계층
**책임**: 포켓몬 간 이전/다음 이동

```
┌──────────────────────────────────────────────────────┐
│   navigatePokemon(direction: -1 | 1)                 │
├──────────────────────────────────────────────────────┤
│ 1. 현재 위치 찾기 (userPokemonList 내 인덱스)       │
│ 2. 다음/이전 포켓몬 결정                              │
│ 3. 진화 체인 비교                                    │
│    ├─ 같은 체인 → displayPokemon()                   │
│    └─ 다른 체인 → showIconGroupDetail()              │
└──────────────────────────────────────────────────────┘
```

**중요 변수**:
- `currentDisplayStableId`: 현재 표시 중인 포켓몬
- `currentDisplayIsShiny`: 이로치 상태
- `isNavigating`: 중복 호출 방지 플래그

**문제 지점**:
- ❌ `userPokemonList` 비어있음 → 네비게이션 불가
- ❌ 현재 위치 못 찾음 → 네비게이션 실패
- ❌ 중복 호출 → UI 떨림

---

#### 6. 홈 화면 계층
**책임**: 즐겨찾기 포켓몬 표시 및 로테이션

```
┌──────────────────────────────────────────────────────┐
│   loadHomeFavoritePokemon()                           │
├──────────────────────────────────────────────────────┤
│ 1. GET /api/collection/favorites                    │
│ 2. displayHomePokemon(favoriteId)                   │
│ 3. navigateHomePokemon(direction)                   │
│    └─ 즐겨찾기 포켓몬 순환                           │
└──────────────────────────────────────────────────────┘
```

**상태**:
```javascript
homeFavorites[] = { pokemon_stable_id, is_shiny }
currentHomeIndex = 0
```

**문제 지점**:
- ❌ 즐겨찾기 없음 → 컨테이너 숨김
- ❌ API 호출 실패 → 빈 목록

---

#### 7. PWA & Service Worker 계층
**책임**: 오프라인 지원 및 앱 설치

```javascript
// pwa.js
├─ beforeinstallprompt 이벤트 → deferredPrompt 저장
├─ handlePwaInstallClick()
│  ├─ iOS → 설치 안내 모달
│  └─ Android → 네이티브 설치 프롬프트
└─ Service Worker 등록 (sw.js)
   └─ 캐싱 및 오프라인 지원
```

**문제 지점**:
- ❌ Service Worker 등록 실패 → 오프라인 기능 없음
- ❌ iOS에서 설치 프롬프트 없음 → 수동 안내 필요

---

### 자산 (Assets) 구조

```
poff-assets/
├── base/                    # 공식 포켓몬 리소스
│  ├── img/
│  │  ├── Icons/            # 아이콘 (192x192)
│  │  ├── Icons shiny/       # 이로치 아이콘
│  │  ├── Front/            # 정면 스프라이트
│  │  ├── Front shiny/       # 정면 스프라이트 (이로치)
│  │  ├── Back/             # 배면 스프라이트
│  │  ├── Back shiny/        # 배면 스프라이트 (이로치)
│  │  └── Eggs/             # 알 이미지
│  ├── info/                # 포켓몬 정보 JSON
│  └── sound/               # 울음소리 MP3
│
├── custom/                  # 커스텀 자산 (UI, 아이템 등)
│  ├── img/
│  │  ├── items/            # 아이템 이미지 (부적, 캔디 등)
│  │  ├── ui/               # UI 요소 (타입 배지, 아이콘 등)
│  │  ├── backgrounds/      # 배경 이미지 (세밀한 품질)
│  │  └── decorations/      # 장식 요소
│  ├── info/                # 커스텀 메타데이터
│  └── sound/               # 효과음
│
└── external/               # 외부 리소스
   ├── img/                 # CDN 리소스
   └── info/                # 외부 데이터
```

**환경 변수**:
```javascript
VITE_ASSETS_BASE_URL     // 자산 CDN URL (기본: '')
VITE_API_BASE_URL        // API 기본 URL (기본: '/api')
```

---

## 백엔드 아키텍처

### 📁 백엔드 폴더 구조

```
lambda/
├── functions/
│  ├── egg-management/         # 알 부화 관리
│  ├── guest-mode/             # 게스트 모드 API
│  ├── pokemon-collection/     # 포켓몬 수집 API ⭐
│  ├── pokemon-management/     # 포켓몬 관리 (진화, 이로치)
│  ├── screen-time-management/ # 스크린 타임 API
│  ├── sleep-management/       # 수면 기록 API
│  └── user-management/        # 사용자 관리 API
│
└── shared/
   ├── auth.js                # Firebase 토큰 인증
   ├── database.js            # MySQL 연결풀
   ├── response-utils.js      # 응답 포맷팅
   ├── logger.js              # 로깅
   ├── validation.js          # 입력 검증
   └── screen-time-rewards.js # 스크린 타임 보상 로직
```

### 로컬 개발 서버 (docker-compose)

```
┌────────────────────────────────────────────────────┐
│         Local Development Environment              │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌─────────────┐      ┌──────────────┐           │
│  │  nginx      │      │  api-server  │           │
│  │  :8080      │◄────►│  :3000       │           │
│  │  (Frontend) │      │  (Node.js)   │           │
│  └─────────────┘      └──────────────┘           │
│                              │                    │
│                              ▼                    │
│                        ┌──────────────┐           │
│                        │    MySQL     │           │
│                        │    :3306     │           │
│                        │              │           │
│                        └──────────────┘           │
│                                                    │
│  Volumes:                                         │
│  - mysql_data (데이터 영속성)                     │
│  - api_node_modules                              │
│  - poff-assets (마운트)                           │
│                                                    │
└────────────────────────────────────────────────────┘
```

**실행 명령어**:
```bash
npm run dev:up        # 개발 서버 시작
npm run dev:down      # 종료
npm run dev:logs      # 로그 보기
npm run db:migrate    # DB 마이그레이션
npm run dev:seed      # 더미 데이터 추가
```

### API 서버 (Express)

```javascript
// local-dev/api-server/server.js
const express = require('express');
const cors = require('cors');
const { getDatabase } = require('../../lambda/shared/database');

app.use(cors());
app.use(express.json());

// Lambda 함수들을 Express 라우터로 변환
app.post('/api/auth/sync', userManagement.handler);
app.get('/api/collection/icons', pokemonCollection.handler);
app.post('/api/pokemon/unlock-shiny', pokemonManagement.handler);
app.post('/api/user/items', userManagement.handler);
// ... 더 많은 라우트
```

**환경 변수**:
```env
NODE_ENV=development
DB_HOST=mysql
DB_PORT=3306
DB_NAME=poff
DB_USER=admin
DB_PASSWORD=poff123
PORT=3000
POKEMON_ASSET_BUCKET_URL=https://...
FIREBASE_SERVICE_ACCOUNT=base64 encoded JSON
```

---

## 데이터베이스 계층

### MySQL 스키마 (마이그레이션)

```
migrations/
├── files/
│  ├── 20250101000000-init-schema-optimized.js  # 초기 스키마
│  ├── 20251226011637-delete-exercise.js        # 운동 기능 삭제
│  ├── 20251227005147-add-sleep.js              # 수면 기능 추가
│  └── 20251227120900-update-sleep-logs.js      # 수면 로그 업데이트
│
├── sqls/
│  └── [SQL 스크립트]
│
└── database.json.example
```

### 핵심 테이블 구조 (예상)

```sql
-- 사용자
users (
  user_id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  username VARCHAR(255),
  firebase_uid VARCHAR(255) UNIQUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- 포켓몬 정보 (정적)
pokemon_info (
  pokemon_stable_id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  pokedex TEXT,
  type1 VARCHAR(50),
  type2 VARCHAR(50),
  category VARCHAR(100),
  habitat VARCHAR(100),
  flags JSON,
  front_image_url VARCHAR(255),
  back_image_url VARCHAR(255),
  background_image_url VARCHAR(255),
  cry_sound_url VARCHAR(255)
)

-- 사용자 포켓몬 컬렉션
user_pokemon_collection (
  id AUTO_INCREMENT PRIMARY KEY,
  user_id UUID FOREIGN KEY,
  pokemon_stable_id VARCHAR(255) FOREIGN KEY,
  is_shiny BOOLEAN,
  is_favorite BOOLEAN,
  owned_count INT,
  collection_date TIMESTAMP,
  UNIQUE KEY (user_id, pokemon_stable_id, is_shiny)
)

-- 스크린 타임 기록
screen_time_logs (
  id AUTO_INCREMENT PRIMARY KEY,
  user_id UUID FOREIGN KEY,
  usage_code VARCHAR(255),
  minutes INT,
  logged_date DATE,
  created_at TIMESTAMP
)

-- 수면 기록
sleep_logs (
  id AUTO_INCREMENT PRIMARY KEY,
  user_id UUID FOREIGN KEY,
  date DATE,
  duration_minutes INT,
  quality VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP
)

-- 알
eggs (
  id AUTO_INCREMENT PRIMARY KEY,
  user_id UUID FOREIGN KEY,
  pokemon_stable_id VARCHAR(255) FOREIGN KEY,
  hatch_date_target DATE,
  hatch_count INT,
  created_at TIMESTAMP
)

-- 사용자 아이템
user_items (
  id AUTO_INCREMENT PRIMARY KEY,
  user_id UUID FOREIGN KEY,
  item_name VARCHAR(255),
  quantity INT,
  UNIQUE KEY (user_id, item_name)
)
```

### 마이그레이션 실행

```bash
npm run db:migrate    # 모든 마이그레이션 실행
npm run db:revert     # 마지막 마이그레이션 되돌리기
npm run db:reset      # 전체 초기화
```

---

## 배포 인프라

### Terraform 구조

```
terraform/
├── bootstrap/
│  ├── dev/          # 개발 환경 설정
│  ├── prod/         # 프로덕션 환경 설정
│  ├── infra/        # 공통 인프라 모듈
│  └── statebucket/  # Terraform 상태 관리 (S3)
│
├── environments/    # 환경별 변수 파일
│
└── modules/         # 재사용 가능한 모듈들
   ├── api-lambda/   # API Lambda 함수
   ├── auth/         # 인증 인프라
   ├── database/     # RDS MySQL
   ├── cdn/          # CloudFront CDN
   ├── storage/      # S3 버킷
   └── networking/   # VPC, 보안 그룹
```

### AWS 인프라 (예상 구조)

```
┌──────────────────────────────────────────────────────────┐
│                    AWS Infrastructure                     │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │              CloudFront CDN                      │   │
│  │  (poff-assets, static files 캐싱)               │   │
│  └────────────────┬─────────────────────────────────┘   │
│                   │                                      │
│  ┌────────────────▼──────────────────────────────────┐  │
│  │          API Gateway (REST API)                   │  │
│  │  Routes to Lambda functions                      │  │
│  └─────────────────┬──────────────────────────────┐  │  │
│                    │                              │   │  │
│  ┌─────────────────▼───────┐  ┌─────────────────┐ │  │  │
│  │    Lambda Functions      │  │   RDS MySQL     │ │  │  │
│  │  ├─ user-management     │  │   (Aurora/MySQL)│ │  │  │
│  │  ├─ pokemon-collection  │  │                 │ │  │  │
│  │  ├─ pokemon-management  │  │   Backup:       │ │  │  │
│  │  ├─ screen-time-mgt     │  │   Daily Snapshots│  │  │
│  │  ├─ sleep-management    │  │                 │ │  │  │
│  │  ├─ egg-management      │  │ VPC Security    │ │  │  │
│  │  └─ guest-mode          │  └─────────────────┘ │  │  │
│  │                         │                      │  │  │
│  └─────────────────┬───────┴──────────────────────┘  │  │
│                    │                                  │  │
│  ┌─────────────────▼──────────────────────────────┐  │  │
│  │           S3 Buckets                           │  │  │
│  │  ├─ poff-assets (포켓몬 이미지/음성)           │  │  │
│  │  ├─ terraform-state (상태 관리)               │  │  │
│  │  └─ logs (CloudWatch, ALB 로그)               │  │  │
│  └──────────────────────────────────────────────┘  │  │
│                                                      │  │
│  Monitoring:                                        │  │
│  ├─ CloudWatch (로그, 메트릭)                       │  │
│  ├─ CloudTrail (감사 로그)                          │  │
│  └─ X-Ray (분산 트레이싱)                           │  │
│                                                      │  │
└──────────────────────────────────────────────────────┘
```

### 배포 프로세스

```bash
# 로컬 테스트
npm run dev:up
npm run test

# 스테이징 배포
terraform plan -var-file="environments/staging.tfvars"
terraform apply

# 프로덕션 배포
terraform plan -var-file="environments/prod.tfvars"
terraform apply
```

---

## 주요 데이터 흐름

### 1️⃣ 사용자 인증 및 로그인 흐름

```
┌─────────────────────────────────────────────────────────┐
│           User Login Flow                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 클라이언트 (index.js)                              │
│     └─ Google Login 버튼 클릭                           │
│                                                         │
│  2. Firebase (Google OAuth)                             │
│     ├─ OAuth 팝업 띄우기                               │
│     ├─ Google 계정 로그인                               │
│     └─ Firebase ID Token 발급                           │
│                                                         │
│  3. 클라이언트 (index.js)                              │
│     └─ onAuthStateChanged 콜백                         │
│        ├─ Firebase user 객체 수신                       │
│        └─ ID Token 추출                                │
│                                                         │
│  4. 백엔드 API 호출                                     │
│     POST /api/auth/sync                                │
│     Headers: Authorization: Bearer {token}             │
│     Body: { idToken, email, username }                │
│                                                         │
│  5. user-management Lambda                            │
│     ├─ Firebase 토큰 검증 (auth.js)                   │
│     ├─ 사용자 존재 여부 확인                            │
│     ├─ 없으면 신규 생성                                │
│     ├─ user_id (UUID) 발급                             │
│     └─ 응답: { userId, isNewUser }                    │
│                                                         │
│  6. 클라이언트                                          │
│     ├─ currentUserId 업데이트                          │
│     ├─ localStorage에 저장                             │
│     ├─ 신규 사용자 → 약관 동의 모달                    │
│     └─ 기존 사용자 → 메인 화면 표시                    │
│                                                         │
│  7. user-synced 이벤트 발생                             │
│     └─ 다른 모듈에서 포켓몬 로드 등 시작               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**문제 지점**:
- 🔴 Firebase 초기화 실패
- 🔴 토큰 만료
- 🔴 /api/auth/sync 응답 지연
- 🔴 UUID 중복 생성

---

### 2️⃣ 포켓몬 컬렉션 조회 흐름

```
┌─────────────────────────────────────────────────────────┐
│    Pokemon Collection Load Flow                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 클라이언트: loadUserPokemonIcons()                 │
│     └─ 현재 userId 확인                                │
│                                                         │
│  2. API 선택                                            │
│     ├─ 인증됨 → /api/collection/icons                 │
│     └─ 게스트 → /api/guest/icons                      │
│                                                         │
│  3. pokemon-collection Lambda                          │
│     ├─ 요청 헤더에서 userId 추출 (token)              │
│     ├─ SQL 쿼리:                                       │
│     │  SELECT pokemon_stable_id, is_shiny,            │
│     │         owned_count, collection_date            │
│     │  FROM user_pokemon_collection                   │
│     │  WHERE user_id = ?                              │
│     │  ORDER BY collection_date DESC                  │
│     │                                                  │
│     └─ 각 포켓몬에 대해:                               │
│        ├─ icon URL 생성                               │
│        ├─ 진척도 계산 (owned_count / total_count)     │
│        └─ 완료 상태 판단                               │
│                                                         │
│  4. 응답 데이터                                         │
│     {                                                  │
│       success: true,                                   │
│       data: [                                          │
│         {                                              │
│           base_image_name: "pikachu",                 │
│           display_stable_id: "pikachu_0",            │
│           icon_url: "...",                           │
│           completion_percentage: 45,                 │
│           is_favorite: true,                         │
│           is_shiny: false                            │
│         }                                             │
│       ]                                               │
│     }                                                  │
│                                                         │
│  5. 클라이언트: createPokemonCard()                    │
│     ├─ 포켓몬 카드 HTML 생성                           │
│     ├─ 진척도 바 렌더링                                │
│     ├─ 스프라이트 이미지 설정 (lazy load)             │
│     └─ 클릭 이벤트 → showIconGroupDetail()            │
│                                                         │
│  6. 필터 및 정렬 적용                                   │
│     ├─ currentFilter에 따라 필터링                     │
│     ├─ 세대별 정렬일 경우 generation-divider 삽입    │
│     └─ 그리드에 렌더링                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**문제 지점**:
- 🔴 DB 쿼리 타임아웃
- 🔴 Icon URL 생성 실패 (자산 경로 오류)
- 🔴 필터 조건에 맞는 포켓몬 0개
- 🔴 스프라이트 이미지 404

---

### 3️⃣ 포켓몬 진화 흐름

```
┌─────────────────────────────────────────────────────────┐
│        Pokemon Evolution Flow                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 클라이언트: handleEvolutionClick()                 │
│     ├─ 진화 조건 확인                                  │
│     ├─ 아이템 보유량 확인: GET /api/user/items        │
│     └─ 확인 모달: "Rare Candy 1개를 사용하시겠습니까?"│
│                                                         │
│  2. 확인 후 API 호출                                    │
│     POST /api/pokemon/unlock-shiny                     │
│     또는                                                │
│     POST /api/pokemon/evolve                           │
│     Body: { targetPokemonId }                          │
│                                                         │
│  3. pokemon-management Lambda                          │
│     ├─ 진화 조건 재확인                                │
│     │  ├─ 이전 진화체 보유 확인                        │
│     │  └─ 아이템 충분한지 확인                         │
│     │                                                  │
│     ├─ 아이템 차감                                     │
│     │  UPDATE user_items                              │
│     │  SET quantity = quantity - 1                    │
│     │  WHERE item_name = ? AND user_id = ?            │
│     │                                                  │
│     ├─ 포켓몬 추가                                     │
│     │  INSERT INTO user_pokemon_collection             │
│     │  (user_id, pokemon_stable_id, is_shiny, owned_)  │
│     │                                                  │
│     └─ 응답: { success, message }                     │
│                                                         │
│  4. 클라이언트: 성공 시                                │
│     ├─ 토스트 메시지 표시                              │
│     ├─ 진화 애니메이션 (선택사항)                      │
│     └─ 포켓몬 목록 새로고침                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**문제 지점**:
- 🔴 아이템 부족
- 🔴 이전 진화체 없음
- 🔴 이미 진화한 포켓몬 (중복 진화 방지)
- 🔴 DB 트랜잭션 실패 (롤백 필요)

---

### 4️⃣ 스크린 타임 보상 흐름

```
┌─────────────────────────────────────────────────────────┐
│      Screen Time Reward Flow                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 사용자가 화면 시간 기록                              │
│     POST /api/screen-time/log                          │
│     Body: { usageCode, minutes }                       │
│                                                         │
│  2. screen-time-management Lambda                      │
│     ├─ usageCode 검증 (parseUsageCode)                │
│     ├─ 스크린 타임 기록 저장                            │
│     │  INSERT INTO screen_time_logs                    │
│     │                                                  │
│     ├─ 보상 계산 (processScreenTimeRewards)           │
│     │  ├─ minutes 기반 포켓몬 해금 가능성 계산         │
│     │  ├─ 구간별 보상:                                │
│     │  │  ├─  0-30분 → 포켓몬 1마리 (50% 확률)       │
│     │  │  ├─ 31-60분 → 포켓몬 2마리 (30% 확률)       │
│     │  │  └─ 60분 이상 → 특별한 포켓몬               │
│     │  │                                               │
│     │  └─ 기존 보유 포켓몬 제외 (새 포켓몬만)         │
│     │                                                  │
│     ├─ 해금 포켓몬 추가                                │
│     │  INSERT INTO user_pokemon_collection             │
│     │                                                  │
│     └─ 응답: { rewardedPokemon: [...] }              │
│                                                         │
│  3. 클라이언트: 보상 표시                               │
│     ├─ 팝업 또는 모달로 획득 포켓몬 표시              │
│     ├─ 애니메이션                                      │
│     └─ 컬렉션 업데이트                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**보상 로직** (screen-time-rewards.js):
```javascript
function processScreenTimeRewards(minutes, userId) {
  // 1. 분 단위 계산
  const rewardTier = calculateRewardTier(minutes);
  
  // 2. 보상 포켓몬 선정 (운 게임 포함)
  const rewardedPokemon = selectRandomPokemon(rewardTier, userId);
  
  // 3. 데이터베이스에 추가
  // INSERT into user_pokemon_collection
  
  return rewardedPokemon;
}
```

**문제 지점**:
- 🔴 usageCode 검증 실패
- 🔴 중복 기록 (같은 시간대 다중 요청)
- 🔴 포켓몬 선택 편향 (운 게임 조작)

---

## 인증 및 보안

### 토큰 흐름

```
┌──────────────────────────────────────────────────────────┐
│           Token Flow & Security                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Firebase Client                                         │
│  ├─ Google OAuth 2.0                                    │
│  ├─ ID Token (JWT, ~30분 유효)                          │
│  └─ Refresh Token (자동 관리)                           │
│        │                                                 │
│        ▼                                                 │
│  HTTP Header                                            │
│  Authorization: Bearer {idToken}                         │
│        │                                                 │
│        ▼                                                 │
│  Backend Lambda (auth.js)                               │
│  ├─ Firebase Admin SDK로 토큰 검증                      │
│  │  firebase.auth().verifyIdToken(token)               │
│  ├─ Payload 추출:                                       │
│  │  { uid: "google-user-id", ... }                     │
│  ├─ DB에서 내부 userId (UUID) 조회                      │
│  └─ 요청 처리 계속                                      │
│                                                          │
│  CORS                                                    │
│  ├─ 프론트엔드 도메인만 허용                             │
│  ├─ 프리플라이트 요청 (OPTIONS) 처리                     │
│  └─ credentials: 'include'로 쿠키 전달                 │
│                                                          │
│  Content Security Policy                                │
│  ├─ 스크립트 소스 제한                                  │
│  ├─ 이미지 소스 제한                                    │
│  └─ 프레임 출처 제한 (clickjacking 방지)               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 인증 코드 (lambda/shared/auth.js)

```javascript
// 토큰 검증
async function authenticateAndParseBody(event) {
  const token = event.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Missing token');
  
  const decodedToken = await admin.auth().verifyIdToken(token);
  const userId = decodedToken.uid; // Firebase UID
  
  // 내부 userId로 변환
  const internalUserId = await getUserIdFromFirebaseUid(userId);
  
  return { userId: internalUserId, body: JSON.parse(event.body) };
}

// 토큰 검증만 (응답 파싱 없음)
async function authenticate(event) {
  // 위와 동일하지만 body 파싱하지 않음
}
```

**문제 지점**:
- 🔴 토큰 만료 → 401 Unauthorized
- 🔴 Firebase 초기화 실패 → 토큰 검증 불가
- 🔴 Firebase UID와 DB UUID 불일치

---

### 요청 검증 (lambda/shared/validation.js)

```javascript
// 예: 포켓몬 진화 요청
function validateEvolutionRequest(body) {
  if (!body.targetPokemonId || typeof body.targetPokemonId !== 'string') {
    throw new Error('Invalid targetPokemonId');
  }
  if (body.targetPokemonId.length > 255) {
    throw new Error('targetPokemonId too long');
  }
}
```

**검증 항목**:
- 필수 필드 확인
- 데이터 타입 확인
- 길이 제한 확인
- 범위 확인 (예: minutes > 0)

---

## 에러 처리 및 로깅

### 에러 응답 포맷 (lambda/shared/response-utils.js)

```javascript
// 성공
createSuccessResponse(statusCode, data, message)
// 예: { success: true, data: {...}, message: "OK" }

// 에러
createErrorResponse(statusCode, errorCode, message)
// 예: { success: false, error: "INVALID_TOKEN", message: "..." }

// 에러 핸들링 래퍼
withErrorHandling(handler)
// 예외 발생 시 자동으로 500 에러 응답
```

### 로깅 (lambda/shared/logger.js)

```javascript
logger.info('사용자 로그인:', { userId, timestamp });
logger.error('DB 쿼리 실패:', { error, query });
logger.warn('토큰 곧 만료:', { expiresIn });
logger.debug('포켓몬 선택:', { pokemonId });
```

**로그 출력 대상**:
- 로컬: 콘솔
- AWS: CloudWatch Logs

**문제 지점**:
- 🔴 로그 누락 → 디버깅 어려움
- 🔴 민감 정보 로깅 (비밀번호, 토큰)
- 🔴 로그 레벨 너무 많음 → 성능 저하

---

## 비즈니스 로직 모듈

### 1️⃣ 사용자 관리 (user-management)

**책임**:
- 신규 사용자 등록
- 사용자 정보 조회/수정
- 아이템 관리 (포켓몬 캔디, 부적 등)

**주요 엔드포인트**:
```
POST   /api/auth/sync              # 사용자 동기화 (신규/기존 확인)
GET    /api/user/profile           # 사용자 정보 조회
PUT    /api/user/profile           # 사용자 정보 수정
GET    /api/user/items             # 아이템 목록 조회
POST   /api/user/items/use         # 아이템 사용
```

**아이템 타입**:
- `RARECANDY` - 포켓몬 진화용 (1개)
- `SHINYCHARM` - 이로치 해금용 (1개, 일반 포켓몬)
- `BRILLIANCECHARM` - 이로치 해금용 (1개, 희귀 포켓몬)
- `MYSTICCHARM` - 폼 변화용 (1개)
- `AWAKENINGCHARM` - 폼 변화용 (1개, 희귀 포켓몬)

---

### 2️⃣ 포켓몬 관리 (pokemon-management)

**책임**:
- 포켓몬 진화
- 이로치 해금
- 폼 변화

**주요 엔드포인트**:
```
POST   /api/pokemon/evolve         # 포켓몬 진화
POST   /api/pokemon/unlock-shiny   # 이로치 해금
POST   /api/pokemon/change-form    # 폼 변화
GET    /api/pokemon/{id}           # 포켓몬 상세 정보
```

**진화 규칙**:
```javascript
// 이전 진화체 필요
if (!hasPreEvolution(targetPokemon)) {
  throw new Error('Cannot evolve: missing pre-evolution');
}

// 아이템 차감
deductItem(userId, 'RARECANDY', cost);

// 신규 포켓몬 추가
addPokemonToCollection(userId, targetPokemon);
```

---

### 3️⃣ 포켓몬 컬렉션 (pokemon-collection)

**책임**:
- 사용자 포켓몬 목록 조회
- 진화 트리 조회
- 즐겨찾기 토글
- 이로치 여부 추적

**주요 엔드포인트**:
```
GET    /api/collection/icons              # 포켓몬 목록 (필터됨)
GET    /api/collection/all-pokemon        # 전체 포켓몬 (세대별)
GET    /api/collection/pokemon/{id}       # 포켓몬 상세
GET    /api/collection/evolution/{base}   # 진화 트리
GET    /api/collection/favorites          # 즐겨찾기 목록
POST   /api/collection/favorite           # 즐겨찾기 토글
```

**진화 트리 응답**:
```javascript
{
  evolution_tree: {
    levels: [
      {
        level_index: 0,
        forms: [
          {
            stable_id: "pikachu_0",
            name: "피카츄",
            image_name: "pikachu",
            form_suffix: null,
            icon_url: "...",
            is_owned: true,
            pre_evolution_pokemon: null
          }
        ]
      }
    ]
  },
  completion: {
    completion_percentage: 45,
    is_complete: false
  }
}
```

---

### 4️⃣ 스크린 타임 관리 (screen-time-management)

**책임**:
- 화면 사용 시간 기록
- 보상 포켓몬 자동 해금
- 스크린 타임 통계

**주요 엔드포인트**:
```
POST   /api/screen-time/log        # 화면 시간 기록
GET    /api/screen-time/stats      # 통계 조회
GET    /api/screen-time/rewards    # 보상 목록
```

**보상 시스템** (shared/screen-time-rewards.js):
```javascript
function calculateReward(minutes) {
  if (minutes < 30) return TIER_1_REWARD; // 포켓몬 1마리 (일반)
  if (minutes < 60) return TIER_2_REWARD; // 포켓몬 2마리
  return TIER_3_REWARD; // 특별한 포켓몬
}
```

---

### 5️⃣ 수면 관리 (sleep-management)

**책임**:
- 수면 기록 저장
- 수면 통계 조회
- 수면 목표 달성 추적

**주요 엔드포인트**:
```
POST   /api/sleep/log              # 수면 기록
GET    /api/sleep/logs             # 수면 기록 목록
GET    /api/sleep/stats            # 수면 통계
```

**수면 기록 데이터**:
```javascript
{
  date: "2025-01-02",
  duration_minutes: 480,           // 8시간
  quality: "good" | "normal" | "bad",
  notes: "추가 메모"
}
```

---

### 6️⃣ 알 관리 (egg-management)

**책임**:
- 알 생성 및 추적
- 부화 조건 확인 (화면 시간 등)
- 포켓몬 부화

**주요 엔드포인트**:
```
POST   /api/eggs                   # 알 생성
GET    /api/eggs                   # 알 목록
POST   /api/eggs/{id}/hatch        # 포켓몬 부화
```

**알 상태**:
- Unhatched: 부화 중
- Ready: 부화 가능 (조건 충족)
- Hatched: 부화 완료

---

### 7️⃣ 게스트 모드 (guest-mode)

**책임**:
- 로그인 없이 기본 기능 제공
- 게스트 데이터 제한

**특징**:
- 고정 게스트 UUID: `00000000-0000-0000-0000-000000000000`
- 읽기만 가능 (포켓몬 조회, 진화 트리 조회)
- 저장 불가 (진화, 아이템 사용 등)

**주요 엔드포인트**:
```
GET    /api/guest/icons            # 게스트용 포켓몬 목록
GET    /api/guest/pokemon/{id}     # 게스트용 포켓몬 상세
GET    /api/guest/evolution/{base} # 게스트용 진화 트리
```

---

## 🔍 문제 탐지 체크리스트

### 프론트엔드 문제

- [ ] Firebase 초기화 실패
- [ ] 토큰 발급 실패
- [ ] 이미지 로드 404
- [ ] API 응답 지연 (3초 이상)
- [ ] 중복 API 호출
- [ ] UI 깜빡임 (렌더링 누락)
- [ ] 메모리 누수 (이벤트 리스너 미삭제)
- [ ] CORS 에러
- [ ] Service Worker 등록 실패
- [ ] 오프라인 기능 미작동

### 백엔드 문제

- [ ] DB 연결 풀 고갈
- [ ] 쿼리 타임아웃 (> 5초)
- [ ] N+1 쿼리 문제
- [ ] 트랜잭션 롤백 미처리
- [ ] 토큰 검증 실패
- [ ] 입력 검증 누락
- [ ] 에러 응답 불일치
- [ ] 로깅 누락

### 인프라 문제

- [ ] Lambda 함수 타임아웃 (> 30초)
- [ ] CloudWatch 로그 누락
- [ ] RDS 백업 미실행
- [ ] CloudFront 캐시 무효화 필요
- [ ] VPC 보안 그룹 규칙 오류
- [ ] S3 버킷 권한 오류
- [ ] Terraform 상태 불일치

### 데이터 무결성 문제

- [ ] 중복 레코드 삽입
- [ ] Foreign Key 제약 위반
- [ ] NULL 값 미처리
- [ ] 문자 인코딩 오류 (UTF-8 확인)
- [ ] 타임존 불일치

### 보안 문제

- [ ] XSS 취약점 (HTML 이스케이프 미처리)
- [ ] SQL 주입 (매개변수화 쿼리 확인)
- [ ] CSRF 토큰 미사용
- [ ] 민감 정보 로깅
- [ ] 토큰 만료 시간 설정 오류

---

## 📞 연락처 및 문서 참조

- **프로젝트**: Poff (Pokemon Habit Collection)
- **저장소**: `/mnt/D_drive/홍익대/4-가을/pokehabit`
- **관련 파일**:
  - [index.js](index.js) - 프론트엔드 메인 로직
  - [vite.config.js](vite.config.js) - 빌드 설정
  - [docker-compose.yml](local-dev/docker-compose.yml) - 로컬 개발 환경
  - [lambda/shared/](lambda/shared/) - 백엔드 공용 유틸
  - [migrations/](migrations/) - DB 마이그레이션

---

**문서 버전**: 1.0  
**최종 수정**: 2026-01-02  
**담당자**: AI Assistant
