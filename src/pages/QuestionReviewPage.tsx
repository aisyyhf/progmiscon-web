import { useParams } from "react-router-dom";
import { QuestionReview } from "../components/review/QuestionReview";

export function QuestionReviewPage() {
  const { questionId } = useParams<{ questionId: string }>();
  if (!questionId) return null;
  return <QuestionReview key={questionId} questionId={questionId} />;
}
