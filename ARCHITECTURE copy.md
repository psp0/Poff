# AWS 인프라 취약점 및 관리 방안 종합표

## 📊 Compute & Serverless (Lambda, API Gateway)

| 번호 | 항목 | 이유 | 취약 부분 (미적용) | 추후 관리 |
|------|------|------|-------------------|-----------|
| 1 | VPC/네트워크 관련 | Lambda가 RDS(MySQL) 접근을 위해 VPC 내부에 배치되어 있어, 새로운 인스턴스 생성 시 네트워크 인터페이스(ENI)를 할당하는 과정에서 '콜드 스타트' 지연이 발생합니다. | 현재 Provisioned Concurrency(예약된 동시성)가 설정되어 있지 않습니다. 이로 인해 서비스 미사용 후 첫 접속 시 사용자가 수 초간의 로딩 지연을 직접 경험하게 됩니다. | CloudWatch의 Duration 및 InitTime 메트릭을 모니터링하여, 지연 시간이 사용자 경험을 해칠 수준이 되면 핵심 API 함수에 대해 유료 옵션인 Provisioned Concurrency 도입을 검토해야 합니다. |
| 2 | 타임아웃 관련 | 알 부화나 진화 트리 조회와 같은 복잡한 재귀 SQL 쿼리, 또는 외부 API 호출이 길어질 경우 설정된 시간 내에 응답하지 못하면 504 에러가 발생합니다. | 현재 타임아웃은 30초로 넉넉하지만, 'Slow Query'(느린 쿼리)에 대한 별도의 로깅이나 알림 체계가 없습니다. 즉, 어떤 쿼리가 성능 저하를 일으키는지 사전에 알기 어렵습니다. | RDS의 Slow Query Log를 활성화하고, 특정 시간(예: 3초) 이상 소요되는 쿼리를 정기적으로 추출하여 인덱스 최적화나 쿼리 튜닝을 진행해야 합니다. |
| 3 | 동시성 관련 | AWS 계정 단위의 전체 동시 실행 제한이 있어, 특정 API에 요청이 폭주하면 다른 모든 기능(로그인 등)까지 함께 먹통이 되는 현상이 발생할 수 있습니다. | 각 Lambda 함수별로 Reserved Concurrency(전용 동시성)가 할당되어 있지 않습니다. 하나의 함수가 자원을 모두 점유할 경우 서비스 전체가 마비될 위험이 있습니다. | 서비스 규모 확장 시 핵심 기능(사용자 인증 등)에 최소한의 전용 동시성을 할당하여 자원을 격리하고, Throttles 메트릭에 대한 알람을 설정해야 합니다. |
| 4 | 초기화/DB 연결 관련 | Lambda는 호출마다 인스턴스가 생성/삭제되므로, DB 연결 관리를 잘못하면 순식간에 DB의 최대 연결 수(max_connections)를 초과하여 서버가 다운됩니다. | 현재 database.js에서 connectionLimit: 1로 설정되어 있어 DB 서버는 안전하지만, 동시 요청이 많아질 경우 Lambda 내부에서 DB 연결을 기다리는 병목 현상이 발생할 수 있습니다. | 트래픽 증가에 따라 connectionLimit 수치를 최적화하거나, 보다 근본적인 해결을 위해 인프라 레벨에서 RDS Proxy 도입을 검토하여 연결 효율을 높여야 합니다. |
| 5 | CORS 설정 관련 | 보안을 위해 브라우저는 다른 도메인의 API 호출을 제한합니다. 프론트엔드(Vite)와 백엔드(API Gateway)의 도메인이 다르므로 정확한 허용 설정이 필수입니다. | 현재 백엔드 코드(response-utils.js)에서 허용 도메인(CORS_ALLOWED_ORIGIN)이 설정되지 않을 경우 *(모든 도메인 허용)을 사용하고 있어 보안상 취약합니다. | 운영 환경 배포 시 반드시 환경 변수를 통해 실제 서비스 중인 프론트엔드 도메인 주소만 허용하도록 엄격하게 제한해야 합니다. |
| 6 | CloudWatch 로그 보관 정책 | 로그를 무기한 보관할 경우 데이터 저장 비용이 매달 누적되어 불필요한 인프라 비용 지출의 원인이 됩니다. | 현재 Terraform에 보관 기간(retention)은 설정되어 있으나, 로그 양이 급증할 경우를 대비한 비용 모니터링이나 오래된 로그를 저렴한 저장소(S3)로 옮기는 아카이빙 전략이 없습니다. | 프로젝트 운영 비용을 정기적으로 검토하여 서비스 중요도에 따라 보관 기간(예: 30일 또는 90일)을 조정하고, 법적 근거가 필요한 로그는 별도로 백업하는 자동화 프로세스를 마련해야 합니다. |

