#!/bin/bash
# Deployment Success Rate Analysis Script
# 배포 성공률 상세 분석 스크립트 (한글화 버전)

set -e

# 설정
REPO="${GITHUB_REPOSITORY:-}"
if [ -z "$REPO" ]; then
  REPO=$(git config --get remote.origin.url | sed 's/.*:\(.*\)\.git/\1/')
fi

DAYS_BACK=${1:-30}  # 기본값: 최근 30일
WORKFLOW_NAME=${2:-"deploy-production.yml"}  # 기본값: 운영 배포

# 색상 설정
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "================================================"
echo "📊 배포 성공률 상세 분석 리포트"
echo "================================================"
echo ""
echo "저장소: $REPO"
echo "워크플로우: $WORKFLOW_NAME"
echo "조회 기간: 최근 $DAYS_BACK일"
echo "생성일시: $(TZ='Asia/Seoul' date '+%Y-%m-%d %H:%M:%S KST')"
echo ""

# gh 설치 확인
if ! command -v gh &> /dev/null; then
    echo -e "${RED}오류: GitHub CLI (gh)가 설치되어 있지 않습니다.${NC}"
    echo "설치 안내: https://cli.github.com/"
    exit 1
fi

# 인증 확인
if ! gh auth status &> /dev/null; then
    echo -e "${RED}오류: GitHub CLI 인증이 되어 있지 않습니다.${NC}"
    echo "실행: gh auth login"
    exit 1
fi

# 날짜 계산
START_DATE=$(date -d "$DAYS_BACK days ago" +%Y-%m-%d)
echo -e "${BLUE}$START_DATE 이후의 실행 기록을 가져오는 중...${NC}"
echo ""

# 워크플로우 실행 기록 조회
RUNS=$(gh run list \
    --workflow "$WORKFLOW_NAME" \
    --limit 100 \
    --json conclusion,status,createdAt,name,headBranch,event,databaseId \
    --jq "[.[] | select(.createdAt >= \"$START_DATE\")]")

# 결과 집계
TOTAL=$(echo "$RUNS" | jq 'length')
SUCCESS=$(echo "$RUNS" | jq '[.[] | select(.conclusion == "success")] | length')
FAILURE=$(echo "$RUNS" | jq '[.[] | select(.conclusion == "failure")] | length')
CANCELLED=$(echo "$RUNS" | jq '[.[] | select(.conclusion == "cancelled")] | length')
IN_PROGRESS=$(echo "$RUNS" | jq '[.[] | select(.status == "in_progress")] | length')

