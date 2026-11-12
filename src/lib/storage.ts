/**
 * Хранилище. В Electron — настоящая папка «Проекты\» рядом с .exe (через preload).
 * В браузере (режим разработки) — localStorage + выгрузка/загрузка файла.
 * Формат файла — v2; файлы v1 читаются через миграцию (src/model/файл.ts).
 */
import { очиститьИмя } from '../../electron/имя-файла.mjs';
import { разобратьФайл, записатьПроект, type РезультатОткрытия } from '../model/файл';
import type { ПроектV2 } from '../model/типы';

export interface ЗаписьСписка {
  имя: string;
  изменён: string;
  размер: number;
  объектов: number;
  превью?: string;
}

export interface Автосохранение {
  имя: string;
  изменён: string;
  /** новее основного файла проекта (или основного файла нет) */
  новее: boolean;
}

interface МостКухни {
  список(): Promise<ЗаписьСписка[]>;
  сохранить(имя: string, текст: string, превью?: string): Promise<{ ок: boolean; путь?: string; имя?: string; ошибка?: string }>;
  открыть(имя: string): Promise<{ ок: boolean; текст?: string; ошибка?: string }>;
  удалить(имя: string): Promise<{ ок: boolean; ошибка?: string }>;
  открытьПапку(): Promise<void>;
  выбратьФайл(): Promise<{ ок: boolean; текст?: string; имя?: string; ошибка?: string }>;
  сохранитьВФайл(имя: string, текст: string): Promise<{ ок: boolean; путь?: string; ошибка?: string }>;
  путьПроектов?: () => Promise<string>;
  превью?: (имя: string, картинка: string) => Promise<{ ок: boolean }>;
  авто: {
    записать(имя: string, текст: string): Promise<{ ок: boolean; ошибка?: string }>;
    найти(): Promise<Автосохранение[]>;
    прочитать(имя: string): Promise<{ ок: boolean; текст?: string; ошибка?: string }>;
    удалить(имя: string): Promise<{ ок: boolean }>;
    интервал(): Promise<number>;
  };
}

declare global {
  interface Window {
    кухня?: МостКухни;
  }
}

export const естьElectron = () => typeof window !== 'undefined' && !!window.кухня;

const КЛЮЧ = 'кухня3d:проекты'; // только для режима разработки в браузере
const КЛЮЧ_АВТО = 'кухня3d:автосохранение';

type Запись = Record<string, { изменён: string; текст: string; превью?: string }>;

function локальноеЧтение(ключ = КЛЮЧ): Запись {
  try {
    return JSON.parse(localStorage.getItem(ключ) || '{}');
  } catch {
    return {};
  }
}

function локальнаяЗапись(д: Запись, ключ = КЛЮЧ) {
  localStorage.setItem(ключ, JSON.stringify(д));
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
  проект: ПроектV2,
  превью?: string,
): Promise<{ ок: boolean; путь?: string; имя?: string; ошибка?: string }> {
  const текст = записатьПроект(проект);
  const имя = очиститьИмя(проект.название);
  if (естьElectron()) return window.кухня!.сохранить(имя, текст, превью);
  const д = локальноеЧтение();
  д[имя] = { изменён: проект.изменён, текст, превью };
  локальнаяЗапись(д);
  return { ок: true, путь: `localStorage:${имя}`, имя };
}

export async function открытьПроект(имя: string): Promise<РезультатОткрытия> {
  if (естьElectron()) {
    const r = await window.кухня!.открыть(имя);
    if (!r.ок || !r.текст) return { ок: false, ошибки: [r.ошибка || 'не удалось прочитать файл'], предупреждения: [] };
    return разобратьФайл(r.текст);
  }
  const д = локальноеЧтение();
  if (!д[имя]) return { ок: false, ошибки: ['Проект не найден'], предупреждения: [] };
  return разобратьФайл(д[имя].текст);
}

