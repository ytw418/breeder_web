import useUser from "@libs/client/useUser";
import { cls } from "@libs/client/utils";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

interface CarrotProps {
  [key: string]: any;
}

export default function CarrotDate({
  CarrotData,
  TTSData,
  CarrotCommentData,
}: CarrotProps) {
  const router = useRouter();
  const { user } = useUser();
  const [textValue, setTextValue] = useState("");
  const [isBuyer, setisBuyer] = useState(true);
  const [show, setShow] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(false);

  const ClickGoToCarrot = () => {
    if (textValue === "후기를 입력 해 보세요") {
      router.push(
        {
          pathname: `/carrotDate/comment/${CarrotData?.findCarrotData?.id}`,
          query: {
            productId: TTSData?.findTalkToSellerUniq?.productId,
            sellerId: TTSData?.findTalkToSellerUniq?.createdSellerId,
            buyerId: TTSData?.findTalkToSellerUniq?.createdBuyerId,
          },
        },
        `/carrotDate/comment/${CarrotData?.findCarrotData?.id}`
      );
    } else {
      if (CarrotData && CarrotData.success) {
        router.push(
          {
            pathname: `/carrotDate/${CarrotData?.findCarrotData?.id}`,
            query: {
              productId: TTSData?.findTalkToSellerUniq?.productId,
              sellerId: TTSData?.findTalkToSellerUniq?.createdSellerId,
            },
          },
          `/carrotDate/${CarrotData?.findCarrotData?.id}`
        );
      }
    }
  };

  useEffect(() => {
    if (
      TTSData?.findTalkToSellerUniq?.isbuy &&
      TTSData?.findTalkToSellerUniq?.issold &&
      !CarrotData?.findCarrotData?.meetTime &&
      TTSData.findTalkToSellerUniq?.createdSellerId !== user?.id
    ) {
      setisBuyer(true);
      setShow(true);
      setTimeRemaining(false);
      setTextValue("구매일정을 등록하고 당근하세요✓");
    } else if (
      TTSData?.findTalkToSellerUniq?.isbuy &&
      TTSData?.findTalkToSellerUniq?.issold &&
      !CarrotData?.findCarrotData?.meetTime &&
      TTSData.findTalkToSellerUniq?.createdSellerId === user?.id
    ) {
      setShow(true);
      setisBuyer(false);
      setTimeRemaining(false);
      setTextValue("상대방이 일정을 등록중에 있습니다");
    } else if (
      TTSData?.findTalkToSellerUniq?.isbuy &&
      TTSData?.findTalkToSellerUniq?.issold &&
      CarrotData?.findCarrotData?.meetTime &&
      !TTSData?.findTalkToSellerUniq?.isSell
    ) {
      setShow(true);
      setisBuyer(true);
      setTimeRemaining(true);
      setTextValue("구매일정이 등록되었습니다✓");
    } else if (
      TTSData?.findTalkToSellerUniq?.isbuy &&
      !TTSData?.findTalkToSellerUniq?.issold
    ) {
      setShow(true);
      setisBuyer(false);
      setTimeRemaining(false);
      setTextValue("구매예약이 된 상품입니다.");
    } else if (
      TTSData?.findTalkToSellerUniq?.createdSellerId === user?.id &&
      !TTSData?.findTalkToSellerUniq?.isbuy &&
      TTSData?.findTalkToSellerUniq?.issold
    ) {
      setShow(true);
      setisBuyer(false);
      setTimeRemaining(false);
      setTextValue("상대방이 구매예약 상태가 아닙니다.");
    } else if (
      (!TTSData?.findTalkToSellerUniq?.isbuy &&
        !TTSData?.findTalkToSellerUniq?.issold) ||
      (CarrotCommentData?.carrotComment?.carrotcommentbuyerId === user?.id &&
        CarrotCommentData?.carrotComment?.buyerComment) ||
      (CarrotCommentData?.carrotComment?.carrotcommentsellerId === user?.id &&
        CarrotCommentData?.carrotComment?.sellerComment)
    ) {
      setShow(false);
    } else if (TTSData?.findTalkToSellerUniq?.isSell) {
      setShow(true);
      setTextValue("후기를 입력 해 보세요");
    }
  }, [CarrotData, TTSData, user, CarrotCommentData]);

  let CarrotTime, CarrotYMD, CarrotHM;
  if (CarrotData?.findCarrotData?.meetTime) {
    CarrotYMD = CarrotData?.findCarrotData?.meetTime.split("-");
    CarrotHM = CarrotData?.findCarrotData?.meetTime.split(":");
    CarrotTime =
      CarrotYMD[0] +
      "년 " +
      CarrotYMD[1] +
      "월 " +
      CarrotYMD[2].slice(0, 2) +
      "일 " +
      CarrotHM[0].slice(-2) +
      "시 " +
      CarrotHM[1] +
      "분";
  }
  return (
    <div
      onClick={ClickGoToCarrot}
      className={cls(
        " fixed z-10 flex flex-col rounded-md max-w-xl h-10 justify-center items-center  w-full  bg-white",
        isBuyer ? "hover:cursor-pointer" : "",
        show ? "" : "hidden",
        timeRemaining ? "my-3" : ""
      )}
    >
      <span> {textValue}</span>
      {timeRemaining && !TTSData?.findTalkToSellerUniq?.isSell && (
        <span>
          거래 시간 - <strong>{CarrotTime}</strong>
        </span>
      )}
    </div>
  );
}
