import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";

export function LecturerLoginPage() {
  const { language } = useLanguage();
  const { login } = useLecturerAuth();
  const navigate = useNavigate();

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
            {language === "id" ? "Masuk sebagai dosen" : "Sign in as a lecturer"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {language === "id"
              ? "Masuk untuk meninjau dan memvalidasi label miskonsepsi mahasiswa."
              : "Sign in to review and validate student misconception labels."}
          </p>

          <form className="mt-7 space-y-5" onSubmit={handleLogin}>
            <div>
              <label htmlFor="lecturer-email" className="mb-2 block text-sm font-medium text-navy-deep">
                Email
              </label>
              <input
                id="lecturer-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder={language === "id" ? "nama@kampus.ac.id" : "name@university.edu"}
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-navy-deep outline-none transition placeholder:text-muted/60 hover:border-navy/35 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
              />
            </div>
            <div>
              <label htmlFor="lecturer-password" className="mb-2 block text-sm font-medium text-navy-deep">
                {language === "id" ? "Kata sandi" : "Password"}
              </label>
              <input
                id="lecturer-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder={language === "id" ? "Masukkan kata sandi" : "Enter your password"}
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-navy-deep outline-none transition placeholder:text-muted/60 hover:border-navy/35 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
              />
            </div>

            <Button type="submit" variant="primary" className="w-full justify-center py-2.5">
              {language === "id" ? "Masuk" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 border-t border-border pt-5 text-center text-sm text-muted">
            {language === "id" ? "Belum memiliki akun?" : "Don't have an account?"}{" "}
            <Link
              to="/dosen/daftar"
              className="font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {language === "id" ? "Daftar" : "Create account"}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
