/**
 * Хранилище. В Electron — настоящая папка «Проекты\» рядом с .exe (через preload).
 * В браузере (режим разработки) — localStorage + выгрузка/загрузка файла.
 */
import type { Project } from '../types';
import { разобратьПроект, примерПроектаJSON } from './schema';

export interface ЗаписьСписка {
  имя: string;
  изменён: string;
  размер: number;
  объектов: number;
  превью?: string;
}

interface МостКухни {
  список(): Promise<ЗаписьСписка[]>;
  сохранить(имя: string, текст: string, превью?: string): Promise<{ ок: boolean; путь?: string; ошибка?: string }>;
  открыть(имя: string): Promise<{ ок: boolean; текст?: string; ошибка?: string }>;
  удалить(имя: string): Promise<{ ок: boolean; ошибка?: string }>;
  открытьПапку(): Promise<void>;
  выбратьФайл(): Promise<{ ок: boolean; текст?: string; имя?: string; ошибка?: string }>;
  сохранитьВФайл(имя: string, текст: string): Promise<{ ок: boolean; путь?: string; ошибка?: string }>;
  путьПроектов?: () => Promise<string>;
}

declare global {
  interface Window {
    кухня?: МостКухни;
  }
}

export const естьElectron = () => typeof window !== 'undefined' && !!window.кухня;

const КЛЮЧ = 'кухня3d:проекты'; // только для режима разработки в браузере

function локальноеЧтение(): Record<string, { изменён: string; текст: string; превью?: string }> {
  try {
    return JSON.parse(localStorage.getItem(КЛЮЧ) || '{}');
  } catch {
    return {};
  }
}

function локальнаяЗапись(д: Record<string, { изменён: string; текст: string; превью?: string }>) {
  localStorage.setItem(КЛЮЧ, JSON.stringify(д));
}

export async function списокПроектов(): Promise<ЗаписьСписка[]> {
  if (естьElectron()) return window.кухня!.список();
  const д = локальноеЧтение();
  return Object.entries(д)
    .map(([имя, з]) => {
      let объектов = 0;
      try {
        объектов = (JSON.parse(з.текст).объекты ?? []).length;
      } catch {
        /* пусто */
      }
      return { имя, изменён: з.изменён, размер: з.текст.length, объектов, превью: з.превью };
    })
    .sort((a, b) => (a.изменён < b.изменён ? 1 : -1));
}

export async function сохранитьПроект(
  проект: Project,
  превью?: string,
): Promise<{ ок: boolean; путь?: string; ошибка?: string }> {
  const текст = примерПроектаJSON(проект);
  const имя = проект.название.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || 'Проект';
  if (естьElectron()) return window.кухня!.сохранить(имя, текст, превью);
  const д = локальноеЧтение();
  д[имя] = { изменён: проект.изменён, текст, превью };
  локальнаяЗапись(д);
  return { ок: true, путь: `localStorage:${имя}` };
}

export async function открытьПроект(имя: string) {
  if (естьElectron()) {
    const r = await window.кухня!.открыть(имя);
    if (!r.ок || !r.текст) return { ок: false, ошибки: [r.ошибка || 'не удалось прочитать файл'], предупреждения: [] };
    return разобратьПроект(r.текст);
  }
  const д = локальноеЧтение();
  if (!д[имя]) return { ок: false, ошибки: ['Проект не найден'], предупреждения: [] };
  return разобратьПроект(д[имя].текст);
}

export async function удалитьПроект(имя: string) {
  if (естьElectron()) return window.кухня!.удалить(имя);
  const д = локальноеЧтение();
  delete д[имя];
  локальнаяЗапись(д);
  return { ок: true };
}

/** Открыть проект из произвольного файла — то, чем пользуется Claude */
export async function открытьИзФайла() {
  if (естьElectron()) {
    const r = await window.кухня!.выбратьФайл();
    if (!r.ок || !r.текст) return { ок: false, ошибки: [r.ошибка || 'файл не выбран'], предупреждения: [] };
    return разобратьПроект(r.текст);
  }
  // браузер: стандартный диалог выбора файла
  return new Promise<ReturnType<typeof разобратьПроект>>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.kitchen,.json,application/json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve({ ок: false, ошибки: ['файл не выбран'], предупреждения: [] });
      resolve(разобратьПроект(await f.text()));
    };
    input.click();
  });
}

export async function выгрузитьВФайл(проект: Project) {
  const текст = примерПроектаJSON(проект);
  const имя = (проект.название || 'проект').replace(/[\\/:*?"<>|]/g, '_') + '.kitchen';
  if (естьElectron()) return window.кухня!.сохранитьВФайл(имя, текст);
  const blob = new Blob([текст], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = имя;
  a.click();
  URL.revokeObjectURL(a.href);
  return { ок: true, путь: имя };
}

export async function открытьПапкуПроектов() {
  if (естьElectron()) return window.кухня!.открытьПапку();
  alert('Папка проектов доступна в собранном приложении. Сейчас проекты хранятся в браузере.');
}
