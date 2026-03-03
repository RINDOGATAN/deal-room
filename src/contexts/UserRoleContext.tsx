"use client";

import { createContext, useContext } from "react";
import { useSession } from "next-auth/react";

type Persona = "business" | "lawyer" | null;

interface UserRoleContextValue {
  persona: Persona;
  isLoading: boolean;
}

const UserRoleContext = createContext<UserRoleContextValue>({
  persona: null,
  isLoading: true,
});

export function UserRoleProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  const role = session?.user?.role;
  const persona: Persona =
    role === "LAWYER" ? "lawyer" : role === "BUSINESS_OWNER" ? "business" : null;

  return (
    <UserRoleContext.Provider value={{ persona, isLoading: status === "loading" }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  return useContext(UserRoleContext);
}
