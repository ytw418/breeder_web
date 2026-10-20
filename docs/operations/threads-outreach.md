# 스레드 영업 (글 · DM · 댓글) — 2026-10-19

## 소문 확인: "링크 많이 달면 노출 안 된다"

최신순으로 찾아본 결과, **링크 자체에 벌점은 없고 반응이 적어서 덜 퍼진다**가 맞다.

| 날짜 | 출처 | 내용 |
|---|---|---|
| 2024-11 | 모세리(인스타·스레드 대표) 스레드 글 https://www.threads.com/@mosseri/post/DCpQG0hz0m8 | 링크를 깎지는 않는다. 다만 클릭 확률은 거의 안 보고, 사람들이 링크 글에 좋아요·댓글을 잘 안 달아서 덜 뜬다 |
| 2025-06-03 | 모세리 https://www.threads.com/@mosseri/post/DKdzO8fumTq · Social Media Today https://www.socialmediatoday.com/news/meta-says-link-posts-ranked-properly-threads-reach/750126/ · Engadget https://www.engadget.com/social-media/threads-is-finally-embracing-links-150012499.html | 링크 글도 제대로 순위를 매기게 바꿨고 링크가 더 잘 된다. 프로필 링크 5개, 링크 클릭 통계 추가 |
| 2025-07 | Meta 뉴스룸 https://about.fb.com/news/2025/07/introducing-messaging-highlighted-perspectives-threads/ | 스레드 DM 시작. **맞팔이 아닌 사람에게 보내면 '요청' 함으로 가고, 요청에는 링크·미디어를 넣을 수 없으며, 보낼 수 있는 요청 수에 한도가 있다** |
| 2025-10-15 | TechCrunch https://techcrunch.com/2025/10/15/threads-is-getting-group-chats-as-messaging-rolls-out-to-the-eu | 그룹 채팅 추가 |

## 그래서 이렇게 한다

- **DM**: 링크 없이 짧게(인스타 물생활 1차와 같은 틀), 마지막 줄은 `👉 제 프로필 링크로 바로 들어가져요`. 스레드 프로필 소개에 bredy.app 이 걸려 있다. 하루 20개부터(요청 한도가 공개돼 있지 않다). 상대가 요청을 수락하기 전에는 한 대화에 **메시지 3개까지만** 보낼 수 있다(10-19 대화창 안내) — 1차 한 통만 보내고 2차는 답이 오면 보낸다.
- **댓글**: 글 내용에 직접 답하는 도움 되는 한두 문장, 링크·홍보 문구 없이. 문장은 글마다 새로 쓴다(같은 문장 반복은 스팸 신호). 사진을 봐야 답할 수 있는 질문(벌레 동정·병)은 고르지 않는다. 한 사람에게 댓글과 DM 을 같이 하지 않는다.
- **내 글**: 링크는 본문 대신 첫 댓글에, 본문은 그 자체로 반응이 나오게(후킹 기준은 `~/Desktop/pro/bredy-marketing/docs/hook-reference.md`).
- 21시~8시엔 보내지 않는다. 인스타에서 이미 연락한 사람(`~/Documents/bredy-outreach/targets.csv`)은 빼고 고른다.
- 링크 줄이기·변형, 무작위 간격, 여러 계정 같은 우회는 하지 않는다.

## 도구

`scripts/marketing/threads-outreach.mjs` — 브리디 자동화 크롬(CDP 9222)의 자기 탭에서 돈다(`@playwright/test` 의 chromium 으로 붙는다). 스레드 작업끼리는 `/tmp/bredy-chrome-locks/threads` 잠금으로 차례대로 돈다.

```bash
node scripts/marketing/threads-outreach.mjs find "크레스티드게코,구피,식집사" /tmp/threads-find.json   # 최근 글(이미 연락한 사람 제외)
# → 고른 글로 plan.json: [{"kind":"comment","href":"/@a/post/X","text":"…"}, {"kind":"dm","handle":"a","text":"…"}]
node scripts/marketing/threads-outreach.mjs run ~/Documents/bredy-outreach/threads/<plan>.json      # 백그라운드로
node scripts/marketing/threads-outreach.mjs post <글 파일> <주제> --dry-run                            # 게시 직전까지만 확인
```

- 남의 글 댓글·DM 에 링크가 든 항목이 있으면 실행을 거부한다. 하루 상한 `THREADS_DM_DAILY`·`THREADS_COMMENT_DAILY`(기본 20), 간격 댓글 60초·DM 90초.
- 보낸 뒤 다시 열어 남아 있는지 확인한 것만 `ok`(남의 글 댓글은 내 '답글' 탭, 내 글 첫 댓글은 그 글에서 확인).
- 데이터는 저장소 밖 `~/Documents/bredy-outreach/threads/`(대기열·답장 문구·기록 `log.tsv`). 연락한 사람 목록이라 올리지 않는다.
- 스레드 메시지함: https://www.threads.com/messages (받은 메시지함 · 요청).

## 글 올리고 DM 받기 (10-19 사용자 결정)

- 컨셉: 사실만 쓴 짧은 후킹 글 + "DM 주면 알려줄게". **없던 실적(다 팔았다·최고가·유기견 찾았다)은 쓰지 않는다**(실거래 0, 표시광고법·신뢰). 실제 첫 분양·낙찰이 나오면 동의 받고 사례로 쓴다.
- 상대가 먼저 보낸 DM 은 '요청'함으로 오고, **수락하면 일반 대화라 링크를 보낼 수 있다**(요청함 안내문). 그래서 요청 답장에는 링크를 넣는다.
- 대기열 `~/Documents/bredy-outreach/threads/posts-queue.json`(10개), 요청 답장 `request-reply.txt`, 하루 일정 `scripts/marketing/threads-daily.sh`(9·19시 30분 글 1개 + 첫 댓글 `여기예요 👉 https://bredy.app` + 요청 답장, 13·22시 30분 요청 답장만). Paseo 일정 `01ae4abc`(9:30·13:30·19:30·22:30, sonnet)가 이 스크립트를 부른다 — 10-20 재부팅으로 nohup 루프(`threads-loop.sh`)가 꺼진 뒤 바꿨다. 운영 사본은 `~/Desktop/pro/breeder_web-wt/threads-outreach` 워크트리.
- 받은 메시지함(이미 수락된 대화)은 자동으로 건드리지 않는다.

## 안전장치 (10-20)

- 같은 자동화 크롬의 스레드에 다른 계정(개인 `lcaros_rn`)이 로그인돼 있던 일이 있었다 → 도구는 시작할 때 로그인 계정이 `bredy_breeder` 인지 확인하고 아니면 아무것도 하지 않는다. 되돌리기: 스레드 로그아웃 → 로그인 화면 'Instagram으로 계속하기 bredy_breeder'(인스타가 bredy_breeder 일 때, 비밀번호 없음).
- 4시간 안에 올린 글이 있으면 `post` 는 건너뛴다(수동 게시 직후 일정이 또 올리지 않게).
