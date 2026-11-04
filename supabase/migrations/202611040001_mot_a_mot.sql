begin;

-- Add a private document namespace for Mot à mot without changing existing data.
alter table public.personal_app_state drop constraint personal_app_state_app_check;
alter table public.personal_app_state add constraint personal_app_state_app_check
  check (app in ('curio','mes-apps','tsugi','mot-a-mot'));

do $$
declare definition text;
begin
  select pg_get_functiondef('public.personal_app_save(text,bigint,jsonb)'::regprocedure) into definition;
  if position('''curio'',''mes-apps'',''tsugi''' in definition)=0 then
    raise exception 'Unexpected personal_app_save definition; review before migration';
  end if;
  execute replace(
    definition,
    '''curio'',''mes-apps'',''tsugi''',
    '''curio'',''mes-apps'',''tsugi'',''mot-a-mot'''
  );
end $$;

commit;
