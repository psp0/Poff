# Load Testing Suite

## 개요

이 디렉토리는 PokeHabit 애플리케이션의 부하 테스트 스위트를 포함합니다. k6를 사용하여 다양한 부하 시나리오에서 시스템의 성능과 안정성을 검증합니다.

## 📋 테스트 유형

### 1. Smoke Test (연기 테스트)
- **목적**: 시스템이 최소한의 부하를 처리할 수 있는지 확인
- **VUs**: 1-5 사용자
- **Duration**: 1-2분
- **사용 시기**: 배포 후 즉시 실행하여 기본 기능 검증

```bash
npm run test:smoke
```

### 2. Load Test (부하 테스트)
- **목적**: 정상적인 예상 부하에서 시스템 성능 테스트
- **VUs**: 10-50 사용자
- **Duration**: 5-10분
- **사용 시기**: 일일 트래픽을 시뮬레이션하여 성능 검증

```bash
npm run test:load
```

### 3. Stress Test (스트레스 테스트)
- **목적**: 시스템의 한계점 찾기
- **VUs**: 50-200+ 사용자 (점진적 증가)
- **Duration**: 10-15분
- **사용 시기**: 시스템 용량 계획 수립

```bash
npm run test:stress
```

### 4. Spike Test (급증 테스트)
- **목적**: 갑작스런 트래픽 급증에 대한 시스템 반응 테스트
- **VUs**: 10 → 200 (10초 내 급증)
- **Duration**: 5-10분
- **사용 시기**: 마케팅 캠페인, 바이럴 콘텐츠 대비

```bash
npm run test:spike
```

### 5. Endurance Test (내구성 테스트)
- **목적**: 장시간 운영 시 시스템 안정성 검증
- **VUs**: 30 사용자 (지속)
- **Duration**: 1-4시간
- **사용 시기**: 메모리 누수, 리소스 고갈 문제 탐지

```bash
npm run test:endurance
```

## 🚀 빠른 시작

### 사전 요구사항

1. **k6 설치**
   ```bash
   # macOS
   brew install k6
   
   # Linux
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   
   # Windows
   choco install k6
   ```

2. **환경 변수 설정**
   ```bash
   export ENVIRONMENT=dev
   export DEV_API_URL=https://api-dev.pokehabit.example.com
   # 또는 프로덕션
   export ENVIRONMENT=prod
   export PROD_API_URL=https://api.pokehabit.example.com
   ```

### 기본 사용법

```bash
# 프로젝트 루트에서
cd load-tests

# Smoke test 실행 (빠른 검증)
npm run test:smoke

# Load test 실행 (기본 성능 테스트)
npm run test:load

# 모든 주요 테스트 실행
npm run test:all
```

### 고급 사용법

```bash
# 환경 변수와 함께 실행
ENVIRONMENT=prod k6 run scenarios/load-test.js

# 결과를 클라우드에 전송
k6 run --out cloud scenarios/load-test.js

# JSON 결과 저장
k6 run --out json=results/output.json scenarios/load-test.js

# 실시간 모니터링과 함께 실행
k6 run --out influxdb=http://localhost:8086/k6 scenarios/load-test.js
```

## 📊 결과 해석

### 주요 메트릭

- **http_req_duration**: HTTP 요청 소요 시간
  - p(95) < 500ms: 우수
  - p(95) < 1000ms: 양호
  - p(95) > 2000ms: 개선 필요

- **http_req_failed**: 실패한 요청 비율
  - < 1%: 우수
  - < 5%: 허용 가능
  - > 10%: 문제 있음

- **http_reqs**: 초당 요청 수 (RPS)
  - 시스템 처리량 지표

### 결과 파일

테스트 실행 후 `results/` 디렉토리에 다음 파일이 생성됩니다:
- `*-summary.json`: 상세한 메트릭 데이터
- `*-summary.html`: HTML 보고서 (일부 테스트)

## 🎯 테스트 시나리오

### 현재 구현된 시나리오

1. **Pokemon 탐색 (60%)**
   - Pokemon 목록 조회
   - 개별 Pokemon 상세 정보 조회

2. **사용자 활동 (30%)**
   - 사용자 컬렉션 조회
   - 알 상태 확인
   - 운동 기록 등록

3. **데이터 집약적 작업 (10%)**
   - 보상 이력 조회
   - 통계 데이터 조회
   - 전체 사용자 데이터 조회

## 🔧 CI/CD 통합

### GitHub Actions

프로젝트에는 자동화된 부하 테스트를 위한 GitHub Actions 워크플로우가 포함되어 있습니다:

- **Scheduled Load Tests**: 매일 정기적으로 실행
- **Pre-Production Tests**: 프로덕션 배포 전 실행
- **Performance Regression**: PR에서 성능 회귀 검증

워크플로우 파일: `.github/workflows/load-tests.yml`

## 📈 성능 기준선

### Dev 환경
- VUs: 10-20
- p95 Response Time: < 800ms
- Error Rate: < 2%
- RPS: > 20

### Prod 환경
- VUs: 50-100
- p95 Response Time: < 500ms
- Error Rate: < 1%
- RPS: > 50

## 🔍 문제 해결

### 일반적인 문제

**문제**: "connection refused" 에러
```
해결: API URL이 올바른지 확인하고 서비스가 실행 중인지 확인
```

**문제**: 높은 에러율
```
해결: 
1. Lambda 동시성 제한 확인
2. RDS 연결 풀 크기 확인
3. API Gateway throttling 설정 확인
4. CloudWatch Logs에서 에러 로그 확인
```

**문제**: 느린 응답 시간
```
해결:
1. CloudFront 캐싱 상태 확인
2. Lambda cold start 확인 (provisioned concurrency 고려)
3. RDS 쿼리 성능 최적화
4. 데이터베이스 인덱스 확인
```

### 디버깅 팁

```bash
# 상세한 로그 출력
k6 run --http-debug scenarios/load-test.js

# 단일 iteration만 실행
k6 run --iterations 1 scenarios/load-test.js

# VU 수를 줄여서 테스트
k6 run --vus 1 --duration 30s scenarios/load-test.js
```

## 📚 추가 리소스

- [k6 Documentation](https://k6.io/docs/)
- [Load Testing Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [Performance Testing Guide](https://k6.io/docs/testing-guides/)

## 🤝 기여하기

새로운 테스트 시나리오를 추가하려면:

1. `scenarios/` 디렉토리에 새 파일 생성
2. 테스트 옵션과 시나리오 정의
3. `package.json`에 npm 스크립트 추가
4. README 업데이트

## 📝 베스트 프랙티스

1. **테스트 환경 분리**: Dev 환경에서 먼저 테스트
2. **점진적 부하 증가**: 갑자기 높은 부하를 주지 말 것
3. **정기적인 실행**: 성능 회귀를 조기에 발견
4. **결과 모니터링**: CloudWatch, Datadog과 연계하여 모니터링
5. **문서화**: 테스트 결과와 개선 사항을 문서화

## 🎓 DevOps 포트폴리오 쇼케이스

이 부하 테스트 스위트는 다음을 시연합니다:

✅ **성능 엔지니어링**: 다양한 부하 시나리오 이해  
✅ **자동화**: CI/CD 파이프라인 통합  
✅ **모니터링**: 메트릭 수집 및 분석  
✅ **용량 계획**: 시스템 한계 파악 및 스케일링 전략  
✅ **문서화**: 명확한 사용법과 해석 가이드  

## 📧 연락처

문제나 제안 사항이 있으면 이슈를 생성해주세요.
