"use client";
import { useRouter } from "next/navigation";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react";
import { SWRConfig } from "swr";
import { capturePosthogError, capturePosthogEvent } from "@libs/client/posthog";

export interface VariousContextValues {
  hasInput: boolean;
  setHasInput: Dispatch<SetStateAction<boolean>>;
  openModal: boolean;
  setOpenModal: Dispatch<SetStateAction<boolean>>;
  openLinkModal: boolean;
  setOpenLinkModal: Dispatch<SetStateAction<boolean>>;
  modalContent: null | JSX.Element;
  setModalContent: Dispatch<SetStateAction<null | JSX.Element>>;
  modalLink: string;
  setModalLink: Dispatch<SetStateAction<string>>;
  confirmCloseModal: boolean;
  setConfirmCloseModal: Dispatch<SetStateAction<boolean>>;
  backgroundCloseModal: boolean;
  setBackgroundCloseModal: Dispatch<SetStateAction<boolean>>;
  closeModal: () => void;
}
export const VariousContext = createContext({} as VariousContextValues);

export const VariousProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [hasInput, setHasInput] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [openLinkModal, setOpenLinkModal] = useState(false);
  const [confirmCloseModal, setConfirmCloseModal] = useState(false);
  const [modalLink, setModalLink] = useState("");
  const [modalContent, setModalContent] = useState<null | JSX.Element>(null);
  const [backgroundCloseModal, setBackgroundCloseModal] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setHasInput(false);
    setOpenLinkModal(false);
    setModalLink("");
    setConfirmCloseModal(false);
    setOpenModal(false);
  }, [router]);

  const closeModal = () => {
    setOpenModal(false);
    setModalContent(<></>);
  };

  return (
    <SWRConfig
      value={{
        fetcher: (url: string) =>
          fetch(url).then(async (res) => {
            if (!res.ok) {
              let message = "요청 처리 중 오류가 발생했습니다.";
              const raw = await res.text().catch(() => "");
              if (raw) {
                try {
                  // API가 JSON 에러 포맷을 주는 경우 우선 사용
                  const data = JSON.parse(raw);
                  message = data?.error || data?.message || raw;
                } catch {
                  // JSON 파싱 실패 시 plain text 메시지를 fallback으로 사용
                  message = raw;
                }
              }

              const swrError = new Error(message) as Error & { status?: number };
              swrError.status = res.status;
              capturePosthogError({
                source: "swr_fetcher",
                error: swrError,
                context: { url, status: res.status },
              });
              throw swrError;
            }
            return res.json();
          }),
        onErrorRetry: (error, _key, _config, revalidate, context) => {
          const status = (error as Error & { status?: number }).status;
          capturePosthogEvent("swr_error_retry_check", {
            status: status ?? null,
            retryCount: context.retryCount,
          });
          // 인증/권한/없음(401/403/404)은 재시도해도 개선되지 않으므로 중단
          if (status === 401 || status === 403 || status === 404) return;
          // 나머지 네트워크성 에러만 짧게 2회 재시도
          if (context.retryCount >= 2) return;
          setTimeout(() => revalidate({ retryCount: context.retryCount + 1 }), 1500);
        },
      }}
    >
      <VariousContext.Provider
        value={{
          setHasInput,
          hasInput,
          openModal,
          setOpenModal,
          modalContent,
          setModalContent,
          openLinkModal,
          setOpenLinkModal,
          modalLink,
          setModalLink,
          confirmCloseModal,
          setConfirmCloseModal,
          backgroundCloseModal,
          setBackgroundCloseModal,
          closeModal,
        }}
      >
        {children}
      </VariousContext.Provider>
    </SWRConfig>
  );
};

export const useVariousData = () => {
  return useContext(VariousContext);
};
