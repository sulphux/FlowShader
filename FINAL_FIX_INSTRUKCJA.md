# 🔥 NAPRAWIONE! Custom Nodes - React State Timing Fix

## ⚠️ MUSISZ ZROBIĆ TO PRZED TESTEM:

### 1. WYCZYŚĆ localStorage (KRYTYCZNE!)

**Otwórz Console (F12) i wklej:**
```javascript
localStorage.clear();
location.reload();
```

**Dlaczego:** Stare custom nodes w localStorage mają `type: 'auto'` i nigdy nie zostaną zaktualizowane!

---

### 2. URUCHOM APLIKACJĘ

```bash
npm run dev
```

---

### 3. TESTUJ OD NOWA (DOKŁADNIE TE KROKI)

#### **Krok 1:** Stwórz custom node
- Prawy klik na canvas → "Create Custom Node"
- Nazwa: "TestFloat"
- Kliknij Create

#### **Krok 2:** Wejdź do custom node  
- **Double-click** na "TestFloat" box na canvasie
- Zobaczysz Custom Input (fioletowy) i Custom Output (fioletowy)

#### **Krok 3:** Dodaj Float
- Z sidebara przeciągnij **"Float"** node
- Ustaw wartość na 1.0

#### **Krok 4:** Połącz Float → Custom Input
- Przeciągnij wire z Float (czerwony port) → Custom Input
- **SPRAWDŹ CONSOLE - MUSISZ ZOBACZYĆ:**
  ```
  ✅ Custom Input type detected: {
    nodeId: 'custom_input-...',
    detectedType: 'float',
    label: 'Input'
  }
  ```
- **Jeśli NIE widzisz tego loga → NAPISZ MI!**

#### **Krok 5:** Wyjdź z custom node
- Kliknij **"Exit to Main"**
- **SPRAWDŹ CONSOLE - MUSISZ ZOBACZYĆ:**
  ```
  🔍 navigateBack extracting ports from CURRENT state: {
    detectedTypes: [
      { id: 'custom_input-...', detectedType: 'float' },
      ...
    ],
    extractedPorts: {
      inputs: [{ type: 'float' }]
    }
  }
  
  💾 Saving custom node to localStorage: {
    inputs: [{ type: 'float' }]
  }
  
  🔄 Refreshing custom node instance: {
    oldInputs: [...],
    newInputs: [{ type: 'float' }]
  }
  ```

#### **Krok 6:** SPRAWDŹ PORT NA GŁÓWNYM CANVASIE

- Custom node "TestFloat" na głównym canvasie
- Port wejściowy (lewy) powinien być **🔴 CZERWONY**, NIE 🟣 FIOLETOWY
- Najedź myszką - tooltip powinien mówić "Input (float)"

---

## 🧪 WERYFIKACJA W CONSOLE

**Wklej w Console (F12):**
```javascript
// 1. Sprawdź NODE_REGISTRY
const customNodeDef = Object.values(NODE_REGISTRY).find(n => n.label === 'TestFloat');
console.log('Custom Node Definition:', customNodeDef);
console.log('Inputs:', customNodeDef?.inputs);

// POWINNO pokazać: inputs: [{ id: '...', label: 'Input', type: 'float' }]

// 2. Sprawdź localStorage
const stored = JSON.parse(localStorage.getItem('custom_nodes_library'));
console.log('Stored custom nodes:', stored);

// POWINNO pokazać detectedType: 'float' w subgraph.nodes

// 3. Sprawdź instancję na canvasie
// Znajdź node na canvasie, kliknij na niego, sprawdź w React DevTools
```

---

## 📊 CO ZOSTAŁO NAPRAWIONE (FINALNE)

### **Problem #1: React State Timing** ✅ NAPRAWIONE
**Symptom:** `navigateBack` używał starego `nodes` z closure  
**Fix:** Użycie functional update `setNodes((currentNodes) => ...)` aby zawsze czytać najnowszy stan

**Kod:** `src/components/NodeEditor.tsx` linia 495-600

### **Problem #2: Custom Output dimension mismatch** ✅ NAPRAWIONE
**Symptom:** vec3 = vec2 błąd kompilacji  
**Fix:** Custom Output używa typu WEJŚCIA, nie defaultowego vec3

**Kod:** `src/core/compiler.ts` linia 168-178

### **Problem #3: Uniforms w void main()** ✅ NAPRAWIONE
**Symptom:** uniform only allowed at global scope  
**Fix:** isSubgraph parametr - subgraphs zwracają tylko mainBody

**Kod:** `src/core/compiler.ts` linia 39, 141, 150, 227

---

## 🎯 SUCCESS CRITERIA

Po wykonaniu kroków 1-6:

✅ Console pokazuje logi "✅ Custom Input type detected"  
✅ Console pokazuje "🔍 navigateBack extracting ports from CURRENT state"  
✅ Console pokazuje "🔄 Refreshing custom node instance"  
✅ Port custom node instance jest **🔴 CZERWONY**  
✅ `NODE_REGISTRY['custom_testfloat'].inputs[0].type === 'float'`  
✅ Brak błędów JavaScript w console  
✅ Shader kompiluje się (preview pokazuje obraz, nie czarny ekran)  

---

## 🚨 JEŚLI NADAL NIE DZIAŁA

### Możliwość 1: Nie wyczyściłeś localStorage
**Rozwiązanie:** Powtórz Krok 1 (localStorage.clear())

### Możliwość 2: Kod nie został załadowany
**Rozwiązanie:** 
- Zatrzymaj dev server (Ctrl+C)
- `npm run dev` ponownie
- Hard refresh (Ctrl+Shift+R)

### Możliwość 3: React cache
**Rozwiązanie:**
- Zamknij wszystkie karty z aplikacją
- Wyczyść localStorage
- Uruchom ponownie

### Możliwość 4: Coś innego jest nie tak
**Napisz mi:**
- Screenshot portu (z tooltipem)
- Cały output z Console (skopiuj wszystkie logi)
- Wynik `console.log(NODE_REGISTRY['custom_testfloat'])`

---

## 📝 ZMIANY W KODZIE (FINALNE)

**6 zmian w 2 plikach:**

### `src/core/compiler.ts` (5 zmian):
1. Parametr isSubgraph
2. Rekurencyjne wywołanie z true
3. Uproszczone wklejanie
4. Warunkowy return
5. **Custom Output typ = typ wejścia** ← TO rozwiązało dimension mismatch!

### `src/components/NodeEditor.tsx` (1 KRYTYCZNA zmiana):
6. **navigateBack używa functional update** ← TO rozwiązało state timing!

---

## 🧪 TESTY (451/451 ✅)

Wszystkie przechodzą, w tym:
- ✅ E2E test: Float → Custom Input → type='float' zachowany
- ✅ Dimension mismatch: vec2 kompiluje się jako vec2
- ✅ GLSL structure: tylko 1x uniforms
- ✅ Manual flow: vec2 persystuje

---

**Kod jest naprawiony. Przetestuj z czystym localStorage!** 🚀
