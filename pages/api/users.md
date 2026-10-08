## 유저(users) API 명세

### 1. 내 정보 조회/수정

- **URL**: `/api/users/me`
- **Method**: GET
- **Response**:

  - `success` (boolean)
  - `profile` (object): 내 프로필 정보

- **Method**: POST
- **Body**:
  - `name` (string, optional): 변경할 닉네임
  - `avatarId` (string, optional): 변경할 아바타 ID
  - `bio` (string | null, optional): 프로필 소개. 앞뒤 공백 제거·연속 개행 3개 이상은 2개로 줄이고, 비우면 null. 코드포인트 150자 초과는 `errorCode: "BIO_TOO_LONG"`
- **Response**:
  - `success` (boolean)
  - `bio` (string | null, optional): 저장한 소개(bio 를 보냈을 때)
  - `error` (string, optional): 에러 메시지(중복 닉네임 등)

### 2. 특정 유저 정보 조회

- **URL**: `/api/users/[id]`
- **Method**: GET
- **Query Params**:
  - `id` (number): 유저 ID
- **Response**:
  - `user` (object): 유저 정보. `bio`, `topSpecies`(게시글 종·상품 카테고리 상위 2개), `_count.auctions`(숨김 제외) 포함
  - `isFollowing`, `isBlocked` (boolean)

### 2-1. 특정 유저의 게시글 목록

- **URL**: `/api/users/[id]/posts`
- **Method**: GET
- **Query Params**: `page`, `size`(max 50), `order`, `media`(`photo` 면 사진 있는 글만·프로필 고정 글 먼저), `species`(Post.type)
- **Response**: `posts`(각 행 `profilePinnedAt`, `type` 포함), `pages`

### 2-2. 종별 자동 앨범

- **URL**: `/api/users/[id]/photo-albums`
- **Method**: GET
- **Response**: `albums` — `{ species, count, cover }[]`, 사진 글이 많은 종부터 최대 8개

### 2-3. 팔로워·팔로잉 목록

- **URL**: `/api/users/[id]/followers`, `/api/users/[id]/following`
- **Method**: GET
- **Query Params**: `page`(default 1), `size`(default 20, max 50)
- **Response**: `users` — `{ id, name, avatar, bio, postsCount, isFollowing, followedAt }[]`, `pages`, `total`
- 탈퇴 사용자와 로그인 viewer 가 차단한 사용자는 빠진다. 최근 팔로우 순.

### 2-4. 프로필 사진 고정

- **URL**: `/api/posts/[id]/profile-pin`
- **Method**: POST (로그인 필요)
- **Body**: `pinned` (boolean)
- **Response**: `pinned`, `profilePinnedAt`. 멱등. 오류: 403 `NOT_POST_OWNER`, 400 `POST_NOT_PINNABLE`(사진 없음·공지), 409 `PROFILE_PIN_LIMIT`(3개 초과)

### 3. 특정 유저의 상품 목록 조회

- **URL**: `/api/users/[id]/productList`
- **Method**: GET
- **Query Params**:
  - `page` (number, optional): 페이지 번호 (default: 1)
  - `size` (number, optional): 페이지 당 상품 개수 (default: 10, max: 50)
  - `order` (string, optional): 정렬 순서 ('asc' | 'desc', default: 'desc')
- **Response**:
  - `success` (boolean)
  - `products` (array): 상품 목록
  - `pages` (number): 전체 페이지 수

### 4. 특정 유저의 구매 내역 조회

- **URL**: `/api/users/[id]/purchases`
- **Method**: GET
- **Query Params**:
  - `id` (number): 유저 ID
- **Response**:
  - `success` (boolean)
  - `mySellHistoryData` (array): 구매 내역 데이터

---

- 모든 API 응답은 `{ success: boolean, ... }` 형태로 반환됩니다.
- 인증이 필요한 API는 세션 기반 인증이 필요합니다.
- 에러 발생 시 `{ success: false, error: ... }` 형태로 반환됩니다.
- 상세한 필드/타입은 실제 API 응답 예시 또는 타입 정의를 참고하세요.
