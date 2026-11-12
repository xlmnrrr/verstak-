/**
 * Группа инстансов: один InstancedMesh на ключ «геометрия + шейдер + прозрачность».
 * Размер детали лежит в aSize (а не в матрице), цвет — в instanceColor, шероховатость/металл/кромка/фаска — в aSurf.
 * Слоты: у владельца в группе один непрерывный диапазон; выбывшие слоты получают aSize = 0 (вершины стягиваются в точку).
 */
import * as THREE from 'three';
import { геометрияГруппы, type ФормаГеометрии } from './геометрии';
import { Слоты } from './слоты';

export interface ПараметрыГруппы {
  ключ: string;
  форма: ФормаГеометрии;
  материал: THREE.Material;
  глубина: THREE.Material | null;
  /** отбрасывает тень */
  тень: boolean;
  /** принимает тень */
  принимает: boolean;
  порядок?: number;
}

export class Группа {
  readonly ключ: string;
  readonly слоты = new Слоты(256);
  mesh!: THREE.InstancedMesh;
  private геом!: THREE.BufferGeometry;
  private матрицы!: Float32Array;
  private размеры!: Float32Array;
  private цвета!: Float32Array;
  private поверхности!: Float32Array;
  private грязноОт = Infinity;
  private грязноДо = -1;
  private грязноВсё = true;
  /** сколько раз ёмкость росла (для отчёта) */
  роста = 0;

  constructor(
    private readonly п: ПараметрыГруппы,
    private readonly родитель: THREE.Object3D,
  ) {
    this.ключ = п.ключ;
    this.создать(256, null);
  }

  private создать(ёмкость: number, старая: Группа['матрицы'] | null) {
    const геом = геометрияГруппы(this.п.форма);
    const матрицы = new Float32Array(ёмкость * 16);
    const размеры = new Float32Array(ёмкость * 3);
    const цвета = new Float32Array(ёмкость * 3);
    const поверхности = new Float32Array(ёмкость * 4);
    if (старая) {
      матрицы.set(this.матрицы);
      размеры.set(this.размеры);
      цвета.set(this.цвета);
      поверхности.set(this.поверхности);
    }
    this.матрицы = матрицы;
    this.размеры = размеры;
    this.цвета = цвета;
    this.поверхности = поверхности;

    const а = (массив: Float32Array, n: number) => {
      const x = new THREE.InstancedBufferAttribute(массив, n);
      x.setUsage(THREE.DynamicDrawUsage);
      return x;
    };
    геом.setAttribute('aSize', а(размеры, 3));
    геом.setAttribute('aSurf', а(поверхности, 4));

    const m = new THREE.InstancedMesh(геом, this.п.материал, ёмкость);
    m.instanceMatrix = а(матрицы, 16);
    m.instanceColor = а(цвета, 3);
    m.castShadow = this.п.тень;
    m.receiveShadow = this.п.принимает;
    if (this.п.глубина) m.customDepthMaterial = this.п.глубина as THREE.MeshDepthMaterial;
    // three считает сферу по матрицам без aSize и обрезал бы видимое; луч three не знает про aSize
    m.frustumCulled = false;
    m.raycast = () => {};
    m.renderOrder = this.п.порядок ?? 0;
    m.name = `группа:${this.п.ключ}`;
    m.count = this.слоты.верх;

    const прежний = this.mesh;
    const прежняяГеом = this.геом;
    this.mesh = m;
    this.геом = геом;
    this.родитель.add(m);
    if (прежний) {
      this.родитель.remove(прежний);
      прежняяГеом.dispose();
    }
    this.грязноВсё = true;
  }

  private расти() {
    const было = this.матрицы;
    this.слоты.ёмкость *= 2;
    this.создать(this.слоты.ёмкость, было);
    this.роста++;
  }

  выделить(n: number): number {
    for (;;) {
      const с = this.слоты.выделить(n);
      if (с >= 0) return с;
      this.расти();
    }
  }

  /** Включить/выключить отбрасывание тени (стены отбрасывают тень только при свете по времени суток) */
  установитьТень(в: boolean) {
    (this.п as { тень: boolean }).тень = в;
    this.mesh.castShadow = в;
  }

  освободить(начало: number, n: number) {
    this.размеры.fill(0, начало * 3, (начало + n) * 3);
    this.пометить(начало, n);
    this.слоты.освободить(начало, n);
  }

  /** Записать один слот: матрица 16 чисел (по столбцам), размер, цвет, поверхность */
  записать(слот: number, m: ArrayLike<number>, размер: ArrayLike<number>, цвет: ArrayLike<number>, поверх: ArrayLike<number>) {
    const a = слот * 16;
    for (let i = 0; i < 16; i++) this.матрицы[a + i] = m[i];
    this.размеры[слот * 3] = размер[0];
    this.размеры[слот * 3 + 1] = размер[1];
    this.размеры[слот * 3 + 2] = размер[2];
    this.цвета[слот * 3] = цвет[0];
    this.цвета[слот * 3 + 1] = цвет[1];
    this.цвета[слот * 3 + 2] = цвет[2];
    this.поверхности[слот * 4] = поверх[0];
    this.поверхности[слот * 4 + 1] = поверх[1];
    this.поверхности[слот * 4 + 2] = поверх[2];
    this.поверхности[слот * 4 + 3] = поверх[3];
  }

  /** Обновить только цвет и поверхность диапазона (смена материала) */
  пометить(начало: number, n: number) {
    if (n <= 0) return;
    this.грязноОт = Math.min(this.грязноОт, начало);
    this.грязноДо = Math.max(this.грязноДо, начало + n);
  }

  /** Сбросить все слоты (уплотнение перепаковывает группу целиком) */
  сбросить() {
    this.размеры.fill(0);
    this.слоты.сбросить();
    this.грязноВсё = true;
  }

  /** Передать изменения в атрибуты: только изменённый отрезок, либо всё после роста */
  применить() {
    const m = this.mesh;
    m.count = this.слоты.верх;
    m.visible = this.слоты.верх > 0;
    const все = [m.instanceMatrix, m.instanceColor!, this.геом.getAttribute('aSize'), this.геом.getAttribute('aSurf')] as THREE.BufferAttribute[];
    if (this.грязноВсё) {
      for (const x of все) {
        x.clearUpdateRanges();
        x.needsUpdate = true;
      }
    } else if (this.грязноДо > this.грязноОт) {
      const от = this.грязноОт;
      const чис = this.грязноДо - this.грязноОт;
      for (const x of все) {
        x.clearUpdateRanges();
        x.addUpdateRange(от * x.itemSize, чис * x.itemSize);
        x.needsUpdate = true;
      }
    }
    this.грязноВсё = false;
    this.грязноОт = Infinity;
    this.грязноДо = -1;
  }

  /** Сколько слотов сейчас занято */
  get занято() {
    return this.слоты.занято;
  }

  освободитьВсё() {
    this.родитель.remove(this.mesh);
    this.геом.dispose();
  }
}