## 🗄️ Database & Storage (RDS MySQL, S3)

| 번호 | 항목 | 이유 | 취약 부분 | 추후 관리 |
|------|------|------|----------|-----------|
| 1 | RDS 스토리지 및 용량 관리 | 서비스가 지속되면 바이너리 로그와 데이터는 필연적으로 증가하여 스토리지 부족을 유발합니다. | 현재 Terraform 설정상 binlog_retention_hours 같은 로그 자동 삭제 설정이 명시적으로 보이지 않아, 디스크가 조용히 가득 찰 위험이 있습니다. | 바이너리 로그 보관 주기를 짧게(예: 24시간) 설정하고, FreeStorageSpace 메트릭에 대한 CloudWatch 알람을 설정해야 합니다. |
| 2 | RDS 메모리 및 CPU 성능 | 현재 t3 계열(Burstable) 인스턴스를 사용할 가능성이 높은데, 이는 CPU 크레딧(사용권) 개념이 있어 크레딧 고갈 시 성능이 급락합니다. | 트래픽이 갑자기 몰릴 경우 CPU 크레딧이 0이 되어 DB가 멈춘 것처럼 반응할 수 있습니다. | CPUCreditBalance 지표를 모니터링하고, 크레딧 고갈이 잦다면 m5 같은 고정 성능 인스턴스로 변경을 고려해야 합니다. |
| 3 | RDS 연결 및 동시성 관리 | AWS Lambda는 실행될 때마다 DB 연결을 맺을 수 있어, 트래픽 급증 시 RDS의 Max Connections 한계에 쉽게 도달합니다. | rds-proxy.tf 파일은 존재하지만 기본 설정(enable_rds_proxy)이 false로 되어 있어, 실제로는 커넥션 풀링 없이 직접 연결하고 있을 가능성이 큽니다. | 프로덕션 환경에서는 RDS Proxy를 활성화하여 커넥션을 재사용하고, Lambda 코드 내 callbackWaitsForEmptyEventLoop = false 설정을 확인해야 합니다. |
| 4 | RDS 쿼리 성능 최적화 (슬로우 쿼리) | pokemon-collection 등에서 WITH RECURSIVE 같은 복잡한 Raw SQL을 사용하고 있어 데이터가 쌓이면 쿼리가 느려질 수 있습니다. | 쿼리 실행 계획을 주기적으로 확인하지 않으면, 특정 데이터 분포에서 인덱스를 타지 않고 풀스캔(Full Scan)이 발생할 수 있습니다. | RDS의 Slow Query Log를 활성화하고, Performance Insights를 통해 느린 쿼리를 주기적으로 튜닝해야 합니다. |
| 5 | RDS 파라미터 및 설정 관리 | Terraform(IaC)으로 인프라를 관리하므로, 설정 변경이 자동화되어 있습니다. | 일부 파라미터는 변경 시 DB 재부팅을 유발합니다. 배포 과정에서 의도치 않게 DB가 재시작되어 서비스 중단이 발생할 수 있습니다. | 파라미터 그룹을 별도로 관리하고, 변경 사항 적용 시 apply_immediately 옵션이 재부팅을 유발하는지 사전에 검토해야 합니다. |
| 6 | RDS 백업 및 내보내기 | 데이터 유실 사고에 대비한 최후의 보루입니다. | 자동 스냅샷은 생성되지만, 이를 실제 복구해보거나 S3로 내보내는 권한(KMS, IAM) 설정이 복잡하여 막상 필요할 때 실패할 수 있습니다. | 주기적으로 스냅샷을 이용해 테스트 DB를 복원해보는 복구 훈련(DR)을 수행해야 합니다. |
| 7 | S3 스토리지 및 비용 최적화 | 포켓몬 이미지, 사운드 등 정적 자산이 계속 쌓이는 구조입니다. | 버전 관리(Versioning)가 켜져 있다면 덮어씌워진 구버전 파일들이 숨겨진 채로 비용을 발생시킬 수 있으며, 실패한 멀티파트 업로드 조각들이 남을 수 있습니다. | S3 Lifecycle Rule(수명 주기 규칙)을 설정하여 불필요한 이전 버전 파일과 미완료 업로드 조각을 자동으로 삭제해야 합니다. |
| 8 | S3 보안 및 권한 관리 | 퍼블릭하게 접근해야 하는 이미지(Assets)와 프라이빗하게 관리해야 하는 로그/백업이 공존합니다. | 실수로 프라이빗 버킷의 설정을 변경하여 전체 공개(Public)로 만들거나, Lambda가 과도한 S3 권한(예: s3:*)을 가질 수 있습니다. | 계정 수준에서 '퍼블릭 액세스 차단(Block Public Access)'을 검토하고, IAM 역할에는 최소 권한 원칙을 적용해야 합니다. |
| 9 | 종합 모니터링 전략 | 장애 발생 시 원인을 빠르게 파악하고 대응하기 위함입니다. | 단순히 "서버가 켜져 있다" 정도만 확인하고, 실제 사용자 경험에 영향을 주는 "DB 연결 수 임박", "디스크 여유 공간 부족" 등의 전조 증상을 놓칠 수 있습니다. | CloudWatch Alarm을 통해 DatabaseConnections, FreeStorageSpace, CPUCreditBalance 등 핵심 지표에 대한 임계값 알림을 설정해야 합니다. |

