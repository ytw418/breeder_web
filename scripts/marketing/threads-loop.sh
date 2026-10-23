#!/bin/bash
# threads-daily.sh 를 매일 09:30·13:30·19:30·22:30(KST)에 돌린다. 재부팅하면 다시 켠다:
#   nohup scripts/marketing/threads-loop.sh >> ~/Documents/bredy-outreach/threads/run.log 2>&1 &
DAILY="$(cd "$(dirname "$0")" && pwd)/threads-daily.sh"
while true; do
  now=$(TZ=Asia/Seoul date +%H%M)
  next=""; for s in 0930 1330 1930 2230; do [ "$now" -lt "$s" ] && { next=$s; break; }; done
  if [ -z "$next" ]; then sleep $(( (24*60 - 10#${now:0:2}*60 - 10#${now:2:2}) * 60 + 30 )); continue; fi
  sleep $(( ((10#${next:0:2}*60 + 10#${next:2:2}) - (10#${now:0:2}*60 + 10#${now:2:2})) * 60 ))
  echo "== $(TZ=Asia/Seoul date '+%F %H:%M') =="; bash "$DAILY" 2>&1 | tail -5
  sleep 90
done
