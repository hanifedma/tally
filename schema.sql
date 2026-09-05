-- ============================================================
--  Tally — the whole database.
--
--  Paste this into the Supabase SQL editor and press Run. It is safe to run
--  more than once: every statement is guarded, so re-running it after an
--  update changes only what is new.
--
--  Five tables, all private to one person by row level security, all
--  streamed to every signed-in device by Realtime.
--
--  ── Two decisions worth knowing about ──────────────────────
--
--  1. Nothing is ever really deleted. `deleted_at` marks a row as gone and
--     clients filter it out. That buys three things at once: undo; a delta
--     sync that can ask "what changed since?" and get deletions in the same
--     answer; and — the important one — realtime that actually works. A real
--     DELETE sends only the primary key, which row level security then has
--     no user_id to check, so the event is dropped before it reaches the
--     device that needed it. A soft delete is an UPDATE carrying the whole
--     row, so it always arrives.
--
--  2. A transaction's date is a plain `date`, not a timestamp. An entry
--     belongs to the calendar day you say it does — recording lunch in Seoul
--     and opening the app in Jakarta must not move it to yesterday. The time
--     of day rides along as minutes past midnight, purely for ordering
--     within the day.
-- ============================================================

-- ------------------------------------------------------------
--  Helpers
-- ------------------------------------------------------------

-- Every table stamps its own updated_at, on insert as well as on update.
-- Clients must not be trusted to set it: the delta sync cursor is built on
-- it, and a device with a wrong clock could otherwise write a row dated last
-- year and hide it from every other device for good.
create or replace function public.tally_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------------------
--  settings — one row per person
-- ------------------------------------------------------------
create table if not exists public.settings (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  -- The currency every total is expressed in.
  main_currency text        not null default 'KRW',
  theme         text        not null default 'dark',
  lang          text        not null default 'en',
  -- 0 = Sunday … 6 = Saturday.
  week_start    smallint    not null default 1,
  -- The day of the month a budget period begins. 1 for calendar months; set
  -- it to your payday to budget by salary cycle instead.
  month_start   smallint    not null default 1,
  -- { "IDR": 0.0875 } — what one unit of that currency is worth in
  -- main_currency, used to fill in the rate on a new entry and to re-express
  -- older entries if main_currency ever changes.
  rates         jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint settings_week_start_range  check (week_start between 0 and 6),
  constraint settings_month_start_range check (month_start between 1 and 28),
  constraint settings_theme_known       check (theme in ('dark', 'light')),
  constraint settings_lang_known        check (lang in ('en', 'ko')),
  constraint settings_currency_shape    check (main_currency ~ '^[A-Z]{3}$')
);

-- ------------------------------------------------------------
--  accounts — where money sits
-- ------------------------------------------------------------
create table if not exists public.accounts (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  name          text        not null,
  -- cash | bank | card | ewallet | savings
  kind          text        not null default 'cash',
  currency      text        not null default 'KRW',
  -- The balance before the first recorded transaction, in minor units.
  opening_minor bigint      not null default 0,
  color         text        not null default 'indigo',
  archived      boolean     not null default false,
  position      integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint accounts_name_length   check (char_length(name) between 1 and 60),
  constraint accounts_kind_known    check (kind in ('cash', 'bank', 'card', 'ewallet', 'savings')),
  constraint accounts_currency_shape check (currency ~ '^[A-Z]{3}$')
);

-- ------------------------------------------------------------
--  categories — what money was for
-- ------------------------------------------------------------
create table if not exists public.categories (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  name       text        not null,
  -- expense | income. A category belongs to one side of the ledger; the
  -- picker would be twice as long and half as useful otherwise.
  kind       text        not null,
  icon       text        not null default '•',
  color      text        not null default 'gray',
  archived   boolean     not null default false,
  position   integer     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint categories_name_length check (char_length(name) between 1 and 60),
  constraint categories_kind_known  check (kind in ('expense', 'income'))
);

-- ------------------------------------------------------------
--  transactions — the ledger itself
-- ------------------------------------------------------------
create table if not exists public.transactions (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  -- expense | income | transfer
  kind            text        not null,
  -- Always positive, in minor units of `currency`. Direction is `kind`'s job;
  -- a signed amount plus a kind is two sources of truth for one fact.
  amount_minor    bigint      not null,
  currency        text        not null,
  -- What one major unit of `currency` was worth in `rate_base` on the day
  -- this was entered. Frozen here so that editing today's exchange rate
  -- cannot silently rewrite what last March cost.
  rate            numeric(20, 10) not null default 1,
  rate_base       text        not null default 'KRW',

  -- expense/income: the account it left or entered.
  -- transfer:       the account it left.
  account_id      uuid references public.accounts(id) on delete set null,
  -- transfer only: the account it arrived in.
  to_account_id   uuid references public.accounts(id) on delete set null,
  -- transfer only, and only when the two accounts hold different currencies:
  -- what actually landed, in minor units of the destination's currency.
  to_amount_minor bigint,

  category_id     uuid references public.categories(id) on delete set null,
  note            text        not null default '',
  -- The calendar day this belongs to. See the note at the top of the file.
  occurred_on     date        not null,
  -- Minutes past midnight, 0–1439. Ordering within a day, nothing more.
  occurred_min    smallint    not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint transactions_kind_known     check (kind in ('expense', 'income', 'transfer')),
  constraint transactions_amount_positive check (amount_minor >= 0),
  constraint transactions_to_amount_positive check (to_amount_minor is null or to_amount_minor >= 0),
  constraint transactions_rate_positive  check (rate > 0),
  constraint transactions_min_range      check (occurred_min between 0 and 1439),
  constraint transactions_note_length    check (char_length(note) <= 280),
  constraint transactions_currency_shape check (currency ~ '^[A-Z]{3}$'),
  -- A transfer needs somewhere to go, and only a transfer may have one.
  constraint transactions_transfer_shape check (
    (kind = 'transfer' and to_account_id is not null and category_id is null)
    or (kind <> 'transfer' and to_account_id is null and to_amount_minor is null)
  ),
  -- Moving money to the account it is already in is not a transfer.
  constraint transactions_transfer_distinct check (
    kind <> 'transfer' or account_id is distinct from to_account_id
  )
);

