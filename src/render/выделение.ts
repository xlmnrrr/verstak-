/**
 * Контуры: латунный у выделенных, красный у тех, что «не влезают». Каждый — один LineSegments (1 draw call)
 * из рёбер габаритного параллелепипеда всех экземпляров.
 */
import * as THREE from 'three';
import type { ЦельВыбора } from './выбор';

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
        const lx = i & 1 ? hx : -hx;
        const ly = i & 2 ? hy : -hy;
        const lz = i & 4 ? hz : -hz;
        углы.push([ц.позиция[0] + ц.cos * lx - ц.sin * lz, ц.позиция[1] + ц.полу[1] + ly, ц.позиция[2] + ц.sin * lx + ц.cos * lz]);
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
