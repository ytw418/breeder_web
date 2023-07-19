import "dayjs/locale/ko";
import "dayjs/locale/ja";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import updateLocale from "dayjs/plugin/updateLocale";

export const getDueDate = (dueDate: string, lng: any) => {
  let locale: "en" | "ja" | "ko";
  switch (lng) {
    case "us":
      locale = "en";
      break;
    case "jp":
      locale = "ja";
      break;
    case "kr":
    default:
      locale = "ko";
      break;
  }
  dayjs.extend(updateLocale);
  dayjs.extend(relativeTime);
  dayjs.locale(locale);

  if (!dueDate) return "";
  const current = dayjs();
  const due = dayjs(Number(dueDate));

  // 소장|대여만료|N일남음|N시간남음
  if (due.year() === 2100) {
    // switch (lng) {
    //   case "us":
    //     return "Owned";
    //   case "jp":
    //     locale = "ja";
    //     return "所藏";
    //   case "kr":
    //   default:
    //     return "소장";
    // }
    return "소장";
  } else if (current > due) {
    switch (lng) {
      case "us":
        return "Expired";
      case "jp":
        locale = "ja";
        return "レンタル滿了";
      case "kr":
      default:
        return "대여만료";
    }
  } else if (current < due) {
    switch (lng) {
      case "us":
        return current.to(due, true) + "left";
      case "jp":
        locale = "ja";
        return current.to(due, true) + "残り";
      case "kr":
      default:
        return current.to(due, true) + "남음";
    }
  }
  return "";
};

export const getPassedTime = (time: string, lng: any) => {
  let locale: "en" | "ja" | "ko";
  switch (lng) {
    case "us":
      locale = "en";
      break;
    case "jp":
      locale = "ja";
      break;
    case "kr":
    default:
      locale = "ko";
      break;
  }

  dayjs.extend(updateLocale);
  dayjs.extend(relativeTime);
  dayjs.locale(locale);

  const createdAt = dayjs(Number(time));
  if (!time) return "";
  return createdAt.fromNow();
};

export const getLocaleDate = (time: string) => {
  return dayjs(+time).format("YYYY.MM.DD");
};
