import { buildBreederHighlights } from "@libs/server/ranking";

const post = (id: number, userId: number, images: string[], likes = 0, image = images[0] ?? "") => ({
  id,
  userId,
  image,
  images,
  _count: { Likes: likes },
});

describe("TOP 브리더 highlight", () => {
  it("최신순 사진 글 4개, 사진 장수, 받은 좋아요, 팔로워, 상품 수를 사람별로 모은다", () => {
    const result = buildBreederHighlights(
      [1, 2],
      [
        post(10, 1, ["a", "b"], 2),
        post(9, 1, [], 1, ""),
        post(8, 1, ["c"]),
        post(7, 2, ["d"], 3),
        post(6, 1, ["e"]),
        post(5, 1, ["f"]),
        post(4, 1, ["g"]),
        post(3, 9, ["x"], 5),
      ],
      [{ key: 2, count: 4 }],
      [{ key: 1, count: 5 }],
    );
    expect(result.get(1)).toEqual({
      photos: [
        { postId: 10, image: "a" },
        { postId: 8, image: "c" },
        { postId: 6, image: "e" },
        { postId: 5, image: "f" },
      ],
      photosCount: 6,
      likesReceivedCount: 3,
      followersCount: 0,
      productsCount: 5,
    });
    expect(result.get(2)).toEqual({
      photos: [{ postId: 7, image: "d" }],
      photosCount: 1,
      likesReceivedCount: 3,
      followersCount: 4,
      productsCount: 0,
    });
    expect(result.has(9)).toBe(false);
  });

  it("images 가 비어 있으면 예전 단일 image 를 쓴다", () => {
    const result = buildBreederHighlights([1], [post(1, 1, [], 0, "old")], [], []);
    expect(result.get(1)?.photos).toEqual([{ postId: 1, image: "old" }]);
    expect(result.get(1)?.photosCount).toBe(1);
  });
});
