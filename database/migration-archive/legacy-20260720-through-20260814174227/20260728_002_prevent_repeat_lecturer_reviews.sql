-- Progmiscon
-- Prevent lecturers from updating a review they have already submitted.

begin;

create or replace function public.prevent_repeat_lecturer_review_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) = old.reviewer_id then
    raise exception using
      message = 'REVIEW_ALREADY_SUBMITTED',
      errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists question_reviews_prevent_repeat_lecturer_update
  on public.question_reviews;
create trigger question_reviews_prevent_repeat_lecturer_update
before update on public.question_reviews
for each row
execute function public.prevent_repeat_lecturer_review_update();

drop trigger if exists answer_reviews_prevent_repeat_lecturer_update
  on public.answer_reviews;
create trigger answer_reviews_prevent_repeat_lecturer_update
before update on public.answer_reviews
for each row
execute function public.prevent_repeat_lecturer_review_update();

commit;
