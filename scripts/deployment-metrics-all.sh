#!/bin/bash
# All Environments Deployment Metrics Summary
# 모든 환경의 배포 성공률 요약

set -e

DAYS_BACK=${1:-30}

echo "================================================"
echo "📊 Poff 배포 성공률 종합 리포트"
echo "================================================"
echo ""
echo "기간: 최근 ${DAYS_BACK}일"
echo "생성일시: $(TZ='Asia/Seoul' date '+%Y-%m-%d %H:%M:%S KST')"
echo ""

# Function to get metrics for a workflow
get_metrics() {
    local WORKFLOW_NAME=$1
    local ENV_NAME=$2
    
    RUNS=$(gh run list \
        --workflow "$WORKFLOW_NAME" \
        --limit 100 \
        --json conclusion,status,createdAt \
        --jq "[.[] | select(.createdAt >= \"$(date -d "$DAYS_BACK days ago" +%Y-%m-%d)\")]" 2>/dev/null || echo "[]")
    
    TOTAL=$(echo "$RUNS" | jq 'length')
    SUCCESS=$(echo "$RUNS" | jq '[.[] | select(.conclusion == "success")] | length')
    FAILURE=$(echo "$RUNS" | jq '[.[] | select(.conclusion == "failure")] | length')
    ROLLBACKS=$(echo "$RUNS" | jq '[.[] | select(.conclusion == "success" and (.name | contains("Rollback") or contains("rollback")))] | length')
    
    if [ "$TOTAL" -gt 0 ]; then
        SUCCESS_RATE=$(echo "scale=1; $SUCCESS * 100 / $TOTAL" | bc)
        FAILURE_RATE=$(echo "scale=1; $FAILURE * 100 / $TOTAL" | bc)
    else
        SUCCESS_RATE="0"
        FAILURE_RATE="0"
    fi
    
    # Determine status emoji
    if (( $(echo "$FAILURE_RATE <= 5" | bc -l) )); then
        STATUS="🟢"
        GRADE="Elite"
    elif (( $(echo "$FAILURE_RATE <= 10" | bc -l) )); then
        STATUS="🟡"
        GRADE="High"
    elif (( $(echo "$FAILURE_RATE <= 15" | bc -l) )); then
        STATUS="🟠"
        GRADE="Medium"
    else
        STATUS="🔴"
        GRADE="Low"
    fi
    
    echo "┌─────────────────────────────────────────────┐"
    echo "│ $STATUS $ENV_NAME 환경"
    echo "├─────────────────────────────────────────────┤"
    printf "│ %-20s %22s │\n" "전체 배포:" "$TOTAL 회"
    printf "│ %-20s %22s │\n" "성공:" "$SUCCESS 회 (${SUCCESS_RATE}%)"
    printf "│ %-20s %22s │\n" "실패:" "$FAILURE 회 (${FAILURE_RATE}%)"
    printf "│ %-20s %22s │\n" "롤백:" "$ROLLBACKS 회"
    printf "│ %-20s %22s │\n" "DORA 등급:" "$GRADE"
    echo "└─────────────────────────────────────────────┘"
    echo ""
}

echo "================================================"
echo "🏠 환경별 배포 성공률"
echo "================================================"
echo ""

# Dev Environment
get_metrics "deploy-dev.yml" "Development (Dev)"

# Production Environment
get_metrics "deploy-production.yml" "Production"

# CI Workflow (optional)
echo "================================================"
echo "🔄 CI 워크플로우 통계"
echo "================================================"
echo ""

CI_RUNS=$(gh run list \
    --workflow "ci.yml" \
    --limit 100 \
    --json conclusion,status,createdAt \
    --jq "[.[] | select(.createdAt >= \"$(date -d "$DAYS_BACK days ago" +%Y-%m-%d)\")]" 2>/dev/null || echo "[]")

CI_TOTAL=$(echo "$CI_RUNS" | jq 'length')
CI_SUCCESS=$(echo "$CI_RUNS" | jq '[.[] | select(.conclusion == "success")] | length')
CI_FAILURE=$(echo "$CI_RUNS" | jq '[.[] | select(.conclusion == "failure")] | length')

if [ "$CI_TOTAL" -gt 0 ]; then
    CI_SUCCESS_RATE=$(echo "scale=1; $CI_SUCCESS * 100 / $CI_TOTAL" | bc)
else
    CI_SUCCESS_RATE="0"
fi

