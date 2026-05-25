# Poff API Server on ECS

Lambda 함수들을 단일 Docker 컨테이너로 통합하여 ECS on EC2에서 실행하기 위한 프로젝트입니다.

## 📁 구조

- `server.js`: Lambda 함수를 Express 라우터로 변환하는 메인 서버
- `Dockerfile`: Production용 Docker 이미지 빌드 설정
- `deploy.sh`: ECR 푸시 및 ECS 서비스 업데이트 스크립트
- `ecs-task-definition.json`: ECS 태스크 정의 템플릿

## 🚀 로컬 테스트 방법

1. 의존성 설치 (필요한 경우)
   ```bash
   cd ecs-server
   npm install
   ```

2. Docker 이미지 빌드
   ```bash
   # 프로젝트 루트에서 실행해야 합니다 (lambda 폴더 포함을 위해)
   cd ..
   docker build -f ecs-server/Dockerfile -t poff-api:local .
   ```

3. Docker 컨테이너 실행
   ```bash
   docker run -p 3000:3000 \
     -e DB_HOST=host.docker.internal \
     -e DB_USER=admin \
     -e DB_PASSWORD=poff123 \
     -e DB_NAME=poff \
     poff-api:local
   ```

4. API 테스트
   - Health check: `http://localhost:3000/health`
   - Data check: `http://localhost:3000/api/guest/icons`

## ☁️ AWS ECS 배포 가이드

### 1. 사전 준비 (AWS Console)
1. **ECR 리포지토리 생성**: `poff-api`
2. **ECS 클러스터 생성**: `poff-cluster` (EC2 Linux + Networking)
3. **Application Load Balancer (ALB) 생성**:
   - 리스너: HTTP 80
   - 타겟 그룹: `poff-api-tg` (HTTP 3000, Health check: `/health`)
4. **Parameter Store (SSM) 설정**:
   - DB 비밀번호 등을 안전하게 저장 (`/poff/db/password`)

### 2. 초기 배포
1. `ecs-task-definition.json` 파일에서 `<AWS_ACCOUNT_ID>`, `<REGION>`, `<DB_HOST>` 등을 실제 값으로 변경
2. Task Definition 등록:
   ```bash
   aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json
   ```
3. ECS 서비스 생성 (Console 또는 CLI):
   - Task Definition: `poff-api-task`
   - Launch Type: EC2
   - Desired Tasks: 2 (가용성 확보)
   - Load Balancer: `poff-api-tg` 연결

### 4. Terraform으로 인프라 배포

`terraform/environments/prod`에서 ECS 모듈이 활성화되어 있습니다.

```bash
cd terraform/environments/prod
terraform init
terraform plan
terraform apply
```

이 코드는 다음 리소스를 생성합니다:
- ECR Repository (`poff-api`)
- ECS Cluster 및 Auto Scaling Group
- Application Load Balancer (ALB)
- ECS Service (Placeholder)

**중요**: Terraform은 ECS Service를 생성하지만, 실제 애플리케이션 배포(Task Definition 업데이트)는 `deploy.sh` 스크립트나 CI/CD 파이프라인을 통해 관리하는 것이 좋습니다. Terraform은 인프라(껍데기)를 관리하고, 배포 스크립트는 애플리케이션(내용물)을 관리합니다.

## ⚠️ 주의사항

- **환경 변수**: 프로덕션 배포 시 `NODE_ENV=production`을 꼭 확인하세요.
- **보안**: DB 비밀번호 등의 민감 정보는 ECS Task Definition의 환경 변수에 직접 넣지 말고, AWS Systems Manager Parameter Store나 Secrets Manager를 사용하세요.
- **로그**: CloudWatch Logs (`/ecs/poff-api`)에서 애플리케이션 로그를 확인할 수 있습니다.