-- ------------------------------------------------------------
--  budgets — a monthly ceiling, total or per category
-- ------------------------------------------------------------
create table if not exists public.budgets (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  -- null = the total budget for the month.
  category_id  uuid references public.categories(id) on delete cascade,
  amount_minor bigint      not null,
  currency     text        not null default 'KRW',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint budgets_amount_positive check (amount_minor >= 0),
  constraint budgets_currency_shape  check (currency ~ '^[A-Z]{3}$')
);

-- One budget per category, and one overall — but only among live rows, so a
-- deleted budget never blocks setting a new one. A partial unique index is
-- the only way to say this: NULLs are not equal to each other, so a plain
-- unique(user_id, category_id) would allow any number of total budgets.
create unique index if not exists budgets_one_per_category
  on public.budgets (user_id, category_id)
  where category_id is not null and deleted_at is null;
create unique index if not exists budgets_one_total
  on public.budgets (user_id)
  where category_id is null and deleted_at is null;

-- ------------------------------------------------------------
--  Indexes — every query this app makes, and no more
-- ------------------------------------------------------------
create index if not exists transactions_by_day
  on public.transactions (user_id, occurred_on desc)
  where deleted_at is null;
-- The delta sync cursor: "everything that changed since I last looked",
-- tombstones included, so this one must not be partial.
create index if not exists transactions_by_change
  on public.transactions (user_id, updated_at);
create index if not exists transactions_by_account
  on public.transactions (user_id, account_id)
  where deleted_at is null;
create index if not exists accounts_by_change   on public.accounts   (user_id, updated_at);
create index if not exists categories_by_change on public.categories (user_id, updated_at);
create index if not exists budgets_by_change    on public.budgets    (user_id, updated_at);

-- ------------------------------------------------------------
--  updated_at triggers
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['settings', 'accounts', 'categories', 'transactions', 'budgets'] loop
    execute format('drop trigger if exists tally_touch on public.%I', t);
    execute format(
      'create trigger tally_touch before insert or update on public.%I
       for each row execute function public.tally_touch_updated_at()', t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
--  Row level security — the whole of Tally's privacy model
--
--  Every policy is the same sentence: this row is yours or it does not
--  exist to you. `with check` on writes is what stops a client inserting a
--  row under someone else's user_id.
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['settings', 'accounts', 'categories', 'transactions', 'budgets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tally_owner_select on public.%I', t);
    execute format('drop policy if exists tally_owner_insert on public.%I', t);
    execute format('drop policy if exists tally_owner_update on public.%I', t);
    execute format('drop policy if exists tally_owner_delete on public.%I', t);

    execute format(
      'create policy tally_owner_select on public.%I
       for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy tally_owner_insert on public.%I
       for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy tally_owner_update on public.%I
       for update to authenticated using (user_id = (select auth.uid()))
       with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy tally_owner_delete on public.%I
       for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
--  Table privileges
--
--  Row level security decides *which rows* a signed-in person may touch. It
--  cannot grant the right to touch the table at all — that is an ordinary
--  SQL privilege, and without it PostgREST answers
--
--      42501  permission denied for table accounts
--
--  long before any policy is consulted. The app sees every read and write
--  refused, so the outbox never drains and the status line sits on
--  "Reconnecting…" for ever, with nothing reaching the other device.
--
--  Supabase's default privileges usually cover this, but they are attached
--  to the role that owns the schema and do not always apply to tables
--  created by a script pasted into the SQL editor. Granting explicitly costs
--  nothing, is idempotent, and removes the failure entirely.
--
--  Only `authenticated`. `anon` is given nothing: no policy above admits it,
--  so a grant would buy an empty list instead of an error, and this is a
--  ledger — an error is the better answer.
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['settings', 'accounts', 'categories', 'transactions', 'budgets'] loop
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
--  Realtime — what makes a phone and a laptop the same app
--
--  REPLICA IDENTITY FULL puts the whole old row in the change event. Tally
--  soft-deletes, so it would mostly work without this; it is set anyway so
--  that a row removed by hand in the Supabase table editor still reaches
--  every open client instead of quietly staying on screen.
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['settings', 'accounts', 'categories', 'transactions', 'budgets'] loop
    execute format('alter table public.%I replica identity full', t);
    -- Adding a table twice is an error rather than a no-op, so ask first.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- ------------------------------------------------------------
--  Done.
--
--  Nothing here seeds a new account with starter categories: the apps do
--  that on first sign-in, using ids derived from the user id so that a
--  phone and a laptop opening for the first time in the same minute write
--  the same rows rather than two sets of them.
--
--  Housekeeping, if tombstones ever bother you — entirely optional, and
--  only ever run it when every device has synced past that date:
--
--    delete from public.transactions where deleted_at < now() - interval '90 days';
-- ------------------------------------------------------------
