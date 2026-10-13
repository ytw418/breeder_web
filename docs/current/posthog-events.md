# PostHog 이벤트 기준

앱(bredy_app)·웹·서버가 한 PostHog 프로젝트(311757, US)로 보낸다. 사람은 DB 사용자 id(`distinct_id`)로 묶는다.

| 보내는 곳 | 방식 | `$lib` | 플랫폼 구분 |
|---|---|---|---|
| 서버 | `libs/server/analytics.ts` `captureServerEvent` → `/capture/` | `bredy-server` | `platform` 속성(`resolveClientPlatform` — 앱은 `X-Bredy-Client: app`, 옛 앱은 okhttp·CFNetwork UA) |
| 웹 | posthog-js(`app/layout.tsx`), 이벤트는 `libs/client/analytics.ts` `trackEvent` | `web` | `platform: "web"` (`trackEvent` 기본값) |
| 앱 | `src/lib/analytics.ts` → `/batch/`(SDK 없음), 운영 빌드만 | `bredy-app` | `platform: "app"` |

## 가입·로그인·이탈

| 이벤트 | 보내는 곳 | 언제 | 속성 |
|---|---|---|---|
| `login_started` | 앱·웹 | 소셜 로그인 버튼을 눌렀을 때 | `method` |
| `login_failed` | 앱 | 앱 로그인이 실패했을 때 | `method`, `error_message` |
| `signup_completed` | 서버 | `/api/auth/login` 이 새 계정을 만들었을 때. **가입률은 이 이벤트로 센다** | `method`(kakao·google·apple), `platform`, 사람 속성 `$set_once.signup_method·signup_platform` |
| `login_completed` | 서버 | 기존 계정이 로그인했을 때(토큰 갱신은 제외) | `method`, `platform` |
| `category_onboarding_completed` | 서버 | 관심 카테고리 온보딩을 처음 마쳤을 때(건너뛰기 포함) | `pinned_count`, `platform` |
| `account_deleted` | 서버 | 탈퇴를 접수했을 때 | `reason`(앞 100자), `platform` |

가입 퍼널: 웹 `$pageview`(또는 앱 `Application Opened`) → `login_started` → `signup_completed` → `category_onboarding_completed` → 첫 `post_created`·`product_created`.
웹은 로그인 직후 `identifyPosthogUser` 가, 앱은 `setAnalyticsUser` 가 익명 기록을 사용자 id 에 합친다.

## 기능 사용(서버, 모두 `platform` 포함)

| 이벤트 | API | 주요 속성 |
|---|---|---|
| `post_created` | `POST /api/posts` | `post_id`, `category`, `species`, `image_count` |
| `post_answer_created` | `POST /api/posts/[id]/answers` | `post_id`, `post_category`, `is_reply` |
| `post_liked` | `POST /api/posts/[id]/wonder`(켤 때만) | `post_id` |
| `product_created` | `POST /api/products` | `product_id`, `category`, `deal_type`, `product_type`, `photo_count`, `has_bloodline` |
| `product_favorited` | `POST /api/products/[id]/fav`(추가만) | `product_id` |
| `auction_created` | `POST /api/auctions` | `auction_id`, `category`, `start_price`, `photo_count`, `has_bloodline` |
| `auction_bid_placed` | `POST /api/auctions/[id]/bid` | `auction_id`, `bid_amount`, `extended` |
| `auction_restarted` | `POST /api/auctions/[id]/restart`(유찰·입양 안 된 낙찰 경매 다시 시작) | `auction_id`, `round`, `from_status`(유찰·종료), `reason`(종료면 NO_CONTACT·DECLINED·OTHER) |
| `chat_room_created` | `POST /api/chat`(새 방만) | `chat_room_id`, `other_user_id` |
| `chat_message_sent` | `POST /api/chat/[id]/message` | `chat_room_id`, `message_type` |
| `chat_wave_sent` | `POST /api/chat/wave`(동네 브리더 손 흔들어 인사) | `chat_room_id`, `other_user_id`, `preset_id`, `room_created` |
| `user_followed` | `POST /api/users/[id]/follow`(팔로우만) | `target_user_id` |
| `report_submitted` | `POST /api/reports`, `/api/auctions/[id]/report` | `target_type`, `reason` |
| `region_set` | `POST /api/users/me`(동네 지정) | `region_sido`, `region_visible` |
| `profile_updated` | `POST /api/users/me`(프로필 필드) | `fields` |
| `bloodline_created`·`bloodline_sent`·`product_bloodline_attached`·`auction_bloodline_attached` | 혈통 API | 기존 이벤트 |

## 화면·세션(이탈 지점)

- 웹: `$pageview`·`$pageleave`(history_change), 화면별 클릭 이벤트는 `libs/client/analytics.ts` `ANALYTICS_EVENTS`.
- 앱: `$screen`(`$screen_name` 은 id 를 `[id]` 로 묶은 경로, 원래 경로는 `$pathname`), `Application Installed`·`Application Opened`(`from_background`)·`Application Backgrounded`. 세션은 30분 쉬면 새로 시작한다(`$session_id`).

## 규칙

- 서버 계측은 응답 직전에 `await` 한다(1.5초 상한, 실패해도 응답은 그대로). 트랜잭션 안에서 부르지 않는다.
- 연락처·이메일·채팅 내용 같은 개인정보는 넣지 않는다.
- 새 이벤트는 `ServerAnalyticsEvent`(서버)·`ANALYTICS_EVENTS`(웹)에 이름을 먼저 추가하고 이 표를 고친다. 앱·웹이 같은 행동을 찍으면 이름을 같게 한다.
- 이 변경이 운영에 나간 시각 이전 데이터에는 서버 이벤트·앱 이벤트가 없다. 앱 이벤트는 키가 들어간 운영 빌드가 스토어에 나간 뒤부터 쌓인다.
