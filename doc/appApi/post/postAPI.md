# 게시글 API 명세서

## 인증 요구사항
- 게시글 작성/수정/삭제, 댓글 작성, 좋아요 기능은 로그인한 사용자만 사용 가능합니다.
- 게시글 목록 조회, 상세 조회, 댓글 조회는 비로그인 사용자도 사용 가능합니다.

## 1. 게시글 목록 조회 (무한 스크롤)

### GET /api/posts
게시글 목록을 무한 스크롤 방식으로 조회합니다.

#### Query Parameters
- `cursor`: 마지막으로 조회한 게시글의 ID (선택)
- `limit`: 한 번에 조회할 게시글 수 (기본값: 10)

#### Response
```json
{
  "posts": [
    {
      "id": 1,
      "title": "게시글 제목",
      "description": "게시글 내용",
      "image": "이미지 URL",
      "createdAt": "2024-04-25T12:00:00Z",
      "updatedAt": "2024-04-25T12:00:00Z",
      "user": {
        "id": 1,
        "name": "작성자 이름",
        "avatar": "프로필 이미지 URL"
      },
      "_count": {
        "comments": 5,
        "Likes": 10
      }
    }
  ],
  "nextCursor": 11
}
```

## 2. 게시글 상세 조회

### GET /api/posts/:id
특정 게시글의 상세 정보를 조회합니다.

#### Response
```json
{
  "success": true,
  "post": {
    "id": 1,
    "title": "게시글 제목",
    "description": "게시글 내용",
    "image": "이미지 URL",
    "createdAt": "2024-04-25T12:00:00Z",
    "updatedAt": "2024-04-25T12:00:00Z",
    "user": {
      "id": 1,
      "name": "작성자 이름",
      "avatar": "프로필 이미지 URL"
    },
    "comments": [
      {
        "id": 1,
        "content": "댓글 내용",
        "createdAt": "2024-04-25T12:00:00Z",
        "user": {
          "id": 2,
          "name": "댓글 작성자 이름",
          "avatar": "프로필 이미지 URL"
        }
      }
    ],
    "_count": {
      "comments": 5,
      "Likes": 10
    }
  },
  "isLiked": false
}
```

## 3. 게시글 생성 (인증 필요)

### POST /api/posts
새로운 게시글을 생성합니다.

#### Request Body (FormData)
- `title`: 게시글 제목
- `description`: 게시글 내용
- `image`: 이미지 파일 (선택)

#### Response
```json
{
  "success": true,
  "post": {
    "id": 1
  }
}
```

## 4. 게시글 수정 (인증 필요)

### PUT /api/posts/:id
게시글을 수정합니다. 작성자만 수정 가능합니다.

#### Request Body (FormData)
- `title`: 게시글 제목
- `description`: 게시글 내용
- `image`: 이미지 파일 (선택)

#### Response
```json
{
  "success": true,
  "post": {
    "id": 1,
    "title": "수정된 제목",
    "description": "수정된 내용",
    "image": "수정된 이미지 URL",
    "updatedAt": "2024-04-25T12:30:00Z"
  }
}
```

## 5. 게시글 좋아요 (인증 필요)

### POST /api/posts/:id/like
게시글에 좋아요를 추가하거나 취소합니다.

#### Response
```json
{
  "success": true,
  "message": "좋아요가 추가되었습니다." // 또는 "좋아요가 취소되었습니다."
}
```

## 6. 댓글 조회

### GET /api/posts/:id/comments
게시글의 댓글 목록을 조회합니다.

#### Response
```json
{
  "success": true,
  "comments": [
    {
      "id": 1,
      "content": "댓글 내용",
      "createdAt": "2024-04-25T12:00:00Z",
      "author": {
        "id": 1,
        "name": "댓글 작성자 이름",
        "avatar": "프로필 이미지 URL"
      }
    }
  ]
}
```

## 7. 댓글 생성 (인증 필요)

### POST /api/posts/:id/comments
게시글에 댓글을 추가합니다.

#### Request Body
```json
{
  "content": "댓글 내용"
}
```

#### Response
```json
{
  "success": true,
  "comment": {
    "id": 1,
    "content": "댓글 내용",
    "createdAt": "2024-04-25T12:00:00Z",
    "author": {
      "id": 1,
      "name": "댓글 작성자 이름",
      "avatar": "프로필 이미지 URL"
    }
  }
}
```

## 에러 응답
모든 API는 다음과 같은 에러 응답을 반환할 수 있습니다:

```json
{
  "error": "에러 메시지"
}
```

### 주요 에러 코드
- `401`: 인증되지 않은 요청
- `403`: 권한이 없는 요청
- `404`: 리소스가 존재하지 않음
- `400`: 잘못된 요청
