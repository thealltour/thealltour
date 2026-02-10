alter table public.members enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "Allow public update members" on public.members;
create policy "Allow public update members"
on public.members
for update
to anon
using (true)
with check (true);

drop policy if exists "Allow public update reviews" on public.reviews;
create policy "Allow public update reviews"
on public.reviews
for update
to anon
using (true)
with check (true);
