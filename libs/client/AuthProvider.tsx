"use client";
import dayjs from "dayjs";
import { getAnalytics } from "firebase/analytics";
// Firebase auth
import { initializeApp } from "firebase/app";
import {
  deleteUser,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  unlink,
} from "firebase/auth";

import { useRouter } from "next/navigation";
import React, { createContext, useContext, useEffect, useState } from "react";

import useApiMutation from "./useApiMutation";
import useMutation from "./useMutation";

const firebaseConfig = JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG!);

interface AuthProviderProps {
  children: React.ReactNode;
}

interface SnsLoginResponse {
  success: boolean;
  error?: string;
  user: SignupAppV2MutationVariables;
}

export interface RestfulResult {
  success: boolean;
  userId?: number; // 애플로그인 후 앰플리튜드 userId 변경
  error?: string;
  isAdult?: boolean;
}

interface AuthContextValues {
  kakaoLogin: () => Promise<SnsLoginResponse>;
  kakaoLogout: () => void;
  kakaoUnlink: () => Promise<any>;
  googleLogin: () => Promise<any>;
  googleLogout: () => Promise<any>;
  googleUnlink: () => Promise<any>;
  googleDeleteUser: () => Promise<any>;
  _login: (
    user: {
      snsId: string;
      email: string;
      name: string;
      thumbnail: string;
    },
    platform: keyof typeof Provider,
    lng: string
  ) => void;
  user: any;
  setUser: any;
}

interface KakaoTokenPayload {
  [key: string]: any;
  // access_token: string;
  // expires_in?: number;
  // refresh_token: string;
  // refresh_token_expires_in?: number;
  // scope?: string;
  // token_type?: string;
  // error?: string;
}

interface KakaoUserPayload {
  [key: string]: any;
}

export const AuthContext = createContext({} as AuthContextValues);

