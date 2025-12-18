# Chaos Engineering & Disaster Recovery Training

## 개요

이 디렉토리는 PokeHabit 시스템의 복원력을 테스트하고 재해 복구 절차를 훈련하기 위한 카오스 엔지니어링 도구와 런북을 포함합니다.

## 📁 디렉토리 구조

```
chaos-engineering/
├── scenarios/          # 카오스 실험 시나리오
│   ├── lambda-failure.sh
│   ├── database-latency.sh
│   └── api-gateway-throttle.sh
├── scripts/           # 공통 스크립트
│   └── common.sh
├── runbooks/          # 재해 복구 런북
│   ├── lambda-failure-recovery.md
│   ├── database-failure-recovery.md
│   └── system-outage-recovery.md
└── results/           # 실험 결과 (자동 생성)
```

## 🎯 목적

### 1. 시스템 복원력 검증
- 장애 상황에서 시스템이 어떻게 동작하는지 이해
- 자동 복구 메커니즘 테스트
- 모니터링 및 알림 시스템 검증

### 2. 재해 복구 훈련
- 실제 장애 상황을 안전하게 시뮬레이션
- 팀의 대응 능력 향상
- 런북의 정확성 검증

### 3. DevOps 역량 시연
- 프로덕션 레디 시스템 운영 능력
- 장애 대응 전문성
- 문서화 및 자동화 수준

## 🧪 카오스 실험 시나리오

### 1. Lambda Function Failure (Lambda 장애)

**목적:** Lambda 함수가 실패할 때 시스템 동작 확인

**실행:**
```bash
cd chaos-engineering
./scenarios/lambda-failure.sh dev pokemon-management 300
```

**매개변수:**
- `dev` 또는 `prod`: 대상 환경
- `pokemon-management`: 함수 이름
- `300`: 지속 시간 (초)

**예상 동작:**
- ✅ API Gateway가 502/503 에러 반환
- ✅ CloudWatch 알람 트리거
- ✅ 다른 기능은 정상 동작
- ✅ 복구 후 자동으로 정상화

**검증 사항:**
- [ ] 알람이 5분 이내에 트리거되는가?
- [ ] 다른 Lambda 함수는 영향 받지 않는가?
- [ ] 복구 후 즉시 정상화되는가?

---

### 2. Database Latency (데이터베이스 지연)

**목적:** 높은 데이터베이스 지연 시 시스템 동작 확인

**실행:**
```bash
./scenarios/database-latency.sh dev 500 300
```

**매개변수:**
- `dev` 또는 `prod`: 대상 환경
- `500`: 시뮬레이션 지연 (ms)
- `300`: 지속 시간 (초)

**예상 동작:**
- ✅ API 응답 시간 증가
- ✅ 연결 풀 고갈 가능
- ✅ Lambda 타임아웃 발생 가능
- ✅ 자동 재시도로 최종 성공

**검증 사항:**
- [ ] 타임아웃이 적절하게 설정되어 있는가?
- [ ] 연결 풀 크기가 충분한가?
- [ ] 재시도 메커니즘이 작동하는가?

---

### 3. API Gateway Throttling (API 제한)

**목적:** API Gateway 제한 발생 시 시스템 동작 확인

**실행:**
```bash
./scenarios/api-gateway-throttle.sh dev 10 20 300
```

**매개변수:**
- `dev` 또는 `prod`: 대상 환경
- `10`: 요청/초 제한
- `20`: 버스트 용량
- `300`: 지속 시간 (초)

**예상 동작:**
- ✅ 429 Too Many Requests 에러
- ✅ 클라이언트 재시도 로직 작동
- ✅ 사용자에게 적절한 에러 메시지

**검증 사항:**
- [ ] 제한이 올바르게 적용되는가?
- [ ] 클라이언트가 재시도하는가?
- [ ] 에러 메시지가 사용자 친화적인가?

---

## 📖 런북 (Runbooks)

### 사용 가능한 런북

1. **[Lambda Failure Recovery](./runbooks/lambda-failure-recovery.md)**
   - Lambda 함수 장애 진단 및 복구
   - 5가지 시나리오 대응 방법
   - 롤백 절차 포함

2. **[Database Failure Recovery](./runbooks/database-failure-recovery.md)**
   - RDS 데이터베이스 장애 대응
   - 스냅샷 복구 절차
   - 데이터 손실 최소화 방법

3. **System Outage Recovery** (예정)
   - 전체 시스템 장애 대응
   - 우선순위 기반 복구

### 런북 사용법

```bash
# 1. 증상 확인
# 런북의 "Symptoms" 섹션 참조

# 2. 진단 수행
# "Diagnosis" 섹션의 명령어 실행

# 3. 해결 방법 적용
# 해당 시나리오의 "Resolution Steps" 실행

# 4. 검증
# "Verification" 섹션으로 복구 확인

# 5. 사후 조치
# "Post-Incident Actions" 체크리스트 수행
```

## 🚀 빠른 시작

### 사전 요구사항

1. **AWS CLI 설치 및 구성**
   ```bash
   aws configure
   # 또는 AWS SSO 사용
   aws sso login --profile pokehabit-dev
   ```

2. **적절한 권한**
   - Lambda 함수 수정 권한
   - RDS 모니터링 권한
   - API Gateway 구성 권한
   - CloudWatch 읽기 권한

