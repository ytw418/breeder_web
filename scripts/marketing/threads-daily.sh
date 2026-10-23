#!/bin/bash
# 스레드 하루 일정 한 번(threads-loop.sh 가 부른다). 규칙: docs/operations/threads-outreach.md
#   9·19시(또는 인자 post) = 대기열 글 1개 + 첫 댓글 링크 + 들어온 DM 요청 답장, 그 밖 = 요청 답장만.
# 데이터(저장소 밖): ~/Documents/bredy-outreach/threads/{posts-queue.json, request-reply.txt, log.tsv}
export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
D=~/Documents/bredy-outreach/threads
T="$(cd "$(dirname "$0")" && pwd)/threads-outreach.mjs"
H=$(TZ=Asia/Seoul date +%H); TODAY=$(TZ=Asia/Seoul date +%F)
if [ "$H" = 09 ] || [ "$H" = 19 ] || [ "${1:-}" = post ]; then
  N=$(python3 - "$D" <<'PY'
import json, os, sys
d = sys.argv[1]; log = os.path.join(d, "log.tsv")
done = {r[3] for r in (l.rstrip("\n").split("\t") for l in open(log)) if len(r) > 4 and r[2] == "post" and r[4] == "ok"} if os.path.exists(log) else set()
left = [x for x in json.load(open(os.path.join(d, "posts-queue.json"))) if str(x["n"]) not in done]
if left:
    open("/tmp/threads-daily-post.txt", "w").write(left[0]["text"]); print(left[0]["n"], left[0]["topic"])
PY
)
  if [ -n "$N" ]; then
    OUT=$(node "$T" post /tmp/threads-daily-post.txt "${N#* }" 2>&1 | tail -1)
    URL=$(echo "$OUT" | sed -n 's/^ok //p')
    printf "%s\t%s\tpost\t%s\t%s\t%s\n" "$TODAY" "$(TZ=Asia/Seoul date +%H:%M)" "${N%% *}" "$([ -n "$URL" ] && echo ok || echo "$OUT")" "$URL" >> "$D/log.tsv"
    [ -n "$URL" ] && sleep 30 && node "$T" selfreply "$URL" "여기예요 👉 https://bredy.app"
  fi
fi
node "$T" requests "$D/request-reply.txt"
