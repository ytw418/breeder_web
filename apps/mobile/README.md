# Bredy Mobile

Expo 기반 Android WebView 앱입니다.

## 시작

```bash
cd apps/mobile
cp .env.example .env
npm install
npm run start
```

## 필수 환경변수

- `EXPO_PUBLIC_WEB_APP_URL`: WebView로 여는 웹앱 주소
- `EXPO_PUBLIC_EAS_PROJECT_ID`: Expo Push 토큰 발급에 사용하는 EAS 프로젝트 ID

## 주요 동작

- 기존 웹을 전체 WebView로 로드
- Expo Push 토큰을 웹에 전달해 `/api/mobile/push-token`으로 등록
- 푸시 클릭 시 웹 경로로 이동
- 외부 도메인 링크는 시스템 브라우저로 분리

## 빌드

```bash
cd apps/mobile
npx eas build --platform android --profile preview
npx eas build --platform android --profile production
```
