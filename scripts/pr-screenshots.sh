#!/usr/bin/env bash
# PR 본문·완료 보고에 넣을 스크린샷을 공개 저장소 ytw418/pr-assets 에 올리고 붙여 넣을 줄을 찍는다.
#
# 사용: scripts/pr-screenshots.sh <파일...>
#   올릴 폴더는 <저장소>/<날짜>-<브랜치> 다(master·main·dev 면 브랜치 대신 커밋 7자리).
#   PR_ASSETS_DIR=breeder_web/pr-201 처럼 주면 그 폴더에 올린다.
#   파일 이름이 캡션이 된다: 01-profile-light.png → "01 profile light".
#   긴 변이 1600px 보다 크면 줄여 올린다. 같은 경로가 있으면 덮어쓰는데 raw 주소는 몇 분 캐시되니
#   다시 찍은 캡처는 이름을 바꿔(-v2) 올린다.
#
# 출력: 파일마다 PR 본문용 <img> 한 줄(표 칸에 넣는다)과 완료 보고용 ![캡션](URL) 한 줄.
# 규칙: AGENTS.md 'PR·완료 보고 스크린샷'. 사본: bredy_app·breeder_web 의 scripts/pr-screenshots.sh(같은 내용).
set -euo pipefail

ASSETS=ytw418/pr-assets
[ $# -gt 0 ] || { echo "사용: scripts/pr-screenshots.sh <파일...>" >&2; exit 1; }

dir=${PR_ASSETS_DIR:-}
if [ -z "$dir" ]; then
  repo=$(basename "$(git remote get-url origin)" .git)
  branch=$(git branch --show-current)
  case "$branch" in
    ""|master|main|dev) branch=$(git rev-parse --short=7 HEAD) ;;
  esac
  dir="$repo/$(date +%Y-%m-%d)-${branch//\//-}"
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

for file in "$@"; do
  [ -f "$file" ] || { echo "파일이 없습니다: $file" >&2; exit 1; }
  name=$(basename "$file")
  cp "$file" "$tmp/$name"
  case "$name" in
    *.png|*.jpg|*.jpeg)
      longest=$(sips -g pixelWidth -g pixelHeight "$tmp/$name" | awk '/pixel/ { if ($2 > m) m = $2 } END { print m + 0 }')
      [ "$longest" -le 1600 ] || sips -Z 1600 "$tmp/$name" >/dev/null
      ;;
  esac

  path="$dir/$name"
  sha=$(gh api "repos/$ASSETS/contents/$path" --jq .sha 2>/dev/null || true)
  base64 < "$tmp/$name" | tr -d '\n' > "$tmp/content.b64"
  jq -n --arg message "add $path" --rawfile content "$tmp/content.b64" --arg sha "$sha" \
    '{message: $message, content: $content} + (if $sha == "" then {} else {sha: $sha} end)' > "$tmp/body.json"
  gh api -X PUT "repos/$ASSETS/contents/$path" --input "$tmp/body.json" --silent

  url="https://raw.githubusercontent.com/$ASSETS/main/$path"
  caption=$(echo "${name%.*}" | tr '_-' '  ')
  echo "<img src=\"$url\" width=\"280\" alt=\"$caption\">"
  echo "![$caption]($url)"
done
