import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type LecturerAuthContextValue = {
  isLecturer: boolean;
  login: () => void;
  logout: () => void;
};

const STORAGE_KEY = "progmiscon-lecturer-auth";
const LecturerAuthContext = createContext<LecturerAuthContextValue | undefined>(undefined);

export function LecturerAuthProvider({ children }: { children: ReactNode }) {
  const [isLecturer, setIsLecturer] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isLecturer));
  }, [isLecturer]);

  const value = useMemo<LecturerAuthContextValue>(
    () => ({
      isLecturer,
      login: () => setIsLecturer(true),
      logout: () => setIsLecturer(false),
    }),
    [isLecturer],
  );

  return <LecturerAuthContext.Provider value={value}>{children}</LecturerAuthContext.Provider>;
}

export function useLecturerAuth(): LecturerAuthContextValue {
  const context = useContext(LecturerAuthContext);
  if (!context) {
    throw new Error("useLecturerAuth must be used within LecturerAuthProvider");
  }
  return context;
}
