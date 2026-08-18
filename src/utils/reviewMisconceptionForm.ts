import type {
  AnswerReviewHistoryItem,
  AnswerReviewValues,
  QuestionReviewHistoryItem,
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
  | { type: "set_note"; value: string }
  | { type: "replace"; value: MisconceptionReviewFormState }
  | { type: "reset" };

export type MisconceptionReviewValidationError =
  | "choice"
  | "selection"
  | "reason";

export type MisconceptionReviewFormErrors = Partial<
  Record<"removal" | "addition", MisconceptionReviewValidationError>
>;

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

export function isMisconceptionReviewFormDirty(
  state: MisconceptionReviewFormState,
  initialState: MisconceptionReviewFormState =
    initialMisconceptionReviewFormState,
): boolean {
  return (
    state.removalChoice !== initialState.removalChoice ||
    state.removedMisconceptionIds.join("\u0000") !==
      initialState.removedMisconceptionIds.join("\u0000") ||
    state.removalReason !== initialState.removalReason ||
    state.additionChoice !== initialState.additionChoice ||
    state.additionalMisconceptionIds.join("\u0000") !==
      initialState.additionalMisconceptionIds.join("\u0000") ||
    state.additionReason !== initialState.additionReason ||
    state.note !== initialState.note
  );
}

function historyReviewFormState(
  review:
    | QuestionReviewHistoryItem
    | AnswerReviewHistoryItem
    | undefined,
  hasRemoval: boolean,
): MisconceptionReviewFormState {
  if (!review) return { ...initialMisconceptionReviewFormState };

  return {
    removalChoice: hasRemoval,
    removedMisconceptionIds: [...review.removedMisconceptionIds],
    removalReason: review.removalReason ?? "",
    additionChoice: review.hasAdditionalMisconceptions,
    additionalMisconceptionIds: [...review.additionalMisconceptionIds],
    additionReason: review.additionReason ?? "",
    note: review.note ?? "",
  };
}

export function questionReviewFormState(
  review: QuestionReviewHistoryItem | undefined,
): MisconceptionReviewFormState {
  return historyReviewFormState(
    review,
    review?.hasIncorrectMisconceptions ?? false,
  );
}

export function answerReviewFormState(
  review: AnswerReviewHistoryItem | undefined,
): MisconceptionReviewFormState {
  return historyReviewFormState(
    review,
    review?.hasMismatchedMisconceptions ?? false,
  );
}

export function getAdditionalMisconceptionCandidates<T extends { id: string }>(
  misconceptions: readonly T[],
  existingIds: readonly string[],
): T[] {
  const existing = new Set(existingIds.map((id) => id.trim()).filter(Boolean));
  return misconceptions.filter((item) => !existing.has(item.id.trim()));
}

export function getQuestionRemovalProposalIds(
  effectiveMisconceptionIds: readonly string[],
): string[] {
  return uniqueIds([...effectiveMisconceptionIds]);
}

export function toggleMisconceptionSelection(
  selectedIds: readonly string[],
  misconceptionId: string,
): string[] {
  const normalizedId = misconceptionId.trim();
  const normalizedSelection = uniqueIds([...selectedIds]);
  if (!normalizedId) return normalizedSelection;
  return normalizedSelection.includes(normalizedId)
    ? normalizedSelection.filter((id) => id !== normalizedId)
    : [...normalizedSelection, normalizedId];
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export function misconceptionReviewFormReducer(
  state: MisconceptionReviewFormState,
  action: MisconceptionReviewFormAction,
): MisconceptionReviewFormState {
  if (action.type === "reset") {
    return { ...initialMisconceptionReviewFormState };
  }

  if (action.type === "replace") {
    return { ...action.value };
  }

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

export function getMisconceptionReviewFormErrors(
  state: MisconceptionReviewFormState,
): MisconceptionReviewFormErrors {
  const errors: MisconceptionReviewFormErrors = {};

  if (state.removalChoice === null) errors.removal = "choice";
  else if (state.removalChoice && state.removedMisconceptionIds.length === 0) {
    errors.removal = "selection";
  } else if (state.removalChoice && !state.removalReason.trim()) {
    errors.removal = "reason";
  }

  if (state.additionChoice === null) errors.addition = "choice";
  else if (state.additionChoice && state.additionalMisconceptionIds.length === 0) {
    errors.addition = "selection";
  } else if (state.additionChoice && !state.additionReason.trim()) {
    errors.addition = "reason";
  }

  return errors;
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
