import { useEffect, useMemo, useState } from "react";
import type {
  Language,
  Question,
  QuestionWordingAuthorityState,
  SaveQuestionWordingOverrideResult,
} from "../../types";
import {
  loadQuestionWordingAuthority,
  QuestionWordingRequestError,
  saveQuestionWordingOverride,
} from "../../services/adminOverrideRepository";
import { Button } from "../common/Button";

function safeErrorMessage(code: string, language: Language): string {
  const indonesian = language === "id";
  const messages: Record<string, [string, string]> = {
    SOURCE_CHANGED_RELOAD_REQUIRED: [
      "Sumber Google berubah. Draft tetap disimpan di layar; muat ulang sebelum mencoba lagi.",
      "The Google source changed. Your draft remains on screen; reload before trying again.",
    ],
    OVERRIDE_CHANGED_RELOAD_REQUIRED: [
      "Admin lain telah mengubah wording ini. Draft tetap disimpan di layar; muat ulang sebelum mencoba lagi.",
      "Another Admin changed this wording. Your draft remains on screen; reload before trying again.",
    ],
    UNAUTHORIZED: [
      "Sesi tidak lagi valid. Masuk kembali untuk melanjutkan.",
      "Your session is no longer valid. Sign in again to continue.",
    ],
    FORBIDDEN: [
      "Akses Admin aktif diperlukan untuk tindakan ini.",
      "Active Admin access is required for this action.",
    ],
    INVALID_QUESTION_WORDING: [
      "Wording Bahasa Indonesia dan Bahasa Inggris wajib diisi.",
      "Both Indonesian and English wording are required.",
    ],
    QUESTION_WORDING_UNCHANGED: [
      "Tidak ada perubahan wording untuk disimpan.",
      "There are no wording changes to save.",
    ],
    QUESTION_NOT_REVIEWED: [
      "Soal ini belum termasuk dalam cakupan sumber yang telah ditinjau.",
      "This question is outside the reviewed authority scope.",
    ],
    QUESTION_NOT_FOUND: [
      "Soal tidak ditemukan pada sumber Google saat ini.",
      "The question was not found in the current Google source.",
    ],
  };
  const message = messages[code] ?? [
    "Otoritas soal belum tersedia. Tidak ada perubahan yang disimpan.",
    "Question authority is unavailable. No changes were saved.",
  ];
  return message[indonesian ? 0 : 1];
}

function readOnlyMessage(
  reason: string | null,
  language: Language,
): string {
  const indonesian = language === "id";
  if (reason === "QUESTION_TYPE_NOT_SUPPORTED") {
    return indonesian
      ? "Soal Pilihan Ganda hanya-baca pada Phase 2A."
      : "Multiple Choice questions are read-only in Phase 2A.";
  }
  if (reason === "STRUCTURED_CONTENT_NOT_SUPPORTED") {
    return indonesian
      ? "Soal ini memiliki struktur konten yang belum aman untuk editor wording dan tetap hanya-baca."
      : "This question has structured content that is not supported by the wording editor.";
  }
  if (reason === "AUTHORITATIVE_LOCALE_REQUIRED") {
    return indonesian
      ? "Sumber otoritatif belum memiliki kedua locale dan tetap hanya-baca."
      : "The authoritative source does not contain both locales and remains read-only.";
  }
  if (reason === "QUESTION_INACTIVE") {
    return indonesian
      ? "Soal tidak aktif dan tetap hanya-baca."
      : "This question is inactive and remains read-only.";
  }
  return indonesian
    ? "Wording soal ini belum dapat diedit pada Phase 2A."
    : "This question wording cannot be edited in Phase 2A.";
}

