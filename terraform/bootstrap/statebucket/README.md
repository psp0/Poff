인프라계정으로 로컬에서 s3버킷 생성 (terraform init 후 apply)
terraform.tf에서 backend "local"은 주석처리 backend s3를 주석해제
backend.hcl 생성
terraform init -migrate-state -backend-config=backend.hcl를 수행해서 마이그레이션 진행
마이그레이션 되었다면 terraform.tfstate 삭제