# 성공률 계산
if [ "$TOTAL" -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=2; $SUCCESS * 100 / $TOTAL" | bc)
    FAILURE_RATE=$(echo "scale=2; $FAILURE * 100 / $TOTAL" | bc)
else
    SUCCESS_RATE=0
    FAILURE_RATE=0
fi

# 요약 표시
echo "================================================"
echo "📈 전체 통계"
echo "================================================"
echo ""
echo -e "전체 배포 시도:     ${BLUE}$TOTAL 회${NC}"
echo -e "✅ 성공:             ${GREEN}$SUCCESS 회${NC} (${SUCCESS_RATE}%)"
echo -e "❌ 실패:             ${RED}$FAILURE 회${NC} (${FAILURE_RATE}%)"
echo -e "⏹️  취소됨:           ${YELLOW}$CANCELLED 회${NC}"
echo -e "🔄 진행 중:          $IN_PROGRESS 회"
echo ""

# DORA 메트릭 분류
echo "================================================"
echo "🎯 DORA 메트릭 등급 (Change Failure Rate)"
echo "================================================"
echo ""

if (( $(echo "$FAILURE_RATE <= 5" | bc -l) )); then
    echo -e "등급: ${GREEN}Elite (최상위 - 5% 이하)${NC}"
elif (( $(echo "$FAILURE_RATE <= 10" | bc -l) )); then
    echo -e "등급: ${BLUE}High (높음 - 5~10%)${NC}"
elif (( $(echo "$FAILURE_RATE <= 15" | bc -l) )); then
    echo -e "등급: ${YELLOW}Medium (보통 - 10~15%)${NC}"
else
    echo -e "등급: ${RED}Low (낮음 - 15% 초과)${NC}"
fi
echo ""

# 최근 10개 배포 이력
echo "================================================"
echo "📜 최근 배포 이력 (최대 10개)"
echo "================================================"
echo ""

echo "$RUNS" | jq -r '.[:10] | .[] | 
    "\(.createdAt | split("T")[0]) " + 
    (if .conclusion == "success" then "✅ 성공" 
     elif .conclusion == "failure" then "❌ 실패" 
     elif .conclusion == "cancelled" then "⏹️ 취소" 
     else "🔄 진행" end) + " - " + 
    .name + " (" + .headBranch + ")"'

echo ""

# 주간 분석 (최근 4주)
echo "================================================"
echo "📅 주간별 추이"
echo "================================================"
echo ""

for i in {0..3}; do
    WEEK_START=$(date -d "$((i * 7)) days ago" +%Y-%m-%d)
    WEEK_END=$(date -d "$(((i + 1) * 7)) days ago" +%Y-%m-%d)
    
    WEEK_RUNS=$(echo "$RUNS" | jq "[.[] | select(.createdAt >= \"$WEEK_END\" and .createdAt < \"$WEEK_START\")]")
    WEEK_TOTAL=$(echo "$WEEK_RUNS" | jq 'length')
    WEEK_SUCCESS=$(echo "$WEEK_RUNS" | jq '[.[] | select(.conclusion == "success")] | length')
    WEEK_FAILURE=$(echo "$WEEK_RUNS" | jq '[.[] | select(.conclusion == "failure")] | length')
    
    if [ "$WEEK_TOTAL" -gt 0 ]; then
        WEEK_SUCCESS_RATE=$(echo "scale=1; $WEEK_SUCCESS * 100 / $WEEK_TOTAL" | bc)
    else
        WEEK_SUCCESS_RATE=0
    fi
    
    echo "기간: $WEEK_END ~ $WEEK_START"
    echo "  전체: $WEEK_TOTAL | 성공: $WEEK_SUCCESS | 실패: $WEEK_FAILURE | 성공률: ${WEEK_SUCCESS_RATE}%"
    echo ""
done

# 브랜치별 분석
echo "================================================"
echo "🌿 브랜치별 통계"
echo "================================================"
echo ""

BRANCHES=$(echo "$RUNS" | jq -r '[.[] | .headBranch] | unique | .[]')
while IFS= read -r BRANCH; do
    if [ -n "$BRANCH" ]; then
        BRANCH_RUNS=$(echo "$RUNS" | jq "[.[] | select(.headBranch == \"$BRANCH\")]")
        BRANCH_TOTAL=$(echo "$BRANCH_RUNS" | jq 'length')
        BRANCH_SUCCESS=$(echo "$BRANCH_RUNS" | jq '[.[] | select(.conclusion == "success")] | length')
        
        if [ "$BRANCH_TOTAL" -gt 0 ]; then
            BRANCH_SUCCESS_RATE=$(echo "scale=1; $BRANCH_SUCCESS * 100 / $BRANCH_TOTAL" | bc)
        else
            BRANCH_SUCCESS_RATE=0
        fi
        
        echo "$BRANCH: $BRANCH_SUCCESS/$BRANCH_TOTAL 회 (${BRANCH_SUCCESS_RATE}%)"
    fi
done <<< "$BRANCHES"

echo ""
echo "================================================"
echo "💡 분석 및 권장 사항"
echo "================================================"
echo ""

if (( $(echo "$FAILURE_RATE > 15" | bc -l) )); then
    echo "⚠️  실패율이 매우 높습니다 (15% 초과)"
    echo "   - 최근 실패한 배포의 로그를 정밀 분석하세요."
    echo "   - 사전 배포 테스트(CI) 단계를 강화해야 합니다."
    echo "   - 스테이징 환경에서의 검증 프로세스를 점검하세요."
elif (( $(echo "$FAILURE_RATE > 10" | bc -l) )); then
    echo "📊 실패율이 다소 높습니다 (10-15%)"
    echo "   - 실패 패턴이 있는지 확인하세요."
    echo "   - 자동화된 체크리스트 도입을 권장합니다."
else
    echo "✅ 배포 안정성이 매우 뛰어납니다!"
    echo "   - 현재의 배포 프로세스를 잘 유지하세요."
fi

echo ""
echo "================================================"
echo "📄 데이터 내보내기"
echo "================================================"
echo ""
echo "CSV로 내보내기:"
echo "  gh run list --workflow $WORKFLOW_NAME --limit 100 --json conclusion,createdAt,name > deployments.json"
echo ""
echo "Datadog으로 전송하기:"
echo "  scripts/send-deployment-to-datadog.sh 를 사용하세요."
echo ""
