# Firebase FCM 웹 푸시 구현 정리

## 1) 구현 목적
- 웹(모바일 브라우저/PC 브라우저)에서 채팅/주요 이벤트 알림을 받기 위해 FCM 기반 웹 푸시를 사용한다.
- 발송은 `Firebase Admin SDK`, 수신 토큰 발급은 `Firebase Web SDK(messaging)`로 분리한다.

## 2) 현재 코드 구조
- 클라이언트 구독/해지 UI: `app/(web)/settings/SettingsClient.tsx`
- 구독 상태/저장 API: `pages/api/push/subscription.ts`
- 테스트 발송 API: `pages/api/push/test.ts`
- 발송 모듈(Admin SDK): `libs/server/push.ts`
- 토큰 저장소(DB): `libs/server/pushStore.ts` (`FcmToken` 모델 사용)
- 서비스워커 알림 표시: `public/sw.js`

## 3) 동작 흐름
1. 설정 화면에서 `/api/push/subscription`(GET) 호출
2. 서버가 `configured/subscribed/vapidPublicKey` 반환
3. 사용자가 "알림 켜기" 클릭
4. 브라우저 권한 허용 후 `firebase/messaging`의 `getToken()`으로 FCM 토큰 발급
5. `/api/push/subscription`(POST, subscribe)로 토큰 저장
6. 서버 이벤트 발생 시 `sendPushToUsers()`가 토큰 목록에 푸시 발송
7. 무효 토큰(`registration-token-not-registered` 등)은 서버에서 자동 정리

## 4) 필수 환경변수
아래를 모두 만족해야 `configured=true`가 된다.

### 클라이언트(공개 가능)
- `NEXT_PUBLIC_FIREBASE_CONFIG`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

### 서버(비공개, 필수)
- 아래 3가지 중 **1세트**
1. `FIREBASE_SERVICE_ACCOUNT_JSON` (권장)
2. `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`
3. `GOOGLE_APPLICATION_CREDENTIALS` (서비스계정 JSON 파일 경로)

### 선택
- `NEXT_PUBLIC_DOMAIN_URL` (푸시 클릭 URL 절대경로 생성에 사용, 미설정 시 `https://bredy.app`)

## 5) env 세팅 방법
### A. `FIREBASE_SERVICE_ACCOUNT_JSON` 권장
1. Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
2. 다운로드한 JSON 전체를 한 줄 문자열로 변환

```bash
node -e 'const fs=require("fs");const o=JSON.parse(fs.readFileSync("service-account.json","utf8"));process.stdout.write(JSON.stringify(o));'
```

3. `.env` 또는 Vercel 환경변수에 저장

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"..."}
NEXT_PUBLIC_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","messagingSenderId":"...","appId":"..."}
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BP...
```

## 6) VAPID 키 주의사항
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`에는 **Web Push certificates의 공개키**를 넣어야 한다.
- `AAAA...:APA...` 형태(콜론 포함)는 FCM 토큰이므로 잘못된 값이다.
- 잘못된 키를 넣으면 모바일에서 `Failed to execute 'atob'...` 오류가 발생할 수 있다.

## 7) 운영 체크리스트
- Vercel Preview/Production 모두 환경변수 적용 후 재배포
- 설정 페이지에서 상태가 `켜짐`으로 바뀌는지 확인
- `테스트 알림 보내기`로 실제 푸시 수신 확인
- 서비스계정 키가 외부에 노출되면 즉시 폐기/재발급(rotate)

## 8) 공식 문서
- Firebase Admin SDK 시작: https://firebase.google.com/docs/admin/setup?hl=ko
- FCM 웹 시작: https://firebase.google.com/docs/cloud-messaging/web/client?hl=ko
- FCM 웹 get started: https://firebase.google.com/docs/cloud-messaging/web/get-started?hl=ko
- 웹 PWA 가이드: https://firebase.google.com/docs/web/pwa?hl=ko
- Admin SDK로 메시지 보내기: https://firebase.google.com/docs/cloud-messaging/send/admin-sdk?hl=ko
