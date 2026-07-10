# Projekt: konta użytkowników, zapis online, licencje

Status: **projekt architektury** — kod aplikacji jest już przygotowany
(interfejs `ProjectStorageProvider` w [src/core/projectStorage.ts](src/core/projectStorage.ts),
dziś działa provider lokalny na localStorage). Podpięcie chmury nie wymaga
zmian w komponentach — tylko nowa implementacja interfejsu i podmiana
w `createProjectStorage()`.

## Wymagania (z zamówienia)

1. Logowanie użytkowników.
2. Zapis projektów online z limitem miejsca na użytkownika.
3. System licencyjny: udostępniam / nie udostępniam projektu (+ na jakiej licencji).

## Rekomendacja backendu

| Opcja | Zalety | Wady |
|---|---|---|
| **Supabase (rekomendowane)** | Auth + Postgres + Storage w jednym, darmowy tier (500 MB DB), Row Level Security wprost pod nasz model uprawnień, SDK JS | Vendor lock-in (umiarkowany — pod spodem czysty Postgres) |
| Firebase | Dojrzałe, dobre SDK | NoSQL utrudnia limity/zapytania, reguły bezpieczeństwa trudniejsze niż RLS |
| Własny backend (Node + Postgres) | Pełna kontrola | Trzeba samemu hostować, utrzymywać auth, koszty czasu |

## Model danych (Postgres/Supabase)

```sql
-- Użytkownicy: tabela auth.users z Supabase (wbudowana)

create table profiles (
  id uuid primary key references auth.users(id),
  display_name text not null,
  storage_limit_bytes bigint not null default 10485760  -- 10 MB na start
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  name text not null,
  json jsonb not null,              -- format serializeGraph (ten sam co pliki)
  size_bytes bigint not null,
  visibility text not null default 'private'
    check (visibility in ('private', 'unlisted', 'public')),
  license text not null default 'all-rights-reserved'
    check (license in ('all-rights-reserved', 'cc-by', 'cc-by-nc', 'cc0')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Limity miejsca (egzekwowane po stronie serwera)

```sql
create or replace function enforce_storage_limit() returns trigger as $$
begin
  if (select coalesce(sum(size_bytes), 0) from projects
      where owner_id = new.owner_id and id <> new.id) + new.size_bytes
     > (select storage_limit_bytes from profiles where id = new.owner_id) then
    raise exception 'storage limit exceeded';
  end if;
  return new;
end $$ language plpgsql;

create trigger projects_limit before insert or update on projects
  for each row execute function enforce_storage_limit();
```

### Uprawnienia (Row Level Security)

```sql
alter table projects enable row level security;

-- Właściciel: pełny dostęp
create policy owner_all on projects
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Inni: odczyt tylko projektów public (unlisted czytane przez endpoint z id)
create policy public_read on projects for select
  using (visibility = 'public');
```

## Licencje (system "udostępniam / nie udostępniam")

- `visibility`:
  - **private** — tylko właściciel (domyślne),
  - **unlisted** — kto ma link, może obejrzeć,
  - **public** — widoczny w publicznej galerii.
- `license` (dotyczy nie-private): `all-rights-reserved` (patrz, nie kopiuj),
  `cc-by`, `cc-by-nc`, `cc0`. UI pokazuje licencję przy otwieraniu cudzego
  projektu; "Duplicate to my account" aktywne tylko dla licencji CC.

## Implementacja klienta (kolejność)

1. `SupabaseProjectStorageProvider implements ProjectStorageProvider`
   (`@supabase/supabase-js`; klucze w `.env.local`: `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUB` (klucz publishable — nowy następca `anon`) — nie commitujemy).
2. UI logowania (modal z Toolbara: email+hasło / magic link).
3. Panel "Moje projekty" (lista z `listProjects()` + pasek zużycia quota).
4. Przełącznik udostępniania + wybór licencji na projekcie (`setSharing`).
5. (Później) publiczna galeria `visibility = 'public'`.

## Uwagi

- Format JSON projektu jest wspólny dla plików lokalnych i chmury
  (`serializeGraph`/`rehydrateGraph`) — migracja w obie strony za darmo.
- Tekstury w data URL potrafią być duże — przy chmurze warto przenieść je do
  Supabase Storage (bucket per user, w JSON tylko referencja) zanim podniesiemy limity.
- Audio nie jest zapisywane w projekcie (celowo — rozmiar); w chmurze można
  dodać upload do bucketu analogicznie do tekstur.