## 🌐 Network & CDN (CloudFront, Route53, NAT Instance)

| 번호 | 항목 | 이유 | 취약 부분 (현재 미적용) | 추후 관리 |
|------|------|------|----------------------|-----------|
| 1 | NAT 인스턴스 성능 및 가용성 (가장 중요) | 비용 절감을 위해 AWS Managed NAT Gateway 대신 EC2(t3.micro)를 NAT 인스턴스로 사용하고 있습니다. Lambda가 외부 API를 호출할 때 이 인스턴스를 통과합니다. | 병목 현상: t3.micro는 네트워크 대역폭이 작아(최대 5Gbps, 기준 성능은 훨씬 낮음) 트래픽이 몰리면 패킷 드랍이 발생할 수 있습니다. 단일 장애점(SPOF): NAT 인스턴스가 죽으면 Private Subnet의 Lambda가 인터넷을 못 써서 외부 API 호출이 전면 중단됩니다. (현재 Auto Scaling이나 자동 복구 구성 여부 불확실) | 모니터링: NAT 인스턴스의 CPUCreditBalance와 NetworkPacketsOut을 필수적으로 감시해야 합니다. 스케일업: 트래픽 증가 시 인스턴스 타입을 t3.medium 등으로 올리거나, 안정성이 중요해지면 비용을 감수하고 NAT Gateway로 전환해야 합니다. |
| 2 | Lambda VPC 콜드 스타트 (Cold Start) | Lambda가 RDS(Private Subnet)에 접근하기 위해 VPC 내부에 배치되어 있습니다. | 초기 지연: VPC에 연결된 Lambda는 ENI(네트워크 인터페이스)를 생성하고 연결하는 과정 때문에, 오랫동안 실행되지 않다가 실행될 때(콜드 스타트) 수 초(1~3초 이상)의 지연이 발생할 수 있습니다. 사용자 경험 저하: 앱을 켜고 첫 데이터를 불러올 때 로딩이 길어질 수 있습니다. | Provisioned Concurrency: 핵심 API(예: 메인 홈 로딩)에는 '프로비저닝된 동시성'을 설정하여 미리 웜(Warm) 상태를 유지하는 것을 고려해야 합니다. (비용 발생) |
| 3 | S3 트래픽 비용 및 경로 최적화 (VPC 엔드포인트) | Lambda가 S3(이미지 업로드/다운로드 등)에 접근할 때, 현재 설정으로는 NAT 인스턴스를 타고 인터넷을 거쳐 S3로 갈 가능성이 높습니다. | 불필요한 비용: AWS 내부 통신임에도 NAT를 거치면 데이터 처리 비용($0.045/GB)이 발생합니다. 속도 저하: NAT 인스턴스 대역폭을 잡아먹습니다. | Gateway Endpoint: VPC 내에 S3 Gateway Endpoint(무료)를 설정하여, Lambda가 NAT를 거치지 않고 S3에 직접 접근하도록 라우팅 테이블을 수정해야 합니다. |
| 4 | CloudFront 캐싱 효율성 | PWA 정적 파일과 API 응답을 CloudFront가 처리합니다. | MinTTL=0 설정: Terraform 설정에 min_ttl = 0이 되어 있어, 오리진(S3/Lambda)이 실수로 Cache-Control: no-cache를 보내면 캐싱이 전혀 안 될 수 있습니다. 쿼리 스트링: API 캐싱 설정에서 쿼리 스트링을 모두 허용(query_string = true)하면, 파라미터 순서만 달라도 다른 캐시로 인식되어 캐시 적중률이 떨어질 수 있습니다. | 헤더 최적화: Lambda 응답 헤더에 명확한 max-age를 설정하고, 불필요한 쿼리 파라미터는 CloudFront 정책에서 제외해야 합니다. |
| 5 | WAF 오탐(False Positive) 가능성 | API Gateway와 CloudFront 앞에 AWS WAF가 적용되어 있으며, CommonRuleSet 등 관리형 규칙을 사용 중입니다. | 정상 요청 차단: 포켓몬 데이터나 사용자 입력값(JSON)에 SQL 구문과 유사한 패턴이나 특수문자가 포함될 경우, WAF가 이를 공격으로 오인하여 403 Forbidden을 리턴할 수 있습니다. 현재 예외 처리(Whitelist)가 되어 있지 않습니다. | 로그 분석: WAF 차단 로그를 주기적으로 확인하여 정상 요청이 막히는지 보고, 필요시 해당 규칙만 Count 모드로 바꾸거나 예외 처리를 해야 합니다. |
| 6 | RDS 연결 관리 (Connection Pooling) | Lambda는 상태가 없으므로(Stateless), 요청마다 DB 연결을 새로 맺으면 RDS에 부하가 큽니다. | 연결 고갈: 트래픽이 폭주하여 Lambda가 수백 개 동시에 뜨면, RDS의 최대 연결 수(Max Connections)를 초과하여 Too many connections 에러가 날 수 있습니다. 현재 RDS Proxy가 적용되어 있지 않은 것으로 보입니다. | RDS Proxy 도입: Lambda와 RDS 사이에 RDS Proxy를 두어 DB 연결을 재사용하고 부하를 조절하는 것이 장기적으로 필수적입니다. |