3. **jq 설치** (JSON 파싱)
   ```bash
   # macOS
   brew install jq
   
   # Linux
   sudo apt-get install jq
   ```

4. **bc 설치** (계산용)
   ```bash
   # Ubuntu/Debian
   sudo apt-get install bc
   ```

### 첫 실험 실행

```bash
# 1. 저장소 클론
cd PokeHabit/chaos-engineering

# 2. 스크립트 실행 권한 부여
chmod +x scenarios/*.sh
chmod +x scripts/*.sh

# 3. Dev 환경에서 간단한 실험 실행
./scenarios/lambda-failure.sh dev pokemon-management 60

# 4. 결과 확인
cat results/lambda-failure-*.json
```

## ⚠️ 안전 수칙

### ✅ DO (해야 할 것)

1. **항상 Dev 환경에서 먼저 테스트**
   ```bash
   ./scenarios/lambda-failure.sh dev function-name 300
   ```

2. **프로덕션 실험 전 승인 받기**
   - 팀에 사전 통지
   - 비즈니스 영향 평가
   - 롤백 계획 준비

3. **업무 시간 외 실행** (가능하면)
   - 주말 또는 새벽 시간
   - 트래픽이 적은 시간대

4. **모니터링 준비**
   - CloudWatch 대시보드 열어두기
   - Datadog 모니터링
   - 알림 채널 확인

5. **롤백 계획 준비**
   - 수동 복구 방법 숙지
   - 필요한 권한 확보
   - 비상 연락망 준비

### ❌ DON'T (하지 말아야 할 것)

1. **프로덕션에서 무단 실험 금지**
2. **복구 절차 없이 실험 금지**
3. **피크 시간대 실험 금지**
4. **여러 시스템 동시 실험 금지**
5. **실험 결과 문서화 생략 금지**

## 📊 실험 결과 분석

### 결과 파일 위치

```bash
chaos-engineering/results/
├── lambda-failure-20241218-143022.json
├── database-latency-20241218-150015.json
└── api-throttle-20241218-153045.json
```

### 결과 파일 형식

```json
{
  "experiment": "lambda-failure",
  "timestamp": "2024-12-18T14:30:22Z",
  "environment": "dev",
  "function": "pokehabit-dev-pokemon-management",
  "duration": 300,
  "status": "completed",
  "recovery": "successful",
  "notes": "Function was disabled for 300 seconds and recovered successfully"
}
```

### 메트릭 수집

```bash
# CloudWatch에서 메트릭 조회
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=pokehabit-dev-pokemon-management \
  --start-time 2024-12-18T14:00:00Z \
  --end-time 2024-12-18T15:00:00Z \
  --period 300 \
  --statistics Sum
```

## 🎓 DevOps 포트폴리오 쇼케이스

이 카오스 엔지니어링 프레임워크는 다음을 시연합니다:

### 기술적 역량
✅ **시스템 복원력**: 장애 상황 대응 설계  
✅ **자동화**: 재사용 가능한 스크립트  
✅ **모니터링**: CloudWatch, Datadog 통합  
✅ **인프라 코드**: AWS CLI, Terraform  

### 운영 역량
✅ **재해 복구 계획**: 체계적인 런북  
✅ **사고 대응**: 명확한 에스컬레이션 절차  
✅ **문서화**: 상세한 절차 및 가이드  
✅ **위험 관리**: 안전 수칙 및 검증  

### 비즈니스 가치
✅ **고가용성**: 99.9% 가동률 목표  
✅ **빠른 복구**: RTO 30분, RPO 5분  
✅ **비용 최적화**: 효율적인 리소스 활용  
✅ **규정 준수**: 재해 복구 요구사항 충족  

## 🔄 정기 훈련 일정

### 월간 (Dev 환경)
- [ ] Lambda 장애 시뮬레이션
- [ ] API 제한 테스트
- [ ] 모니터링 알람 검증

### 분기별 (Dev 환경)
- [ ] 데이터베이스 장애 훈련
- [ ] 전체 시스템 복구 훈련
- [ ] 런북 업데이트 및 검토

### 연간 (Prod 환경)
- [ ] 프로덕션 카오스 데이
- [ ] 재해 복구 전체 훈련
- [ ] 팀 교육 및 워크샵

## 📚 참고 자료

### 카오스 엔지니어링
- [Principles of Chaos Engineering](https://principlesofchaos.org/)
- [Netflix Chaos Monkey](https://netflix.github.io/chaosmonkey/)
- [AWS Fault Injection Simulator](https://aws.amazon.com/fis/)

### AWS 고가용성
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [AWS Disaster Recovery](https://aws.amazon.com/disaster-recovery/)
- [RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)

### 모니터링 및 알림
- [CloudWatch Best Practices](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Best_Practice_Recommended_Alarms_AWS_Services.html)
- [Datadog APM](https://docs.datadoghq.com/tracing/)

## 🤝 기여하기

새로운 시나리오나 런북을 추가하려면:

1. `scenarios/` 또는 `runbooks/`에 파일 생성
2. 표준 템플릿 따르기
3. 테스트 및 문서화
4. Pull Request 생성

## 📧 연락처

질문이나 제안 사항이 있으면 이슈를 생성해주세요.

## 📝 버전 히스토리

- **v1.0.0** (2024-12-18): 초기 릴리스
  - Lambda 장애 시나리오
  - 데이터베이스 지연 시나리오
  - API Gateway 제한 시나리오
  - 기본 런북 2개
