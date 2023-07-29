"use client";

import { useRouter } from "next/navigation";
import { LoginReqBody } from "pages/api/auth/login";
import React, { createContext, useContext, useEffect, useState } from "react";

interface AuthProviderProps {
  children: React.ReactNode;
}

interface AuthContextValues {
  user: any;
  setUser: any;
}

export const AuthContext = createContext({} as AuthContextValues);

// eslintreact-hooks/rules-of-hooks; React component names must start with an uppercase letter.
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState();

  const router = useRouter();

  const login = (body: LoginReqBody) => {};

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
