import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";

export function LecturerLoginPage() {
  const { language } = useLanguage();
  const { login, isLecturer } = useLecturerAuth();
  const navigate = useNavigate();

  const handleLogin = () => {
    login();
    navigate("/review");
  };

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-border bg-white p-8">
      <p className="text-[11px] font-medium uppercase tracking-wide text-brand">
        {language === "id" ? "Akses dosen" : "Lecturer access"}
      </p>
      <h1 className="mt-2 font-serif-brand text-3xl font-semibold text-navy-deep">
        {language === "id" ? "Masuk Dosen" : "Lecturer Login"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        {language === "id"
          ? "Login mock ini membuka halaman Review untuk validasi label miskonsepsi. Pengguna publik tetap dapat menelusuri materi, konsep, dan miskonsepsi tanpa login."
          : "This mock login opens the Review page for misconception-label validation. Public users can still explore material, concepts, and misconceptions without signing in."}
      </p>
      <div className="mt-6">
        <Button variant="primary" onClick={handleLogin}>
          {isLecturer ? (language === "id" ? "Buka Review" : "Open Review") : language === "id" ? "Masuk sebagai Dosen" : "Enter as Lecturer"}
        </Button>
      </div>
    </div>
  );
}
