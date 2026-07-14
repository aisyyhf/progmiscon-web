import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";

export function LecturerSignupPage() {
  const { language } = useLanguage();
  const { login } = useLecturerAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const handleSignup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (formData.get("password") !== formData.get("passwordConfirmation")) {
      setError(language === "id" ? "Kata sandi belum sama." : "Passwords do not match.");
      return;
    }

    setError("");
    login();
    navigate("/review");
  };

  return (
    <div className="mx-auto w-full max-w-md py-4 sm:py-8">
      <section className="overflow-hidden rounded-lg border border-border bg-white shadow-[0_8px_28px_rgba(30,41,59,0.06)]">
        <div className="h-1 bg-brand" />
        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase text-brand">
            {language === "id" ? "Akun Dosen" : "Lecturer Account"}
          </p>
          <h1 className="mt-2 font-serif-brand text-3xl font-semibold text-navy-deep">
            {language === "id" ? "Daftar akun dosen" : "Create a lecturer account"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {language === "id"
              ? "Buat akun untuk meninjau dan memvalidasi label miskonsepsi mahasiswa."
              : "Create an account to review and validate student misconception labels."}
          </p>

          <form className="mt-7 space-y-5" onSubmit={handleSignup}>
            <div>
              <label htmlFor="lecturer-name" className="mb-2 block text-sm font-medium text-navy-deep">
                {language === "id" ? "Nama lengkap" : "Full name"}
              </label>
              <input
                id="lecturer-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                placeholder={language === "id" ? "Masukkan nama lengkap" : "Enter your full name"}
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-navy-deep outline-none transition placeholder:text-muted/60 hover:border-navy/35 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
              />
            </div>
            <div>
              <label htmlFor="signup-email" className="mb-2 block text-sm font-medium text-navy-deep">
                Email
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder={language === "id" ? "nama@kampus.ac.id" : "name@university.edu"}
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-navy-deep outline-none transition placeholder:text-muted/60 hover:border-navy/35 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
              />
            </div>
            <div>
              <label htmlFor="signup-password" className="mb-2 block text-sm font-medium text-navy-deep">
                {language === "id" ? "Kata sandi" : "Password"}
              </label>
              <input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                placeholder={language === "id" ? "Minimal 6 karakter" : "At least 6 characters"}
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-navy-deep outline-none transition placeholder:text-muted/60 hover:border-navy/35 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
              />
            </div>
            <div>
              <label htmlFor="signup-password-confirmation" className="mb-2 block text-sm font-medium text-navy-deep">
                {language === "id" ? "Ulangi kata sandi" : "Confirm password"}
              </label>
              <input
                id="signup-password-confirmation"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "signup-error" : undefined}
                placeholder={language === "id" ? "Masukkan kembali kata sandi" : "Re-enter your password"}
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-navy-deep outline-none transition placeholder:text-muted/60 hover:border-navy/35 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 aria-[invalid=true]:border-incorrect aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-incorrect/15"
              />
              {error ? (
                <p id="signup-error" role="alert" className="mt-2 text-sm text-incorrect">
                  {error}
                </p>
              ) : null}
            </div>

            <Button type="submit" variant="primary" className="w-full justify-center py-2.5">
              {language === "id" ? "Daftar" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 border-t border-border pt-5 text-center text-sm text-muted">
            {language === "id" ? "Sudah memiliki akun?" : "Already have an account?"}{" "}
            <Link
              to="/dosen/login"
              className="font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {language === "id" ? "Masuk" : "Sign in"}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
