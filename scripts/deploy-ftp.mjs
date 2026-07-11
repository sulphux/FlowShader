/**
 * Buduje projekt i wgrywa zawartość dist/ na hosting po FTP.
 *
 * Dane logowania NIGDY nie są hardcodowane ani commitowane — czyta je
 * z lokalnego pliku .env.deploy (patrz .env.deploy.example), który jest
 * w .gitignore.
 *
 * Użycie:
 *   1. cp .env.deploy.example .env.deploy
 *   2. wypełnij .env.deploy swoimi danymi FTP
 *   3. npm run deploy        (buduje + wgrywa)
 *      npm run deploy:only   (wgrywa bez ponownego builda, jeśli dist/ już aktualny)
 */
import { Client } from 'basic-ftp';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = join(ROOT, 'dist');
const ENV_FILE = join(ROOT, '.env.deploy');

/** Minimalny parser .env — bez zależności od dodatkowego pakietu. */
function loadEnvFile(path) {
  if (!existsSync(path)) {
    console.error(`Brak pliku ${path}\n`);
    console.error('Utwórz go na podstawie .env.deploy.example i uzupełnij dane FTP.');
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnvFile(ENV_FILE);

const required = ['FTP_HOST', 'FTP_USER', 'FTP_PASSWORD'];
const missing = required.filter(k => !env[k]);
if (missing.length > 0) {
  console.error(`Brak wymaganych zmiennych w .env.deploy: ${missing.join(', ')}`);
  process.exit(1);
}

if (!existsSync(DIST_DIR)) {
  console.error('Brak folderu dist/ — uruchom najpierw `npm run build` (albo `npm run deploy`, który robi to automatycznie).');
  process.exit(1);
}

const remoteDir = env.FTP_REMOTE_DIR || '/public_html';
const secure = env.FTP_SECURE === 'true'; // FTPS, jeśli hosting wspiera i tego wymaga
const port = env.FTP_PORT ? Number(env.FTP_PORT) : undefined;

const client = new Client();
client.ftp.verbose = false;

const main = async () => {
  console.log(`Łączenie z ${env.FTP_HOST}${port ? ':' + port : ''}...`);
  await client.access({
    host: env.FTP_HOST,
    port,
    user: env.FTP_USER,
    password: env.FTP_PASSWORD,
    secure,
  });

  console.log(`Katalog docelowy: ${remoteDir}`);
  await client.ensureDir(remoteDir);

  console.log(`Wgrywanie zawartości ${DIST_DIR} → ${remoteDir} ...`);
  // uploadFromDir nadpisuje pliki o tych samych nazwach i tworzy nowe;
  // nie usuwa plików, których nie ma lokalnie (bezpieczne, nie kasuje nic na serwerze)
  await client.uploadFromDir(DIST_DIR, remoteDir);

  console.log('\n✓ Wdrożono pomyślnie.');
};

main()
  .catch(err => {
    console.error('\n✗ Wdrożenie nie powiodło się:', err.message);
    process.exitCode = 1;
  })
  .finally(() => client.close());
