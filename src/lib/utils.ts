/** Вспомогательные функции: единицы, снаппинг, идентификаторы */

/** Миллиметры → метры (в 3D работаем в метрах) */
export const м = (мм: number) => мм / 1000;

export const вМм = (метры: number) => Math.round(метры * 1000);

export const зажать = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

let счётчик = 0;
export const новыйИд = (префикс = 'obj') =>
  `${префикс}-${Date.now().toString(36)}-${(счётчик++).toString(36)}`;

/** Прилипание числа к шагу сетки */
export const снап = (значение: number, шаг: number) =>
  шаг > 0 ? Math.round(значение / шаг) * шаг : Math.round(значение);

export const градусыВРадианы = (г: number) => (г * Math.PI) / 180;
export const радианыВГрадусы = (р: number) => (р * 180) / Math.PI;

/** Сколько полок влезает в корпус при шаге 320 мм */
export const автоПолки = (высота: number, цоколь = 0, толщина = 16) => {
  const внутренняя = высота - цоколь - толщина * 2;
  if (внутренняя < 200) return 0;
  return Math.max(0, Math.floor(внутренняя / 320) - 1);
};

export const форматМм = (v: number) => `${Math.round(v)} мм`;
