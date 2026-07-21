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
import { EmptyState } from "../components/common/EmptyState";
import { HomePage } from "../pages/HomePage";
import { MateriPage } from "../pages/MateriPage";
import { KonsepPage } from "../pages/KonsepPage";
import { MiskonsepsiPage } from "../pages/MiskonsepsiPage";
import { QuestionReviewPage } from "../pages/QuestionReviewPage";
import { LecturerLoginPage } from "../pages/LecturerLoginPage";
import { LecturerSignupPage } from "../pages/LecturerSignupPage";
import { LecturerReviewPage } from "../pages/LecturerReviewPage";
import { LecturerReviewHistoryPage } from "../pages/LecturerReviewHistoryPage";

function LecturerOnly({ children }: { children: ReactNode }) {
  const { isLecturer, loading } = useLecturerAuth();

  if (loading) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState loading message="Memeriksa sesi dosen..." />
      </div>
    );
  }

  return isLecturer ? children : <Navigate to="/dosen/login" replace />;
}

function LegacyQuestionRedirect() {
  const { questionId } = useParams<{ questionId: string }>();

  return (
    <Navigate to={questionId ? `/question/${questionId}` : "/materi"} replace />
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <LecturerAuthProvider>
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/materi" element={<MateriPage />} />
              <Route path="/konsep" element={<KonsepPage />} />
              <Route path="/konsep/:conceptId" element={<KonsepPage />} />
              <Route path="/miskonsepsi" element={<MiskonsepsiPage />} />
              <Route
                path="/miskonsepsi/:misconceptionId"
                element={<MiskonsepsiPage />}
              />
              <Route path="/dosen/login" element={<LecturerLoginPage />} />
              <Route path="/dosen/daftar" element={<LecturerSignupPage />} />
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
                path="/review/riwayat"
                element={
                  <LecturerOnly>
                    <LecturerReviewHistoryPage />
                  </LecturerOnly>
                }
              />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </LecturerAuthProvider>
    </LanguageProvider>
  );
}
