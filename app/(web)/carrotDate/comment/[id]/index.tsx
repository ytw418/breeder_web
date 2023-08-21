import Layout from "@components/layout";
import useMutation from "@libs/client/useMutation";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";

interface IForm {
  comment?: string;
  star?: number;
}
const CarrotDate: NextPage = () => {
  const router = useRouter(); //query:{buyerId, id:isCarrotId,  productId, sellerId}

  const [carrotComment, { loading }] = useMutation(
    `/api/gotocarrot/update/comment/${router.query.id}?productId=${router.query.productId}&sellerId=${router.query.sellerId}&buyerId=${router.query.buyerId}`
  );
  const { register, handleSubmit } = useForm<IForm>();
  const onValid = (form: IForm) => {
    if (loading) return;
    carrotComment(form);
    if (!loading) {
      router.replace(`/chats`);
    }
  };
  return (
    <Layout canGoBack title="후기 작성" seoTitle="후기 작성">
      <div>
        <form onSubmit={handleSubmit(onValid)}>
          <span>후기를 입력해 주세요</span>
          <br />
          <textarea {...register("comment")} placeholder="좋은 거래였습니다!" />
          <br />
          <span>별점을 입력해 주세요(기본 5)</span>
          <br />
          <input {...register("star")} type="number" max={5} min={0} />
          <br />
          <button>입력완료</button>
        </form>
      </div>
    </Layout>
  );
};

export default CarrotDate;
