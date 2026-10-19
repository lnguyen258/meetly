"use client";

import { createContext, useContext } from "react";

type UserInfo = { userId: string; email: string | null };

const Ctx = createContext<UserInfo | null>(null);

export function UserProvider({ value, children }: { value: UserInfo; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUser(): UserInfo {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUser must be used inside <UserProvider>");
  return v;
}
