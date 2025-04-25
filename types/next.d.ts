import { IronSessionData } from "iron-session";
import { NextRequest } from "next/server";

declare module "next/server" {
  interface NextRequest {
    session: IronSessionData;
  }
} 