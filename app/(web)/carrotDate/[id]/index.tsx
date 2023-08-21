import type { NextPage } from "next";
import Layout from "@components/layout";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import useMutation from "@libs/client/useMutation";

interface IForm {
  year: string;
  month: string;
  day: string;
  hour: string;
  min: string;
}

const CarrotDate: NextPage = () => {
  const router = useRouter(); // query:{id:carrotId, productId, sellerId}
  const { register, handleSubmit } = useForm();
  const [updateCarrotDate, { data, loading }] = useMutation(
    `/api/gotocarrot/update/${router.query.id}`
  );
  const onValid = (form: IForm) => {
    if (loading) return;
    if (Number(form.month) < 10 && form.month.slice(0, 1) !== "0") {
      form.month = "0" + form.month.slice(0, 1);
    }
    updateCarrotDate(form);
  };

  if (data && data.success) {
    router.replace(
      `/chats/${router.query.productId}?sellerId=${router.query.sellerId}`
    );
  }

  // 현재시간 출력 시작
  const year = new Intl.DateTimeFormat("en", { year: "numeric" }).format();
  const monthFull = new Intl.DateTimeFormat("kr", { month: "short" }).format();
  let month = "0" + monthFull.slice(0, 1);
  if (monthFull.slice(1, 2) !== "월") {
    month = monthFull.slice(0, 2);
  }
  const day = new Intl.DateTimeFormat("en", { day: "numeric" }).format();
  const hourFull = new Intl.DateTimeFormat("kr", { hour: "numeric" }).format();
  let hour = Number(hourFull.slice(3, 4));
  if (hourFull.slice(0, 2) === "오후") {
    if (hourFull.slice(4, 5) === "시") {
      hour = Number(hourFull.slice(3, 4)) + 12;
    } else {
      hour = Number(hourFull.slice(3, 5) + 12);
    }
  } else {
    if (hourFull.slice(4, 5) === "시") {
      hour = Number(hourFull.slice(3, 4));
    } else {
      hour = Number(hourFull.slice(3, 5));
    }
  }
  const min = new Intl.DateTimeFormat("en", { minute: "numeric" }).format();
  //현재 시간 출력 끝
  return (
    <Layout canGoBack title="구매 날짜 선택" seoTitle="구매 날짜 선택">
      <div>
        <span>구매 날짜를 입력해 주세요</span>
        <form onSubmit={handleSubmit(() => onValid)}>
          <input defaultValue={year} type="text" {...register("year")} />년
          <input defaultValue={month} type="text" {...register("month")} />월
          <input defaultValue={day} type="text" {...register("day")} />일
          <input defaultValue={hour} type="text" {...register("hour")} />시
          <input defaultValue={min} type="text" {...register("min")} />분<br />
          <button>입력완료</button>
        </form>
      </div>
    </Layout>
  );
};

export default CarrotDate;
