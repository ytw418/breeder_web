import client from "@libs/server/client";
import { findAdminUserIds } from "@libs/server/adminAccess";
import { sendPushToUsers } from "@libs/server/push";
import { REPORT_TARGET_LABEL, type ReportTargetType } from "@libs/shared/report";
import { isUrgentReportReason } from "@libs/shared/sanction";

/** 운영자 푸시를 누르면 여는 화면(앱은 /admin 경로를 브라우저로 연다). */
export const REPORT_ALERT_ADMIN_PATH = "/admin/reports";

/** 같은 대상의 열린 신고가 이 건수가 되는 순간 알린다(첫 신고와 누적 3건째). */
const ALERT_OPEN_COUNTS = [1, 3];

/**
 * 운영자에게 바로 알릴 신고인지(앱 docs/prd/admin-moderation.md §10).
 * 사기·불법 개체·동물 학대 계열은 매번, 그 밖의 사유는 같은 대상의 첫 신고와 3건째에만 알린다.
 */
export const shouldAlertAdminsOfReport = (openCount: number, reason: string) =>
  isUrgentReportReason(reason) || ALERT_OPEN_COUNTS.includes(openCount);

/**
 * 신고 접수 직후 운영자(ytw418* 이메일) 기기로 푸시를 보낸다. 1인 운영이라 관리자 화면에 들어가기 전에 알아야 한다.
 * 알림 실패가 신고 접수를 막지 않도록 오류는 삼킨다. 신고한 사람이 운영자 본인이면 그 계정은 뺀다.
 */
export async function notifyAdminsOfReport({
  targetType,
  targetId,
  reason,
  reporterId,
}: {
  targetType: ReportTargetType;
  targetId: number;
  reason: string;
  reporterId: number;
}): Promise<void> {
  try {
    const openCount = await client.report.count({
      where: { targetType, targetId, status: "OPEN" },
    });
    if (!shouldAlertAdminsOfReport(openCount, reason)) return;

    const adminIds = (await findAdminUserIds()).filter((id) => id !== reporterId);
    if (!adminIds.length) return;

    await sendPushToUsers(adminIds, {
      title: `신고 접수: ${REPORT_TARGET_LABEL[targetType]} · ${reason}`,
      body:
        openCount > 1
          ? `같은 대상 신고가 ${openCount}건 쌓였어요. 눌러서 확인해 주세요`
          : "눌러서 신고 관리에서 확인해 주세요",
      url: REPORT_ALERT_ADMIN_PATH,
      tag: `report-${targetType}-${targetId}`,
    });
  } catch (error) {
    console.error("[reports] 운영자 신고 알림 실패", error);
  }
}
