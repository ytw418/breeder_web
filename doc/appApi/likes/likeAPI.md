# 좋아요 API 명세서

## 인증 요구사항
- 좋아요 추가/취소는 로그인한 사용자만 가능합니다.
- 좋아요 목록 조회는 비로그인 사용자도 가능합니다.

## 1. 좋아요 추가/취소

### POST /api/posts/:id/like
특정 게시글에 좋아요를 추가하거나 취소합니다. 이미 좋아요가 있는 경우 취소됩니다.

#### Response
```json
{
  "success": true,
  "isLiked": true, // 좋아요 상태 (true: 추가됨, false: 취소됨)
  "likeCount": 10 // 해당 게시글의 전체 좋아요 수
}
```

## 2. 좋아요 상태 확인

### GET /api/posts/:id/like
특정 게시글의 좋아요 상태를 확인합니다.

#### Response
```json
{
  "success": true,
  "isLiked": true,
  "likeCount": 10
}
```

## 3. 내가 좋아요한 게시글 목록

### GET /api/users/:id/likes
특정 사용자가 좋아요한 게시글 목록을 조회합니다.

#### Response
```json
{
  "success": true,
  "likes": [
    {
      "id": 1,
      "post": {
        "id": 1,
        "title": "게시글 제목",
        "content": "게시글 내용",
        "createdAt": "2024-04-25T12:00:00Z",
        "author": {
          "id": 1,
          "name": "게시글 작성자 이름",
          "avatar": "프로필 이미지 URL"
        },
        "likeCount": 10,
        "commentCount": 5
      },
      "createdAt": "2024-04-25T12:00:00Z"
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
- 404: 리소스가 존재하지 않음
- 400: 잘못된 요청 