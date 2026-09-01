import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AdminReviewConsensusItem,
  Question,
  StudentAnswer,
} from "../../types";
import {
  getAdminReviewConsensus,
  previewConsensus,
  publishAnswerMisconceptionOverride,
  publishQuestionMisconceptionOverride,
  resetAnswerMisconceptionOverride,
  resetQuestionMisconceptionOverride,
  syncMasterRelationBaselines,
} from "../../services/adminOverrideRepository";
import { normalizeEffectiveIds } from "../../utils/effectiveMasterData";
import { filterAdminReviewConsensusItems } from "../../utils/reviewWorkspace";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";

// This button still calls the legacy, non-versioned baseline sync
// (public.sync_master_relation_baselines): it deletes and rebuilds every
// baseline row without assigning a source_version, which desynchronises every
// active review from its baseline. Baseline sync must go through the controlled
// version-aware workflow (impact preflight -> sync_master_relation_baselines_v2)
// instead. Until that workflow replaces this action, guard against accidental
// clicks with an explicit confirmation.
const LEGACY_BASELINE_SYNC_WARNING =
  "Tombol ini memakai sinkronisasi baseline versi lama (tanpa source_version). " +
  "Menjalankannya dapat membuat SEMUA review aktif menjadi usang, bukan hanya soal yang berubah. " +
  "Gunakan alur sinkronisasi baseline terkontrol (preflight dampak -> sinkronisasi versi-aware). " +
  "Lanjutkan hanya jika Anda benar-benar memahami risikonya.";

function IdList({ ids, empty = "Tidak ada" }: { ids: string[]; empty?: string }) {
  return ids.length ? (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <code
          key={id}
          className="rounded bg-neutral px-2 py-1 text-xs font-semibold text-navy-deep"
        >
          {id}
        </code>
      ))}
    </div>
  ) : (
    <p className="text-sm text-muted">{empty}</p>
  );
}

