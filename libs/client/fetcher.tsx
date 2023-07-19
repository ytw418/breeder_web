export const fetcher = async <ReqBody = any, ResData = any>(
  url: string,
  { arg, init }: { arg?: ReqBody; init?: RequestInit }
): Promise<ResData> => {
  return fetch(
    url,
    init
      ? init
      : {
          method: "POST",
          body: JSON.stringify(arg),
        }
  ).then(async (res) => {
    if (!res.ok) {
      try {
        // ok 가 false 일때 res.json() 실행
        const data = await res.json();
        throw new Error(data.message);
      } catch (error) {
        //  응답이 json이 아닐 때 res.text()
        const data = await res.text();
        throw new Error(data);
      }
    }
    return res.json();
  }); // 그 외 에러는 swr 에서 처리
};
