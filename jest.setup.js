// DOM 관련 matcher를 추가
import "@testing-library/jest-dom";

// 전역 모의(mock) 설정
global.fetch = jest.fn();
global.console.error = jest.fn();
global.console.warn = jest.fn();

// jsdom 에는 scrollIntoView 가 없다(오류 칸을 화면으로 올리는 폼이 부른다).
// node 환경(@jest-environment node) 테스트에는 Element 가 없다.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = jest.fn();
}

// 이미지 모킹
jest.mock("@images/defaultImage.png", () => "test-file-stub");
