## 상품 API 명세

### 1. 상품 목록 조회

- **URL**: `/api/products`
- **Method**: GET
- **Query Params**:
  - `page` (number, optional): 페이지 번호 (default: 1)
  - `size` (number, optional): 페이지 당 상품 개수 (default: 10)
- **Response**:
  - `success` (boolean)
  - `products` (array): 상품 목록
  - `pages` (number): 전체 페이지 수

### 2. 상품 등록

- **URL**: `/api/products`
- **Method**: POST
- **Body**:
  - `name` (string): 상품명
  - `price` (number): 가격
  - `description` (string): 설명
  - `photos` (string[]): 상품 이미지 URL 배열 (optional)
- **Response**:
  - `success` (boolean)
  - `product` (object): 생성된 상품 정보

### 3. 상품 상세 조회

- **URL**: `/api/products/[id]`
- **Method**: GET
- **Response**:
  - `success` (boolean)
  - `product` (object): 상품 상세 정보
  - `isLiked` (boolean): 관심 상품 여부
  - `relatedProducts` (array): 연관 상품 목록

### 4. 상품 수정/삭제

- **URL**: `/api/products/[id]`
- **Method**: POST
- **Body**:
  - `action` (string): 'update' | 'delete'
  - `data` (object, optional): 수정 시 포함 (name, price, description, photos)
- **Response**:
  - `success` (boolean)
  - `product` (object, optional): 수정된 상품 정보

### 5. 관심 상품 등록/취소

- **URL**: `/api/products/[id]/fav`
- **Method**: POST
- **Response**:
  - `success` (boolean)

### 6. 특정 유저의 상품 목록 조회

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

---

- 모든 API 응답은 `{ success: boolean, ... }` 형태로 반환됩니다.
- 인증이 필요한 API는 JWT/세션 기반 인증이 필요합니다.
- 에러 발생 시 `{ success: false, error: ... }` 형태로 반환됩니다.
- 상세한 필드/타입은 실제 API 응답 예시 또는 타입 정의를 참고하세요.
