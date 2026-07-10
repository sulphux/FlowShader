# FlowShader

**Wizualny edytor shaderów GLSL** — budujesz efekty graficzne łącząc klocki (nody)
przeciągane na kanwę, a wynik renderuje się na żywo obok. Zero pisania boilerplate'u
GLSL: graf jest kompilowany do fragment shadera automatycznie przy każdej zmianie.

![Edytor FlowShader — graf nodów i podgląd na żywo](docs/img/01-editor.png)

Powyżej: klasyczne animowane pierścienie — `UV → Length → + Time → Cosine Palette → Output`.
Sześć klocków, zero linijek kodu.

## Szybki start

```bash
npm install
npm run dev        # edytor na http://localhost:5173
npm test           # ~630 testów (kompilator, nody, UI)
```

## Do czego to służy

- **Nauka shaderów** — widzisz na żywo, co robi każda operacja; podgląd `< > Code`
  pokazuje wygenerowany GLSL, więc graf działa jak interaktywny podręcznik.
- **Prototypowanie efektów** — tła, wizualizacje audio, generatywne wzory; szybciej
  niż ręczne pisanie i przeładowywanie shaderów.
- **Kreatywne zabawy** — parametry (suwaki, kolory) zmieniasz w trakcie animacji.

## Podstawowe możliwości

### Graf nodów z systemem typów

Porty mają typy (`float`, `vec2`, `vec3`, `vec4`) oznaczone kolorami. Niezgodne
połączenia nie przechodzą "po cichu" — **auto-adapter** sam wstawia smukłe nody
Split (≺) / Combine (≻), które rozkładają i składają wektory:

![Przegląd nodów: edytor kodu, monitor wartości, split/combine, color preview](docs/img/03-nodes.png)

Na zrzucie m.in.:
- **Code (GLSL)** — mini-edytor: piszesz wyrażenie z wejściami `a b c d`
  (np. `vec3(sin(a*2.0)*0.5+0.5, cos(a)*0.5+0.5, 0.8)`) i wybierasz typ wyjścia,
- **Value Watcher** — podgląd liczbowy sygnału (X/Y/Z/W na żywo),
- **Color Preview** — próbka koloru z kodem hex,
- smukłe **Split ≺ / Combine ≻** z badge'em rozmiaru wektora,
- **Float Param** — nazwany parametr ze strzałkami i suwakiem (zakładka PARAMS
  w bibliotece zbiera wszystkie parametry projektu w jedno miejsce).

### Szybkie dodawanie nodów

Przeciągnij kabel na puste pole albo kliknij prawym przyciskiem — menu pokazuje
**tylko nody pasujące do typu**, który ciągniesz. Zaznaczone nody można też
zapisać jako własny node (Create Custom Node) i używać jak zwykłego klocka:

![Menu szybkiego dodawania](docs/img/02-quick-add.png)

### Tekstury i audio

Node **Texture** wgrywa obraz z dysku (miniatura na nodzie, opcjonalne wejście UV),
a **Audio** analizuje plik dźwiękowy na żywo i wystawia poziomy
Level / Bass / Mid / High — gotowe do sterowania animacją w rytm muzyki:

![Nody Texture i Audio](docs/img/04-media.png)

### Ustawienia globalne

Limit FPS (bez limitu / 30 / 60) i jakość renderowania (50–100%) dla wszystkich
okien podglądu — przydatne na słabszym sprzęcie:

![Ustawienia globalne](docs/img/05-settings.png)

### Zapis projektów

- **Plik**: `Save` nadpisuje otwarty plik bez pytania (jak w normalnym edytorze),
  `Save As…` wybiera nowy, `Load` podpina wczytany plik pod kolejne zapisy.
  Projekt to zwykły JSON — łatwo wersjonować w gicie.
- **Chmura** (opcjonalnie, przycisk ☁️): logowanie, projekty online z limitem
  miejsca na użytkownika oraz **udostępnianie z licencją** — projekt może być
  prywatny, "z linkiem" albo publiczny, na licencji ARR / CC BY / CC BY-NC / CC0.
  Konfiguracja backendu (darmowy Supabase): [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

![Panel projektów w chmurze](docs/img/06-cloud.png)

## Biblioteka nodów (skrót)

| Kategoria | Nody |
|---|---|
| Wejścia | Output (Screen), Time, Float/Color Param, UV Coord, **Texture**, **Audio** |
| Matematyka | `+ − × ÷`, Negate, POW, SIN/COS/TAN/COT/ATAN, ABS, EXP, FRACT |
| Wektory | UV Scale/Shift, Length, Fract (Vec2), Mix (Lerp), Relay |
| Narzędzia | Split/Combine (Auto), Value Watcher, Preview, Color Preview, **Code (GLSL)**, Comment, Group |
| Kolor i kształty | Cosine Palette, Add/Scale (Color), Mono (RGB), Circle SDF |
| Własne | Create Custom Node — zamknij fragment grafu w reużywalny klocek z podgrafem |

## Więcej

- [ARCHITECTURE.md](ARCHITECTURE.md) — jak działa kompilator grafu → GLSL
- [DEVELOPMENT.md](DEVELOPMENT.md) — praca nad kodem
- [CLOUD_SYNC_DESIGN.md](CLOUD_SYNC_DESIGN.md) — architektura części chmurowej
- Zrzuty w tym README generuje `node scripts/docs-screenshots.mjs`
  (wymaga uruchomionego dev servera na porcie 5199)

Stack: React 19 + TypeScript + Vite, React Flow (graf), Three.js (rendering),
Vitest + glslangValidator (testy poprawności GLSL), Supabase (opcjonalna chmura).

## Licencja

[PolyForm Strict 1.0.0](LICENSE) — kod można przeglądać i uruchamiać lokalnie,
ale nie kopiować, modyfikować ani wykorzystywać w innych projektach bez zgody
autora. (To dotyczy tego repozytorium — nie mylić z licencjami projektów
shaderów tworzonych *w* aplikacji, opisanymi wyżej w sekcji Chmura.)
