# Scripts

이 디렉토리에는 프로젝트 관리를 위한 유틸리티 스크립트들이 포함되어 있습니다.

## upload-assets.sh

로컬의 `pokehabit-assets` 디렉토리를 S3에 업로드하는 스크립트입니다.

### 왜 별도 스크립트를 사용하나요?

**Best Practice**: 대용량 바이너리 파일(이미지, 오디오)은 Git 저장소에 저장하지 않고, 필요할 때 직접 S3에 업로드합니다.

**장점**:
- ✅ Git 저장소 크기 감소
- ✅ CI/CD 파이프라인 속도 향상
- ✅ Assets 업데이트를 배포와 분리
- ✅ 대역폭 및 스토리지 비용 절감

### 사용법

```bash
# Dev 환경에 업로드
./scripts/upload-assets.sh dev

# Prod 환경에 업로드 (미리보기)
./scripts/upload-assets.sh prod --dry-run

# Prod 환경에 업로드 (실제 업로드)
./scripts/upload-assets.sh prod

# S3에 없는 파일 삭제하면서 동기화
./scripts/upload-assets.sh prod --delete
```

### 옵션

- `dev` 또는 `prod`: 대상 환경 (필수)
- `--dry-run`: 실제 업로드 없이 미리보기
- `--delete`: 로컬에 없는 파일을 S3에서 삭제
- `--help`: 도움말 표시

### 사전 요구사항

1. **AWS CLI 설치 및 구성**
   ```bash
   aws configure
   ```

2. **적절한 AWS 권한**
   - SSM Parameter Store 읽기 권한
   - S3 버킷에 대한 쓰기 권한

3. **인프라 배포 완료**
   - Terraform으로 인프라가 배포되어 있어야 함
   - SSM에 S3 버킷 정보가 저장되어 있어야 함

### 업로드되는 디렉토리

- `pokehabit-assets/base/` → `s3://<bucket>/base/`
- `pokehabit-assets/external/` → `s3://<bucket>/external/`
- `pokehabit-assets/custom/` → `s3://<bucket>/custom/`

### 주의사항

⚠️ **Production 환경에 업로드할 때는 주의하세요!**

```bash
# 항상 먼저 dry-run으로 확인
./scripts/upload-assets.sh prod --dry-run

# 확인 후 실제 업로드
./scripts/upload-assets.sh prod
```

### 트러블슈팅

**문제**: `Error: Could not retrieve S3 bucket from SSM`

**해결**:
1. AWS 자격 증명이 올바른지 확인
2. 올바른 AWS 프로파일을 사용하고 있는지 확인
3. 인프라가 배포되었는지 확인

```bash
# SSM 파라미터 확인
aws ssm get-parameter --name "/pokehabit/dev/infrastructure/s3_bucket"
```

**문제**: `Error: Assets directory not found`

**해결**:
프로젝트 루트에서 스크립트를 실행하세요:
```bash
cd /path/to/pokehabit
./scripts/upload-assets.sh dev
```

## 기타 스크립트

추가 스크립트는 필요에 따라 이 디렉토리에 추가됩니다.
