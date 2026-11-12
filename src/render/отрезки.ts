/**
 * Линии поверх сцены одним LineSegments (1 draw call): размерные линии, направляющие стыковки, рулетка.
 * Цвет у каждого отрезка свой, глубина не проверяется (линии видны сквозь мебель).
 */
import * as THREE from 'three';
import type { В3 } from './жесты-математика';

export interface Отрезок {
  a: В3;
  b: В3;
  цвет?: [number, number, number];
}

export class Отрезки {
  readonly линии: THREE.LineSegments;
  private ёмкость = 256;

  constructor(родитель: THREE.Object3D, порядок = 14, прозрачность = 0.95) {
    const г = new THREE.BufferGeometry();
    г.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.ёмкость * 6), 3).setUsage(THREE.DynamicDrawUsage));
    г.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.ёмкость * 6), 3).setUsage(THREE.DynamicDrawUsage));
    г.setDrawRange(0, 0);
    const м = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: прозрачность, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
    this.линии = new THREE.LineSegments(г, м);
    this.линии.frustumCulled = false;
    this.линии.renderOrder = порядок;
    this.линии.raycast = () => {};
    this.линии.visible = false;
    родитель.add(this.линии);
  }

  get число() {
    return this.линии.geometry.drawRange.count / 2;
  }

  задать(список: readonly Отрезок[]) {
    const г = this.линии.geometry;
    if (список.length > this.ёмкость) {
      this.ёмкость = список.length * 2;
      г.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.ёмкость * 6), 3).setUsage(THREE.DynamicDrawUsage));
      г.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.ёмкость * 6), 3).setUsage(THREE.DynamicDrawUsage));
    }
    const pos = (г.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    const col = (г.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;
    let о = 0;
    for (const с of список) {
      const ц = с.цвет ?? [1, 1, 1];
      for (let k = 0; k < 2; k++) {
        const p = k === 0 ? с.a : с.b;
        pos[о] = p[0];
        pos[о + 1] = p[1];
        pos[о + 2] = p[2];
        col[о] = ц[0];
        col[о + 1] = ц[1];
        col[о + 2] = ц[2];
        о += 3;
      }
    }
    г.setDrawRange(0, список.length * 2);
    (г.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (г.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    this.линии.visible = список.length > 0;
  }

  освободить() {
    this.линии.geometry.dispose();
    (this.линии.material as THREE.Material).dispose();
    this.линии.parent?.remove(this.линии);
  }
}

/** Подписи в HTML над сценой: пул элементов, позиция по проекции мировой точки; ничего не создаётся на каждом кадре */
export interface ПодписьСцены {
  точка: В3;
  текст: string;
  класс?: string;
}

export class ПулПодписей {
  private readonly элементы: HTMLElement[] = [];
  private активные: ПодписьСцены[] = [];
  private readonly _в = new THREE.Vector3();

  constructor(
    private readonly контейнер: HTMLElement | null,
    private readonly базовыйКласс: string,
  ) {}

  задать(список: readonly ПодписьСцены[]) {
    this.активные = [...список];
    while (this.элементы.length < список.length && this.контейнер) {
      const эл = document.createElement('div');
      эл.className = this.базовыйКласс;
      this.контейнер.appendChild(эл);
      this.элементы.push(эл);
    }
    this.элементы.forEach((эл, i) => {
      const с = список[i];
      if (!с) {
        эл.style.display = 'none';
        return;
      }
      эл.className = `${this.базовыйКласс}${с.класс ? ' ' + с.класс : ''}`;
      if (эл.textContent !== с.текст) эл.textContent = с.текст;
    });
  }

  /** Расставить по экрану: вызывать на кадре (холст `r` — прямоугольник канваса) */
  расставить(камера: THREE.Camera, r: DOMRect) {
    this.активные.forEach((с, i) => {
      const эл = this.элементы[i];
      if (!эл) return;
      this._в.set(с.точка[0], с.точка[1], с.точка[2]).project(камера);
      const виден = this._в.z > -1 && this._в.z < 1;
      эл.style.display = виден ? '' : 'none';
      if (виден) эл.style.transform = `translate(${((this._в.x + 1) / 2) * r.width}px, ${((1 - this._в.y) / 2) * r.height}px) translate(-50%, -50%)`;
    });
  }

  освободить() {
    for (const эл of this.элементы) эл.remove();
    this.элементы.length = 0;
    this.активные = [];
  }
}
