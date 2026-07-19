import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";
import { ShieldCheck } from "lucide-react";

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
    <div className="mx-auto w-full max-w-4xl py-4 md:py-8">
      <section className="grid overflow-hidden rounded-lg bg-white shadow-[0_18px_50px_rgba(30,41,59,0.09)] md:grid-cols-[0.85fr_1.15fr]">
        <aside className="flex flex-col bg-navy p-6 text-white md:p-8">
          <Link to="/home" className="inline-flex items-center gap-2.5 self-start font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
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
            <ShieldCheck size={24} strokeWidth={1.8} className="text-white/70" aria-hidden="true" />
            <p className="mt-4 text-lg font-bold">
              {language === "id" ? "Kontribusi dosen" : "Lecturer contribution"}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/65">
              {language === "id"
                ? "Bantu menjaga pemetaan miskonsepsi tetap akurat dan berguna bagi mahasiswa."
                : "Help keep misconception mappings accurate and useful for students."}
            </p>
          </div>
        </aside>

        <div className="p-6 md:p-8">
        <header>
          <p className="text-sm font-semibold text-brand">
            {language === "id" ? "Akun Dosen" : "Lecturer Account"}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-navy-deep">
            {language === "id" ? "Daftar akun dosen" : "Create a lecturer account"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {language === "id"
              ? "Buat akun untuk meninjau jawaban dan memvalidasi pemetaan miskonsepsi."
              : "Create an account to review answers and validate misconception mappings."}
          </p>
        </header>

        <form className="mt-7 space-y-5" onSubmit={handleSignup}>
          <div>
            <label htmlFor="lecturer-name" className="mb-2 block text-sm font-semibold text-navy-deep">
              {language === "id" ? "Nama lengkap" : "Full name"}
            </label>
            <input id="lecturer-name" name="name" type="text" autoComplete="name" required placeholder={language === "id" ? "Masukkan nama lengkap" : "Enter your full name"} className="academic-input px-3.5 py-3 text-sm placeholder:text-muted/55" />
          </div>
          <div>
            <label htmlFor="signup-email" className="mb-2 block text-sm font-semibold text-navy-deep">Email</label>
            <input id="signup-email" name="email" type="email" autoComplete="email" required placeholder={language === "id" ? "nama@kampus.ac.id" : "name@university.edu"} className="academic-input px-3.5 py-3 text-sm placeholder:text-muted/55" />
          </div>
          <div>
            <label htmlFor="signup-password" className="mb-2 block text-sm font-semibold text-navy-deep">
              {language === "id" ? "Kata sandi" : "Password"}
            </label>
            <input id="signup-password" name="password" type="password" autoComplete="new-password" minLength={6} required placeholder={language === "id" ? "Minimal 6 karakter" : "At least 6 characters"} className="academic-input px-3.5 py-3 text-sm placeholder:text-muted/55" />
          </div>
          <div>
            <label htmlFor="signup-password-confirmation" className="mb-2 block text-sm font-semibold text-navy-deep">
              {language === "id" ? "Ulangi kata sandi" : "Confirm password"}
            </label>
            <input id="signup-password-confirmation" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={6} required aria-invalid={Boolean(error)} aria-describedby={error ? "signup-error" : undefined} placeholder={language === "id" ? "Masukkan kembali kata sandi" : "Re-enter your password"} className="academic-input px-3.5 py-3 text-sm placeholder:text-muted/55 aria-[invalid=true]:border-incorrect aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-incorrect/15" />
            {error ? <p id="signup-error" role="alert" className="mt-2 text-sm text-incorrect">{error}</p> : null}
          </div>

          <Button type="submit" variant="primary" className="w-full justify-center py-3">
            {language === "id" ? "Daftar" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 border-t border-border pt-5 text-sm text-muted">
          {language === "id" ? "Sudah memiliki akun?" : "Already have an account?"}{" "}
          <Link to="/dosen/login" className="font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            {language === "id" ? "Masuk" : "Sign in"}
          </Link>
        </p>
        </div>
      </section>
    </div>
  );
}
