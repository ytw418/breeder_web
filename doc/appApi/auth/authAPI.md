# 사용자 인증 API 명세서

## 인증 시스템 개요

### 세션 기반 인증
- `iron-session` 라이브러리를 사용하여 세션 관리
- 쿠키 이름: "kakaoDev"
- 세션 유효기간: 24시간
- 보안: production 환경에서만 secure 쿠키 사용

### 세션 데이터 구조
```typescript
interface IronSessionData {
  user?: {
    id: number;
    snsId: string;
    provider: string;
    phone: string | null;
    email: string | null;
    name: string;
    avatar: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}
```

## 1. 로그인

### POST /api/auth/login
소셜 로그인을 통해 사용자를 인증합니다.

#### Request Body
```json
{
  "snsId": "123456789",
  "name": "사용자 이름",
  "provider": "kakao" | "google" | "apple",
  "email": "user@example.com",
  "avatar": "프로필 이미지 URL"
}
```

#### Response
```json
{
  "success": true,
  "user": {
    "id": 1,
    "snsId": "123456789",
    "provider": "kakao",
    "phone": null,
    "email": "user@example.com",
    "name": "사용자 이름",
    "avatar": "프로필 이미지 URL",
    "createdAt": "2024-04-25T12:00:00Z",
    "updatedAt": "2024-04-25T12:00:00Z"
  }
}
```

## 2. 로그아웃

### POST /api/auth/logout
사용자 세션을 종료합니다.

#### Response
```json
{
  "success": true,
  "message": "로그아웃되었습니다."
}
```

## 3. 현재 사용자 정보 조회

### GET /api/users/me
현재 로그인한 사용자의 정보를 조회합니다.

#### Response
```json
{
  "success": true,
  "user": {
    "id": 1,
    "snsId": "123456789",
    "provider": "kakao",
    "phone": null,
    "email": "user@example.com",
    "name": "사용자 이름",
    "avatar": "프로필 이미지 URL",
    "createdAt": "2024-04-25T12:00:00Z",
    "updatedAt": "2024-04-25T12:00:00Z"
  }
}
```

## 4. 소셜 로그인 콜백

### POST /api/auth/{provider}/callback
소셜 로그인 인증 후 콜백을 처리합니다.

#### 지원하는 Provider
- kakao
- google
- apple

#### Response
```json
{
  "success": true,
  "user": {
    "id": 1,
    "snsId": "123456789",
    "provider": "kakao",
    "phone": null,
    "email": "user@example.com",
    "name": "사용자 이름",
    "avatar": "프로필 이미지 URL",
    "createdAt": "2024-04-25T12:00:00Z",
    "updatedAt": "2024-04-25T12:00:00Z"
  }
}
```

## 클라이언트 측 인증 관리

### AuthProvider
```typescript
const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState();
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### useAuth 훅
```typescript
const { user, setUser } = useAuth();
```

## 인증이 필요한 API 사용 방법

### 서버 사이드
```typescript
export default withApiSession(
  withHandler({ 
    methods: ["POST"], 
    handler, 
    isPrivate: true 
  })
);
```

### 클라이언트 사이드
```typescript
const { user } = useAuth();
if (!user) {
  // 로그인 페이지로 리다이렉트
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
- `BAD_REQUEST`: 잘못된 요청
- `INTERNAL_SERVER_ERROR`: 서버 내부 오류

## 보안 고려사항

1. 세션 보안
   - 쿠키는 production 환경에서만 secure 옵션 사용
   - 세션 데이터는 암호화되어 저장

2. 소셜 로그인
   - 각 provider의 공식 SDK 사용
   - 토큰 검증 및 사용자 정보 확인

3. API 보호
   - 인증이 필요한 API는 `withApiSession`과 `withHandler`로 보호
   - 클라이언트 측에서도 인증 상태 확인

4. 세션 관리
   - 세션 만료 시간 설정 (24시간)
   - 로그아웃 시 세션 즉시 파기 