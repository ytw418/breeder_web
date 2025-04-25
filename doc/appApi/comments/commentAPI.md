# 댓글 API 명세서

## 인증 요구사항
- 댓글 작성/수정/삭제는 로그인한 사용자만 가능합니다.
- 댓글 목록 조회는 비로그인 사용자도 가능합니다.

## 1. 댓글 작성

### POST /api/posts/:id/comments
특정 게시글에 댓글을 작성합니다.

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

## 2. 댓글 수정

### PUT /api/comments/:id
특정 댓글을 수정합니다.

#### Request Body
```json
{
  "content": "수정된 댓글 내용"
}
```

#### Response
```json
{
  "success": true,
  "comment": {
    "id": 1,
    "content": "수정된 댓글 내용",
    "createdAt": "2024-04-25T12:00:00Z",
    "updatedAt": "2024-04-25T13:00:00Z",
    "author": {
      "id": 1,
      "name": "댓글 작성자 이름",
      "avatar": "프로필 이미지 URL"
    }
  }
}
```

## 3. 댓글 삭제

### DELETE /api/comments/:id
특정 댓글을 삭제합니다.

#### Response
```json
{
  "success": true
}
```

## 4. 내 댓글 목록 조회

### GET /api/users/:id/comments
특정 사용자가 작성한 댓글 목록을 조회합니다.

#### Response
```json
{
  "success": true,
  "comments": [
    {
      "id": 1,
      "content": "댓글 내용",
      "createdAt": "2024-04-25T12:00:00Z",
      "post": {
        "id": 1,
        "title": "게시글 제목"
      },
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
- 403: 권한이 없는 요청 (자신의 댓글만 수정/삭제 가능)
- 404: 리소스가 존재하지 않음
- 400: 잘못된 요청 