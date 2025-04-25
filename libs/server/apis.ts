import { ItemDetailResponse } from "pages/api/products/[id]";
import { PostDetailResponse } from "pages/api/posts/[id]";

const CACHE_TIME = 300; // 5분

export async function getProduct(id: string) {
  const res = await fetch(
    process.env.NEXT_PUBLIC_DOMAIN_URL! + `/api/products/${id}`,
    {
      cache: "no-store",
      // next: {
      //   revalidate: CACHE_TIME,
      // },
    }
  );
  if (!res.ok) {
    // 에러를 발생시켜 error.tsx 페이지에서 에러 처리
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
  return res.json() as Promise<ItemDetailResponse>;
}

export async function getPost(id: string) {
  const res = await fetch(
    process.env.NEXT_PUBLIC_DOMAIN_URL! + `/api/posts/${id}`,
    {
      cache: "no-store",
    }
  );
  
  if (!res.ok) {
    const contentType = res.headers.get("content-type");
    let errorMessage;
    
    if (contentType && contentType.includes("application/json")) {
      const data = await res.json();
      errorMessage = data.message || data.error || "알 수 없는 오류가 발생했습니다.";
    } else {
      errorMessage = await res.text();
    }
    
    throw new Error(errorMessage);
  }
  
  return res.json() as Promise<PostDetailResponse>;
}
