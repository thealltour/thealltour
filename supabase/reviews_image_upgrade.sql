alter table public.reviews
add column if not exists image_url text;

alter table public.reviews
add column if not exists image_urls text[] not null default '{}';

update public.reviews
set image_urls = case
  when image_url is not null and image_url <> '' then array[image_url]
  else '{}'::text[]
end
where image_urls is null or cardinality(image_urls) = 0;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-images',
  'review-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read review images" on storage.objects;
create policy "Public read review images"
on storage.objects
for select
to anon
using (bucket_id = 'review-images');

drop policy if exists "Public upload review images" on storage.objects;
create policy "Public upload review images"
on storage.objects
for insert
to anon
with check (bucket_id = 'review-images');
