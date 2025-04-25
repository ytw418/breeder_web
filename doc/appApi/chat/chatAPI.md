# 채팅 API 명세서

## 1. 채팅방 생성 (인증 필요)

### POST /api/chats
새로운 채팅방을 생성합니다.

#### Request Body
```json
{
  "productId": 1,
  "partnerId": 2
}
```

#### Response
```json
{
  "id": 1,
  "product": {
    "id": 1,
    "name": "상품 이름",
    "price": 10000,
    "photos": ["이미지 URL1"]
  },
  "partner": {
    "id": 2,
    "name": "채팅 상대 이름",
    "avatar": "프로필 이미지 URL"
  },
  "createdAt": "2024-04-25T12:00:00Z"
}
```

## 2. 채팅방 목록 조회 (인증 필요)

### GET /api/chats
내가 참여 중인 채팅방 목록을 조회합니다.

#### Query Parameters
- `cursor`: 마지막으로 조회한 채팅방의 ID (선택)
- `limit`: 한 번에 조회할 채팅방 수 (기본값: 10)

#### Response
```json
{
  "chats": [
    {
      "id": 1,
      "product": {
        "id": 1,
        "name": "상품 이름",
        "price": 10000,
        "photos": ["이미지 URL1"]
      },
      "partner": {
        "id": 2,
        "name": "채팅 상대 이름",
        "avatar": "프로필 이미지 URL"
      },
      "lastMessage": "마지막 메시지 내용",
      "unreadCount": 3,
      "updatedAt": "2024-04-25T12:00:00Z"
    }
  ],
  "nextCursor": 11,
  "hasMore": true
}
```

## 3. 채팅방 상세 조회 (인증 필요)

### GET /api/chats/:id
특정 채팅방의 상세 정보와 메시지 목록을 조회합니다.

#### Query Parameters
- `cursor`: 마지막으로 조회한 메시지의 ID (선택)
- `limit`: 한 번에 조회할 메시지 수 (기본값: 20)

#### Response
```json
{
  "id": 1,
  "product": {
    "id": 1,
    "name": "상품 이름",
    "price": 10000,
    "photos": ["이미지 URL1"],
    "status": "available"
  },
  "partner": {
    "id": 2,
    "name": "채팅 상대 이름",
    "avatar": "프로필 이미지 URL"
  },
  "messages": [
    {
      "id": 1,
      "content": "메시지 내용",
      "sender": {
        "id": 1,
        "name": "보낸 사람 이름",
        "avatar": "프로필 이미지 URL"
      },
      "createdAt": "2024-04-25T12:00:00Z",
      "isRead": true
    }
  ],
  "nextCursor": 21,
  "hasMore": true
}
```

## 4. 메시지 전송 (인증 필요)

### POST /api/chats/:id/messages
채팅방에 메시지를 전송합니다.

#### Request Body
```json
{
  "content": "메시지 내용"
}
```

#### Response
```json
{
  "id": 1,
  "content": "메시지 내용",
  "sender": {
    "id": 1,
    "name": "보낸 사람 이름",
    "avatar": "프로필 이미지 URL"
  },
  "createdAt": "2024-04-25T12:00:00Z",
  "isRead": false
}
```

## 5. 메시지 읽음 처리 (인증 필요)

### PUT /api/chats/:id/messages/read
채팅방의 메시지를 읽음 처리합니다.

#### Response
```json
{
  "success": true,
  "message": "메시지가 읽음 처리되었습니다."
}
```

## 6. 채팅방 나가기 (인증 필요)

### DELETE /api/chats/:id
채팅방에서 나갑니다.

#### Response
```json
{
  "success": true,
  "message": "채팅방에서 나갔습니다."
}
```

## 7. 실시간 채팅 (WebSocket)

### WebSocket /ws/chats
실시간 채팅을 위한 WebSocket 연결입니다.

#### 연결 요청
```json
{
  "type": "connect",
  "chatId": 1
}
```

#### 메시지 전송
```json
{
  "type": "message",
  "content": "메시지 내용"
}
```

#### 메시지 수신
```json
{
  "type": "message",
  "id": 1,
  "content": "메시지 내용",
  "sender": {
    "id": 1,
    "name": "보낸 사람 이름",
    "avatar": "프로필 이미지 URL"
  },
  "createdAt": "2024-04-25T12:00:00Z"
}
```

#### 읽음 처리
```json
{
  "type": "read",
  "messageIds": [1, 2, 3]
}
```

## 에러 응답
모든 API는 다음과 같은 에러 응답을 반환할 수 있습니다:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지"
  }
}
```

### 주요 에러 코드
- `UNAUTHORIZED`: 인증되지 않은 요청
- `FORBIDDEN`: 권한이 없는 요청
- `NOT_FOUND`: 리소스가 존재하지 않음
- `BAD_REQUEST`: 잘못된 요청
- `INTERNAL_SERVER_ERROR`: 서버 내부 오류

## 권한 관리

1. 모든 API는 인증이 필요합니다.
2. 채팅방은 관련된 사용자만 접근할 수 있습니다.
3. 메시지는 채팅방 참여자만 전송/조회할 수 있습니다.
4. 실시간 채팅은 채팅방 참여자만 연결할 수 있습니다. 