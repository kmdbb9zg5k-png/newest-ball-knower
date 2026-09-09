-- Profile photos are normalized to a 512x512 JPEG by the client. The storage
-- bucket must accept that MIME type in addition to legacy WebP avatars.

update storage.buckets
set allowed_mime_types=array['image/webp','image/jpeg']
where id='ball-knower-avatars';

do $$
begin
  if not exists(
    select 1
    from storage.buckets
    where id='ball-knower-avatars'
      and allowed_mime_types=array['image/webp','image/jpeg']
  ) then
    raise exception 'Ball Knower avatar bucket must allow WebP and JPEG uploads';
  end if;
end;
$$;
