/**
 * Группа частей моделей (docs/модели.md §2): один InstancedMesh на ключ «геометрия + класс материала».
 * Геометрия уже в метрах нужного размера, поэтому матрица инстанса — только поворот и сдвиг; цвет инстанса — оттенок класса.
 * Слоты и обновление диапазонов — как у групп плит (`группы.ts`): у владельца один непрерывный диапазон,
 * освобождённый слот получает нулевую матрицу (вершины стягиваются в точку).
 */
import * as THREE from 'three';
import { Слоты } from './слоты';
import { геометрияМодели } from './модели/геометрии-моделей';
import { материалКласса, теньКласса, type КлассМодели } from './модели/материалы-моделей';

export class ГруппаМодели {
  readonly ключ: string;
  readonly слоты = new Слоты(64);
  mesh!: THREE.InstancedMesh;
  private матрицы!: Float32Array;
  private цвета!: Float32Array;
  private грязноОт = Infinity;
  private грязноДо = -1;
  private грязноВсё = true;
  private тень: boolean;
  readonly геом: string;
  readonly класс: КлассМодели;

  constructor(
    ключ: string,
    private readonly родитель: THREE.Object3D,
    фото: boolean,
  ) {
    this.ключ = ключ;
    const [, геом, класс] = ключ.split('|');
    this.геом = геом;
    this.класс = класс as КлассМодели;
    const т = теньКласса(this.класс);
    this.тень = т === 'всегда' || (т === 'фото' && фото);
    this.создать(64, false);
  }

  private создать(ёмкость: number, сохранить: boolean) {
    const матрицы = new Float32Array(ёмкость * 16);
    const цвета = new Float32Array(ёмкость * 3).fill(1);
    if (сохранить) {
      матрицы.set(this.матрицы);
      цвета.set(this.цвета);
    }
    this.матрицы = матрицы;
    this.цвета = цвета;
    const m = new THREE.InstancedMesh(геометрияМодели(this.геом), материалКласса(this.класс), ёмкость);
    m.instanceMatrix = new THREE.InstancedBufferAttribute(матрицы, 16);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(цвета, 3);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = this.тень;
    m.receiveShadow = true;
    // как у плит: сфера по матрицам без учёта размера ненадёжна, а модели почти всегда в кадре
    m.frustumCulled = false;
    m.raycast = () => {};
    m.name = `группа:${this.ключ}`;
    m.count = this.слоты.верх;
    // прозрачное стекло — после непрозрачного
    if ((m.material as THREE.Material).transparent) m.renderOrder = 2;
    const прежний = this.mesh;
    this.mesh = m;
    this.родитель.add(m);
    if (прежний) this.родитель.remove(прежний);
    this.грязноВсё = true;
  }

  выделить(n: number): number {
    for (;;) {
      const с = this.слоты.выделить(n);
      if (с >= 0) return с;
      this.слоты.ёмкость *= 2;
      this.создать(this.слоты.ёмкость, true);
    }
  }

  освободить(начало: number, n: number) {
    this.матрицы.fill(0, начало * 16, (начало + n) * 16);
    this.пометить(начало, n);
    this.слоты.освободить(начало, n);
  }

  /** Сигнатура как у групп плит: размер и поверхность не нужны (геометрия своего размера, материал — класса) */
  записать(слот: number, m: ArrayLike<number>, _размер: ArrayLike<number>, цвет: ArrayLike<number>) {
    const a = слот * 16;
    for (let i = 0; i < 16; i++) this.матрицы[a + i] = m[i];
    this.цвета[слот * 3] = цвет[0];
    this.цвета[слот * 3 + 1] = цвет[1];
    this.цвета[слот * 3 + 2] = цвет[2];
  }

  пометить(начало: number, n: number) {
    if (n <= 0) return;
    this.грязноОт = Math.min(this.грязноОт, начало);
    this.грязноДо = Math.max(this.грязноДо, начало + n);
  }

  сбросить() {
    this.матрицы.fill(0);
    this.слоты.сбросить();
    this.грязноВсё = true;
  }

  применить() {
    const m = this.mesh;
    m.count = this.слоты.верх;
    m.visible = this.слоты.верх > 0;
    const все = [m.instanceMatrix, m.instanceColor!] as THREE.BufferAttribute[];
    if (this.грязноВсё) {
      for (const x of все) {
        x.clearUpdateRanges();
        x.needsUpdate = true;
      }
    } else if (this.грязноДо > this.грязноОт) {
      for (const x of все) {
        x.clearUpdateRanges();
        x.addUpdateRange(this.грязноОт * x.itemSize, (this.грязноДо - this.грязноОт) * x.itemSize);
        x.needsUpdate = true;
      }
    }
    this.грязноВсё = false;
    this.грязноОт = Infinity;
    this.грязноДо = -1;
  }

  /** «Фото» включает тени мелких моделей, остальные профили — выключают */
  установитьФото(фото: boolean) {
    const т = теньКласса(this.класс);
    this.тень = т === 'всегда' || (т === 'фото' && фото);
    this.mesh.castShadow = this.тень;
  }

  установитьТень(в: boolean) {
    this.mesh.castShadow = в && this.тень;
  }

  get занято() {
    return this.слоты.занято;
  }

  освободитьВсё() {
    this.родитель.remove(this.mesh);
  }
}
