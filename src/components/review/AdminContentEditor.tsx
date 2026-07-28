import { useEffect, useState } from "react";
import type { Question, StudentAnswer } from "../../types";
import {
  resetAnswerContentOverride,
  resetQuestionContentOverride,
  saveAnswerContentOverride,
  saveQuestionContentOverride,
} from "../../services/adminOverrideRepository";
import { Button } from "../common/Button";

function EditorNotice({
  error,
  success,
}: {
  error: string;
  success: string;
}) {
  if (!error && !success) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`mt-3 rounded-md px-3 py-2 text-xs leading-5 ${
        error
          ? "border border-incorrect-border bg-incorrect-bg text-incorrect"
          : "bg-correct-bg text-correct"
      }`}
    >
      {error || success}
    </p>
  );
}

export function AdminQuestionContentEditor({
  question,
}: {
  question: Question;
}) {
  const [open, setOpen] = useState(false);
  const [questionInd, setQuestionInd] = useState(
    question.questionInd ?? question.prompt.id,
  );
  const [questionEn, setQuestionEn] = useState(
    question.questionEn ?? question.prompt.en,
  );
  const [questionCode, setQuestionCode] = useState(question.questionCode ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setQuestionInd(question.questionInd ?? question.prompt.id);
    setQuestionEn(question.questionEn ?? question.prompt.en);
    setQuestionCode(question.questionCode ?? "");
  }, [
    question.prompt.en,
    question.prompt.id,
    question.questionCode,
    question.questionEn,
    question.questionInd,
  ]);

  const hasContent = [questionInd, questionEn, questionCode].some((value) =>
    value.trim(),
  );

  const save = async () => {
    if (!hasContent) {
      setError("Minimal satu konten soal harus diisi.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await saveQuestionContentOverride(
        question.id,
        questionInd,
        questionEn,
        questionCode,
      );
      setSuccess("Override soal disimpan.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Override soal gagal disimpan.",
      );
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm("Kembalikan soal ke data asli?")) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await resetQuestionContentOverride(question.id);
      setSuccess("Soal dikembalikan ke data Google Sheets.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Override soal gagal dihapus.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-4 border-t border-border pt-4">
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        Edit soal
      </Button>
      {open && (
        <div className="mt-3 grid gap-3 rounded-md bg-neutral p-4">
          <label className="grid gap-1.5 text-xs font-semibold text-navy-deep">
            Bahasa Indonesia
            <textarea
              value={questionInd}
              onChange={(event) => setQuestionInd(event.target.value)}
              className="academic-input min-h-24 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-navy-deep">
            Bahasa Inggris
            <textarea
              value={questionEn}
              onChange={(event) => setQuestionEn(event.target.value)}
              className="academic-input min-h-24 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-navy-deep">
            Kode soal
            <textarea
              value={questionCode}
              onChange={(event) => setQuestionCode(event.target.value)}
              className="academic-input min-h-24 px-3 py-2.5 font-mono text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={saving || !hasContent}
              onClick={save}
            >
              {saving ? "Menyimpan..." : "Simpan override"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={reset}
            >
              Kembalikan ke data asli
            </Button>
          </div>
          {!hasContent && (
            <p role="alert" className="text-xs font-medium text-incorrect">
              Minimal satu konten soal harus diisi.
            </p>
          )}
          <EditorNotice error={error} success={success} />
        </div>
      )}
    </section>
  );
}

export function AdminAnswerContentEditor({
  answer,
}: {
  answer: StudentAnswer;
}) {
  const [open, setOpen] = useState(false);
  const [answerText, setAnswerText] = useState(answer.answerText ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => setAnswerText(answer.answerText ?? ""), [answer.answerText]);

  const save = async () => {
    if (!answerText.trim()) {
      setError("Teks jawaban wajib diisi.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await saveAnswerContentOverride(answer.id, answerText);
      setSuccess("Override jawaban disimpan.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Override jawaban gagal disimpan.",
      );
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm("Kembalikan jawaban ke data asli?")) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await resetAnswerContentOverride(answer.id);
      setSuccess("Jawaban dikembalikan ke data Google Sheets.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Override jawaban gagal dihapus.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-4 border-t border-border pt-4">
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        Edit jawaban
      </Button>
      {open && (
        <div className="mt-3 grid gap-3 rounded-md bg-neutral p-4">
          <label className="grid gap-1.5 text-xs font-semibold text-navy-deep">
            Teks jawaban
            <textarea
              value={answerText}
              onChange={(event) => setAnswerText(event.target.value)}
              className="academic-input min-h-28 px-3 py-2.5 font-mono text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={saving || !answerText.trim()}
              onClick={save}
            >
              {saving ? "Menyimpan..." : "Simpan override"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={reset}
            >
              Kembalikan ke data asli
            </Button>
          </div>
          <EditorNotice error={error} success={success} />
        </div>
      )}
    </section>
  );
}
