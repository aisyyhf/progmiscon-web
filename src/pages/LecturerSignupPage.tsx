import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthPageLayout } from "../components/auth/AuthPageLayout";
import { Button } from "../components/common/Button";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";

export function LecturerSignupPage() {
  const { language } = useLanguage();
  const { isLecturer, loading, signup } = useLecturerAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);

  useEffect(() => {
    if (!loading && isLecturer) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLecturer, loading, navigate]);

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const fullName = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const passwordConfirmation = String(
      formData.get("passwordConfirmation") ?? "",
    );

    if (password !== passwordConfirmation) {
      setError(
        language === "id"
          ? "Kata sandi belum sama."
          : "Passwords do not match.",
      );
      return;
    }

    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const result = await signup(fullName, email, password);

      if (result.needsEmailConfirmation) {
        form.reset();
        setSuccess(
          language === "id"
            ? "Pendaftaran berhasil. Buka email verifikasi, lalu masuk"
            : "Registration succeeded. Open the verification email, then sign in",
        );
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (signupError) {
      setError(
        signupError instanceof Error
          ? signupError.message
          : "Pendaftaran akun gagal.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageLayout
      title={
        language === "id" ? "Daftar akun dosen" : "Create a lecturer account"
      }
      accountPrompt={
        language === "id" ? "Sudah punya akun?" : "Already have an account?"
      }
      accountLinkLabel={language === "id" ? "Masuk" : "Sign in"}
      accountLinkTo="/dosen/login"
    >
      {success && (
        <p
          role="status"
          className="mb-4 flex items-start gap-2.5 rounded-lg border border-correct-border bg-correct-bg px-3.5 py-3 text-sm leading-5 text-correct"
        >
          <CircleCheck
            size={17}
            strokeWidth={2}
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />
          <span>{success}</span>
        </p>
      )}

      {error && (
        <p
          id="signup-error"
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-lg border border-incorrect-border bg-incorrect-bg px-3.5 py-3 text-sm leading-5 text-incorrect"
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
        className="space-y-3"
        onSubmit={handleSignup}
        aria-busy={submitting}
      >
        <div>
          <label
            htmlFor="lecturer-name"
            className="mb-1 block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-navy-deep"
          >
            {language === "id" ? "Nama lengkap" : "Full name"}
          </label>
          <div className="relative">
            <UserRound
              size={16}
              strokeWidth={1.8}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/75"
            />
            <input
              id="lecturer-name"
              name="name"
              type="text"
              autoComplete="name"
              minLength={2}
              required
              disabled={submitting}
              placeholder={
                language === "id" ? "Masukkan nama lengkap" : "Enter your full name"
              }
              className="academic-input h-10 bg-white pl-10 pr-3.5 text-sm placeholder:text-muted/55 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="signup-email"
            className="mb-1 block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-navy-deep"
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
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={submitting}
              placeholder={
                language === "id"
                  ? "nama@telkomuniversity.ac.id"
                  : "name@telkomuniversity.ac.id"
              }
              aria-describedby="signup-email-hint"
              className="academic-input h-10 bg-white pl-10 pr-3.5 text-sm placeholder:text-muted/55 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <p id="signup-email-hint" className="mt-1 text-xs leading-5 text-muted">
            {language === "id"
              ? "Gunakan email dengan domain @telkomuniversity.ac.id"
              : "Use an email ending in @telkomuniversity.ac.id"}
          </p>
        </div>

        <div>
          <label
            htmlFor="signup-password"
            className="mb-1 block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-navy-deep"
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
              id="signup-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={6}
              required
              disabled={submitting}
              placeholder={
                language === "id" ? "Minimal 6 karakter" : "At least 6 characters"
              }
              className="academic-input h-10 bg-white pl-10 pr-11 text-sm placeholder:text-muted/55 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={
                language === "id"
                  ? showPassword
                    ? "Sembunyikan kata sandi"
                    : "Tampilkan kata sandi"
                  : showPassword
                    ? "Hide password"
                    : "Show password"
              }
              aria-controls="signup-password"
              aria-pressed={showPassword}
              disabled={submitting}
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted/65 transition-colors hover:text-navy-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              {showPassword ? (
                <EyeOff size={16} strokeWidth={1.8} aria-hidden="true" />
              ) : (
                <Eye size={16} strokeWidth={1.8} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="signup-password-confirmation"
            className="mb-1 block text-[0.7rem] font-bold uppercase tracking-[0.08em] text-navy-deep"
          >
            {language === "id" ? "Ulangi kata sandi" : "Confirm password"}
          </label>
          <div className="relative">
            <LockKeyhole
              size={16}
              strokeWidth={1.8}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/75"
            />
            <input
              id="signup-password-confirmation"
              name="passwordConfirmation"
              type={showPasswordConfirmation ? "text" : "password"}
              autoComplete="new-password"
              minLength={6}
              required
              disabled={submitting}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "signup-error" : undefined}
              placeholder={
                language === "id"
                  ? "Masukkan kembali kata sandi"
                  : "Re-enter your password"
              }
              className="academic-input h-10 bg-white pl-10 pr-11 text-sm placeholder:text-muted/55 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-incorrect aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-incorrect/15"
            />
            <button
              type="button"
              onClick={() =>
                setShowPasswordConfirmation((visible) => !visible)
              }
              aria-label={
                language === "id"
                  ? showPasswordConfirmation
                    ? "Sembunyikan konfirmasi kata sandi"
                    : "Tampilkan konfirmasi kata sandi"
                  : showPasswordConfirmation
                    ? "Hide password confirmation"
                    : "Show password confirmation"
              }
              aria-controls="signup-password-confirmation"
              aria-pressed={showPasswordConfirmation}
              disabled={submitting}
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted/65 transition-colors hover:text-navy-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              {showPasswordConfirmation ? (
                <EyeOff size={16} strokeWidth={1.8} aria-hidden="true" />
              ) : (
                <Eye size={16} strokeWidth={1.8} aria-hidden="true" />
              )}
            </button>
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
              ? "Daftar"
              : "Create account"}
          {!submitting && (
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          )}
        </Button>
      </form>
    </AuthPageLayout>
  );
}
