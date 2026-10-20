import { uploadInOrder } from "@libs/client/uploadQueue";

/** 앱 src/lib/uploadQueue.ts 와 같은 파일. 글쓰기 사진을 3장씩 올리고 순서를 지키는지 본다. */
const deferred = () => {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("uploadInOrder", () => {
  it("동시에 3장까지만 올리고, 늦게 끝나도 결과는 넣은 순서다", async () => {
    const jobs = Array.from({ length: 5 }, deferred);
    const started: number[] = [];
    const progress: number[] = [];
    const run = uploadInOrder(jobs, (job, index) => {
      started.push(index);
      return job.promise;
    }, { onProgress: (done) => progress.push(done) });

    await flush();
    expect(started).toEqual([0, 1, 2]);
    jobs[2].resolve("c");
    await flush();
    expect(started).toEqual([0, 1, 2, 3]);
    jobs[0].resolve("a");
    jobs[1].resolve("b");
    jobs[3].resolve("d");
    await flush();
    jobs[4].resolve("e");
    await expect(run).resolves.toEqual(["a", "b", "c", "d", "e"]);
    expect(progress).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("한 장이 실패하면 새 장은 시작하지 않고, 올리던 장이 끝난 뒤 그 오류를 던진다", async () => {
    const jobs = Array.from({ length: 5 }, deferred);
    const started: number[] = [];
    const run = uploadInOrder(jobs, (job, index) => {
      started.push(index);
      return job.promise;
    });
    await flush();
    jobs[0].reject(new Error("이미지 업로드에 실패했습니다."));
    await flush();
    jobs[1].resolve("b");
    jobs[2].resolve("c");
    await expect(run).rejects.toThrow("이미지 업로드에 실패했습니다.");
    expect(started).toEqual([0, 1, 2]);
  });
});
