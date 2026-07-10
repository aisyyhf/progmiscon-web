import type { VerificationCheck } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t, uiText } from "../../utils/translation";
import { verificationResultLabel, verificationResultTone } from "../../utils/status";
import { StatusPill } from "../common/StatusPill";

export function MisconceptionCheck({ check }: { check: VerificationCheck | undefined }) {
  const { language } = useLanguage();

  if (!check) {
    return <p className="text-sm text-muted">{t(uiText.noVerification, language)}</p>;
  }

  const tone = verificationResultTone(check.result);

  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Prompt</p>
        <p className="text-navy-deep">{t(check.prompt, language)}</p>
      </div>
      {check.pseudocode && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Pseudocode</p>
          <pre className="whitespace-pre-wrap rounded-md bg-bg px-3 py-2 font-mono text-xs text-navy-deep">
            {check.pseudocode}
          </pre>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {t(uiText.correctOptionLabel, language)}
          </p>
          <p className="text-navy-deep">{t(check.expectedAnswer, language)}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {t(uiText.studentAnswerLabel, language)}
          </p>
          <p className="text-navy-deep">{t(check.studentAnswer, language)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusPill tone={tone} label={verificationResultLabel(check.result, language)} />
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          {language === "id" ? "Penjelasan" : "Explanation"}
        </p>
        <p className="text-navy-deep">{t(check.explanation, language)}</p>
      </div>
      <p className="border-t border-border pt-3 text-xs italic text-muted">
        {t(uiText.verificationHelper, language)}
      </p>
    </div>
  );
}
