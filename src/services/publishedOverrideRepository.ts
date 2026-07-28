import type {
  AnswerContentOverride,
  AnswerMisconceptionOverride,
  PublishedMasterOverrides,
  QuestionContentOverride,
  QuestionMisconceptionOverride,
} from "../types";
import { supabase } from "./supabaseClient";

type PublishedMasterOverrideRow = {
  question_content_overrides: QuestionContentOverride[] | null;
  answer_content_overrides: AnswerContentOverride[] | null;
  question_misconception_overrides: QuestionMisconceptionOverride[] | null;
  answer_misconception_overrides: AnswerMisconceptionOverride[] | null;
};

export async function getPublishedMasterOverrides(): Promise<PublishedMasterOverrides> {
  const { data, error } = await supabase.rpc("get_published_master_overrides");

  if (error) {
    throw new Error(`Published override gagal dimuat: ${error.message}`);
  }

  const row = (data?.[0] as PublishedMasterOverrideRow | undefined) ?? null;

  return {
    questionContentOverrides: row?.question_content_overrides ?? [],
    answerContentOverrides: row?.answer_content_overrides ?? [],
    questionMisconceptionOverrides:
      row?.question_misconception_overrides ?? [],
    answerMisconceptionOverrides:
      row?.answer_misconception_overrides ?? [],
  };
}
