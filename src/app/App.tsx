import type { ReactNode } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import { LanguageProvider } from "../hooks/useLanguage";
import {
  LecturerAuthProvider,
  useLecturerAuth,
} from "../hooks/useLecturerAuth";
import { AppShell } from "../components/layout/AppShell";
import { HomePage } from "../pages/HomePage";
import { MateriPage } from "../pages/MateriPage";
import { KonsepPage } from "../pages/KonsepPage";
import { MiskonsepsiPage } from "../pages/MiskonsepsiPage";
import { QuestionReviewPage } from "../pages/QuestionReviewPage";
import { LecturerLoginPage } from "../pages/LecturerLoginPage";
import { LecturerSignupPage } from "../pages/LecturerSignupPage";
import { LecturerReviewPage } from "../pages/LecturerReviewPage";

function LecturerOnly({ children }: { children: ReactNode }) {
  const { isLecturer, loading } = useLecturerAuth();

  if (loading) {
    return (
      <div
        role="status"
        className="mx-auto max-w-xl rounded-lg bg-white px-5 py-8 text-center text-sm text-muted shadow-[0_8px_28px_rgba(30,41,59,0.06)]"
      >
        Memeriksa sesi dosen...
      </div>
    );
  }

  return isLecturer
    ? children
    : <Navigate to="/dosen/login" replace />;
}

function LegacyQuestionRedirect() {
  const { questionId } = useParams<{ questionId: string }>();

  return (
    <Navigate
      to={questionId ? `/question/${questionId}` : "/materi"}
      replace
    />
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <LecturerAuthProvider>
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route
                path="/"
                element={<Navigate to="/home" replace />}
              />
              <Route path="/home" element={<HomePage />} />
              <Route path="/materi" element={<MateriPage />} />
              <Route path="/konsep" element={<KonsepPage />} />
              <Route
                path="/konsep/:conceptId"
                element={<KonsepPage />}
              />
              <Route
                path="/miskonsepsi"
                element={<MiskonsepsiPage />}
              />
              <Route
                path="/miskonsepsi/:misconceptionId"
                element={<MiskonsepsiPage />}
              />
              <Route
                path="/dosen/login"
                element={<LecturerLoginPage />}
              />
              <Route
                path="/dosen/daftar"
                element={<LecturerSignupPage />}
              />
              <Route
                path="/pustaka"
                element={<Navigate to="/konsep" replace />}
              />
              <Route
                path="/review/:questionId"
                element={<LegacyQuestionRedirect />}
              />
              <Route
                path="/question/:questionId"
                element={<QuestionReviewPage />}
              />
              <Route
                path="/review"
                element={
                  <LecturerOnly>
                    <LecturerReviewPage />
                  </LecturerOnly>
                }
              />
              <Route
                path="*"
                element={<Navigate to="/home" replace />}
              />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </LecturerAuthProvider>
    </LanguageProvider>
  );
}
