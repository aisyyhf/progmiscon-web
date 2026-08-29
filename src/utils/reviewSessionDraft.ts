import type { MisconceptionReviewFormState } from "./reviewMisconceptionForm";

type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type ReviewSessionDraftIdentity = {
  reviewerId: string;
  targetType: "question" | "answer";
  targetId: string;
  sourceVersion: string;
};

type StoredReviewSessionDraft = {
  version: 1;
  identity: ReviewSessionDraftIdentity;
  form: MisconceptionReviewFormState;
};

const REVIEW_SESSION_DRAFT_PREFIX = "progmiscon:review-session-draft";

function draftKey(identity: ReviewSessionDraftIdentity): string {
  const scope = [
    identity.reviewerId,
    identity.targetType,
    identity.targetId,
    identity.sourceVersion,
  ]
    .map(encodeURIComponent)
    .join(":");
  return `${REVIEW_SESSION_DRAFT_PREFIX}:${scope}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isReviewFormState(value: unknown): value is MisconceptionReviewFormState {
  if (typeof value !== "object" || value === null) return false;
  const form = value as Record<string, unknown>;
  const validChoice = (choice: unknown) =>
    choice === null || typeof choice === "boolean";

  return (
    validChoice(form.removalChoice) &&
    isStringArray(form.removedMisconceptionIds) &&
    typeof form.removalReason === "string" &&
    validChoice(form.additionChoice) &&
    isStringArray(form.additionalMisconceptionIds) &&
    typeof form.additionReason === "string" &&
    typeof form.note === "string"
  );
}

function sameIdentity(
  left: ReviewSessionDraftIdentity,
  right: ReviewSessionDraftIdentity,
): boolean {
  return (
    left.reviewerId === right.reviewerId &&
    left.targetType === right.targetType &&
    left.targetId === right.targetId &&
    left.sourceVersion === right.sourceVersion
  );
}

export function saveReviewSessionDraft(
  storage: SessionStorageLike,
  identity: ReviewSessionDraftIdentity,
  form: MisconceptionReviewFormState,
) {
  const draft: StoredReviewSessionDraft = {
    version: 1,
    identity,
    form: {
      ...form,
      removedMisconceptionIds: [...form.removedMisconceptionIds],
      additionalMisconceptionIds: [...form.additionalMisconceptionIds],
    },
  };
  storage.setItem(draftKey(identity), JSON.stringify(draft));
}

export function loadReviewSessionDraft(
  storage: SessionStorageLike,
  identity: ReviewSessionDraftIdentity,
): MisconceptionReviewFormState | undefined {
  const key = draftKey(identity);

  try {
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    const draft = JSON.parse(raw) as Partial<StoredReviewSessionDraft>;

    if (
      draft.version !== 1 ||
      !draft.identity ||
      !sameIdentity(draft.identity, identity) ||
      !isReviewFormState(draft.form)
    ) {
      storage.removeItem(key);
      return undefined;
    }

    return {
      ...draft.form,
      removedMisconceptionIds: [...draft.form.removedMisconceptionIds],
      additionalMisconceptionIds: [...draft.form.additionalMisconceptionIds],
    };
  } catch {
    storage.removeItem(key);
    return undefined;
  }
}

export function clearReviewSessionDraft(
  storage: SessionStorageLike,
  identity: ReviewSessionDraftIdentity,
) {
  storage.removeItem(draftKey(identity));
}
