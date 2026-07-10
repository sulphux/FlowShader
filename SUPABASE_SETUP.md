# Konfiguracja Supabase (logowanie + projekty online + licencje)

Aplikacja działa bez tej konfiguracji (projekty zapisują się wtedy lokalnie
w przeglądarce). Po wykonaniu poniższych kroków przycisk ☁️ w toolbarze
przełącza się na tryb chmurowy: logowanie, zapis online z limitem miejsca
i udostępnianie projektów z wyborem licencji.

## Krok 1: Załóż projekt Supabase (za darmo)

1. Wejdź na https://supabase.com i zarejestruj się (np. kontem GitHub).
2. **New project** → wybierz nazwę (np. `nodeshader`), region (najbliżej: `eu-central-1`)
   i hasło do bazy (zapisz je, choć aplikacja go nie potrzebuje).
3. Poczekaj ~2 minuty, aż projekt się utworzy.

## Krok 2: Utwórz schemat bazy

1. W panelu projektu: **SQL Editor** → **New query**.
2. Wklej całą zawartość pliku [`supabase/schema.sql`](supabase/schema.sql) z tego repo.
3. Kliknij **Run**. Powinno pojawić się "Success. No rows returned".

To tworzy: profile użytkowników (z limitem 10 MB na osobę), tabelę projektów,
trigger egzekwujący limit miejsca oraz reguły dostępu (każdy widzi tylko swoje
projekty + publiczne innych).

## Krok 3: Skopiuj klucze do aplikacji

1. W panelu: **Project Settings** (zębatka) → **API Keys**.
2. Skopiuj **Project URL** oraz klucz **publishable** (`sb_publishable_...`) —
   to następca starego klucza `anon`, Supabase pokazuje go teraz jako domyślny.
3. W katalogu głównym repo utwórz plik `.env.local`:

```
VITE_SUPABASE_URL=https://TWOJ-PROJEKT.supabase.co
VITE_SUPABASE_PUB=sb_publishable_...
```

> `.env.local` nie trafia do gita (reguła `*.local`). Klucz `publishable` jest
> bezpieczny do użycia w przeglądarce — prawdziwa ochrona danych to reguły RLS
> z kroku 2. (Jeśli Twój projekt ma jeszcze tylko starszy klucz `anon` (JWT),
> działa on identycznie pod zmienną `VITE_SUPABASE_ANON_KEY`.)

## Krok 4: Restart i logowanie

1. Zrestartuj dev server (`npm run dev`).
2. Kliknij ☁️ w toolbarze → **Zarejestruj** (email + hasło).
   - Domyślnie Supabase wysyła mail potwierdzający; do testów możesz to
     wyłączyć w **Authentication → Sign In / Up → Email → Confirm email: OFF**.
3. Po zalogowaniu: **Zapisz bieżący** wysyła graf do chmury, lista pokazuje
   projekty z paskiem zużycia miejsca, a przy każdym projekcie ustawisz
   widoczność (prywatny / z linkiem / publiczny) i licencję (ARR / CC BY /
   CC BY-NC / CC0).

## Limity miejsca

Domyślnie 10 MB na użytkownika. Zmiana globalnego domyślnego: kolumna
`storage_limit_bytes` w tabeli `profiles` (nowi użytkownicy), a per użytkownik:

```sql
update profiles set storage_limit_bytes = 52428800  -- 50 MB
where id = 'uuid-użytkownika';
```

Limit egzekwuje trigger w bazie — nie da się go obejść z klienta.
