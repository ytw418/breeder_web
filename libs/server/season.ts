const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const toKstDate = (date: Date) => new Date(date.getTime() + KST_OFFSET_MS);
const fromKstDate = (date: Date) => new Date(date.getTime() - KST_OFFSET_MS);

export const getKstWeekWindow = (baseDate = new Date()) => {
  const kst = toKstDate(baseDate);
  const day = kst.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const startKst = new Date(kst);
  startKst.setUTCDate(kst.getUTCDate() + diffToMonday);
  startKst.setUTCHours(0, 0, 0, 0);

  const endKst = new Date(startKst.getTime() + WEEK_MS - 1);

  return {
    startAt: fromKstDate(startKst),
    endAt: fromKstDate(endKst),
  };
};

export const getPreviousKstWeekWindow = (baseDate = new Date()) => {
  const current = getKstWeekWindow(baseDate);
  const endAt = new Date(current.startAt.getTime() - 1);
  const startAt = new Date(endAt.getTime() - WEEK_MS + 1);
  return {
    startAt,
    endAt,
  };
};

export const getMonthWindow = (baseDate = new Date()) => {
  const kst = toKstDate(baseDate);
  const startKst = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1, 0, 0, 0, 0));
  const endKst = new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() + 1, 1, 0, 0, 0, 0) - 1
  );
  return {
    startAt: fromKstDate(startKst),
    endAt: fromKstDate(endKst),
  };
};

export const getSeasonLabel = (startAt: Date, endAt: Date) => {
  return `${startAt.toLocaleDateString("ko-KR")} - ${endAt.toLocaleDateString("ko-KR")}`;
};
