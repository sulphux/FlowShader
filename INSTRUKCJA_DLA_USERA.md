# ⚠️ KRYTYCZNE: MUSISZ WYCZYŚCIĆ STARE DANE!

## Problem
Jeśli widzisz FIOLETOWY port (auto) zamiast CZERWONEGO (float), to znaczy że masz **STARE custom nodes w localStorage**!

## ROZWIĄZANIE - ZRÓB TO TERAZ:

### Krok 1: Wyczyść localStorage (KRYTYCZNE!)

**Otwórz Console (F12) i wklej:**
```javascript
localStorage.clear();
location.reload();
```

**To:**
- Usuwa WSZYSTKIE stare custom nodes
- Odświeża stronę
- Daje Ci czysty start

---

### Krok 2: Stwórz NOWY custom node (od zera)

1. **Prawy klik** na canvas → **"Create Custom Node"**
2. Nazwa: **"TestFloat"**
3. **Double-click** na nowo stworzony "TestFloat"

---

### Krok 3: Dodaj Float i połącz

1. Z sidebara przeciągnij **"Float"** node
2. **Połącz**: Float (output) → Custom Input (wejście)
3. **Sprawdź console (F12)** - MUSISZ zobaczyć:
   ```
   ✅ Custom Input type detected: {
     nodeId: 'custom_input-...',
     detectedType: 'float',
     label: 'Input'
   }
   ```

4. Jeśli NIE widzisz tego loga → **onConnect nie działa!** (napisz mi)

---

### Krok 4: Wyjdź i sprawdź

1. Kliknij **"Exit to Main"**
2. **Sprawdź console** - MUSISZ zobaczyć:
   ```
   🔍 extractCustomNodePorts - Custom Input: {
     nodeId: 'custom_input-...',
     detectedType: 'float',
     final: 'float'
   }
   
   💾 Saving custom node to localStorage: {
     inputs: [{ type: 'float' }]
   }
   ```

3. **Patrz na custom node instance na głównym canvasie**
4. **PORT WEJŚCIOWY** powinien być **🔴 CZERWONY** (nie fioletowy!)

---

### Krok 5: Weryfikacja w Console

**Wklej w Console (F12):**
```javascript
// Sprawdź NODE_REGISTRY
console.log('Registry:', NODE_REGISTRY['custom_testfloat']);

// Powinno pokazać:
// inputs: [{ id: '...', label: 'Input', type: 'float' }]

// Sprawdź localStorage
console.log('Storage:', JSON.parse(localStorage.getItem('custom_nodes_library')));

// Powinno pokazać w subgraph.nodes detectedType: 'float'
```

---

## ⚠️ JEŚLI NADAL NIE DZIAŁA

### Scenariusz A: Port jest NADAL fioletowy

**Zrób screenshot i pokaż mi:**
1. Custom node instance na głównym canvasie
2. Console output (wszystkie logi)
3. Wynik z `console.log(NODE_REGISTRY['custom_testfloat'])`

**I powiedz mi:**
- Czy widziałeś log "✅ Custom Input type detected"?
- Czy widziałeś log "💾 Saving custom node to localStorage"?
- Czy w console NODE_REGISTRY pokazuje `type: 'float'`?

### Scenariusz B: Nie widzisz logów

**To znaczy że:**
- onConnect NIE jest wywoływany (problem z event handlerem)
- LUB masz starą wersję kodu (nie odświeżyłeś po moich zmianach)

**Sprawdź:**
```bash
# W terminalu (zatrzymaj npm run dev jeśli działa)
npm run dev
```

**I spróbuj ponownie.**

---

## 🎯 CO POWINNO SIĘ STAĆ (IDEALNY FLOW)

1. Tworzysz custom node → FIOLETOWY port (auto) ← POPRAWNE (brak połączeń)
2. Wchodzisz do środka → widzisz Custom Input (fioletowy)
3. Dodajesz Float → Float ma czerwony output
4. Łączysz Float → Custom Input → **Custom Input zmienia się na CZERWONY**
5. Wychodzisz → Custom node instance **MA CZERWONY PORT**
6. F5 (reload) → Port NADAL czerwony

---

## 🚨 JEŚLI KROK 4 NIE DZIAŁA

(Custom Input NIE zmienia się na czerwony po połączeniu)

**To znaczy że onConnect jest broken!**

Sprawdź w Console błędy JavaScript (czerwone komunikaty).

---

## 📞 POTRZEBUJĘ OD CIEBIE

**Po wykonaniu kroków 1-5, napisz mi:**

1. ✅ / ❌ Czy widziałeś log "✅ Custom Input type detected"?
2. ✅ / ❌ Czy port custom node instance jest CZERWONY?
3. ✅ / ❌ Czy `NODE_REGISTRY['custom_testfloat'].inputs[0].type === 'float'`?

**Jeśli którekolwiek jest ❌ - pokaż mi console output i screenshot!**

---

**Testy pokazują że KOD działa. Jeśli UI nie działa - problem jest w renderowaniu albo cache!**