export async function удалитьПроект(имя: string) {
  if (естьElectron()) return window.кухня!.удалить(имя);
  const д = локальноеЧтение();
  delete д[имя];
  локальнаяЗапись(д);
  return { ок: true };
}

/** Открыть проект из произвольного файла — то, чем пользуется Claude */
export async function открытьИзФайла(): Promise<РезультатОткрытия> {
  if (естьElectron()) {
    const r = await window.кухня!.выбратьФайл();
    if (!r.ок || !r.текст) return { ок: false, ошибки: [r.ошибка || 'файл не выбран'], предупреждения: [] };
    return разобратьФайл(r.текст);
  }
  // браузер: стандартный диалог выбора файла
  return new Promise<РезультатОткрытия>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.kitchen,.json,application/json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve({ ок: false, ошибки: ['файл не выбран'], предупреждения: [] });
      resolve(разобратьФайл(await f.text()));
    };
    input.click();
  });
}

export async function выгрузитьВФайл(проект: ПроектV2) {
  const текст = записатьПроект(проект);
  const имя = очиститьИмя(проект.название, 'проект') + '.kitchen';
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

/* ------------------------------------------------------------------ автосохранение */

export async function записатьАвтосохранение(проект: ПроектV2): Promise<{ ок: boolean; ошибка?: string }> {
  const имя = очиститьИмя(проект.название);
  const текст = записатьПроект(проект);
  if (естьElectron()) return window.кухня!.авто.записать(имя, текст);
  try {
    const д = локальноеЧтение(КЛЮЧ_АВТО);
    д[имя] = { изменён: new Date().toISOString(), текст };
    локальнаяЗапись(д, КЛЮЧ_АВТО);
    return { ок: true };
  } catch (e) {
    return { ок: false, ошибка: (e as Error).message };
  }
}

export async function найтиАвтосохранения(): Promise<Автосохранение[]> {
  if (естьElectron()) return window.кухня!.авто.найти();
  const авто = локальноеЧтение(КЛЮЧ_АВТО);
  const основные = локальноеЧтение();
  return Object.entries(авто).map(([имя, з]) => ({
    имя,
    изменён: з.изменён,
    новее: !основные[имя] || основные[имя].изменён < з.изменён,
  }));
}

export async function прочитатьАвтосохранение(имя: string): Promise<РезультатОткрытия> {
  if (естьElectron()) {
    const r = await window.кухня!.авто.прочитать(имя);
    if (!r.ок || !r.текст) return { ок: false, ошибки: [r.ошибка || 'не удалось прочитать автосохранение'], предупреждения: [] };
    return разобратьФайл(r.текст);
  }
  const з = локальноеЧтение(КЛЮЧ_АВТО)[имя];
  return з ? разобратьФайл(з.текст) : { ок: false, ошибки: ['Автосохранение не найдено'], предупреждения: [] };
}

/** Удалить автосохранение проекта (после ручного сохранения или отказа от восстановления) */
export async function удалитьАвтосохранение(названиеПроекта: string): Promise<void> {
  const имя = очиститьИмя(названиеПроекта);
  if (естьElectron()) {
    await window.кухня!.авто.удалить(имя);
    return;
  }
  const д = локальноеЧтение(КЛЮЧ_АВТО);
  delete д[имя];
  локальнаяЗапись(д, КЛЮЧ_АВТО);
}

/** Интервал автосохранения в секундах (60; в Electron можно сократить переменной для проверки) */
export async function интервалАвтосохранения(): Promise<number> {
  if (естьElectron()) return window.кухня!.авто.интервал();
  return 60;
}

/** Тихо обновить превью сохранённого проекта (при автосохранении) */
export async function обновитьПревью(название: string, картинка: string | undefined): Promise<void> {
  if (!картинка || !естьElectron()) return;
  await window.кухня!.превью?.(очиститьИмя(название), картинка);
}
