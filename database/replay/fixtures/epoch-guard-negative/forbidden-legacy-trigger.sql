create trigger question_reviews_enforce_cap
before insert or update on public.question_reviews
for each row execute function public.enforce_question_review_cap();
