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
  );
};

export const useVariousData = () => {
  return useContext(VariousContext);
};