function VoteList({
  votes,
}: {
  votes: Record<string, number>;
}) {
  const entries = Object.entries(votes).sort(([left], [right]) =>
    left.localeCompare(right, undefined, { numeric: true }),
  );
  return entries.length ? (
    <ul className="space-y-1 text-sm text-navy-deep">
      {entries.map(([id, count]) => (
        <li key={id} className="flex items-center justify-between gap-3">
          <code>{id}</code>
          <span className="tabular-nums text-muted">{count}/3 suara</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted">Tidak ada usulan.</p>
  );
}

function ConsensusCard({
  item,
  summary,
  questionType,
  question,
  busy,
  error,
  onPublish,
  onReset,
}: {
  item: AdminReviewConsensusItem;
  summary: string;
  questionType: string;
  question?: Question;
  busy: boolean;
  error: string;
  onPublish: () => void;
  onReset: () => void;
}) {
  const baselineAvailable = item.baselineMisconceptionIds !== null;
  const preview = previewConsensus(item.baselineMisconceptionIds ?? [], item);
  const answerDerivedMisconceptionIds = normalizeEffectiveIds(
    question?.answerDerivedMisconceptionIds ?? [],
  );
  const effectiveQuestionPreview = normalizeEffectiveIds([
    ...preview,
    ...answerDerivedMisconceptionIds,
  ]);
  const questionTarget = item.targetType === "question";
  const hasAnswerDerivedRemovalVotes =
    questionTarget &&
    Object.entries(item.removedVotes).some(
      ([id, votes]) =>
        votes > 0 && answerDerivedMisconceptionIds.includes(id.trim()),
    );
  const published = item.publishedMisconceptionIds !== null;
  const ready = item.reviewCount === 3;
  const status = !baselineAvailable
    ? "Baseline belum disinkronkan"
    : published
    ? "Sudah dipublikasikan"
    : ready
      ? "Siap dipublikasikan"
      : "Menunggu reviewer";

  return (
    <article className="rounded-lg border border-border bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-bold text-navy-deep">{item.targetId}</code>
            <span className="rounded bg-neutral px-2 py-1 text-xs font-semibold text-muted">
              {questionType}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
            {summary || "Isi target tidak tersedia."}
          </p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-sm font-bold tabular-nums text-navy-deep">
            {item.reviewCount}/3 reviewer
          </p>
          <p className="mt-1 text-xs font-semibold text-brand">{status}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 border-t border-border pt-5 md:grid-cols-2">
        {questionTarget ? (
          <>
            <section>
              <h4 className="text-xs font-bold text-navy-deep">
                Baseline relasi langsung soal
              </h4>
              <div className="mt-2">
                {baselineAvailable ? (
                  <IdList ids={item.baselineMisconceptionIds ?? []} />
                ) : (
                  <p className="text-sm text-incorrect">
                    Sinkronkan baseline Google Sheets sebelum publikasi.
                  </p>
                )}
              </div>
            </section>
            <section>
              <h4 className="text-xs font-bold text-navy-deep">
                Preview final relasi langsung soal
              </h4>
              <div className="mt-2"><IdList ids={preview} /></div>
            </section>
            <section>
              <h4 className="text-xs font-bold text-navy-deep">
                Miskonsepsi turunan dari jawaban
              </h4>
              <div className="mt-2">
                <IdList ids={answerDerivedMisconceptionIds} />
              </div>
            </section>
            <section>
              <h4 className="text-xs font-bold text-navy-deep">
                Preview efektif soal setelah union
              </h4>
              <div className="mt-2"><IdList ids={effectiveQuestionPreview} /></div>
            </section>
          </>
        ) : (
          <>
            <section>
              <h4 className="text-xs font-bold text-navy-deep">Relasi baseline</h4>
              <div className="mt-2">
                {baselineAvailable ? (
                  <IdList ids={item.baselineMisconceptionIds ?? []} />
                ) : (
                  <p className="text-sm text-incorrect">
                    Sinkronkan baseline Google Sheets sebelum publikasi.
                  </p>
                )}
              </div>
            </section>
            <section>
              <h4 className="text-xs font-bold text-navy-deep">Preview snapshot final</h4>
              <div className="mt-2"><IdList ids={preview} /></div>
            </section>
          </>
        )}
        <section>
          <h4 className="text-xs font-bold text-navy-deep">Usulan hapus</h4>
          <div className="mt-2"><VoteList votes={item.removedVotes} /></div>
        </section>
        <section>
          <h4 className="text-xs font-bold text-navy-deep">Usulan tambah</h4>
          <div className="mt-2"><VoteList votes={item.additionalVotes} /></div>
        </section>
      </div>

      {published && (
        <section className="mt-5 border-t border-border pt-4">
          <h4 className="text-xs font-bold text-navy-deep">
            {questionTarget ? "Snapshot langsung soal aktif" : "Snapshot aktif"}
          </h4>
          <div className="mt-2">
            <IdList ids={item.publishedMisconceptionIds ?? []} />
          </div>
        </section>
      )}

      {questionTarget && (
        <p className="mt-4 text-xs leading-5 text-muted">
          Publikasi kartu soal hanya menyimpan snapshot relasi langsung soal.
          Relasi turunan tetap berasal dari snapshot jawaban yang telah
          dipublikasikan.
        </p>
      )}
      {hasAnswerDerivedRemovalVotes && (
        <p className="mt-3 rounded-md bg-neutral px-3 py-2 text-xs leading-5 text-muted">
          Usulan hapus yang masih berasal dari jawaban tidak akan hilang dari
          kemungkinan miskonsepsi soal sampai relasi jawaban terkait juga
          dihapus.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-incorrect-border bg-incorrect-bg px-3 py-2 text-sm text-incorrect"
        >
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          disabled={!ready || !baselineAvailable || busy}
          onClick={onPublish}
        >
          {busy ? "Memproses..." : "Publikasikan perubahan"}
        </Button>
        {published && (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onReset}
          >
            Kembalikan ke data asli
          </Button>
        )}
      </div>
    </article>
  );
}

export function AdminFinalizationPanel({
  questions,
  answers,
  masterLoading,
}: {
  questions: Question[];
  answers: StudentAnswer[];
  masterLoading: boolean;
}) {
  const [items, setItems] = useState<AdminReviewConsensusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncError, setSyncError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setItems(await getAdminReviewConsensus());
    } catch (caught) {
      setLoadError(
        caught instanceof Error
          ? caught.message
          : "Consensus review gagal dimuat.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const questionMap = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );
  const answerMap = useMemo(
    () => new Map(answers.map((answer) => [answer.id, answer])),
    [answers],
  );
  const eligibleItems = useMemo(
    () => filterAdminReviewConsensusItems(items, questionMap),
    [items, questionMap],
  );
  const latestSync = useMemo(
    () =>
      items.reduce<string | null>(
        (latest, item) =>
          item.baselineSyncedAt && (!latest || item.baselineSyncedAt > latest)
            ? item.baselineSyncedAt
            : latest,
        null,
      ),
    [items],
  );

  const run = async (
    item: AdminReviewConsensusItem,
    action: () => Promise<void>,
    confirmation: string,
  ) => {
    if (!window.confirm(confirmation)) return;
    setBusyId(`${item.targetType}:${item.targetId}`);
    setActionErrors((current) => ({ ...current, [item.targetId]: "" }));
    try {
      await action();
      await load();
    } catch (caught) {
      setActionErrors((current) => ({
        ...current,
        [item.targetId]:
          caught instanceof Error ? caught.message : "Tindakan gagal.",
      }));
    } finally {
      setBusyId("");
    }
  };

  const syncBaseline = async () => {
    if (!window.confirm(LEGACY_BASELINE_SYNC_WARNING)) return;
    setSyncing(true);
    setSyncStatus("");
    setSyncError("");
    try {
      const result = await syncMasterRelationBaselines();
      setSyncStatus(
        `Tersinkron ${result.questionCount} soal, ${result.answerCount} jawaban, dan ${result.misconceptionCount} misconception pada ${new Date(result.syncedAt).toLocaleString("id-ID")}.`,
      );
      await load();
    } catch (caught) {
      setSyncError(
        caught instanceof Error
          ? caught.message
          : "Sinkronisasi baseline gagal.",
      );
    } finally {
      setSyncing(false);
    }
  };

  if (loading || masterLoading) {
    return <EmptyState loading message="Memuat consensus finalisasi..." />;
  }

  if (loadError) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm text-incorrect"
      >
        {loadError}
      </p>
    );
  }

  const renderItems = (targetType: "question" | "answer") =>
    eligibleItems
      .filter((item) => item.targetType === targetType)
      .map((item) => {
        const question = questionMap.get(item.questionId);
        const answer = answerMap.get(item.targetId);
        const key = `${item.targetType}:${item.targetId}`;
        const questionType =
          question?.type === "multiple_choice" ? "MP" : "PS";
        const summary =
          targetType === "question"
            ? question?.prompt.id ?? ""
            : answer?.answerText ?? "";

        return (
          <ConsensusCard
            key={key}
            item={item}
            summary={summary}
            questionType={questionType}
            question={targetType === "question" ? question : undefined}
            busy={busyId === key}
            error={actionErrors[item.targetId] ?? ""}
            onPublish={() =>
              void run(
                item,
                () =>
                  targetType === "question"
                    ? publishQuestionMisconceptionOverride(item.targetId)
                    : publishAnswerMisconceptionOverride(item.targetId),
                `Publikasikan snapshot relasi ${item.targetId}?`,
              )
            }
            onReset={() =>
              void run(
                item,
                () =>
                  targetType === "question"
                    ? resetQuestionMisconceptionOverride(item.targetId)
                    : resetAnswerMisconceptionOverride(item.targetId),
                `Kembalikan relasi ${item.targetId} ke data Google Sheets?`,
              )
            }
          />
        );
      });

  const questionCards = renderItems("question");
  const answerCards = renderItems("answer");

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-navy-deep">
              Baseline relasi
            </h2>
            <p className="mt-1 text-sm text-muted">
              {syncStatus ||
                (latestSync
                  ? `Sinkronisasi terakhir: ${new Date(latestSync).toLocaleString("id-ID")}`
                  : "Baseline server belum terdeteksi pada target review.")}
            </p>
            {syncError && (
              <p role="alert" className="mt-2 text-sm font-medium text-incorrect">
                {syncError}
              </p>
            )}
            <p className="mt-2 text-xs font-medium text-incorrect">
              Sinkronisasi versi lama. Dapat membuat semua review aktif usang.
              Pakai alur sinkronisasi baseline terkontrol (preflight dampak lalu
              sinkronisasi versi-aware).
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={syncing}
            onClick={() => void syncBaseline()}
          >
            {syncing ? "Menyinkronkan..." : "Sinkronkan baseline Google Sheets"}
          </Button>
        </div>
      </section>

      {eligibleItems.length === 0 ? (
        <EmptyState message="Belum ada target review untuk difinalisasi." />
      ) : (
        <>
      <section>
        <h2 className="text-lg font-bold text-navy-deep">Soal</h2>
        <div className="mt-4 space-y-4">
          {questionCards.length ? questionCards : (
            <EmptyState message="Belum ada review soal." />
          )}
        </div>
      </section>
      <section>
        <h2 className="text-lg font-bold text-navy-deep">Jawaban</h2>
        <div className="mt-4 space-y-4">
          {answerCards.length ? answerCards : (
            <EmptyState message="Belum ada review jawaban." />
          )}
        </div>
      </section>
        </>
      )}
    </div>
  );
}
