# 상품 API 명세서

## 1. 상품 목록 조회

### GET /api/products
상품 목록을 조회합니다.

#### Query Parameters
- `cursor`: 마지막으로 조회한 상품의 ID (선택)
- `limit`: 한 번에 조회할 상품 수 (기본값: 10)
- `category`: 카테고리 (선택)
- `search`: 검색어 (선택)
  - `type`: 검색 유형 (title: 제목, seller: 판매자, all: 전체)
  - `keyword`: 검색 키워드
- `minPrice`: 최소 가격 (선택)
- `maxPrice`: 최대 가격 (선택)
- `sort`: 정렬 기준 (createdAt: 최신순, price: 가격순, likes: 좋아요순)

#### Response
```json
{
  "products": [
    {
      "id": 1,
      "name": "상품 이름",
      "price": 10000,
      "description": "상품 설명",
      "photos": ["이미지 URL1", "이미지 URL2"],
      "createdAt": "2024-04-25T12:00:00Z",
      "updatedAt": "2024-04-25T12:00:00Z",
      "seller": {
        "id": 1,
        "name": "판매자 이름",
        "avatar": "프로필 이미지 URL"
      },
      "favCount": 10,
      "isFav": false // 로그인한 경우에만 포함
    }
  ],
  "nextCursor": 11,
  "hasMore": true
}
```

## 2. 상품 상세 조회

### GET /api/products/:id
특정 상품의 상세 정보를 조회합니다.

#### Response
```json
{
  "id": 1,
  "name": "상품 이름",
  "price": 10000,
  "description": "상품 설명",
  "photos": ["이미지 URL1", "이미지 URL2"],
  "createdAt": "2024-04-25T12:00:00Z",
  "updatedAt": "2024-04-25T12:00:00Z",
  "seller": {
    "id": 1,
    "name": "판매자 이름",
    "avatar": "프로필 이미지 URL"
  },
  "favCount": 10,
  "isFav": false, // 로그인한 경우에만 포함
  "status": "available" // available, sold, reserved
}
```

## 3. 상품 생성 (인증 필요)

### POST /api/products
새로운 상품을 생성합니다.

#### Request Body
```json
{
  "name": "상품 이름",
  "price": 10000,
  "description": "상품 설명",
  "photos": ["이미지 URL1", "이미지 URL2"]
}
```

#### Response
```json
{
  "id": 1,
  "name": "상품 이름",
  "price": 10000,
  "description": "상품 설명",
  "photos": ["이미지 URL1", "이미지 URL2"],
  "createdAt": "2024-04-25T12:00:00Z",
  "updatedAt": "2024-04-25T12:00:00Z",
  "sellerId": 1
}
```

## 4. 상품 수정 (인증 필요)

### PUT /api/products/:id
상품 정보를 수정합니다. 판매자만 수정 가능합니다.

#### Request Body
```json
{
  "name": "수정된 상품 이름",
  "price": 15000,
  "description": "수정된 상품 설명",
  "photos": ["이미지 URL1", "이미지 URL2"]
}
```

#### Response
```json
{
  "id": 1,
  "name": "수정된 상품 이름",
  "price": 15000,
  "description": "수정된 상품 설명",
  "photos": ["이미지 URL1", "이미지 URL2"],
  "updatedAt": "2024-04-25T12:30:00Z"
}
```

## 5. 상품 삭제 (인증 필요)

### DELETE /api/products/:id
상품을 삭제합니다. 판매자만 삭제 가능합니다.

#### Response
```json
{
  "success": true,
  "message": "상품이 삭제되었습니다."
}
```

## 6. 상품 좋아요 (인증 필요)

### POST /api/products/:id/fav
상품에 좋아요를 추가합니다.

#### Response
```json
{
  "success": true,
  "message": "상품에 좋아요를 추가했습니다."
}
```

### DELETE /api/products/:id/fav
상품의 좋아요를 취소합니다.

#### Response
```json
{
  "success": true,
  "message": "상품의 좋아요를 취소했습니다."
}
```

## 7. 상품 상태 변경 (인증 필요)

### PUT /api/products/:id/status
상품의 상태를 변경합니다. 판매자만 변경 가능합니다.

#### Request Body
```json
{
  "status": "sold" // available, sold, reserved
}
```

#### Response
```json
{
  "success": true,
  "message": "상품 상태가 변경되었습니다.",
  "status": "sold"
}
```

## 8. 판매자 상품 목록 조회

### GET /api/users/:userId/products
특정 판매자의 상품 목록을 조회합니다.

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

## 9. 상품 거래 내역 조회 (인증 필요)

### GET /api/products/:id/records
상품의 거래 내역을 조회합니다. 판매자와 구매자만 조회 가능합니다.

#### Response
```json
{
  "records": [
    {
      "id": 1,
      "type": "purchase", // purchase, sale
      "price": 10000,
      "createdAt": "2024-04-25T12:00:00Z",
      "user": {
        "id": 1,
        "name": "사용자 이름",
        "avatar": "프로필 이미지 URL"
      }
    }
  ]
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

1. 상품 생성/수정/삭제
   - 로그인한 사용자만 가능
   - 자신의 상품만 수정/삭제 가능

2. 상품 상태 변경
   - 판매자만 가능
   - 판매 완료된 상품은 수정 불가

3. 거래 내역 조회
   - 판매자와 구매자만 조회 가능

4. 좋아요 기능
   - 로그인한 사용자만 가능
   - 자신의 상품에는 좋아요 불가 