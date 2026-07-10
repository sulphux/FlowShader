/**
 * Generuje zrzuty ekranu do dokumentacji (docs/img/*.png).
 *
 * Wymaga działającego dev servera (npm run dev -- --port 5199) i Chrome/Edge.
 * Uruchomienie: node scripts/docs-screenshots.mjs
 *
 * Sceny są wstrzykiwane przez localStorage (format serializeGraph) i zrzucane
 * headlessowo — wbudowany screenshot podglądu nie radzi sobie z pętlą WebGL.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'docs', 'img');
const URL = process.env.DOCS_URL || 'http://localhost:5199';

const CHROME_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = CHROME_PATHS.find(p => existsSync(p));
if (!executablePath) {
  console.error('Nie znaleziono Chrome/Edge');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// --- Budowanie grafów (format zapisu: definition = { id } + opcjonalne porty) ---

const node = (id, defId, x, y, extra = {}) => ({
  id,
  type: defId === 'preview' ? 'previewNode'
      : defId === 'monitor' ? 'monitorNode'
      : defId === 'color_preview' ? 'colorPreviewNode'
      : 'shaderNode',
  position: { x, y },
  data: { definition: { id: defId }, ...extra },
});

const edge = (source, sourceHandle, target, targetHandle) => ({
  id: `e_${source}_${sourceHandle}_${target}_${targetHandle}`,
  source, sourceHandle, target, targetHandle,
  type: 'default', interactionWidth: 25,
  style: { stroke: '#a0a0a0', strokeWidth: 3 },
});

/** Scena 1: hero — animowane pierścienie (uv → length → +time → palette → output). */
const heroGraph = {
  nodes: [
    node('uv1', 'uv', 40, 200),
    node('len1', 'vec_length', 200, 200),
    node('time1', 'time', 40, 320),
    node('add1', 'math_add', 360, 250),
    node('pal1', 'palette', 480, 220),
    node('out1', 'output', 700, 230),
    node('prev1', 'preview', 480, 380, { label: 'Preview' }),
  ],
  edges: [
    edge('uv1', 'out', 'len1', 'in'),
    edge('len1', 'out', 'add1', 'a'),
    edge('time1', 't', 'add1', 'b'),
    edge('add1', 'out', 'pal1', 't'),
    edge('pal1', 'color', 'out1', 'color'),
    edge('pal1', 'color', 'prev1', 'in'),
  ],
  viewport: { x: 40, y: -40, zoom: 1.0 },
};

/** Scena 2: przegląd nodów — code, mono, monitor, slim split/combine, color preview. */
const nodesGraph = {
  nodes: [
    node('time1', 'time', 40, 80),
    node('code1', 'code_glsl', 220, 40, {
      label: 'Moje RGB',
      value: 'vec3(sin(a * 2.0) * 0.5 + 0.5, cos(a) * 0.5 + 0.5, 0.8)',
      definition: { id: 'code_glsl',
        inputs: [
          { id: 'a', label: 'A', type: 'float' },
          { id: 'b', label: 'B', type: 'float' },
          { id: 'c', label: 'C', type: 'float' },
          { id: 'd', label: 'D', type: 'float' },
        ],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
      },
    }),
    node('colparam1', 'param_color', 300, 470, { value: '#ff007a', label: 'Kolor' }),
    node('cprev1', 'color_preview', 520, 60),
    node('param1', 'param_float', 40, 300, { value: 0.35, label: 'Jasność' }),
    node('mono1', 'mono', 260, 320),
    node('split1', 'split_vec3', 400, 300),
    node('comb1', 'combine_vec4', 500, 290),
    node('mon1', 'monitor', 620, 250, { label: 'Value Watcher' }),
    node('out1', 'output', 620, 500),
  ],
  edges: [
    edge('time1', 't', 'code1', 'a'),
    edge('colparam1', 'rgb', 'cprev1', 'in'),
    edge('code1', 'out', 'out1', 'color'),
    edge('param1', 'out', 'mono1', 'in'),
    edge('mono1', 'out', 'split1', 'in'),
    edge('split1', 'x', 'comb1', 'x'),
    edge('split1', 'y', 'comb1', 'y'),
    edge('split1', 'z', 'comb1', 'z'),
    edge('comb1', 'out', 'mon1', 'in'),
  ],
  viewport: { x: 60, y: 40, zoom: 1.0 },
};

