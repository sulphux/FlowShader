import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveProjectFile,
  openProjectFile,
  supportsFileSystemAccess,
  type FileHandleLike,
} from '../core/fileAccess';

/**
 * "Hook na pliku": Save nadpisuje trzymany plik bez pytania,
 * Save As wybiera nowy plik, Load podpina uchwyt wczytanego pliku.
 */

interface MockWritable {
  write: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

const makeHandle = (name: string): { handle: FileHandleLike; writable: MockWritable } => {
  const writable: MockWritable = { write: vi.fn(), close: vi.fn() };
  // jsdom nie wspiera File.text() — mockujemy minimalny kształt File używany przez fileAccess
  const fileLike = { name, text: async () => '{"nodes":[],"edges":[]}' } as unknown as File;
  const handle: FileHandleLike = {
    name,
    getFile: vi.fn(async () => fileLike),
    createWritable: vi.fn(async () => writable),
  };
  return { handle, writable };
};

type FsaWindow = Window & {
  showSaveFilePicker?: ReturnType<typeof vi.fn>;
  showOpenFilePicker?: ReturnType<typeof vi.fn>;
};
const w = window as FsaWindow;

describe('fileAccess (File System Access)', () => {
  beforeEach(() => {
    delete w.showSaveFilePicker;
    delete w.showOpenFilePicker;
  });

  it('detects missing File System Access support', () => {
    expect(supportsFileSystemAccess()).toBe(false);
    w.showSaveFilePicker = vi.fn();
    expect(supportsFileSystemAccess()).toBe(true);
  });

  it('Save with an existing handle overwrites WITHOUT showing a picker', async () => {
    const { handle, writable } = makeHandle('moj_projekt.json');
    w.showSaveFilePicker = vi.fn();

    const result = await saveProjectFile('{"a":1}', handle, false, 'ignored.json');

    expect(w.showSaveFilePicker).not.toHaveBeenCalled();
    expect(writable.write).toHaveBeenCalledWith('{"a":1}');
    expect(writable.close).toHaveBeenCalled();
    expect(result).toMatchObject({ handle, fileName: 'moj_projekt.json', saved: true });
  });

  it('Save As always opens the picker and returns the NEW handle', async () => {
    const { handle: oldHandle } = makeHandle('stary.json');
    const { handle: newHandle, writable } = makeHandle('nowy.json');
    w.showSaveFilePicker = vi.fn(async () => newHandle);

    const result = await saveProjectFile('{"b":2}', oldHandle, true, 'nowy.json');

    expect(w.showSaveFilePicker).toHaveBeenCalledOnce();
    expect(writable.write).toHaveBeenCalledWith('{"b":2}');
    expect(result.handle).toBe(newHandle);
    expect(result.fileName).toBe('nowy.json');
  });

  it('first Save (no handle) opens the picker', async () => {
    const { handle } = makeHandle('pierwszy.json');
    w.showSaveFilePicker = vi.fn(async () => handle);

    const result = await saveProjectFile('{}', null, false, 'pierwszy.json');

    expect(w.showSaveFilePicker).toHaveBeenCalledOnce();
    expect(result.handle).toBe(handle);
  });

  it('cancelled picker does not write and keeps the old handle', async () => {
    const { handle: oldHandle, writable } = makeHandle('stary.json');
    w.showSaveFilePicker = vi.fn(async () => { throw new DOMException('cancel', 'AbortError'); });

    const result = await saveProjectFile('{}', oldHandle, true, 'x.json');

    expect(writable.write).not.toHaveBeenCalled();
    expect(result).toMatchObject({ handle: oldHandle, saved: false });
  });

  it('falls back to download when the API is unavailable', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const result = await saveProjectFile('{}', null, false, 'fallback.json');

    expect(click).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ handle: null, fileName: 'fallback.json', saved: true });

    click.mockRestore();
    createUrl.mockRestore();
    revokeUrl.mockRestore();
  });

  it('openProjectFile returns content + handle for future overwrites', async () => {
    const { handle } = makeHandle('wczytany.json');
    w.showOpenFilePicker = vi.fn(async () => [handle]);

    const result = await openProjectFile();

    expect(result).not.toBeNull();
    expect(result!.handle).toBe(handle);
    expect(result!.fileName).toBe('wczytany.json');
    expect(result!.content).toContain('"nodes"');
  });

  it('openProjectFile returns null when unsupported or cancelled', async () => {
    expect(await openProjectFile()).toBeNull(); // brak API

    w.showOpenFilePicker = vi.fn(async () => { throw new DOMException('cancel', 'AbortError'); });
    expect(await openProjectFile()).toBeNull(); // anulowano
  });
});
