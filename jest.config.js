module.exports = {
  // TypeScript 파일을 처리하기 위한 설정
  preset: "ts-jest",

  // 브라우저 환경을 시뮬레이션
  testEnvironment: "jsdom",

  // 테스트 파일 패턴
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],

  // 모듈 경로 별칭 설정
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@components/(.*)$": "<rootDir>/components/$1",
    "^@libs/(.*)$": "<rootDir>/libs/$1",
    "^@images/(.*)$": "<rootDir>/public/images/$1",
    "^@icons/(.*)$": "<rootDir>/public/icons/$1",
    "^@hero/(.*)$": "<rootDir>/public/hero/$1",
  },

  // 테스트 실행 전에 실행할 파일
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  // TypeScript 설정
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },

  // 상세한 테스트 결과 출력
  verbose: true,

  // 테스트 결과 출력 형식
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "test-results",
        outputName: "junit.xml",
        classNameTemplate: "{classname}",
        titleTemplate: "{title}",
      },
    ],
  ],
};
