"use client";

import Link from "next/link";
import Layout from "@components/features/MainLayout";

export default function AdminAppointedGuidePage() {
  return (
    <Layout canGoBack title="운영 매뉴얼" seoTitle="당신은 관리자로 임명 받았습니다.">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            당신은 관리자로 임명 받았습니다.
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            핸드폰으로 아래 순서만 따라하면 됩니다.
          </p>

          <div className="mt-5 space-y-4">
            <section className="rounded-lg border border-gray-100 p-4">
              <p className="text-base font-semibold text-gray-900">1. 카카오 로그인하기</p>
              <p className="mt-1 text-sm text-gray-600">
                카카오 로그인 후 마이페이지로 이동하세요.
              </p>
              <Link
                href="/auth/login"
                className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-3 text-sm font-semibold text-white"
              >
                로그인 하러 가기
              </Link>
            </section>

            <section className="rounded-lg border border-gray-100 p-4">
              <p className="text-base font-semibold text-gray-900">
                2. 카카오 계정 이메일을 성준이에게 전달하기
              </p>
              <p className="mt-1 text-sm text-gray-600">
                마이페이지에서 이메일을 확인하고 성준이에게 카톡으로 보내주세요.
              </p>
            </section>

            <section className="rounded-lg border border-gray-100 p-4">
              <p className="text-base font-semibold text-gray-900">
                3. 관리자 권한 적용 후 다시 로그인
              </p>
              <p className="mt-1 text-sm text-gray-600">
                성준이가 관리자 계정으로 바꿔주면 다시 로그인하세요.
              </p>
              <p className="mt-1 text-sm text-gray-600">
                마이페이지에 <span className="font-semibold">관리자 페이지로 이동</span> 버튼이 보이면
                성공입니다.
              </p>
            </section>

            <section className="rounded-lg border border-gray-100 p-4">
              <p className="text-base font-semibold text-gray-900">4. 관리자 페이지에서 할 일</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                <li>1) 데이터 생성하기 (가장 중요)</li>
                <li>2) 공지 등록하기</li>
              </ul>
              <Link
                href="/admin"
                className="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-gray-300 px-3 text-sm font-semibold text-gray-700"
              >
                관리자 페이지 이동
              </Link>
            </section>

            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">문제 생기면</p>
              <p className="mt-1 text-sm text-amber-800">
                오류 화면 캡처해서 성준이에게 바로 보내주세요.
              </p>
            </section>
          </div>
        </article>
      </div>
    </Layout>
  );
}
