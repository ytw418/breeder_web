"use client";

import React from "react";
import PostList from "@components/features/post/PostList";
import { Button } from "@components/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const PostsPage = () => {
  const searchParams = useSearchParams();
  const category = searchParams?.get("category") || "";

  return (
    <div className="flex flex-col space-y-4">
     
      <PostList category={category} />
    </div>
  );
};

export default PostsPage;
