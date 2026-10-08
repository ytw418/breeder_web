"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Layout from "@components/features/MainLayout";

// 앱 src/app/content/admin-appointed.tsx 와 같은 구성(카드 5개 + 하단 주황 CTA).

const CARD_CLASS = "rounded-xl border border-app-border bg-app-elevated p-4";

function GuideSection({
  title,
  children,
  cta,
}: {
  title: string;
  children: ReactNode;
  cta?: ReactNode;
}) {
  return (
    <section className={CARD_CLASS}>
      <h2 className="text-[17px] font-bold text-app-text">{title}</h2>
      <div className="mt-1.5 text-[16px] leading-6 text-app-text">
        {children}
      </div>
      {cta ? <div className="mt-3">{cta}</div> : null}
    </section>
  );
}

export default function AdminAppointedGuidePage() {
  return (
    <Layout
      canGoBack
      title="운영 매뉴얼"
      seoTitle="당신은 관리자로 임명 받았습니다."
    >
      <div className="mx-auto min-h-full max-w-2xl bg-app-bg px-4 pb-10 pt-4">
        <h1 className="text-[22px] font-bold text-app-text">
          당신은 관리자로 임명 받았습니다
        </h1>
        <p className="mt-2.5 text-[16px] leading-6 text-app-muted">
          핸드폰으로 아래 순서만 따라하면 됩니다.
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          <GuideSection title="1. 카카오 로그인하기">
            <p>카카오 로그인 후 마이페이지로 이동하세요.</p>
          </GuideSection>

          <GuideSection title="2. 카카오 계정 이메일을 성준이에게 전달하기">
            <p>
              마이페이지에서 이메일을 확인하고 성준이에게 카톡으로 보내주세요.
            </p>
          </GuideSection>

          <GuideSection title="3. 관리자 권한 적용 후 다시 로그인">
            <p>성준이가 관리자 계정으로 바꿔주면 다시 로그인하세요.</p>
            <p>
              마이페이지에{" "}
              <span className="font-semibold">관리자 페이지로 이동</span> 버튼이
              보이면 성공입니다.
            </p>
          </GuideSection>

          <GuideSection
            title="4. 관리자 페이지에서 할 일"
            cta={
              <Link
                href="/admin"
                className="flex h-[52px] items-center justify-center rounded-md bg-app-surface text-[16px] font-semibold text-app-text"
              >
                관리자 페이지 이동
              </Link>
            }
          >
            <ul className="flex flex-col gap-0.5">
              <li>1) 데이터 생성하기 (가장 중요)</li>
              <li>2) 공지 등록하기</li>
            </ul>
          </GuideSection>

          <GuideSection title="문제 생기면">
            <p className="text-app-muted">
              오류 화면 캡처해서 성준이에게 바로 보내주세요.
            </p>
          </GuideSection>
        </div>

        <Link
          href="/auth/login"
          className="mt-6 flex h-[52px] items-center justify-center rounded-md bg-app-brand text-[16px] font-semibold text-white"
        >
          로그인 하러 가기
        </Link>
      </div>
    </Layout>
  );
}
