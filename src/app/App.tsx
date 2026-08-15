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
import { LecturerReviewPage } from "../pages/LecturerReviewWeekFirstPage";
import { LecturerReviewHistoryPage } from "../pages/LecturerReviewHistoryPage";
import { LecturerDashboardPage } from "../pages/LecturerDashboardPage";
import { AdminPage } from "../pages/AdminPage";

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

function AdminOnly({ children }: { children: ReactNode }) {
  const { isLecturer, isAdmin, loading, adminAccessError } = useLecturerAuth();

  if (loading) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState loading message="Memeriksa hak akses Admin..." />
      </div>
    );
  }

  if (!isLecturer) {
    return <Navigate to="/dosen/login" replace />;
  }

  if (adminAccessError) {
    return (
      <div className="mx-auto max-w-xl">
        <p
          role="alert"
          className="rounded-lg border border-incorrect-border bg-incorrect-bg px-5 py-4 text-sm leading-6 text-incorrect"
        >
          {adminAccessError}
        </p>
      </div>
    );
  }

  return isAdmin ? children : <Navigate to="/dashboard" replace />;
}

function LegacyQuestionRedirect() {
  const { questionId } = useParams<{ questionId: string }>();

  return (
    <Navigate to={questionId ? `/question/${questionId}` : "/materi"} replace />
  );
}

function LecturerAnswerReviewRoute() {
  const { answerId } = useParams<{ answerId: string }>();
  return <LecturerReviewPage initialAnswerId={answerId} />;
}

export default function App() {
  return (
    <LanguageProvider>
      <LecturerAuthProvider>
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/home" element={<Navigate to="/" replace />} />
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
                path="/dashboard"
                element={
                  <LecturerOnly>
                    <LecturerDashboardPage />
                  </LecturerOnly>
                }
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
                path="/review/answer/:answerId"
                element={
                  <LecturerOnly>
                    <LecturerAnswerReviewRoute />
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
              <Route
                path="/admin"
                element={
                  <AdminOnly>
                    <AdminPage />
                  </AdminOnly>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </LecturerAuthProvider>
    </LanguageProvider>
  );
}
