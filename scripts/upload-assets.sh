#!/bin/bash
# Upload poff-assets to S3
# Usage: ./scripts/upload-assets.sh <dev|prod> [--dry-run] [--delete]

set -e

# === Configuration ===
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ASSETS_DIR="$PROJECT_ROOT/poff-assets"
MANIFEST_FILE="$SCRIPT_DIR/assets-manifest.txt"

# === Parse Arguments ===
ENV="" DRY_RUN="" DELETE="" PROFILE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    dev|prod)
      ENV="$1"
      shift
      ;;
    --dry-run)
      DRY_RUN="--dryrun"
      shift
      ;;
    --delete)
      DELETE="--delete"
      shift
      ;;
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 <dev|prod> [--profile <name>] [--dry-run] [--delete]"
      exit 0
      ;;
    *)
      echo "❌ Error: Unknown argument '$1'"
      exit 1
      ;;
  esac
done

if [[ -n "$PROFILE" ]]; then
  export AWS_PROFILE="$PROFILE"
fi

[[ -z "$ENV" ]] && { echo "❌ Error: Environment required (dev or prod)"; exit 1; }
[[ ! -d "$ASSETS_DIR" ]] && { echo "❌ Error: Assets directory not found"; exit 1; }

# === Get S3 Bucket (convention-based naming) ===
ASSETS_BUCKET_NAME="poff-${ENV}-assets"
echo "✅ Assets Bucket: $ASSETS_BUCKET_NAME"

# === Sync Function ===
sync_dir() {
  local name=$1 local_path=$2 exclude_info=${3:-false}
  local cache_age=${4:-31536000}  # Default: 1 year, can override with 4th arg
  [[ ! -d "$local_path" ]] && { echo "⚠️  Skipping $name (not found)"; return; }
  
  echo "📁 Uploading $name (cache: ${cache_age}s)..."
  
  # Use array for safe argument passing (prevents glob expansion)
  local opts=()
  [[ -n "$DRY_RUN" ]] && opts+=("--dryrun")
  [[ -n "$DELETE" ]] && opts+=("--delete")
  [[ "$exclude_info" == "true" ]] && opts+=(--exclude "info/*")
  
  aws s3 sync "$local_path/" "s3://$ASSETS_BUCKET_NAME/$name/" \
    --cache-control "max-age=$cache_age" \
    --exclude "*.DS_Store" --exclude ".gitkeep" --exclude "desktop.ini" \
    "${opts[@]}"
  echo "✅ $name done"
}

# === Upload Manifest Files ===
upload_manifest_files() {
  [[ ! -f "$MANIFEST_FILE" ]] && { echo "⚠️  Manifest not found, skipping info files"; return; }
  
  echo "📄 Uploading info files from manifest..."
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and empty lines
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    line=$(echo "$line" | xargs)  # trim
    
    local file="$ASSETS_DIR/$line"
    if [[ -f "$file" ]]; then
      [[ -n "$DRY_RUN" ]] && echo "  [dry-run] $line" && continue
      aws s3 cp "$file" "s3://$ASSETS_BUCKET_NAME/$line" \
        --cache-control "max-age=86400" --content-type "text/plain; charset=utf-8" --quiet
      echo "  ✅ $line"
    else
      echo "  ⚠️  Not found: $line"
    fi
  done < "$MANIFEST_FILE"
}

# === Main ===
echo ""
echo "━━━ Poff Assets Upload ━━━"
echo "Environment: $ENV | Profile: ${AWS_PROFILE:-default} | Dry-run: ${DRY_RUN:-no} | Delete: ${DELETE:-no}"
echo ""

sync_dir "base" "$ASSETS_DIR/base" true           # exclude info/, cache: 1 year
upload_manifest_files                              # upload only manifest files
sync_dir "external" "$ASSETS_DIR/external" false 604800  # cache: 1 week (7*24*60*60)
sync_dir "custom" "$ASSETS_DIR/custom"              # cache: 1 year (default)

echo ""
echo "🎉 Upload complete!"
echo "최종적으로 이 에셋들을 db 테이블에 반영하고 싶다면 seed-rds.yml를 수행하세요"