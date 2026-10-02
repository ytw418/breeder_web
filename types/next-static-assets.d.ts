// next-env.d.ts 는 .gitignore 대상이라 CI(깨끗한 체크아웃)에는 없다.
// 이미지·svg import 타입(*.svg, *.png 등)을 CI 타입체크에서도 알 수 있게 같은 참조를 커밋해 둔다.
/// <reference types="next" />
/// <reference types="next/image-types/global" />
