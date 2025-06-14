"use client";
import Image from "@components/atoms/Image";
import Link from "next/link";
import { getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import { Colors } from "styles/colors";
import { useRef } from "react";

interface ItemProps {
  title: string;
  id: number;
  price: number | null;
  comments?: number;
  hearts: number;
  image: string;
  createdAt: Date;
}

export default function Item({
  title,
  price,
  comments,
  hearts,
  id,
  image,
  createdAt,
}: ItemProps) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  return (
    <div
      className="flex px-4 cursor-pointer justify-between"
      onClick={() => linkRef.current?.click()}
    >
      <div className="flex space-x-4 flex-1">
        <Link href={`/products/${id}-${title}`}>
          <Image
            src={makeImageUrl(image, "product")}
            className="w-20 h-20 bg-gray-400 rounded-md"
            alt="productList"
            width={80}
            height={80}
          />
        </Link>
        <div className="pt-2 flex flex-col flex-1">
          <Link
            ref={linkRef}
            href={`/products/${id}-${title}`}
            className="text-sm font-medium text-gray-900"
          >
            {title}
          </Link>
          <span className="font-medium mt-1 text-gray-900">
            {price ? `${price.toLocaleString()}원` : "가격 미정"}
          </span>
          <span className="body-1 mt-1 text-Gray-500">
            {getTimeAgoString(new Date(createdAt))}
          </span>
        </div>
      </div>
      <div className="flex space-x-2 items-end justify-end">
        <div className="flex space-x-0.5 items-center text-sm  text-gray-600">
          <svg
            className="w-4 h-4"
            fill={Colors.RED}
            stroke={Colors.RED}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            ></path>
          </svg>
          <span>{hearts}</span>
        </div>
        <div className="flex space-x-0.5 items-center text-sm  text-gray-600">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            ></path>
          </svg>
          <span>{comments ?? "0"}</span>
        </div>
      </div>
    </div>
  );
}
