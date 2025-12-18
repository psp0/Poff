# Chaos Engineering Quick Start Guide

## 첫 번째 카오스 실험 (10분)

### 사전 준비 (3분)

1. **AWS CLI 설정**
   ```bash
   aws configure
   # Access Key, Secret Key, Region 입력
   ```

2. **권한 확인**
   ```bash
   # Lambda 함수 목록 조회 가능한지 확인
   aws lambda list-functions --max-items 1
   
   # RDS 인스턴스 목록 조회 가능한지 확인
   aws rds describe-db-instances --max-records 1
   ```

3. **도구 설치**
   ```bash
   # jq (JSON 파싱)
   sudo apt-get install jq  # Ubuntu
   brew install jq          # macOS
   
   # bc (계산)
   sudo apt-get install bc  # Ubuntu
   brew install bc          # macOS
   ```

### 첫 실험 실행 (5분)

```bash
# 프로젝트 루트에서
cd chaos-engineering

# 스크립트 실행 권한 부여
chmod +x scenarios/*.sh
chmod +x scripts/*.sh

# Dev 환경에서 간단한 Lambda 장애 실험 (1분간)
./scenarios/lambda-failure.sh dev pokemon-management 60
```

### 실험 중 확인사항

1. **터미널 출력 모니터링**
   - 실시간 로그 확인
   - 에러 카운트 확인

2. **CloudWatch 확인**
   - Lambda 메트릭 모니터링
   - 에러 로그 확인

3. **Datadog 대시보드** (있는 경우)
   - 실시간 메트릭
   - 알람 트리거 확인

### 결과 확인 (2분)

```bash
# 생성된 결과 파일 확인
ls -la results/

# 결과 내용 확인
cat results/lambda-failure-*.json | jq '.'
```

## 안전한 실험을 위한 체크리스트

### 실험 전
- [ ] Dev 환경인지 확인 (`dev` 환경만 사용)
- [ ] 백업이 최신인지 확인
- [ ] 팀에 알림
- [ ] 모니터링 대시보드 준비
- [ ] 복구 절차 숙지

### 실험 중
- [ ] 실시간 모니터링
- [ ] 로그 확인
- [ ] 사용자 영향 최소화
- [ ] 즉시 중단 가능한 준비

### 실험 후
- [ ] 정상 복구 확인
- [ ] 결과 문서화
- [ ] 런북 업데이트
- [ ] 팀 공유

## 사용 가능한 시나리오

### 1. Lambda 장애 (추천 - 가장 안전)
```bash
./scenarios/lambda-failure.sh dev pokemon-management 60
```
- 1분간 Lambda 함수 비활성화
- 자동 복구
- 다른 기능에 영향 없음

### 2. 데이터베이스 지연 (시뮬레이션)
```bash
./scenarios/database-latency.sh dev 500 60
```
- 데이터베이스 지연 모니터링
- 실제 지연 주입은 하지 않음 (안전)
- 메트릭 수집 및 분석

### 3. API Gateway 제한
```bash
./scenarios/api-gateway-throttle.sh dev 10 20 60
```
- API 요청 제한 적용
- 제한 동작 확인
- 자동 복구

## 긴급 복구

실험이 잘못되었을 때:

```bash
# Ctrl+C를 눌러 스크립트 중단
# 스크립트는 자동으로 복구를 시도합니다

# 수동 복구가 필요한 경우:

# Lambda 동시성 제한 제거
aws lambda delete-function-concurrency \
  --function-name pokehabit-dev-pokemon-management

# API Gateway 제한 제거
aws apigateway update-stage \
  --rest-api-id <API_ID> \
  --stage-name dev \
  --patch-operations '[{"op": "remove", "path": "/throttle"}]'
```

## 다음 단계

1. **런북 읽기**
   - [Lambda Failure Recovery](./runbooks/lambda-failure-recovery.md)
   - [Database Failure Recovery](./runbooks/database-failure-recovery.md)

2. **더 복잡한 시나리오 시도**
   - 더 긴 지속 시간
   - 여러 함수 동시 테스트

3. **자동화**
   - GitHub Actions로 정기 실행
   - 결과 분석 자동화

## 문제 해결

**스크립트가 실행되지 않음**
```bash
chmod +x scenarios/*.sh
```

**AWS 권한 부족**
```bash
# 현재 사용자 확인
aws sts get-caller-identity

# 필요한 권한: Lambda, RDS, API Gateway 읽기/쓰기
```

**복구 실패**
- 런북의 수동 복구 절차 참조
- AWS Console에서 직접 수정
- 팀에 에스컬레이션

## 도움말

- 자세한 내용: [README.md](./README.md)
- 런북: [runbooks/](./runbooks/)
- 문제 발생 시: GitHub Issues 생성
