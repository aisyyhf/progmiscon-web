import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { Button } from "../components/common/Button";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";
import { ShieldCheck } from "lucide-react";

export function LecturerLoginPage() {
  const { language } = useLanguage();
  const { isLecturer, loading, login } = useLecturerAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isLecturer) {
      navigate("/review", { replace: true });
    }
  }, [isLecturer, loading, navigate]);

  const handleLogin = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      navigate("/review", { replace: true });
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
    <div className="mx-auto w-full max-w-4xl py-4 md:py-10">
      <section className="grid overflow-hidden rounded-xl border border-border bg-white md:grid-cols-[0.85fr_1.15fr]">
        <aside className="flex flex-col bg-navy p-6 text-white md:p-8">
          <Link
            to="/home"
            className="inline-flex items-center gap-2.5 self-start font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
              <img
                src="/progmiscon-logo.png"
                alt=""
                className="h-full w-full scale-[1.4] object-cover contrast-200"
              />
            </span>
            Progmiscon
          </Link>

          <div className="mt-10 md:mt-auto md:pt-24">
            <ShieldCheck
              size={24}
              strokeWidth={1.8}
              className="text-white/70"
              aria-hidden="true"
            />
            <p className="mt-4 text-lg font-bold">
              {language === "id"
                ? "Ruang review akademik"
                : "Academic review workspace"}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/65">
              {language === "id"
                ? "Tinjau jawaban mahasiswa dan validasi pemetaan miskonsepsi secara terarah."
                : "Review student answers and validate misconception mappings in one focused workspace."}
            </p>
          </div>
        </aside>

        <div className="p-6 md:p-8">
          <header>
            <p className="text-sm font-semibold text-brand">
              {language === "id"
                ? "Akun Dosen"
                : "Lecturer Account"}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-navy-deep">
              {language === "id"
                ? "Masuk sebagai dosen"
                : "Sign in as a lecturer"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              {language === "id"
                ? "Gunakan akun yang telah terdaftar sebagai reviewer."
                : "Use an account registered as a reviewer."}
            </p>
          </header>

          {emailConfirmed && (
            <p
              role="status"
              className="mt-5 rounded-md border border-correct-border bg-correct-bg px-4 py-3 text-sm text-correct"
            >
              {language === "id"
                ? "Email berhasil diverifikasi. Silakan masuk."
                : "Email verified successfully. Please sign in."}
            </p>
          )}

          {error && (
            <p
              id="login-error"
              role="alert"
              className="mt-5 rounded-md border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm text-incorrect"
            >
              {error}
            </p>
          )}

          <form
            className="mt-7 space-y-5"
            onSubmit={handleLogin}
            aria-busy={submitting}
          >
            <div>
              <label
                htmlFor="lecturer-email"
                className="mb-2 block text-sm font-semibold text-navy-deep"
              >
                Email
              </label>
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
                  language === "id"
                    ? "nama@kampus.ac.id"
                    : "name@university.edu"
                }
                className="academic-input px-3.5 py-3 text-sm placeholder:text-muted/55"
              />
            </div>

            <div>
              <label
                htmlFor="lecturer-password"
                className="mb-2 block text-sm font-semibold text-navy-deep"
              >
                {language === "id" ? "Kata sandi" : "Password"}
              </label>
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
                className="academic-input px-3.5 py-3 text-sm placeholder:text-muted/55"
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
                  ? "Masuk"
                  : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 border-t border-border pt-5 text-sm text-muted">
            {language === "id"
              ? "Belum memiliki akun?"
              : "Don't have an account?"}{" "}
            <Link
              to="/dosen/daftar"
              className="font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {language === "id" ? "Daftar" : "Create account"}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