// eslintreact-hooks/rules-of-hooks; React component names must start with an uppercase letter.
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState({
    snsId: undefined,
    email: undefined,
    name: undefined,
    thumbnail: undefined,
  });

  const router = useRouter();

  const [loginSession, { loading: sLoading, data: sData, error: sError }] =
    useApiMutation<RestfulResult>("/api/auth/login");

  const [loginApp, { data: lData, loading: lLoading, error: lError }] =
    useMutation<LoginAppMutation>(LOGIN_APP_MUTATION);

  const [signupAppV2, { loading: signupLoading, error: signError }] =
    useMutation<SignupAppV2Mutation>(SIGNUP_APP_V2_MUTATION);

  /**
   * @see https://developers.kakao.com/docs/latest/ko/kakaologin/js
   * JavaScript SDK의 보안 강화를 위해 리프레시 토큰을 취급하지 않도록 수정되었습니다.
   */

  const kakaoLogin = async (): Promise<SnsLoginResponse> => {
    return new Promise((resolve, reject) => {
      if (!window.Kakao) {
        return reject({
          success: false,
          error: "window.Kakao undefined",
        });
      }
      // 사용자 정보 가져오기
      window.Kakao.API.request({
        url: "/v2/user/me",
        success: (response: any) => {
          console.log("kakao.API.request.response >>>> ", response);
          const {
            id,
            kakao_account: {
              email,
              profile: { is_default_image, nickname, thumbnail_image_url },
            },
          } = response;
          if (!id) {
            return reject({
              success: false,
              error: "id undefined",
            });
          }
          setUser({
            snsId: `kakao:${id}`,
            email: email || "",
            name: nickname,
            thumbnail: is_default_image
              ? DEFAULT_THUMBNAIL_CDN
              : thumbnail_image_url,
          } as any);
          resolve({
            success: true,
            user: {
              snsId: `kakao:${id}`,
              email: email || "",
              name: nickname,
              thumbnail: is_default_image
                ? DEFAULT_THUMBNAIL_CDN
                : thumbnail_image_url,
            },
          });
        },
        fail: (err: any) => {
          console.log("Auth Kakao login failed err.message >>>> ", err?.msg);
          reject({
            success: false,
            error: err?.msg,
          });
        },
      });
    });
  };

  const googleLogin = () => {
    const app = initializeApp(firebaseConfig);
    return new Promise((resolve, reject) => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
      });
      signInWithPopup(getAuth(), provider)
        .then((result) => {
          // This gives you a Google Access Token. You can use it to access the Google API.
          const credential = GoogleAuthProvider.credentialFromResult(result);
          let token = null;
          if (credential) {
            token = credential.accessToken;
          }
          // The signed-in user info.
          const {
            uid,
            email,
            displayName: name,
            photoURL: thumbnail,
          } = result.user;
          setUser({
            snsId: `google:${uid}`,
            email,
            name,
            thumbnail: thumbnail,
          } as any);

          resolve({
            snsId: `google:${uid}`,
            email,
            name,
            thumbnail: thumbnail,
          });
        })
        .catch((error) => {
          const errorCode = error.code;
          const errorMessage = error.message;
          const email = error.email;
          const credential = GoogleAuthProvider.credentialFromError(error);
          // ...
          reject(error);
        });
    });
  };

  const _login = async (
    snsUser: {
      snsId: string;
      email: string;
      name: string;
      thumbnail: string;
    },
    platform: keyof typeof Provider,
    lng: string
  ) => {
    loginApp({
      variables: { snsId: snsUser?.snsId },
      onCompleted: (result) => {
        if (!result?.loginApp) {
          return;
        }
        const {
          loginApp: { success, error, token, user: loggedInUser, authCode },
        } = result;
        if (success && loggedInUser) {
          if (loggedInUser.role === Role.USER && loggedInUser.publisher) {
            router.push(`/${lng}/auth/login?review=publisher`);
            return;
          } else if (loggedInUser.role === Role.USER && loggedInUser.plinist) {
            router.push(`/${lng}/auth/login?review=plinist`);
            return;
          } else {
            loginSession(
              JSON.stringify({
                token,
                user: {
                  id: loggedInUser.id,
                  name: loggedInUser.name,
                  email: loggedInUser.email,
                  isAdult: loggedInUser.isAdult,
                  role: loggedInUser.role,
                  thumbnail: loggedInUser?.thumbnail ?? DEFAULT_THUMBNAIL_CDN,
                  provider: Provider[platform],
                  plingBalance: loggedInUser?.plingBalance,
                },
              }),
              "",
              "",
              () => {
                router.refresh();
                if (loggedInUser.role === Role.USER) {
                  return router.push(`/${lng}/auth/sign-up/creator`);
                }
                if (loggedInUser.role === Role.PLINIST)
                  return router.push(`/${lng}/creator/`);
              }
            );
          }
        } else {
          if (error && authCode === "11") {
            // error: "존재하지 않는 유저입니다."
            signupAppV2({
              variables: {
                pling: 4,
                ...snsUser,
              },
              onCompleted: (result) => {
                if (!result?.signupAppV2) {
                  //회원가입 실패 케이스
                  return;
                }
                const {
                  signupAppV2: { success, error, token, user: signedUser },
                } = result;
                if (success && signedUser) {
                  loginSession(
                    JSON.stringify({
                      token,
                      user: {
                        id: signedUser?.id,
                        name: signedUser?.name,
                        email: signedUser?.email,
                        isAdult: signedUser?.isAdult,
                        role: signedUser?.role,
                        thumbnail:
                          signedUser?.thumbnail ?? DEFAULT_THUMBNAIL_CDN,
                        provider: Provider[platform],
                        plingBalance: signedUser?.plingBalance,
                      },
                    }),
                    "",
                    "",
                    () => {
                      router.push(`/${lng}/auth/sign-up/creator`);
                      return;
                    }
                  );
                } else {
                  if (
                    error &&
                    (error?.includes(Provider.GOOGLE.toUpperCase()) ||
                      error?.includes(Provider.KAKAO.toUpperCase()) ||
                      error?.includes(Provider.APPLE.toUpperCase()))
                  ) {
                    router.push(
                      `/${lng}/auth/login/existing-user/?sns=${error
                        .split(" ")[0]
                        .toUpperCase()}`
                    );
                    return;
                  } else {
                    console.log(error);
                    alert(error);
                  }
                }
              },
            });
          } else {
            // 미가입 유저도 X , 로그인 실패 케이스
            alert(error);
            console.log(error);
          }
        }
      },
    });
  };

  const kakaoLogout = () => {
    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY);
    }
    if (window.Kakao.isInitialized()) {
      window.Kakao.Auth.logout();
    }
  };

  const kakaoUnlink = () => {
    return new Promise((resolve, reject) => {
      if (!window.Kakao.isInitialized()) {
        window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY);
      }
      if (window.Kakao.Auth.getAccessToken()) {
        window.Kakao.API.request({
          url: "/v1/user/unlink",
          success: (response: any) => {
            resolve(response);
          },
          fail: (error: any) => {
            reject(error);
          },
        });
      }
    });
  };

  const googleLogout = () => {
    return new Promise((resolve, reject) => {
      signOut(getAuth())
        .then(() => {
          // Sign-out successful.
          resolve(true);
        })
        .catch((error) => {
          // An error happened.
          reject(error);
        });
    });
  };

  const googleUnlink = () => {
    return new Promise((resolve, reject) => {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      auth.onAuthStateChanged(function (user) {
        if (!user) {
          return reject("no signed in user");
        }

        console.log(user);
        unlink(auth.currentUser!, provider.providerId)
          .then(() => {
            // Auth provider unlinked from account
            console.log("resolved");
            resolve(true);
          })
          .catch((error) => {
            // An error happened
            console.log("googleUnlink.error", error);
            reject(error);
          });
      });
    });
  };

  const googleDeleteUser = () => {
    return new Promise((resolve, reject) => {
      // getAuth().
      const user = getAuth().currentUser;
      deleteUser(user!)
        .then((result) => {
          // User deleted. (uid 가 삭제됨, 다음로그인 uid 변경.)
          console.log("googleDeleteUser.result", result);
          resolve(true);
        })
        .catch((error) => {
          // An error ocurred
          console.log("googleDeleteUser.error", error);
          reject(error);
        });
    });
  };

  useEffect(() => {
    // _app.tsx Script.onLoad 처리
    // if (!window.Kakao.isInitialized()) {
    //   window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY);
    // }

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    getAnalytics(app);
    /*
    // 리스너 필요시 사용
    const unsubscribe = getAuth().onAuthStateChanged((user: any) => {
      console.log("onAuthStateChanged.user", user);
      if (user) {
        setUser(user);
      } else {
        setUser(null);
      }
    });
    // Cleanup subscription on unmount
    return () => unsubscribe();
    */
  }, []);

  return (
    <AuthContext.Provider
      value={{
        kakaoLogin,
        kakaoLogout,
        kakaoUnlink,
        googleLogin,
        googleLogout,
        googleUnlink,
        googleDeleteUser,
        user,
        setUser,
        _login,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