/** Scena 3: media — tekstura (gradient generowany w locie) + audio. */
const mediaGraphTemplate = (textureDataUrl) => ({
  nodes: [
    node('tex1', 'texture_2d', 80, 120, { value: textureDataUrl, label: 'moja_tekstura.png' }),
    node('audio1', 'audio_input', 80, 380, { label: 'utwor.mp3' }),
    node('out1', 'output', 420, 160),
  ],
  edges: [
    edge('tex1', 'rgb', 'out1', 'color'),
  ],
  viewport: { x: 120, y: 20, zoom: 1.15 },
});

// --- Sterowanie przeglądarką ---

const setGraphAndReload = async (page, graph) => {
  await page.evaluate((json) => {
    localStorage.setItem('shader-nodes-save-v1', json);
  }, JSON.stringify(graph));
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2500); // kompilacja + pierwsze klatki shaderów
};

const shoot = async (page, name) => {
  const path = join(OUT_DIR, name);
  await page.screenshot({ path, type: 'png' });
  console.log('✓', name);
};

const main = async () => {
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1600,950'],
    defaultViewport: { width: 1600, height: 950 },
  });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle2' });

  // Scena 1: hero
  await setGraphAndReload(page, heroGraph);
  await shoot(page, '01-editor.png');

  // Scena 1b: menu szybkiego dodawania (prawy przycisk na kanwie)
  await page.mouse.click(700, 620, { button: 'right' });
  await sleep(400);
  // najedź na kategorię, żeby otworzyć podmenu
  const catBox = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find(d => d.textContent === 'Math (Trig/Func)' && d.parentElement?.style?.position !== '');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (catBox) {
    await page.mouse.move(catBox.x, catBox.y);
    await sleep(400);
  }
  await shoot(page, '02-quick-add.png');
  await page.keyboard.press('Escape');
  await page.mouse.click(400, 850); // zamknij menu

  // Scena 2: przegląd nodów (schowaj główny podgląd, żeby było więcej miejsca)
  await setGraphAndReload(page, nodesGraph);
  const hideBtn = await page.$('button[title="Hide Preview"]');
  if (hideBtn) { await hideBtn.click(); await sleep(600); }
  await shoot(page, '03-nodes.png');

  // Scena 3: media (tekstura generowana w przeglądarce)
  const textureDataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 128, 128);
    grad.addColorStop(0, '#ff007a');
    grad.addColorStop(0.5, '#7a00ff');
    grad.addColorStop(1, '#00c8ff');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 8; i++) g.fillRect(i * 16, 0, 8, 128);
    return c.toDataURL('image/png');
  });
  await setGraphAndReload(page, mediaGraphTemplate(textureDataUrl));
  await shoot(page, '04-media.png');

  // Scena 4: global settings
  await setGraphAndReload(page, heroGraph);
  await page.evaluate(() => {
    const gear = [...document.querySelectorAll('button')].find(b => (b.getAttribute('title') || '').includes('Global Settings'));
    gear?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await sleep(500);
  await shoot(page, '05-settings.png');
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const close = [...document.querySelectorAll('button')].find(b => b.getAttribute('title') === 'Close');
    close?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await sleep(300);

  // Scena 5: panel projektów (chmura/lokalnie)
  await page.evaluate(() => {
    const cloud = [...document.querySelectorAll('button')].find(b => (b.getAttribute('title') || '').includes('chmurze'));
    cloud?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await sleep(1200);
  await shoot(page, '06-cloud.png');

  await browser.close();
  console.log('Gotowe →', OUT_DIR);
};

main().catch(err => { console.error(err); process.exit(1); });
