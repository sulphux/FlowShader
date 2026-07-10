/**
 * Zapis/odczyt projektu z prawdziwym "uchwytem" na plik (File System Access API).
 *
 * - Save: nadpisuje plik pod trzymanym uchwytem (bez okienka),
 * - Save As / pierwszy zapis: picker wyboru pliku, uchwyt zostaje na później,
 * - Load: picker otwarcia — uchwyt zostaje, więc kolejne Save nadpisuje TEN plik.
 *
 * Fallback (Firefox/Safari): klasyczny download i <input type="file">.
 */

// Minimalne typy File System Access API (brak w lib.dom TS)
export interface FileHandleLike {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}

interface FilePickerOptions {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}

interface FsAccessWindow {
  showSaveFilePicker?: (options?: FilePickerOptions) => Promise<FileHandleLike>;
  showOpenFilePicker?: (options?: FilePickerOptions & { multiple?: boolean }) => Promise<FileHandleLike[]>;
}

const JSON_FILE_TYPES = [{
  description: 'Shader graph JSON',
  accept: { 'application/json': ['.json'] as string[] },
}];

const fsWindow = (): FsAccessWindow => window as unknown as FsAccessWindow;

export const supportsFileSystemAccess = (): boolean =>
  typeof window !== 'undefined' && typeof fsWindow().showSaveFilePicker === 'function';

export interface SaveResult {
  /** Uchwyt do ponownego zapisu (null w trybie fallback-download). */
  handle: FileHandleLike | null;
  /** Nazwa pliku (do wyświetlenia w toolbarze). */
  fileName: string;
  /** Czy zapis się odbył (false np. gdy użytkownik anulował picker). */
  saved: boolean;
}

/**
 * Zapisuje JSON projektu.
 * @param json  treść pliku
 * @param handle  istniejący uchwyt (Save nadpisuje bez pytania) lub null
 * @param saveAs  wymusza wybór nowego pliku
 * @param suggestedName  proponowana nazwa przy pickerze/downloadzie
 */
export async function saveProjectFile(
  json: string,
  handle: FileHandleLike | null,
  saveAs: boolean,
  suggestedName: string,
): Promise<SaveResult> {
  const w = fsWindow();

  if (!supportsFileSystemAccess()) {
    // Fallback: klasyczny download (przeglądarka sama dopisze (1), (2)...)
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    return { handle: null, fileName: suggestedName, saved: true };
  }

  let targetHandle = handle;
  if (saveAs || !targetHandle) {
    try {
      targetHandle = await w.showSaveFilePicker!({ suggestedName, types: JSON_FILE_TYPES });
    } catch {
      // Użytkownik anulował picker
      return { handle, fileName: handle?.name ?? suggestedName, saved: false };
    }
  }

  const writable = await targetHandle.createWritable();
  await writable.write(json);
  await writable.close();
  return { handle: targetHandle, fileName: targetHandle.name, saved: true };
}

export interface OpenResult {
  handle: FileHandleLike | null;
  fileName: string;
  content: string;
}

/**
 * Otwiera plik projektu przez picker (gdy FSA dostępne).
 * Zwraca null, gdy użytkownik anulował albo API niedostępne
 * (wtedy wołający używa klasycznego <input type="file">).
 */
export async function openProjectFile(): Promise<OpenResult | null> {
  const w = fsWindow();
  if (typeof w.showOpenFilePicker !== 'function') return null;

  try {
    const [handle] = await w.showOpenFilePicker({ types: JSON_FILE_TYPES, multiple: false });
    const file = await handle.getFile();
    const content = await file.text();
    return { handle, fileName: file.name, content };
  } catch {
    // Anulowano
    return null;
  }
}
