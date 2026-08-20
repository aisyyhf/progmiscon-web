import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CircleAlert, CircleCheck, LockKeyhole, Mail } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthPageLayout } from "../components/auth/AuthPageLayout";
import { Button } from "../components/common/Button";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";

export function LecturerLoginPage() {
  const { language } = useLanguage();
  const { isLecturer, loading, login } = useLecturerAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isLecturer) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLecturer, loading, navigate]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Gagal masuk ke akun dosen.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const emailConfirmed = searchParams.get("confirmed") === "1";

  return (
    <AuthPageLayout
      title={language === "id" ? "Masuk ke Progmiscon" : "Sign in to Progmiscon"}
      accountPrompt={
        language === "id" ? "Belum punya akun?" : "Don't have an account?"
      }
      accountLinkLabel={
        language === "id"
          ? "Daftar akun dosen"
          : "Create a lecturer account"
      }
      accountLinkTo="/dosen/daftar"
    >
      {emailConfirmed && (
        <p
          role="status"
          className="mb-5 flex items-start gap-2.5 rounded-lg border border-correct-border bg-correct-bg px-3.5 py-3 text-sm leading-5 text-correct"
        >
          <CircleCheck
            size={17}
            strokeWidth={2}
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />
          <span>
            {language === "id"
              ? "Email berhasil diverifikasi. Silakan masuk"
              : "Email verified successfully. Please sign in"}
          </span>
        </p>
      )}

      {error && (
        <p
          id="login-error"
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-lg border border-incorrect-border bg-incorrect-bg px-3.5 py-3 text-sm leading-5 text-incorrect"
        >
          <CircleAlert
            size={17}
            strokeWidth={2}
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />
          <span>{error}</span>
        </p>
      )}

      <form
        className="space-y-4"
        onSubmit={handleLogin}
        aria-busy={submitting}
      >
        <div>
          <label
            htmlFor="lecturer-email"
            className="mb-1.5 block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-navy-deep"
          >
            {language === "id" ? "Email dosen" : "Lecturer email"}
          </label>
          <div className="relative">
            <Mail
              size={16}
              strokeWidth={1.8}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/75"
            />
            <input
              id="lecturer-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={submitting}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "login-error" : undefined}
              placeholder={
                language === "id" ? "nama@telkomuniversity.ac.id" : "name@university.edu"
              }
              className="academic-input h-11 bg-white pl-10 pr-3.5 text-sm placeholder:text-muted/55 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-incorrect aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-incorrect/15"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="lecturer-password"
            className="mb-1.5 block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-navy-deep"
          >
            {language === "id" ? "Kata sandi" : "Password"}
          </label>
          <div className="relative">
            <LockKeyhole
              size={16}
              strokeWidth={1.8}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/75"
            />
            <input
              id="lecturer-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={submitting}
              placeholder={
                language === "id"
                  ? "Masukkan kata sandi"
                  : "Enter your password"
              }
              className="academic-input h-11 bg-white pl-10 pr-3.5 text-sm placeholder:text-muted/55 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
          className="h-11 w-full justify-center rounded-lg shadow-[0_8px_18px_rgba(143,28,32,0.18)] active:shadow-none"
        >
          {submitting
            ? language === "id"
              ? "Memproses..."
              : "Processing..."
            : language === "id"
              ? "Masuk"
              : "Sign in"}
          {!submitting && (
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          )}
        </Button>
      </form>
    </AuthPageLayout>
  );
}
