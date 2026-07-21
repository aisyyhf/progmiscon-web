import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";

export function LecturerSignupPage() {
  const { language } = useLanguage();
  const {
    isLecturer,
    loading,
    signup,
  } = useLecturerAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isLecturer) {
      navigate("/review", { replace: true });
    }
  }, [isLecturer, loading, navigate]);

  const handleSignup = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
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
            ? "Pendaftaran berhasil. Buka email verifikasi, lalu masuk."
            : "Registration succeeded. Open the verification email, then sign in.",
        );
      } else {
        navigate("/review", { replace: true });
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
    <div className="mx-auto w-full max-w-4xl py-4 md:py-10">
      <section className="grid overflow-hidden rounded-xl border border-border bg-white md:grid-cols-[0.8fr_1.2fr]">
        <aside className="flex min-h-56 flex-col justify-center border-b border-border bg-brand-soft p-6 md:min-h-full md:border-b-0 md:border-r md:p-8">
          <div>
            <p className="text-sm font-semibold text-brand">
              {language === "id" ? "Portal dosen" : "Lecturer portal"}
            </p>
            <h2 className="mt-3 text-2xl font-bold leading-tight text-navy-deep">
              {language === "id"
                ? "Kontribusi dosen"
                : "Lecturer contribution"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              {language === "id"
                ? "Akun hanya dapat dibuat oleh email yang telah dimasukkan ke daftar reviewer."
                : "Accounts can only be created by emails added to the reviewer allowlist."}
            </p>
          </div>
        </aside>

        <div className="p-6 md:p-8">
          <header>
            <h1 className="text-2xl font-bold text-navy-deep">
              {language === "id"
                ? "Daftar akun dosen"
                : "Create a lecturer account"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              {language === "id"
                ? "Gunakan email yang telah disetujui sebagai reviewer Progmiscon."
                : "Use an email approved as a Progmiscon reviewer."}
            </p>
          </header>

          {success && (
            <p
              role="status"
              className="mt-5 rounded-md border border-correct-border bg-correct-bg px-4 py-3 text-sm leading-6 text-correct"
            >
              {success}
            </p>
          )}

          {error && (
            <p
              id="signup-error"
              role="alert"
              className="mt-5 rounded-md border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm text-incorrect"
            >
              {error}
            </p>
          )}

          <form
            className="mt-7 space-y-5"
            onSubmit={handleSignup}
            aria-busy={submitting}
          >
            <div>
              <label
                htmlFor="lecturer-name"
                className="mb-2 block text-sm font-semibold text-navy-deep"
              >
                {language === "id"
                  ? "Nama lengkap"
                  : "Full name"}
              </label>
              <input
                id="lecturer-name"
                name="name"
                type="text"
                autoComplete="name"
                minLength={2}
                required
                disabled={submitting}
                placeholder={
                  language === "id"
                    ? "Masukkan nama lengkap"
                    : "Enter your full name"
                }
                className="academic-input px-3.5 py-3 text-sm placeholder:text-muted/55"
              />
            </div>

            <div>
              <label
                htmlFor="signup-email"
                className="mb-2 block text-sm font-semibold text-navy-deep"
              >
                Email
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={submitting}
                placeholder={
                  language === "id"
                    ? "nama@kampus.ac.id"
                    : "name@university.edu"
                }
                className="academic-input px-3.5 py-3 text-sm placeholder:text-muted/55"
              />
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="mb-2 block text-sm font-semibold text-navy-deep"
              >
                {language === "id" ? "Kata sandi" : "Password"}
              </label>
              <input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                disabled={submitting}
                placeholder={
                  language === "id"
                    ? "Minimal 6 karakter"
                    : "At least 6 characters"
                }
                className="academic-input px-3.5 py-3 text-sm placeholder:text-muted/55"
              />
            </div>

            <div>
              <label
                htmlFor="signup-password-confirmation"
                className="mb-2 block text-sm font-semibold text-navy-deep"
              >
                {language === "id"
                  ? "Ulangi kata sandi"
                  : "Confirm password"}
              </label>
              <input
                id="signup-password-confirmation"
                name="passwordConfirmation"
                type="password"
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
                className="academic-input px-3.5 py-3 text-sm placeholder:text-muted/55 aria-[invalid=true]:border-incorrect aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-incorrect/15"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className="w-full justify-center py-3"
            >
              {submitting
                ? language === "id"
                  ? "Memproses..."
                  : "Processing..."
                : language === "id"
                  ? "Daftar"
                  : "Create account"}
            </Button>
          </form>

          <p className="mt-6 border-t border-border pt-5 text-sm text-muted">
            {language === "id"
              ? "Sudah memiliki akun?"
              : "Already have an account?"}{" "}
            <Link
              to="/dosen/login"
              className="font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {language === "id" ? "Masuk" : "Sign in"}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
