# 🐞 Breeder

## [브리더 접속하기](https://breeder-web.vercel.app/)

**Breeder**에 오신 것을 환영합니다! 이 웹 애플리케이션은 곤충 애호가들을 연결하고 곤충 관련 콘텐츠를 공유하고 발견할 수 있는 플랫폼을 제공합니다. 최신 기술을 활용하여 매끄럽고 몰입감 있는 사용자 경험을 제공합니다.

## 🚀 주요 기능

- **사용자 인증**: 인기 있는 OAuth 제공자를 통한 안전한 로그인 및 회원가입
- **게시물 관리**: 풍부한 텍스트와 이미지 지원으로 게시물 생성, 수정, 삭제
- **실시간 채팅**: 다른 사용자와 실시간 대화 가능
- **무한 스크롤**: 게시물을 손쉽게 탐색할 수 있는 무한 스크롤
- **반응형 디자인**: 데스크톱과 모바일 기기 모두에 최적화

## 🛠️ 기술 스택

- **프론트엔드**: React, Next.js, Tailwind CSS
- **백엔드**: Node.js, Prisma, PlanetScale
- **데이터베이스**: MySQL
- **인증**: NextAuth.js
- **실시간**: SWR, useSWRInfinite
- **배포**: Vercel

## 📂 프로젝트 구조

├── app
│ ├── (web)
│ │ ├── posts
│ │ │ ├── [id]
│ │ │ │ └── PostClient.tsx
│ │ │ ├── MainClient.tsx
│ │ │ └── upload
│ │ │ └── UploadClient.tsx
│ ├── (main)
│ │ └── MainClient.tsx
├── components
│ ├── layout.tsx
│ └── item.tsx
├── libs
│ └── server
│ └── apis.ts
├── pages
│ ├── api
│ │ └── posts
│ │ ├── index.ts
│ │ └── [id]
│ │ └── index.ts
├── public
│ └── images
│ ├── KakaoRound.svg
│ ├── GoogleRound.svg
│ ├── AppleSquare.svg
│ ├── AppleRound.svg
│ └── HeaderLogo.svg
├── styles
│ ├── globals.css
│ ├── style.css
│ └── colors.ts
└── README.md
🐜

## 📦 설치 방법

1. **레포지토리 클론**:

   ```bash
   git clone https://github.com/yourusername/breeder.git
   cd breeder
   ```

2. **의존성 설치**:

   ```bash
   npm install
   ```

3. **데이터베이스 설정**:

   ```bash
   npx prisma db push
   ```

4. **개발 서버 실행**:

   ```bash
   npm run dev
   ```

5. **브라우저 열기**:
   `http://localhost:3000`으로 이동하여 앱을 탐색하세요.

## 📜 스크립트

- `npm run dev`: 개발 서버 시작
- `npm run build`: 프로덕션 빌드
- `npm run start`: 프로덕션 서버 시작
- `npx prisma studio`: Prisma Studio를 열어 데이터베이스 관리

## 🤝 기여

기여를 환영합니다! 자세한 내용은 [기여 가이드라인](CONTRIBUTING.md)을 참조하세요.

## 📄 라이선스

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🌟 감사의 말

- 오픈 소스 커뮤니티의 귀중한 리소스와 도구에 감사드립니다.

---

Breeder와 함께 곤충의 세계를 탐험하고 기여하며 즐기세요! 🐜
