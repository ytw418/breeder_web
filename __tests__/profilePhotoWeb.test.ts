import {
  isFollowListKey,
  isFollowingFeedKey,
  isProfileKey,
  withFollowListRow,
  withMyFollowingDelta,
  withTargetFollowState,
} from "@libs/client/followState";
import { clampAlbumTitle, mergeAlbumCandidates, toggleAlbumPost } from "@libs/client/albumEdit";
import { PROFILE_TABS } from "@libs/client/profileTabs";
import { getPostMenuActionKeys } from "../app/(web)/posts/_lib/postComposer";

const profile = (followers: number, following: number) => ({
  isFollowing: false,
  user: { id: 3, name: "a", _count: { followers, following } },
});

describe("팔로우 캐시 갱신(앱 applyFollowState 와 같은 규칙)", () => {
  it("상대 프로필은 상태와 팔로워 수를 바꾸고 0 아래로 내려가지 않는다", () => {
    expect(withTargetFollowState(profile(2, 0), true, 1)).toMatchObject({
      isFollowing: true,
      user: { _count: { followers: 3 } },
    });
    expect(withTargetFollowState(profile(0, 0), false, -1)?.user?._count.followers).toBe(0);
  });

  it("delta 0 은 상태만 맞추고, 내 프로필은 팔로잉 수만 바꾼다", () => {
    expect(withTargetFollowState(profile(2, 0), true, 0)?.user?._count.followers).toBe(2);
    expect(withMyFollowingDelta(profile(0, 4), -1)?.user?._count.following).toBe(3);
    const same = profile(0, 4);
    expect(withMyFollowingDelta(same, 0)).toBe(same);
  });

  it("목록 페이지에서는 그 사람 행만 바꾼다", () => {
    const pages = [{ users: [{ id: 1, isFollowing: false }, { id: 2, isFollowing: false }] }];
    expect(withFollowListRow(pages, 2, true)?.[0].users).toEqual([
      { id: 1, isFollowing: false },
      { id: 2, isFollowing: true },
    ]);
  });

  it("캐시 키를 가려낸다", () => {
    expect(isProfileKey("/api/users/3", 3)).toBe(true);
    expect(isProfileKey("/api/users/30", 3)).toBe(false);
    expect(isFollowListKey("$inf$/api/users/3/followers?page=1&size=20")).toBe(true);
    expect(isFollowListKey("/api/users/3/followers?page=1")).toBe(false);
  });

  it("반려생활 '팔로잉' 목록 키를 가려낸다(팔로우·언팔로우 뒤 다시 받는다)", () => {
    expect(isFollowingFeedKey("$inf$/api/posts?page=1&following=1&categoryPath=%2Freptile%2F")).toBe(true);
    expect(isFollowingFeedKey("$inf$/api/posts?page=1&category=%EC%9E%90%EC%9C%A0")).toBe(false);
    expect(isFollowingFeedKey("/api/users/3")).toBe(false);
  });
});

describe("앨범 편집", () => {
  it("고른 순서대로 담고, 다시 누르면 빼고, 30장이면 막는다", () => {
    expect(toggleAlbumPost([5, 7], 9)).toEqual({ selected: [5, 7, 9], limited: false });
    expect(toggleAlbumPost([5, 7, 9], 7)).toEqual({ selected: [5, 9], limited: false });
    const full = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(toggleAlbumPost(full, 99)).toEqual({ selected: full, limited: true });
  });

  it("이름은 12자(이모지 1자)로 자른다", () => {
    expect(clampAlbumTitle("가나다라마바사아자차카타파하")).toBe("가나다라마바사아자차카타");
    expect(clampAlbumTitle("🦎🦎🦎")).toBe("🦎🦎🦎");
  });

  it("앨범 글을 앞에 두고 내 사진 글을 잇되 같은 글은 한 번만", () => {
    expect(mergeAlbumCandidates([{ id: 3 }, { id: 1 }], [{ id: 1 }, { id: 2 }]).map((p) => p.id)).toEqual([3, 1, 2]);
  });
});

describe("프로필 밑줄 탭", () => {
  // 2026-10-09 v4: 내 프로필·남 프로필·마이페이지가 같은 다섯 탭을 쓴다(내용이 없으면 빈 상태).
  it("누구 프로필이든 사진·기록·분양·경매·혈통 다섯 개를 같은 순서로 둔다", () => {
    expect(PROFILE_TABS.map((t) => t.label)).toEqual(["사진", "기록", "분양", "경매", "혈통"]);
    expect(PROFILE_TABS.map((t) => t.id)).toEqual(["photos", "posts", "products", "auctions", "bloodlines"]);
  });
});

describe("게시글 ⋯ 메뉴 프로필 고정", () => {
  const base = { isOwn: true, isNotice: false, hasAuthor: true, authorBlocked: false };
  it("내 사진 글이면 삭제 다음에 프로필 고정을 둔다", () => {
    expect(getPostMenuActionKeys({ ...base, canProfilePin: true })).toEqual([
      "edit",
      "delete",
      "profile-pin",
      "share",
      "copy-link",
    ]);
    expect(getPostMenuActionKeys(base)).toEqual(["edit", "delete", "share", "copy-link"]);
    expect(getPostMenuActionKeys({ ...base, isOwn: false, canProfilePin: true })).not.toContain("profile-pin");
  });
});
