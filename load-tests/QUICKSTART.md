# Load Testing Quick Start Guide

## 5분 안에 시작하기

### 1. k6 설치 (1분)

**macOS:**
```bash
brew install k6
```

**Ubuntu/Debian:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**
```bash
choco install k6
```

### 2. 환경 설정 (1분)

```bash
# Dev 환경 테스트
export ENVIRONMENT=dev
export DEV_API_URL=https://api-dev.pokehabit.example.com

# 또는 Prod 환경 테스트
export ENVIRONMENT=prod
export PROD_API_URL=https://api.pokehabit.example.com
```

### 3. 첫 테스트 실행 (3분)

```bash
# 프로젝트 루트에서
cd load-tests

# Smoke test 실행 (가장 빠른 테스트)
npm run test:smoke

# 또는 k6 직접 실행
k6 run scenarios/smoke-test.js
```

## 결과 해석

### 성공 예시
```
✓ health check status is 200
✓ pokemon list status is 200
✓ pokemon list response time < 500ms

checks.........................: 100.00% ✓ 120  ✗ 0
http_req_duration..............: avg=245ms   p(95)=380ms
http_req_failed................: 0.00%   ✓ 0    ✗ 120
```

### 실패 예시 (문제가 있는 경우)
```
✗ health check status is 200
  ↳  0% — ✓ 0 / ✗ 60

http_req_duration..............: avg=1245ms  p(95)=2380ms
http_req_failed................: 15.00%  ✓ 18   ✗ 102
```

## 다음 단계

1. **Load Test 실행** (정상 부하)
   ```bash
   npm run test:load
   ```

2. **결과 분석**
   - `results/` 폴더에서 JSON 파일 확인
   - CloudWatch에서 메트릭 확인

3. **정기적으로 실행**
   - GitHub Actions를 통해 자동화됨
   - 매일 자동으로 smoke test 실행

## 문제 해결

**"connection refused" 에러**
- API URL이 올바른지 확인
- 서비스가 실행 중인지 확인

**높은 에러율**
- CloudWatch Logs 확인
- Lambda 동시성 제한 확인
- RDS 연결 확인

**느린 응답**
- CloudFront 캐싱 확인
- Lambda cold start 확인
- 데이터베이스 쿼리 최적화

## 도움말

자세한 내용은 [README.md](./README.md)를 참조하세요.
