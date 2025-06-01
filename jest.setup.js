// DOM 관련 matcher를 추가
require("@testing-library/jest-dom");

// 전역 모의(mock) 설정
global.fetch = jest.fn();
global.console.error = jest.fn();
global.console.warn = jest.fn();
