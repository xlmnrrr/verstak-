/**
 * Схема файла проекта (.kitchen) — контракт между приложением и тем,
 * кто пишет проект руками (в том числе Claude).
 * Задача: проверять файл и объяснять ошибку человеческим языком, а не «файл повреждён».
 */
import { z } from 'zod';
import { SCHEMA_VERSION, новый_проект, type Project } from '../types';

const Dims = z.object({
  ш: z.number().positive(),
  г: z.number().positive(),
  в: z.number().positive(),
});

const Obj = z.object({
  id: z.string().min(1),
  модуль: z.string().min(1),
  название: z.string().optional(),
  позиция: z.tuple([z.number(), z.number(), z.number()]),
  поворот: z.number(),
  наклон_X: z.number().optional(),
  наклон_Z: z.number().optional(),
  открыт: z.boolean().optional(),
  петли: z.enum(['слева', 'справа', 'сверху', 'снизу']).optional(),
  габариты: Dims,
  подъём: z.number().optional(),
  цвет: z.string().optional(),
  материал: z.string().optional(),
  ящиков: z.number().optional(),
  полок: z.number().optional(),
  цоколь: z.number().optional(),
  ножки: z.number().optional(),
  вид: z.string().optional(),
  фасад: z.string().optional(),
});

const Room = z.object({
  длина: z.number().min(500, 'длина комнаты должна быть не меньше 500 мм'),
  ширина: z.number().min(500, 'ширина комнаты должна быть не меньше 500 мм'),
  высота_стен: z.number().min(1000, 'высота стен должна быть не меньше 1000 мм'),
  толщина_стен: z.number().min(0),
  форма: z.enum(['прямоугольник', 'Г', 'П']),
  обои: z.string(),
  пол: z.string(),
  фон: z.string().optional(),
});

export const СхемаПроекта = z.object({
  schemaVersion: z.number(),
  название: z.string().min(1),
  создан: z.string(),
  изменён: z.string(),
  комната: Room,
  объекты: z.array(Obj),
  настройки: z
    .object({
      шаг_сетки: z.number().optional(),
      толщина_плиты: z.number().optional(),
      режим_обзора: z.enum(['сверху', 'прогулка']).optional(),
      тема: z.enum(['тёмная', 'светлая']).optional(),
    })
    .optional(),
});

export interface РезультатРазбора {
  ок: boolean;
  проект?: Project;
  ошибки: string[];
  предупреждения: string[];
}

/** Разобрать текст файла .kitchen в проект. Ошибки — с путём до поля. */
export function разобратьПроект(текст: string): РезультатРазбора {
  let данные: unknown;
  try {
    данные = JSON.parse(текст);
  } catch (e) {
    return { ок: false, ошибки: [`Это не JSON: ${(e as Error).message}`], предупреждения: [] };
  }

  const итог = СхемаПроекта.safeParse(данные);
  if (!итог.success) {
    const ошибки = итог.error.issues.map((i) => {
      const путь = i.path.length ? i.path.join('.') : '(корень файла)';
      return `${путь}: ${i.message}`;
    });
    return { ок: false, ошибки, предупреждения: [] };
  }

  const предупреждения: string[] = [];
  const п = итог.data as unknown as Project;

  if (п.schemaVersion > SCHEMA_VERSION) {
    предупреждения.push(
      `Файл новее приложения (schemaVersion ${п.schemaVersion} против ${SCHEMA_VERSION}). Часть полей может не читаться.`,
    );
  }

  // Мягкая миграция: неизвестные поля игнорируем, недостающие берём из шаблона
  const эталон = новый_проект(п.название, п.комната);
  const проект: Project = {
    ...эталон,
    ...п,
    schemaVersion: SCHEMA_VERSION,
    настройки: { ...эталон.настройки, ...(п.настройки ?? {}) },
    объекты: (п.объекты ?? []).map((o) => ({
      ...o,
      подъём: o.подъём ?? 0,
    })),
  };

  if (проект.объекты.length === 0) предупреждения.push('В проекте нет ни одного объекта.');

  return { ок: true, проект, ошибки: [], предупреждения };
}

export const примерПроектаJSON = (проект: Project) => JSON.stringify(проект, null, 2);
