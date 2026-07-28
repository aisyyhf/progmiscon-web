import type {
  AnswerReviewValues,
  QuestionReviewValues,
} from "../types/reviewPersistence";

export type MisconceptionReviewFormState = {
  removalChoice: boolean | null;
  removedMisconceptionIds: string[];
  removalReason: string;
  additionChoice: boolean | null;
  additionalMisconceptionIds: string[];
  additionReason: string;
  note: string;
};

export type MisconceptionReviewFormAction =
  | { type: "set_presence"; field: "removal" | "addition"; value: boolean }
  | {
      type: "set_ids";
      field: "removal" | "addition";
      ids: string[];
    }
  | {
      type: "set_reason";
      field: "removal" | "addition";
      value: string;
    }
  | { type: "set_note"; value: string };

export const initialMisconceptionReviewFormState: MisconceptionReviewFormState =
  {
    removalChoice: null,
    removedMisconceptionIds: [],
    removalReason: "",
    additionChoice: null,
    additionalMisconceptionIds: [],
    additionReason: "",
    note: "",
  };

export function getAdditionalMisconceptionCandidates<T extends { id: string }>(
  misconceptions: readonly T[],
  existingIds: readonly string[],
): T[] {
  const existing = new Set(existingIds.map((id) => id.trim()).filter(Boolean));
  return misconceptions.filter((item) => !existing.has(item.id.trim()));
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export function misconceptionReviewFormReducer(
  state: MisconceptionReviewFormState,
  action: MisconceptionReviewFormAction,
): MisconceptionReviewFormState {
  if (action.type === "set_presence") {
    if (action.field === "removal") {
      return {
        ...state,
        removalChoice: action.value,
        removedMisconceptionIds: action.value
          ? state.removedMisconceptionIds
          : [],
        removalReason: action.value ? state.removalReason : "",
      };
    }

    return {
      ...state,
      additionChoice: action.value,
      additionalMisconceptionIds: action.value
        ? state.additionalMisconceptionIds
        : [],
      additionReason: action.value ? state.additionReason : "",
    };
  }

  if (action.type === "set_ids") {
    return action.field === "removal"
      ? { ...state, removedMisconceptionIds: uniqueIds(action.ids) }
      : { ...state, additionalMisconceptionIds: uniqueIds(action.ids) };
  }

  if (action.type === "set_reason") {
    return action.field === "removal"
      ? { ...state, removalReason: action.value }
      : { ...state, additionReason: action.value };
  }

  return { ...state, note: action.value };
}

export function canSubmitMisconceptionReview(
  state: MisconceptionReviewFormState,
): boolean {
  return (
    state.removalChoice !== null &&
    state.additionChoice !== null &&
    (!state.removalChoice ||
      (state.removedMisconceptionIds.length > 0 &&
        state.removalReason.trim().length > 0)) &&
    (!state.additionChoice ||
      (state.additionalMisconceptionIds.length > 0 &&
        state.additionReason.trim().length > 0))
  );
}

function commonPayload(state: MisconceptionReviewFormState) {
  return {
    removedMisconceptionIds: state.removalChoice
      ? uniqueIds(state.removedMisconceptionIds)
      : [],
    removalReason: state.removalChoice
      ? state.removalReason.trim() || null
      : null,
    hasAdditionalMisconceptions: state.additionChoice === true,
    additionalMisconceptionIds: state.additionChoice
      ? uniqueIds(state.additionalMisconceptionIds)
      : [],
    additionReason: state.additionChoice
      ? state.additionReason.trim() || null
      : null,
    note: state.note.trim() || null,
  };
}

export function buildQuestionReviewValues(
  state: MisconceptionReviewFormState,
): QuestionReviewValues {
  return {
    hasIncorrectMisconceptions: state.removalChoice === true,
    ...commonPayload(state),
  };
}

export function buildAnswerReviewValues(
  state: MisconceptionReviewFormState,
): AnswerReviewValues {
  return {
    hasMismatchedMisconceptions: state.removalChoice === true,
    ...commonPayload(state),
  };
}
