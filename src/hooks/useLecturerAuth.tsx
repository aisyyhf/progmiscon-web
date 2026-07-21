import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { LecturerProfile, LecturerSignUpResult } from "../types";
import {
  getCurrentUserAdminAccess,
  getLecturerProfile,
} from "../services/lecturerRepository";
import { supabase } from "../services/supabaseClient";
import {
  isTelkomLecturerEmail,
  normalizeLecturerEmail,
} from "../utils/lecturerEmail";

type LecturerAuthContextValue = {
  user: User | null;
  profile: LecturerProfile | null;
  isLecturer: boolean;
  isAdmin: boolean;
  adminAccessError: string;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<LecturerSignUpResult>;
  logout: () => Promise<void>;
};

const LecturerAuthContext = createContext<LecturerAuthContextValue | undefined>(
  undefined,
);

function authErrorMessage(error: unknown): string {
  let rawMessage = "";
  let code = "";

  if (error instanceof Error) {
    rawMessage = error.message;
  } else if (typeof error === "string") {
    rawMessage = error;
  } else if (typeof error === "object" && error !== null) {
    const authError = error as {
      message?: unknown;
      error_description?: unknown;
      code?: unknown;
    };

    if (typeof authError.message === "string") {
      rawMessage = authError.message;
    } else if (typeof authError.error_description === "string") {
      rawMessage = authError.error_description;
    }

    if (typeof authError.code === "string") {
      code = authError.code;
    }
  }

  const normalized = `${code} ${rawMessage}`.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email atau kata sandi salah.";
  }

  if (
    normalized.includes("email_not_confirmed") ||
    normalized.includes("email not confirmed")
  ) {
    return "Email belum diverifikasi. Periksa kotak masuk atau folder spam.";
  }

  if (
    normalized.includes("lecturer_email_domain_not_allowed")
  ) {
    return "Gunakan email dengan domain @telkomuniversity.ac.id.";
  }

  if (normalized.includes("lecturer_email_not_verified")) {
    return "Email belum diverifikasi. Periksa kotak masuk atau folder spam.";
  }

  if (normalized.includes("lecturer_email_not_allowed")) {
    return "Email belum terdaftar sebagai reviewer Progmiscon.";
  }

  if (
    normalized.includes("database error saving new user") ||
    rawMessage.trim() === "{}"
  ) {
    return "Akun belum dapat dibuat. Periksa email dan coba kembali.";
  }

  if (normalized.includes("email_address_not_authorized")) {
    return "Email verifikasi belum dapat dikirim ke alamat ini. Hubungi pengelola Progmiscon.";
  }

  if (
    normalized.includes("user already registered") ||
    normalized.includes("user_already_exists") ||
    normalized.includes("email_exists")
  ) {
    return "Email tersebut sudah terdaftar. Silakan masuk.";
  }

  if (
    normalized.includes("over_email_send_rate_limit") ||
    normalized.includes("rate limit")
  ) {
    return "Terlalu banyak permintaan email. Tunggu beberapa saat lalu coba kembali.";
  }

  if (normalized.includes("weak_password")) {
    return "Kata sandi belum memenuhi persyaratan keamanan.";
  }

  if (normalized.includes("failed to fetch")) {
    return "Tidak dapat terhubung ke layanan akun. Periksa koneksi internet.";
  }

  if (normalized.includes("unexpected_failure")) {
    return "Akun belum dapat dibuat. Pastikan email sudah terdaftar sebagai reviewer.";
  }

  return rawMessage.trim() || "Pendaftaran akun gagal. Silakan coba kembali.";
}

export function LecturerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<LecturerProfile | null>(null);
  const [adminAccess, setAdminAccess] = useState(false);
  const [adminAccessError, setAdminAccessError] = useState("");
  const [loading, setLoading] = useState(true);
  const syncRequestId = useRef(0);

  const syncSession = useCallback(
    async (session: Session | null): Promise<boolean> => {
      const requestId = ++syncRequestId.current;
      setLoading(true);

      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        if (requestId === syncRequestId.current) {
          setProfile(null);
          setAdminAccess(false);
          setAdminAccessError("");
          setLoading(false);
        }
        return false;
      }

      try {
        const nextProfile = await getLecturerProfile(nextUser.id);

        if (requestId !== syncRequestId.current) {
          return Boolean(nextProfile?.active);
        }

        let nextAdminAccess = false;
        let nextAdminAccessError = "";

        if (nextProfile?.active) {
          try {
            nextAdminAccess = await getCurrentUserAdminAccess();
          } catch (error) {
            console.error("[Progmiscon] Hak akses Admin gagal diperiksa", error);
            nextAdminAccessError =
              "Hak akses Admin belum dapat diperiksa. Pastikan migration Admin sudah dijalankan di Supabase.";
          }
        }

        if (requestId !== syncRequestId.current) {
          return Boolean(nextProfile?.active);
        }

        setProfile(nextProfile ?? null);
        setAdminAccess(nextAdminAccess);
        setAdminAccessError(nextAdminAccessError);
        return Boolean(nextProfile?.active);
      } catch (error) {
        console.error("[Progmiscon] Profil dosen gagal dimuat", error);

        if (requestId === syncRequestId.current) {
          setProfile(null);
          setAdminAccess(false);
          setAdminAccessError("");
        }
        return false;
      } finally {
        if (requestId === syncRequestId.current) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        console.error("[Progmiscon] Sesi Supabase gagal dimuat", error);
        await syncSession(null);
        return;
      }

      await syncSession(data.session);
    };

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      void syncSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [syncSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizeLecturerEmail(email),
        password,
      });

      if (error) {
        throw new Error(authErrorMessage(error));
      }

      const allowed = await syncSession(data.session);

      if (!allowed) {
        await supabase.auth.signOut();
        await syncSession(null);
        throw new Error(
          "Akun tidak aktif atau belum terdaftar sebagai reviewer Progmiscon.",
        );
      }
    },
    [syncSession],
  );

  const signup = useCallback(
    async (
      fullName: string,
      email: string,
      password: string,
    ): Promise<LecturerSignUpResult> => {
      if (!isTelkomLecturerEmail(email)) {
        throw new Error(
          "Gunakan email dengan domain @telkomuniversity.ac.id.",
        );
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizeLecturerEmail(email),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/dosen/login?confirmed=1`,
        },
      });

      if (error) {
        throw new Error(authErrorMessage(error));
      }

      if (data.session) {
        const allowed = await syncSession(data.session);

        if (!allowed) {
          await supabase.auth.signOut();
          await syncSession(null);
          throw new Error(
            "Akun tidak aktif atau belum terdaftar sebagai reviewer Progmiscon.",
          );
        }
      }

      return {
        needsEmailConfirmation: data.session === null,
      };
    },
    [syncSession],
  );

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(authErrorMessage(error));
    }

    await syncSession(null);
  }, [syncSession]);

  const value = useMemo<LecturerAuthContextValue>(
    () => ({
      user,
      profile,
      isLecturer: Boolean(user && profile?.active),
      isAdmin: Boolean(user && profile?.active && adminAccess),
      adminAccessError,
      loading,
      login,
      signup,
      logout,
    }),
    [adminAccess, adminAccessError, loading, login, logout, profile, signup, user],
  );

  return (
    <LecturerAuthContext.Provider value={value}>
      {children}
    </LecturerAuthContext.Provider>
  );
}

export function useLecturerAuth(): LecturerAuthContextValue {
  const context = useContext(LecturerAuthContext);

  if (!context) {
    throw new Error("useLecturerAuth must be used within LecturerAuthProvider");
  }

  return context;
}
