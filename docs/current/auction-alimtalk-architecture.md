# 경매 알림 채널 확장 설계 (웹푸시 -> 카카오 알림톡)

작성일: 2026-02-11

## 목표

- 현재: DB 알림 + 웹푸시 기반
- 다음: 경매 핵심 이벤트는 카카오 알림톡까지 선택 발송
- 원칙: 비즈니스 로직은 유지하고, 채널만 추가 가능한 구조로 유지

## 이벤트 정의

- `AUCTION_BID`: 내 경매에 새 입찰
- `AUCTION_OUTBID`: 내가 1등에서 밀림
- `AUCTION_END`: 경매 종료(판매자)
- `AUCTION_WON`: 낙찰(구매자)

현재 코드 이벤트 타입 매핑:
- `BID`, `OUTBID`, `AUCTION_END`, `AUCTION_WON`

## 권장 구조

1. 이벤트 생성층
- 위치: `libs/server/notification.ts`
- 역할: DB 알림 저장 + 채널 라우팅 호출

2. 채널 라우팅층
- 신규 파일 제안: `libs/server/notificationChannels.ts`
- 입력: `{ userId, type, message, targetType, targetId }`
- 처리:
  - 웹푸시: 즉시 발송(기존)
  - 알림톡: 발송조건 충족 시 큐 적재

3. 알림톡 큐/잡
- 신규 테이블 제안: `NotificationDelivery`
  - `id`, `userId`, `channel`(`WEB_PUSH`|`KAKAO_ALIMTALK`), `templateCode`, `payload`, `status`, `retryCount`, `lastError`, `createdAt`, `updatedAt`
- 워커:
  - `status=QUEUED` -> 발송 -> `SENT`/`FAILED`
  - 실패 재시도(예: 최대 3회, 지수 백오프)

4. 수신자 식별
- 기본: 앱 계정(`User.id`)
- 알림톡 발송 조건:
  - 사용자의 카카오 채널 수신 동의 상태
  - 템플릿 필수 파라미터 충족
  - 야간 발송 정책(심야 제한) 통과

## API/코드 변경 최소화 전략

- `createNotification()` 시그니처는 유지
- 내부에 옵션 추가:
  - `channels?: ("webpush" | "alimtalk")[]`
  - 기본값은 기존처럼 웹푸시
- 경매 이벤트만 단계적으로 `["webpush", "alimtalk"]` 확장

## 템플릿 예시

- `AUCTION_OUTBID`
  - 제목: 경매 순위 변동 안내
  - 본문: `{auctionTitle} 경매에서 {amount}원 입찰로 순위가 변경되었습니다.`
  - 버튼: 경매 바로가기
- `AUCTION_WON`
  - 제목: 낙찰 안내
  - 본문: `{auctionTitle} 경매에 낙찰되었습니다. 낙찰가 {amount}원`
  - 버튼: 경매 상세

## 운영/비용 체크리스트

- 템플릿 사전 검수/승인
- 일 발송량 및 실패율 모니터링
- 사용자 알림 수신 동의/해지 정책
- 알림톡 비용 한도 초과 시 웹푸시 fallback

## 단계적 적용 계획

1. 1단계: 채널 라우터/큐 스키마 추가 (실제 발송 OFF)
2. 2단계: 샌드박스 템플릿으로 내부 테스트
3. 3단계: `AUCTION_OUTBID`, `AUCTION_WON` 2개 이벤트만 제한 오픈
4. 4단계: 전체 경매 알림 확장 + 비용/효율 최적화