echo "┌─────────────────────────────────────────────┐"
echo "│ 🔄 CI 빌드"
echo "├─────────────────────────────────────────────┤"
printf "│ %-20s %22s │\n" "전체 빌드:" "$CI_TOTAL 회"
printf "│ %-20s %22s │\n" "성공:" "$CI_SUCCESS 회"
printf "│ %-20s %22s │\n" "실패:" "$CI_FAILURE 회"
printf "│ %-20s %22s │\n" "성공률:" "${CI_SUCCESS_RATE}%"
echo "└─────────────────────────────────────────────┘"
echo ""

# Overall Summary
echo "================================================"
echo "📈 종합 요약"
echo "================================================"
echo ""

# Calculate overall metrics
DEV_RUNS=$(gh run list --workflow "deploy-dev.yml" --limit 100 --json conclusion,createdAt --jq "[.[] | select(.createdAt >= \"$(date -d "$DAYS_BACK days ago" +%Y-%m-%d)\")]" 2>/dev/null || echo "[]")
PROD_RUNS=$(gh run list --workflow "deploy-production.yml" --limit 100 --json conclusion,createdAt --jq "[.[] | select(.createdAt >= \"$(date -d "$DAYS_BACK days ago" +%Y-%m-%d)\")]" 2>/dev/null || echo "[]")

TOTAL_DEPLOYMENTS=$(($(echo "$DEV_RUNS" | jq 'length') + $(echo "$PROD_RUNS" | jq 'length')))
TOTAL_SUCCESS=$(($(echo "$DEV_RUNS" | jq '[.[] | select(.conclusion == "success")] | length') + $(echo "$PROD_RUNS" | jq '[.[] | select(.conclusion == "success")] | length')))
TOTAL_FAILURE=$(($(echo "$DEV_RUNS" | jq '[.[] | select(.conclusion == "failure")] | length') + $(echo "$PROD_RUNS" | jq '[.[] | select(.conclusion == "failure")] | length')))

if [ "$TOTAL_DEPLOYMENTS" -gt 0 ]; then
    OVERALL_SUCCESS_RATE=$(echo "scale=1; $TOTAL_SUCCESS * 100 / $TOTAL_DEPLOYMENTS" | bc)
    OVERALL_FAILURE_RATE=$(echo "scale=1; $TOTAL_FAILURE * 100 / $TOTAL_DEPLOYMENTS" | bc)
else
    OVERALL_SUCCESS_RATE="0"
    OVERALL_FAILURE_RATE="0"
fi

echo "• 전체 배포 시도: $TOTAL_DEPLOYMENTS 회"
echo "• 전체 성공: $TOTAL_SUCCESS 회 (${OVERALL_SUCCESS_RATE}%)"
echo "• 전체 실패: $TOTAL_FAILURE 회 (${OVERALL_FAILURE_RATE}%)"
echo ""

# DORA Metrics explanation
echo "================================================"
echo "📚 DORA 메트릭 기준"
echo "================================================"
echo ""
echo "🟢 Elite:  실패율 ≤ 5%  (성공률 ≥ 95%)"
echo "🟡 High:   실패율 5-10% (성공률 90-95%)"
echo "🟠 Medium: 실패율 10-15% (성공률 85-90%)"
echo "🔴 Low:    실패율 > 15% (성공률 < 85%)"
echo ""

# Recommendations
echo "================================================"
echo "💡 권장 사항"
echo "================================================"
echo ""

if (( $(echo "$OVERALL_FAILURE_RATE > 15" | bc -l) )); then
    echo "⚠️  전체 실패율이 높습니다 (>15%)"
    echo ""
    echo "권장 조치:"
    echo "  1. 최근 실패한 배포 로그 분석"
    echo "  2. 테스트 커버리지 확대"
    echo "  3. Staging 환경에서 충분한 검증"
    echo "  4. 롤백 계획 수립"
elif (( $(echo "$OVERALL_FAILURE_RATE > 10" | bc -l) )); then
    echo "📊 실패율이 다소 높습니다 (10-15%)"
    echo ""
    echo "권장 조치:"
    echo "  1. 실패 패턴 분석"
    echo "  2. 자동화 테스트 강화"
else
    echo "✅ 배포 안정성이 양호합니다!"
    echo ""
    echo "유지 조치:"
    echo "  1. 현재 프로세스 유지"
    echo "  2. 정기적인 모니터링 지속"
fi

echo ""
echo "================================================"
echo "📊 리포트 끝"
echo "================================================"
