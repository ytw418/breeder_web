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
- `category`: 카테고리 필터 (all, question, share, notice)
- `author`: 작성자 ID로 필터링 (선택)
- `search`: 검색어 (제목, 내용에서 검색)

#### Response
```json
{
  "success": true,
  "posts": [
    {
      "id": 1,
      "title": "게시글 제목",
      "content": "게시글 내용",
      "image": "이미지 URL",
      "createdAt": "2024-04-25T12:00:00Z",
      "updatedAt": "2024-04-25T12:00:00Z",
      "author": {
        "id": 1,
        "name": "작성자 이름",
        "avatar": "프로필 이미지 URL"
      },
      "category": {
        "id": 1,
        "name": "question"
      },
      "_count": {
        "comments": 5,
        "likes": 10
      }
    }
  ],
  "nextCursor": 11
}
```

## 2. 게시글 생성

### POST /api/posts
새로운 게시글을 생성합니다.

#### Request Body
```json
{
  "title": "게시글 제목",
  "content": "게시글 내용",
  "category": "question", // 미입력시 "all"로 설정
  "image": "이미지 URL" // 선택
}
```

#### Response
```json
{
  "success": true,
  "post": {
    "id": 1
  }
}
```

## 3. 게시글 상세 조회

### GET /api/posts/:id
특정 게시글의 상세 정보를 조회합니다.

#### Response
```json
{
  "success": true,
  "post": {
    "id": 1,
    "title": "게시글 제목",
    "content": "게시글 내용",
    "image": "이미지 URL",
    "createdAt": "2024-04-25T12:00:00Z",
    "updatedAt": "2024-04-25T12:00:00Z",
    "author": {
      "id": 1,
      "name": "작성자 이름",
      "avatar": "프로필 이미지 URL"
    },
    "category": {
      "id": 1,
      "name": "question"
    },
    "_count": {
      "comments": 5,
      "likes": 10
    }
  },
  "isLiked": false
}
```

## 4. 내 게시글 목록 조회

### GET /api/users/:id/posts
특정 사용자의 게시글 목록을 조회합니다.

#### Response
```json
{
  "success": true,
  "posts": [
    {
      "id": 1,
      "title": "게시글 제목",
      "content": "게시글 내용",
      "image": "이미지 URL",
      "createdAt": "2024-04-25T12:00:00Z",
      "author": {
        "id": 1,
        "name": "작성자 이름",
        "avatar": "프로필 이미지 URL"
      },
      "_count": {
        "comments": 5,
        "likes": 10
      }
    }
  ]
}
```

## 5. 좋아요한 게시글 목록 조회

### GET /api/users/:id/likes
사용자가 좋아요한 게시글 목록을 조회합니다.

#### Response
```json
{
  "success": true,
  "posts": [
    {
      "id": 1,
      "title": "게시글 제목",
      "content": "게시글 내용",
      "image": "이미지 URL",
      "createdAt": "2024-04-25T12:00:00Z",
      "author": {
        "id": 1,
        "name": "작성자 이름",
        "avatar": "프로필 이미지 URL"
      },
      "_count": {
        "comments": 5,
        "likes": 10
      }
    }
  ]
}
```

## 6. 댓글 목록 조회

### GET /api/posts/:id/comments
특정 게시글의 댓글 목록을 조회합니다.

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

## 에러 응답
모든 API는 다음과 같은 에러 응답을 반환할 수 있습니다:

```json
{
  "success": false,
  "error": "에러 메시지"
}
```

### 주요 에러 코드
- 401: 인증되지 않은 요청
- 403: 권한이 없는 요청
- 404: 리소스가 존재하지 않음
- 400: 잘못된 요청 