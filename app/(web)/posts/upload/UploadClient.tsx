"use client";

import { PostComposer } from "../_components/PostComposer";

/** 글쓰기(앱 posts/upload). 폼은 수정 화면과 공용인 PostComposer 가 그린다. 로그인은 page 의 AuthGuard 가 확인한다. */
const UploadClient = () => <PostComposer mode="create" />;

export default UploadClient;
