alter policy "Lecturers can update their own question reviews"
on public.question_reviews
using (
  exists (
    select 1
    from public.lecturer_profiles profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  )
)
with check (
  exists (
    select 1
    from public.lecturer_profiles profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  )
);
