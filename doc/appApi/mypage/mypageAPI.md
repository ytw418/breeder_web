# 마이페이지 API 명세서

## 1. 사용자 프로필 조회 (인증 필요)

### GET /api/users/me/profile
현재 로그인한 사용자의 프로필 정보를 조회합니다.

#### Response
```json
{
  "id": 1,
  "name": "사용자 이름",
  "email": "user@example.com",
  "phone": "010-1234-5678",
  "avatar": "프로필 이미지 URL",
  "createdAt": "2024-04-25T12:00:00Z",
  "updatedAt": "2024-04-25T12:00:00Z",
  "stats": {
    "productCount": 10,
    "favCount": 20,
    "followerCount": 30,
    "followingCount": 40
  }
}
```

## 2. 프로필 수정 (인증 필요)

### PUT /api/users/me/profile
사용자 프로필 정보를 수정합니다.

#### Request Body
```json
{
  "name": "수정된 이름",
  "phone": "010-9876-5432",
  "avatar": "새로운 프로필 이미지 URL"
}
```

#### Response
```json
{
  "id": 1,
  "name": "수정된 이름",
  "email": "user@example.com",
  "phone": "010-9876-5432",
  "avatar": "새로운 프로필 이미지 URL",
  "updatedAt": "2024-04-25T12:30:00Z"
}
```

## 3. 내 상품 목록 조회 (인증 필요)

### GET /api/users/me/products
내가 판매한 상품 목록을 조회합니다.

#### Query Parameters
- `cursor`: 마지막으로 조회한 상품의 ID (선택)
- `limit`: 한 번에 조회할 상품 수 (기본값: 10)
- `status`: 상품 상태 필터 (available, sold, reserved)

#### Response
```json
{
  "products": [
    {
      "id": 1,
      "name": "상품 이름",
      "price": 10000,
      "description": "상품 설명",
      "photos": ["이미지 URL1"],
      "createdAt": "2024-04-25T12:00:00Z",
      "updatedAt": "2024-04-25T12:00:00Z",
      "status": "available",
      "favCount": 10
    }
  ],
  "nextCursor": 11,
  "hasMore": true
}
```

## 4. 관심 상품 목록 조회 (인증 필요)

### GET /api/users/me/favs
내가 좋아요한 상품 목록을 조회합니다.

#### Query Parameters
- `cursor`: 마지막으로 조회한 상품의 ID (선택)
- `limit`: 한 번에 조회할 상품 수 (기본값: 10)

#### Response
```json
{
  "products": [
    {
      "id": 1,
      "name": "상품 이름",
      "price": 10000,
      "description": "상품 설명",
      "photos": ["이미지 URL1"],
      "createdAt": "2024-04-25T12:00:00Z",
      "updatedAt": "2024-04-25T12:00:00Z",
      "seller": {
        "id": 2,
        "name": "판매자 이름",
        "avatar": "프로필 이미지 URL"
      },
      "status": "available"
    }
  ],
  "nextCursor": 11,
  "hasMore": true
}
```

## 5. 구매 내역 조회 (인증 필요)

### GET /api/users/me/purchases
내가 구매한 상품 목록을 조회합니다.

#### Query Parameters
- `cursor`: 마지막으로 조회한 구매 내역의 ID (선택)
- `limit`: 한 번에 조회할 구매 내역 수 (기본값: 10)
- `status`: 구매 상태 필터 (pending, completed)

#### Response
```json
{
  "purchases": [
    {
      "id": 1,
      "product": {
        "id": 1,
        "name": "상품 이름",
        "price": 10000,
        "photos": ["이미지 URL1"]
      },
      "seller": {
        "id": 2,
        "name": "판매자 이름",
        "avatar": "프로필 이미지 URL"
      },
      "status": "completed",
      "createdAt": "2024-04-25T12:00:00Z"
    }
  ],
  "nextCursor": 11,
  "hasMore": true
}
```

## 6. 판매 내역 조회 (인증 필요)

### GET /api/users/me/sales
내가 판매한 상품 목록을 조회합니다.

#### Query Parameters
- `cursor`: 마지막으로 조회한 판매 내역의 ID (선택)
- `limit`: 한 번에 조회할 판매 내역 수 (기본값: 10)
- `status`: 판매 상태 필터 (pending, completed)

#### Response
```json
{
  "sales": [
    {
      "id": 1,
      "product": {
        "id": 1,
        "name": "상품 이름",
        "price": 10000,
        "photos": ["이미지 URL1"]
      },
      "buyer": {
        "id": 3,
        "name": "구매자 이름",
        "avatar": "프로필 이미지 URL"
      },
      "status": "completed",
      "createdAt": "2024-04-25T12:00:00Z"
    }
  ],
  "nextCursor": 11,
  "hasMore": true
}
```

## 7. 팔로워 목록 조회 (인증 필요)

### GET /api/users/me/followers
나를 팔로우하는 사용자 목록을 조회합니다.

#### Query Parameters
- `cursor`: 마지막으로 조회한 사용자의 ID (선택)
- `limit`: 한 번에 조회할 사용자 수 (기본값: 10)

#### Response
```json
{
  "followers": [
    {
      "id": 2,
      "name": "사용자 이름",
      "avatar": "프로필 이미지 URL",
      "isFollowing": true
    }
  ],
  "nextCursor": 11,
  "hasMore": true
}
```

## 8. 팔로잉 목록 조회 (인증 필요)

### GET /api/users/me/following
내가 팔로우하는 사용자 목록을 조회합니다.

#### Query Parameters
- `cursor`: 마지막으로 조회한 사용자의 ID (선택)
- `limit`: 한 번에 조회할 사용자 수 (기본값: 10)

#### Response
```json
{
  "following": [
    {
      "id": 3,
      "name": "사용자 이름",
      "avatar": "프로필 이미지 URL",
      "isFollowing": true
    }
  ],
  "nextCursor": 11,
  "hasMore": true
}
```

## 9. 채팅 목록 조회 (인증 필요)

### GET /api/users/me/chats
나의 채팅 목록을 조회합니다.

#### Query Parameters
- `cursor`: 마지막으로 조회한 채팅의 ID (선택)
- `limit`: 한 번에 조회할 채팅 수 (기본값: 10)

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
2. 사용자는 자신의 정보만 조회/수정할 수 있습니다.
3. 채팅은 관련된 사용자만 조회할 수 있습니다. 