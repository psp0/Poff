#!/bin/bash
# Send Deployment Event and Metrics to Datadog
# 배포 이벤트와 메트릭을 Datadog으로 전송

set -e

# 필수 환경 변수
DATADOG_API_KEY="${DATADOG_API_KEY}"
DATADOG_SITE="${DATADOG_SITE:-datadoghq.com}"

# 배포 정보 (인자 또는 환경 변수)
DEPLOYMENT_STATUS="${1:-$DEPLOYMENT_STATUS}"  # success, failure, rollback
ENVIRONMENT="${2:-$ENVIRONMENT:-production}"
VERSION="${3:-$VERSION:-unknown}"
DURATION_SECONDS="${4:-$DURATION_SECONDS:-0}"
INFRA_DURATION="${5:-0}"  # 인프라(Terraform) 소요 시간 추가
DEPLOYER="${6:-$GITHUB_ACTOR:-unknown}"
COMMIT_SHA="${7:-$GITHUB_SHA:-unknown}"

# 입력값 검증
if [ -z "$DATADOG_API_KEY" ]; then
    echo "오류: DATADOG_API_KEY가 필요합니다."
    exit 1
fi

if [ -z "$DEPLOYMENT_STATUS" ]; then
    echo "오류: DEPLOYMENT_STATUS가 필요합니다 (success|failure|rollback)"
    exit 1
fi

# 상태에 따른 제목 및 타입 설정
case "$DEPLOYMENT_STATUS" in
    success)
        ALERT_TYPE="success"
        TITLE="✅ 배포 성공 ($ENVIRONMENT)"
        ;;
    failure)
        ALERT_TYPE="error"
        TITLE="❌ 배포 실패 ($ENVIRONMENT)"
        ;;
    rollback)
        ALERT_TYPE="warning"
        TITLE="⏪ 롤백 실행 ($ENVIRONMENT)"
        ;;
    *)
        ALERT_TYPE="info"
        TITLE="ℹ️ 배포 이벤트 ($ENVIRONMENT)"
        ;;
esac

# 현재 타임스탬프
TIMESTAMP=$(date +%s)

echo "================================================"
echo "📤 Datadog으로 배포 데이터 전송 중"
echo "================================================"
echo "상태: $DEPLOYMENT_STATUS"
echo "환경: $ENVIRONMENT"
echo "버전: $VERSION"
echo "전체 소요 시간: ${DURATION_SECONDS}초"
echo "인프라 소요 시간: ${INFRA_DURATION}초"
echo ""

# 1. 배포 이벤트 전송
echo "배포 이벤트 전송 중..."

EVENT_PAYLOAD=$(cat <<EOF
{
  "title": "$TITLE",
  "text": "### 배포 리포트 ($ENVIRONMENT)\n\n**상태:** $DEPLOYMENT_STATUS\n**버전:** $VERSION\n**전체 시간:** ${DURATION_SECONDS}s\n**인프라 시간:** ${INFRA_DURATION}s\n**배포자:** $DEPLOYER\n**커밋:** ${COMMIT_SHA:0:7}",
  "alert_type": "$ALERT_TYPE",
  "priority": "normal",
  "tags": [
    "environment:$ENVIRONMENT",
    "deployment_status:$DEPLOYMENT_STATUS",
    "version:$VERSION",
    "deployer:$DEPLOYER",
    "service:poff"
  ],
  "source_type_name": "GITHUB_ACTIONS"
}
EOF
)

curl -X POST "https://api.${DATADOG_SITE}/api/v1/events" \
    -H "Content-Type: application/json" \
    -H "DD-API-KEY: ${DATADOG_API_KEY}" \
    -d "$EVENT_PAYLOAD" -s > /dev/null

# 2. 메트릭 전송 (배포 횟수 및 시간)
echo "메트릭 전송 중..."

# 롤백 여부 계산 (1 또는 0)
IS_ROLLBACK=0
if [ "$DEPLOYMENT_STATUS" = "rollback" ]; then IS_ROLLBACK=1; fi

METRICS_PAYLOAD=$(cat <<EOF
{
  "series": [
    {
      "metric": "deployment.count",
      "points": [[${TIMESTAMP}, 1]],
      "type": "count",
      "tags": ["environment:$ENVIRONMENT", "status:$DEPLOYMENT_STATUS", "service:poff"]
    },
    {
      "metric": "deployment.duration",
      "points": [[${TIMESTAMP}, ${DURATION_SECONDS}]],
      "type": "gauge",
      "tags": ["environment:$ENVIRONMENT", "status:$DEPLOYMENT_STATUS", "service:poff"]
    },
    {
      "metric": "deployment.infra_duration",
      "points": [[${TIMESTAMP}, ${INFRA_DURATION}]],
      "type": "gauge",
      "tags": ["environment:$ENVIRONMENT", "service:poff"]
    },
    {
      "metric": "deployment.rollback",
      "points": [[${TIMESTAMP}, ${IS_ROLLBACK}]],
      "type": "count",
      "tags": ["environment:$ENVIRONMENT", "service:poff"]
    }
  ]
}
EOF
)

curl -X POST "https://api.${DATADOG_SITE}/api/v2/series" \
    -H "Content-Type: application/json" \
    -H "DD-API-KEY: ${DATADOG_API_KEY}" \
    -d "$METRICS_PAYLOAD" -s > /dev/null

echo "✅ Datadog 데이터 전송 완료"
