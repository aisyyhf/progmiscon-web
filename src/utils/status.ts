import type { AnswerStatus, CheckKey, Language, VerificationResult } from "../types";
import { t, uiText } from "./translation";

export function answerStatusLabel(status: AnswerStatus, language: Language): string {
  return status === "correct" ? t(uiText.filterCorrect, language) : t(uiText.filterIncorrect, language);
}

export function checkKeyLabel(key: CheckKey, language: Language): string {
  const map: Record<CheckKey, { id: string; en: string }> = {
    output: uiText.checkOutput,
    logic: uiText.checkLogic,
    pseudocode: uiText.checkPseudocode,
    concept: uiText.checkConcept,
  };
  return t(map[key], language);
}

export function checkPassedLabel(passed: boolean, language: Language): string {
  return passed ? t(uiText.pass, language) : t(uiText.fail, language);
}

export function checkPassedSymbol(passed: boolean): string {
  return passed ? "✓" : "✕";
}

export function verificationResultLabel(result: VerificationResult, language: Language): string {
  const map: Record<VerificationResult, { id: string; en: string }> = {
    confirmed: uiText.resultConfirmed,
    not_confirmed: uiText.resultNotConfirmed,
    needs_review: uiText.resultNeedsReview,
  };
  return t(map[result], language);
}

export function verificationResultTone(result: VerificationResult): "correct" | "incorrect" | "muted" {
  if (result === "confirmed") return "correct";
  if (result === "not_confirmed") return "incorrect";
  return "muted";
}
