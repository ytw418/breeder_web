// DOM 관련 matcher를 추가
import "@testing-library/jest-dom";

// 전역 모의(mock) 설정
global.fetch = jest.fn();
global.console.error = jest.fn();
global.console.warn = jest.fn();

// 이미지 모킹
jest.mock("@images/defaultImage.png", () => "test-file-stub");
