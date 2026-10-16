import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Layout from "@components/features/MainLayout";
import { AUCTION_SETTLEMENT_GRACE_DAYS } from "@libs/auctionRules";

// Google Play 데이터 보안 '계정 삭제 URL'로 등록하는 공개 안내 페이지(로그인 없이 열린다).
// 지우는 것·남기는 것은 libs/server/accountDeletion.ts(deleteAccount)와 같아야 한다 — 그쪽을 바꾸면 이 글도 고친다.

const SUPPORT_EMAIL = "bredyteam@gmail.com";
const RETENTION_DAYS = 30;
const CARD_CLASS = "rounded-xl border border-app-border bg-app-elevated p-4";

export const metadata: Metadata = {
  title: "계정·데이터 삭제 안내",
  description:
    "브리디 계정을 탈퇴하고 데이터를 삭제하는 방법, 지워지는 정보와 남는 정보, 보관 기간을 안내합니다.",
  alternates: { canonical: "https://bredy.app/account-deletion" },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={CARD_CLASS}>
      <h2 className="text-[17px] font-bold text-app-text">{title}</h2>
      <div className="mt-1.5 flex flex-col gap-1 text-[15px] leading-6 text-app-text">
        {children}
      </div>
    </section>
  );
}

export default function AccountDeletionPage() {
  return (
    <Layout canGoBack title="계정·데이터 삭제" seoTitle="브리디 계정·데이터 삭제 안내">
      <div className="mx-auto min-h-full max-w-2xl bg-app-bg px-4 pb-10 pt-4">
        <h1 className="text-[22px] font-bold text-app-text">
          브리디 계정·데이터 삭제 안내
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-app-muted">
          브리디(Bredy) 앱·웹 계정을 탈퇴하고 데이터를 지우는 방법입니다. 앱과 웹은
          같은 계정이라 한쪽에서 탈퇴하면 둘 다 지워집니다.
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          <Section title="1. 앱에서 탈퇴하기">
            <p>브리디 앱 → 메뉴(☰) → 설정 → 회원탈퇴 → 탈퇴하기 → 확인 창에서 탈퇴하기</p>
          </Section>

          <Section title="2. 웹에서 탈퇴하기">
            <p>bredy.app 에 로그인 → 메뉴(☰) → 설정 → 회원탈퇴 → 탈퇴하기</p>
            <p>
              <Link
                href="/settings/delete-account"
                className="font-semibold text-app-brand-text underline"
              >
                회원탈퇴 화면 바로 가기
              </Link>
            </p>
          </Section>

          <Section title="3. 로그인할 수 없을 때">
            <p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              로 제목 &lsquo;브리디 탈퇴 요청&rsquo;, 가입한 로그인 방식(카카오·구글)과
              닉네임을 보내 주세요. 본인 확인 뒤 탈퇴를 처리하고 메일로 알려 드립니다.
            </p>
          </Section>

          <Section title="바로 지워지는 정보">
            <ul className="list-disc pl-5">
              <li>이메일, 전화번호, 프로필 사진, 소개글, 커버 사진, 대표 링크</li>
              <li>내 동네 설정과 동네 방문 기록, 관심 카테고리 설정</li>
              <li>닉네임 — &lsquo;탈퇴한 사용자&rsquo;로 바뀝니다</li>
              <li>소셜 로그인 식별값 — 되돌릴 수 없는 값으로 바뀌고 모든 기기에서 로그아웃됩니다</li>
              <li>푸시 알림 토큰, 관심 목록, 팔로우·팔로워, 알림, 프로필 앨범</li>
              <li>분양중인 분양글은 목록에서 내려갑니다</li>
            </ul>
          </Section>

          <Section title="남는 정보">
            <p>
              작성한 게시글·댓글·분양글·채팅·경매 기록은 다른 이용자와 나눈 대화와 거래
              기록이라 남습니다. 작성자는 &lsquo;탈퇴한 사용자&rsquo;로 표시되어 누구인지
              알 수 없습니다. 탈퇴 전에 지우고 싶은 글은 각 글의 ⋯ 메뉴에서 직접 삭제해
              주세요.
            </p>
            <p>
              앱 사용 통계(어떤 화면을 열었는지 등)는 회원 번호로만 남아 서비스 개선에
              쓰입니다. 구글로 가입했다면 로그인 인증 기록(Google Firebase)도 남습니다.
              둘 다 지우기를 원하면 위 메일로 요청해 주세요.
            </p>
          </Section>

          <Section title="보관 기간">
            <p>
              잘못된 탈퇴 복구와 거래 분쟁 대응을 위해 이메일·전화번호·닉네임·소셜 로그인
              식별값 원문을 탈퇴일로부터 {RETENTION_DAYS}일 동안 따로 보관한 뒤 파기합니다.
              이 기간에는 같은 소셜 계정으로 다시 가입할 수 없습니다.
            </p>
          </Section>

          <Section title="지금 탈퇴할 수 없는 경우">
            <p>
              진행 중인 경매(분양 중이거나 최고 입찰 중), 낙찰된 지{" "}
              {AUCTION_SETTLEMENT_GRACE_DAYS}일이 지나지 않은 경매, 예약중인 분양글이
              있으면 거래가 끝난 뒤 탈퇴할 수 있습니다.
            </p>
          </Section>

          <Section title="계정은 두고 일부 데이터만 지우려면">
            <p>
              게시글·댓글·분양글은 각 화면의 ⋯ 메뉴에서 바로 삭제할 수 있습니다. 그 밖의
              데이터 삭제는{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              로 요청해 주세요.
            </p>
          </Section>
        </div>
      </div>
    </Layout>
  );
}
