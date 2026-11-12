/** Запуск выгрузки из интерфейса: берёт проект и поля штампа, сохраняет файл, сообщает результат */
import { очиститьИмя } from '../../electron/имя-файла.mjs';
import { useКухня } from '../store';
import { useUI } from '../store/интерфейс';
import { csv, glb, htmlЧертежа, xlsx } from './форматы';
import { сохранитьФайлы } from './сохранить';

export type ФорматВыгрузки = 'pdf' | 'xlsx' | 'csv' | 'gltf';

export async function выгрузитьВ(формат: ФорматВыгрузки): Promise<boolean> {
  const с = useКухня.getState();
  const п = с.проект2;
  const u = useUI.getState();
  const имя = очиститьИмя(п.название);
  с.занятоУстановить?.(true);
  try {
    let р: { ок: boolean; путь?: string; ошибка?: string };
    if (формат === 'pdf') р = await сохранитьФайлы.pdf(htmlЧертежа(п, { заказ: u.заказ, клиент: u.клиент, дизайнер: u.дизайнер }), имя);
    else if (формат === 'xlsx') р = await сохранитьФайлы.файл(имя, xlsx(п), 'xlsx', 'Excel');
    else if (формат === 'csv') р = await сохранитьФайлы.файл(имя, csv(п), 'csv', 'CSV');
    else р = await сохранитьФайлы.файл(имя, await glb(п), 'glb', 'glTF');
    if (р.ок) с.сообщить(`Выгружено: ${р.путь ?? имя}`);
    else if (р.ошибка !== 'отменено') с.сообщить(`Не выгружено: ${р.ошибка}`, 'ошибка');
    return р.ок;
  } catch (e) {
    с.сообщить(`Не выгружено: ${(e as Error).message}. Попробуйте ещё раз или сохраните .kitchen.`, 'ошибка');
    return false;
  } finally {
    с.занятоУстановить?.(false);
  }
}

/** Для проверок: единый доступ к выгрузке без второй копии модулей */
if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>).__верстакВыгрузка ??= выгрузитьВ;
