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
- **Response**:
  - `success` (boolean)
  - `error` (string, optional): 에러 메시지(중복 닉네임 등)

### 2. 특정 유저 정보 조회

- **URL**: `/api/users/[id]`
- **Method**: GET
- **Query Params**:
  - `id` (number): 유저 ID
- **Response**:
  - `user` (object): 유저 정보

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
