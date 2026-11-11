/**
 * Настоящая фаска вблизи. Фаска радиуса r на расстоянии d занимает px = r·H / (2·d·tg(fov/2)); видимой считаем от 1,5 px.
 * Решение — по экземпляру: расстояние до ближайшей точки его габарита меньше d_вкл (r = 2 мм) → плиты уходят в группу
 * «плита-фаска». Выключение при 1,2·d_вкл (гистерезис). Не больше N ближайших изделий (зависит от профиля).
 * Проверка — когда камера сдвинулась больше чем на 0,25 м или повернулась больше чем на 5°, не чаще раза в 100 мс.
 */
import * as THREE from 'three';

export const ВИДИМАЯ_ФАСКА_ПИКС = 1.5;
export const РАДИУС_ФАСКИ_М = 0.002;

/** Расстояние включения (м) для высоты холста в пикселях */
export function расстояниеВключения(высотаПикс: number, fovГрад: number): number {
  return (РАДИУС_ФАСКИ_М * высотаПикс) / (2 * Math.tan((fovГрад * Math.PI) / 360) * ВИДИМАЯ_ФАСКА_ПИКС);
}

export class ВыборФаски {
  private позиция = new THREE.Vector3(Infinity, 0, 0);
  private взгляд = new THREE.Vector3(0, 0, -1);
  private время = -Infinity;
  private текущие = new Set<string>();
  private _в = new THREE.Vector3();

  constructor(
    private readonly камера: THREE.PerspectiveCamera,
    private readonly расстояниеДо: (id: string, p: [number, number, number]) => number,
    private readonly идыВсех: () => string[],
  ) {}

  /** Нужна ли проверка: камера заметно сдвинулась или повернулась */
  нужна(сейчас: number): boolean {
    if (сейчас - this.время < 100) return false;
    this.камера.getWorldDirection(this._в);
    const сдвиг = this.позиция.distanceTo(this.камера.position);
    const угол = Math.acos(Math.max(-1, Math.min(1, this._в.dot(this.взгляд)))) * (180 / Math.PI);
    return сдвиг > 0.25 || угол > 5 || !isFinite(this.позиция.x);
  }

  /**
   * Пересчитать набор. Возвращает новый набор, если он изменился, иначе null.
   * `высотаПикс` — высота буфера кадра (с учётом dpr), `лимит` — N из профиля.
   */
  обновить(сейчас: number, высотаПикс: number, лимит: number): Set<string> | null {
    this.время = сейчас;
    this.позиция.copy(this.камера.position);
    this.камера.getWorldDirection(this.взгляд);
    const p: [number, number, number] = [this.камера.position.x, this.камера.position.y, this.камера.position.z];
    const вкл = расстояниеВключения(высотаПикс, this.камера.fov);
    const кандидаты: { id: string; d: number }[] = [];
    if (лимит > 0) {
      for (const id of this.идыВсех()) {
        const d = this.расстояниеДо(id, p);
        const порог = this.текущие.has(id) ? вкл * 1.2 : вкл;
        if (d < порог) кандидаты.push({ id, d });
      }
    }
    кандидаты.sort((a, b) => a.d - b.d);
    const новые = new Set(кандидаты.slice(0, лимит).map((x) => x.id));
    const то_же = новые.size === this.текущие.size && [...новые].every((id) => this.текущие.has(id));
    if (то_же) return null;
    this.текущие = новые;
    return новые;
  }

  /** Сбросить (новый проект) */
  сброс() {
    this.текущие = new Set();
    this.позиция.set(Infinity, 0, 0);
  }
}