## 🛡️ Security & Auth (IAM, Secrets Manager)

| 번호 | 항목 | 이유 | 취약 부분 | 추후 관리 |
|------|------|------|----------|-----------|
| 1 | Secrets Manager 접근 실패 | database.js#34-52에서 DB_SECRET_ARN으로 Secrets Manager 조회 로직이 구현되어 있습니다. | Secrets Manager 호출 실패 시 에러만 throw하고 fallback 없이 Cold start 시 네트워크 지연으로 실패할 수 있습니다. | Secrets Manager 캐싱을 Lambda 컨텍스트 재사용을 통해 구현하고, retry 로직을 추가해야 합니다. CloudWatch 알람으로 GetSecretValue 실패를 모니터링합니다. |
| 2 | IAM 권한 부족 | main.tf#134-163에서 Lambda IAM Role에 SSM, KMS 권한을 부여하고 있습니다. | kms:Decrypt에 Resource = "*"를 사용하여 최소 권한 원칙을 위반하고 있습니다. | 특정 KMS 키 ARN만 허용하도록 변경하고, IAM Access Analyzer로 사용하지 않는 권한을 탐지해야 합니다. CloudTrail로 AccessDenied 이벤트를 모니터링합니다. |
| 3 | 하드코딩된 크리덴셜 | auth.js#15-24에서 FIREBASE_SERVICE_ACCOUNT를 환경변수로 관리하고, compute/main.tf에서 환경변수로 민감정보를 전달합니다. | Firebase 서비스 계정이 Lambda 환경변수에 평문으로 저장되어 로그 출력 시 노출 위험이 있습니다. | CloudWatch Logs Data Protection을 활성화하고, 로그에서 민감정보를 마스킹 처리해야 합니다. 환경변수 대신 Secrets Manager 사용을 검토합니다(콜드 스타트 트레이드오프 고려). |
| 4 | 보안 그룹(SG) 실수 | main.tf#38-46에서 RDS egress가 0.0.0.0/0으로 설정되어 있습니다. | RDS 보안 그룹 egress 규칙이 모든 트래픽을 허용하여 필요 이상으로 열려 있습니다. | egress 규칙을 필요한 포트/대상으로 제한하고, AWS Config Rule로 보안 그룹 감사를 자동화해야 합니다. Security Hub로 지속적 모니터링을 수행합니다. |
| 5 | JWT 토큰 위변조 | auth.js#40-57에서 Firebase ID Token 검증을 구현하고 있습니다. | 토큰 검증 실패 시 상세 에러 로깅이 없어 위변조 시도 패턴 추적이 어렵습니다. | 401 에러 발생 시 IP, User-Agent 등 메타데이터를 로깅하고, CloudWatch Insights로 Invalid token 패턴 대시보드를 생성해야 합니다. 특정 임계치 초과 시 알람을 설정합니다. |
| 6 | Throttling 공격 방어 | waf/main.tf에 WAF 구성이 있고, main.tf#250-253에 API Gateway throttling이 설정되어 있습니다. | WAF에 Rate Limit 룰이 없으며, API Gateway throttling만 설정되어 WAF 레벨 차단이 미구현되어 있습니다. | WAF에 RateBasedStatement 룰을 추가하여 IP당 요청을 제한하고, CloudWatch 메트릭으로 요청량 이상을 탐지해야 합니다. 특정 IP 자동 차단 Lambda 구현을 검토합니다. |
| 7 | SSM 파라미터 변경 이력 | main.tf#80-116에서 SSM Parameter Store에 DB 크리덴셜을 저장하고 있습니다. | SSM 파라미터 변경에 대한 CloudTrail 모니터링/알람이 미설정되어 있습니다. | CloudTrail에서 ssm:PutParameter 이벤트를 추적하고, EventBridge + SNS로 파라미터 변경 시 알람을 설정해야 합니다. 변경 이력을 문서화합니다. |
| 8 | KMS 키 접근 권한 불일치 | main.tf#152-163에서 Lambda에 kms:Decrypt 권한을 부여하고 있습니다. | KMS 권한이 Resource = "*"로 설정되어 모든 KMS 키에 접근할 수 있습니다. | 특정 KMS 키 ARN으로 제한하고, KMS 키 정책에서 Lambda 역할을 명시적으로 허용해야 합니다. IAM Policy Simulator로 권한을 검증합니다. |
| 9 | SSM Parameter Store의 민감한 정보 평문 저장 | main.tf#81-89에서 username을 String 타입으로 저장하고, password만 SecureString으로 저장합니다. | RDS username이 평문(String)으로 저장되어 있습니다. | username도 SecureString으로 변경을 검토하고, AWS Config Rule ssm-parameter-type-check를 적용해야 합니다. 민감 파라미터 목록을 정기적으로 감사합니다. |
| 10 | Lambda 함수의 환경 변수에 시크릿 노출 | main.tf#192-224에서 FIREBASE_SERVICE_ACCOUNT, FIREBASE_API_KEY 등이 환경변수로 설정되어 있습니다. | 민감한 Firebase 크리덴셜이 Lambda 환경변수에 직접 저장되어 콘솔에서 평문으로 노출됩니다. | CloudWatch Logs Data Protection을 활성화하고, 로그에서 크리덴셜 패턴을 자동으로 마스킹해야 합니다. Secrets Manager 사용을 검토합니다(콜드스타트 vs 보안 트레이드오프 고려). |
| 11 | API Gateway 커스텀 Authorizer 오류로 인한 요청 지연 | Lambda 함수에서 직접 Firebase 토큰 검증을 수행합니다(auth.js). | Firebase Admin SDK 초기화가 콜드 스타트마다 발생하고, 토큰 검증 결과 캐싱이 없습니다. | Lambda SnapStart 활성화를 검토하고(Node.js 지원 확인), Firebase Admin 인스턴스 재사용을 확인해야 합니다. CloudWatch X-Ray로 검증 시간을 추적합니다. |
| 12 | VPC 엔드포인트 정책으로 인한 Secrets Manager 접근 거부 | Lambda가 VPC 내에서 실행됩니다(main.tf#183-186). | VPC 엔드포인트 정책이 명시적으로 정의되지 않아 NAT를 통해 외부 접근이 필요합니다. | SSM/Secrets Manager VPC 엔드포인트 추가를 검토하고, VPC Flow Logs로 네트워크 문제를 추적해야 합니다. NAT 비용 절감을 위한 엔드포인트를 활용합니다. |
| 13 | Lambda Concurrency 초과로 인한 "rate exceeded" 에러 | compute/main.tf에서 Lambda 함수 7개를 정의하고 있습니다. | Reserved/Provisioned Concurrency가 미설정되어 트래픽 급증 시 throttling이 발생할 수 있습니다. | 핵심 함수에 Reserved Concurrency를 설정하고, CloudWatch 알람으로 ConcurrentExecutions를 모니터링해야 합니다. Throttles 메트릭 알람을 설정합니다. |
| 14 | CORS 정책 오류로 인한 API 호출 실패 | main.tf#233-243에서 API Gateway CORS를 설정하고 있습니다. | allow_credentials = false로 설정되어 추후 쿠키 기반 인증 도입 시 문제가 발생할 수 있습니다. | 프로덕션 도메인만 allow_origins에 명시하고, CORS 설정을 정기적으로 검토해야 합니다. 브라우저 콘솔에서 CORS 에러를 모니터링합니다. |
| 15 | Lambda 함수의 S3 버킷 액세스 권한 거부 | 프로젝트에 S3 자산 버킷(poff-assets, CloudFront CDN)을 사용하고 있습니다. | Lambda IAM 정책에 S3 접근 권한이 명시되지 않았습니다(현재는 CDN을 통해 접근). | Lambda에서 S3 직접 접근이 필요할 경우 최소 권한 정책을 추가하고, 특정 버킷 ARN만 허용해야 합니다. AWS Access Analyzer로 정기적으로 검증합니다. |