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
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(jpg|jpeg|png|gif|webp|svg)$": "<rootDir>/__mocks__/fileMock.js",
    "^@images/(.*)\\.(png|jpg|jpeg|gif|webp|svg)$":
      "<rootDir>/__mocks__/fileMock.js",
  },

  // 테스트 실행 전에 실행할 파일
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  // TypeScript 설정
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          module: "commonjs",
        },
      },
    ],
    "^.+\\.(js|jsx)$": [
      "babel-jest",
      {
        presets: [
          "@babel/preset-env",
          "@babel/preset-react",
          "@babel/preset-typescript",
        ],
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

  // node_modules 변환 제외 패턴
  transformIgnorePatterns: [
    "/node_modules/(?!(@babel|@testing-library|@emotion|@mui|@prisma|@svgr)/)",
  ],

  // 로컬 worktree 복제본은 테스트 스캔에서 제외
  modulePathIgnorePatterns: ["<rootDir>/.worktrees/"],
  testPathIgnorePatterns: ["<rootDir>/.worktrees/"],
};
