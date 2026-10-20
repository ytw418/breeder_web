/**
 * 사진 여러 장을 동시에 몇 장씩 올리고, 결과는 넣은 순서대로 돌려준다.
 * - 앱 `src/lib/uploadQueue.ts` = 웹 `libs/client/uploadQueue.ts` 사본이다. 고칠 때는 두 곳을 같이 고친다.
 * - 한 장이 실패하면 새 장은 더 시작하지 않고, 이미 올리던 장이 끝나기를 기다린 뒤 첫 오류를 던진다.
 *   성공한 장은 upload 함수 안에서 호출하는 쪽이 기록해 두면(글쓰기: 사진을 remote 로 바꿈) 다시 누를 때 건너뛴다.
 * - 플랫폼 import 를 두지 않는다.
 */

export type UploadQueueOptions = {
  /** 동시에 올리는 장 수(기본 3). */
  concurrency?: number;
  /** 한 장이 끝날 때마다(성공만) 완료 수·전체 수를 알린다. 시작할 때 0 으로 한 번 부른다. */
  onProgress?: (done: number, total: number) => void;
};

export async function uploadInOrder<T, R>(
  items: readonly T[],
  upload: (item: T, index: number) => Promise<R>,
  { concurrency = 3, onProgress }: UploadQueueOptions = {},
): Promise<R[]> {
  const total = items.length;
  const results = new Array<R>(total);
  let next = 0;
  let done = 0;
  let failure: { error: unknown } | null = null;
  onProgress?.(0, total);

  const worker = async () => {
    while (!failure && next < total) {
      const index = next;
      next += 1;
      try {
        results[index] = await upload(items[index], index);
        done += 1;
        onProgress?.(done, total);
      } catch (error) {
        if (!failure) failure = { error };
      }
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, total)) }, worker);
  await Promise.all(workers);
  if (failure) throw (failure as { error: unknown }).error;
  return results;
}