export function AdminQuestionWordingEditor({
  question,
  language,
  onSaved,
}: {
  question: Question;
  language: Language;
  onSaved: (result: SaveQuestionWordingOverrideResult) => void;
}) {
  const [authority, setAuthority] = useState<
    QuestionWordingAuthorityState | undefined
  >();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [questionInd, setQuestionInd] = useState("");
  const [questionEn, setQuestionEn] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const isIndonesian = language === "id";
  const hasChanges = useMemo(
    () => Boolean(authority) && (
      questionInd !== authority?.questionInd || questionEn !== authority?.questionEn
    ),
    [authority, questionEn, questionInd],
  );

  useEffect(() => {
    let active = true;
    setAuthority(undefined);
    setLoading(true);
    setEditing(false);
    setError("");
    setSaved(false);
    void loadQuestionWordingAuthority(question.id)
      .then((result) => {
        if (!active) return;
        setAuthority(result);
        setQuestionInd(result.questionInd);
        setQuestionEn(result.questionEn);
      })
      .catch((caught) => {
        if (!active) return;
        setError(safeErrorMessage(
          caught instanceof QuestionWordingRequestError
            ? caught.code
            : "UNEXPECTED_ERROR",
          language,
        ));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [language, question.id]);

  if (loading) {
    return (
      <p className="mt-5 rounded-md border border-border bg-neutral/65 px-3 py-2.5 text-xs leading-5 text-muted">
        {isIndonesian
          ? "Memverifikasi otoritas soal..."
          : "Verifying question authority..."}
      </p>
    );
  }

  if (!authority) {
    return (
      <p role="alert" className="mt-5 rounded-md border border-incorrect-border bg-incorrect-bg px-3 py-2.5 text-xs leading-5 text-incorrect">
        {error || safeErrorMessage("AUTHORITY_UNAVAILABLE", language)}
      </p>
    );
  }

  if (!authority.editable) {
    return (
      <p className="mt-5 rounded-md border border-border bg-neutral/65 px-3 py-2.5 text-xs leading-5 text-muted">
        {readOnlyMessage(authority.readOnlyReason, language)}
      </p>
    );
  }

  const cancel = () => {
    setQuestionInd(authority.questionInd);
    setQuestionEn(authority.questionEn);
    setError("");
    setSaved(false);
    setEditing(false);
  };

  const save = async () => {
    if (!questionInd.trim() || !questionEn.trim()) {
      setError(safeErrorMessage("INVALID_QUESTION_WORDING", language));
      return;
    }
    if (!hasChanges) {
      setError(safeErrorMessage("QUESTION_WORDING_UNCHANGED", language));
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const result = await saveQuestionWordingOverride({
        questionId: question.id,
        expectedAuthoritySha256: authority.authoritySha256,
        expectedOverrideVersion: authority.overrideVersion,
        questionInd,
        questionEn,
      });
      setAuthority(result);
      setQuestionInd(result.questionInd);
      setQuestionEn(result.questionEn);
      setEditing(false);
      setSaved(true);
      onSaved(result);
    } catch (caught) {
      setError(safeErrorMessage(
        caught instanceof QuestionWordingRequestError
          ? caught.code
          : "UNEXPECTED_ERROR",
        language,
      ));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs leading-5 text-muted" aria-live="polite">
          {saved
            ? isIndonesian
              ? "Wording berhasil disimpan."
              : "Wording saved successfully."
            : isIndonesian
              ? "Wording kedua bahasa dapat diedit. Struktur soal tetap terkunci."
              : "Both wording locales can be edited. Question structure remains locked."}
        </p>
        <Button type="button" onClick={() => {
          setError("");
          setSaved(false);
          setEditing(true);
        }}>
          {isIndonesian ? "Edit wording" : "Edit wording"}
        </Button>
      </div>
    );
  }

  return (
    <section
      className="mt-5 border-t border-border pt-4"
      aria-label={isIndonesian ? "Editor wording soal" : "Question wording editor"}
    >
      <div className="grid gap-4 rounded-md bg-neutral/65 p-4">
        <label className="grid gap-1.5 text-xs font-semibold text-navy-deep">
          Bahasa Indonesia
          <textarea
            required
            value={questionInd}
            onChange={(event) => setQuestionInd(event.target.value)}
            disabled={saving}
            aria-invalid={!questionInd.trim()}
            className="academic-input min-h-32 resize-y px-3 py-2.5 text-sm font-normal leading-6"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-navy-deep">
          English
          <textarea
            required
            value={questionEn}
            onChange={(event) => setQuestionEn(event.target.value)}
            disabled={saving}
            aria-invalid={!questionEn.trim()}
            className="academic-input min-h-32 resize-y px-3 py-2.5 text-sm font-normal leading-6"
          />
        </label>
        {error && (
          <p role="alert" className="rounded-md border border-incorrect-border bg-incorrect-bg px-3 py-2 text-xs leading-5 text-incorrect">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={saving || !hasChanges || !questionInd.trim() || !questionEn.trim()}
            onClick={save}
          >
            {saving
              ? isIndonesian ? "Menyimpan..." : "Saving..."
              : isIndonesian ? "Simpan" : "Save"}
          </Button>
          <Button type="button" disabled={saving} onClick={cancel}>
            {isIndonesian ? "Batal" : "Cancel"}
          </Button>
        </div>
      </div>
    </section>
  );
}
