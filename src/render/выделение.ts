/**
 * Контуры: латунный у выделенных, красный у тех, что «не влезают». Каждый — один LineSegments (1 draw call)
 * из рёбер габаритного параллелепипеда всех экземпляров.
 */
import * as THREE from 'three';
import type { ЦельВыбора } from './выбор';
import type { В3 } from './жесты-математика';

/** Коробка в осях изделия: центр относительно позиции (низ, центр), полуразмеры — метры */
export interface Коробка {
  позиция: В3;
  cos: number;
  sin: number;
  центр: В3;
  полу: В3;
}

/** Охватывающая коробка тех деталей цели, чья подвижная группа входит в `группы` (метры); нет таких — null */
export function коробкаГрупп(ц: ЦельВыбора, группы: Set<string>): Коробка | null {
  if (!ц.группы) return null;
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity,
    z0 = Infinity,
    z1 = -Infinity;
  const б = ц.боксы;
  for (let i = 0; i < ц.группы.length; i++) {
    const г = ц.группы[i];
    if (!г || !группы.has(г)) continue;
    x0 = Math.min(x0, б[i * 6] - б[i * 6 + 3]);
    x1 = Math.max(x1, б[i * 6] + б[i * 6 + 3]);
    y0 = Math.min(y0, б[i * 6 + 1] - б[i * 6 + 4]);
    y1 = Math.max(y1, б[i * 6 + 1] + б[i * 6 + 4]);
    z0 = Math.min(z0, б[i * 6 + 2] - б[i * 6 + 5]);
    z1 = Math.max(z1, б[i * 6 + 2] + б[i * 6 + 5]);
  }
  if (x0 === Infinity) return null;
  return { позиция: ц.позиция, cos: ц.cos, sin: ц.sin, центр: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], полу: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2] };
}

const РЁБРА: [number, number][] = [
  [0, 1],
  [1, 3],
  [3, 2],
  [2, 0],
  [4, 5],
  [5, 7],
  [7, 6],
  [6, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

export class Контур {
  readonly линии: THREE.LineSegments;
  private ёмкость = 16;

  constructor(
    родитель: THREE.Object3D,
    цвет: string,
    непрозрачность: number,
    порядок: number,
  ) {
    const г = new THREE.BufferGeometry();
    г.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.ёмкость * 72), 3).setUsage(THREE.DynamicDrawUsage));
    г.setDrawRange(0, 0);
    const м = new THREE.LineBasicMaterial({ color: цвет, transparent: true, opacity: непрозрачность, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
    this.линии = new THREE.LineSegments(г, м);
    this.линии.frustumCulled = false;
    this.линии.renderOrder = порядок;
    this.линии.raycast = () => {};
    this.линии.visible = false;
    родитель.add(this.линии);
  }

  /** Перерисовать контуры для списка целей (зазор 10 мм, как у рамки v1) */
  обновить(цели: ЦельВыбора[]) {
    this.обновитьКоробки(цели.map((ц) => ({ позиция: ц.позиция, cos: ц.cos, sin: ц.sin, центр: [0, ц.полу[1], 0] as В3, полу: ц.полу })));
  }

  /** То же для произвольных коробок в осях изделия (например, одна дверца) */
  обновитьКоробки(цели: Коробка[]) {
    const г = this.линии.geometry;
    if (цели.length > this.ёмкость) {
      this.ёмкость = цели.length * 2;
      г.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.ёмкость * 72), 3).setUsage(THREE.DynamicDrawUsage));
    }
    const a = (г.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    let о = 0;
    for (const ц of цели) {
      const hx = ц.полу[0] + 0.01;
      const hy = ц.полу[1] + 0.01;
      const hz = ц.полу[2] + 0.01;
      const углы: [number, number, number][] = [];
      for (let i = 0; i < 8; i++) {
        const lx = ц.центр[0] + (i & 1 ? hx : -hx);
        const ly = i & 2 ? hy : -hy;
        const lz = ц.центр[2] + (i & 4 ? hz : -hz);
        углы.push([ц.позиция[0] + ц.cos * lx - ц.sin * lz, ц.позиция[1] + ц.центр[1] + ly, ц.позиция[2] + ц.sin * lx + ц.cos * lz]);
      }
      for (const [i, j] of РЁБРА) {
        a[о++] = углы[i][0];
        a[о++] = углы[i][1];
        a[о++] = углы[i][2];
        a[о++] = углы[j][0];
        a[о++] = углы[j][1];
        a[о++] = углы[j][2];
      }
    }
    г.setDrawRange(0, цели.length * 24);
    (г.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.линии.visible = цели.length > 0;
  }

  освободить() {
    this.линии.geometry.dispose();
    (this.линии.material as THREE.Material).dispose();
    this.линии.parent?.remove(this.линии);
  }
}

/** Дуги и вылет открывания на полу: контур развёртки каждой дверцы или ящика; красным — где упирается во что-то */
export class Дуги {
  readonly линии: THREE.LineSegments;
  private ёмкость = 512;

  constructor(родитель: THREE.Object3D) {
    const г = new THREE.BufferGeometry();
    г.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.ёмкость * 6), 3).setUsage(THREE.DynamicDrawUsage));
    г.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.ёмкость * 6), 3).setUsage(THREE.DynamicDrawUsage));
    г.setDrawRange(0, 0);
    const м = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
    this.линии = new THREE.LineSegments(г, м);
    this.линии.frustumCulled = false;
    this.линии.renderOrder = 9;
    this.линии.raycast = () => {};
    this.линии.visible = false;
    родитель.add(this.линии);
  }

  /** Контуры (замкнутые ломаные в плане, мм, оси помещения) на высоте y (мм); красные — с помехой */
  обновить(контуры: { точки: [number, number][]; y: number; помеха: boolean }[]) {
    let нужно = 0;
    for (const к of контуры) нужно += к.точки.length;
    const г = this.линии.geometry;
    if (нужно > this.ёмкость) {
      this.ёмкость = нужно * 2;
      г.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.ёмкость * 6), 3).setUsage(THREE.DynamicDrawUsage));
      г.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.ёмкость * 6), 3).setUsage(THREE.DynamicDrawUsage));
    }
    const pos = (г.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    const col = (г.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;
    let о = 0;
    const норма = [0.94, 0.7, 0.16];
    const беда = [1, 0.23, 0.19];
    for (const к of контуры) {
      const ц = к.помеха ? беда : норма;
      const n = к.точки.length;
      for (let i = 0; i < n; i++) {
        const a = к.точки[i];
        const b = к.точки[(i + 1) % n];
        pos[о] = a[0] / 1000;
        pos[о + 1] = к.y / 1000;
        pos[о + 2] = a[1] / 1000;
        pos[о + 3] = b[0] / 1000;
        pos[о + 4] = к.y / 1000;
        pos[о + 5] = b[1] / 1000;
        for (let k = 0; k < 2; k++) {
          col[о + k * 3] = ц[0];
          col[о + k * 3 + 1] = ц[1];
          col[о + k * 3 + 2] = ц[2];
        }
        о += 6;
      }
    }
    г.setDrawRange(0, о / 3);
    (г.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (г.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    this.линии.visible = о > 0;
  }

  освободить() {
    this.линии.geometry.dispose();
    (this.линии.material as THREE.Material).dispose();
    this.линии.parent?.remove(this.линии);
  }
}
