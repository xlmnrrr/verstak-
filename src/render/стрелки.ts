/**
 * Стрелки осей: один InstancedMesh на все стрелки (1 draw call), постоянный размер на экране (~90 px).
 * Попадание — в экранных координатах: расстояние от курсора до проекции отрезка стрелки не больше 10 px.
 * Мебель в событиях не участвует, поэтому клик по стрелке не может достаться телу шкафа (баг v1).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { В3 } from './жесты-математика';

export type ОсьСтрелки = 'X' | 'Y' | 'Z';
export type РежимСтрелок = 'двигать' | 'крутить' | 'растянуть';

export interface Стрелка {
  id: string;
  ось: ОсьСтрелки;
  /** начало и кончик, метры */
  начало: В3;
  кончик: В3;
  /** единичное направление */
  направление: В3;
}

export interface ОпорнаяТочка {
  id: string;
  /** позиция экземпляра (низ, центр), метры */
  позиция: В3;
  cos: number;
  sin: number;
  /** габариты, метры: ш, в, г */
  размер: В3;
}

const ЦВЕТА: Record<ОсьСтрелки, string> = { X: '#e0563f', Y: '#5fb87a', Z: '#4f7fd0' };
export const ДЛИНА_СТРЕЛКИ_ПИКС = 90;
export const РАДИУС_ПОПАДАНИЯ_ПИКС = 10;

function геометрияСтрелки(): THREE.BufferGeometry {
  const стебель = new THREE.CylinderGeometry(0.022, 0.022, 0.8, 8);
  стебель.translate(0, 0.4, 0);
  const голова = new THREE.ConeGeometry(0.07, 0.2, 12);
  голова.translate(0, 0.9, 0);
  for (const г of [стебель, голова]) г.deleteAttribute('uv');
  return mergeGeometries([стебель, голова])!;
}

export class Стрелки {
  readonly mesh: THREE.InstancedMesh;
  private список: Стрелка[] = [];
  private readonly _м = new THREE.Matrix4();
  private readonly _к = new THREE.Quaternion();
  private readonly _п = new THREE.Vector3();
  private readonly _м2 = new THREE.Vector3();
  private readonly _в = new THREE.Vector3(0, 1, 0);
  private readonly _d = new THREE.Vector3();
  private readonly _с = new THREE.Color();
  private ёмкость = 48;
  private режим: РежимСтрелок = 'двигать';
  private точки: ОпорнаяТочка[] = [];

  constructor(родитель: THREE.Object3D) {
    const м = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, transparent: true, toneMapped: false, fog: false });
    this.mesh = new THREE.InstancedMesh(геометрияСтрелки(), м, this.ёмкость);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.ёмкость * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.raycast = () => {};
    this.mesh.count = 0;
    this.mesh.name = 'стрелки';
    родитель.add(this.mesh);
  }

  /** Какие стрелки нужны: режим и выделенные экземпляры */
  задать(режим: РежимСтрелок, точки: ОпорнаяТочка[]) {
    this.режим = режим;
    this.точки = точки;
  }

  get стрелки(): readonly Стрелка[] {
    return this.список;
  }

  /** Пересчёт под камеру: постоянный размер в пикселях. Вызывать каждый кадр перед рендером. */
  обновить(камера: THREE.PerspectiveCamera, высотаОкнаПикс: number) {
    const tg = Math.tan((камера.fov * Math.PI) / 360);
    const список: Стрелка[] = [];
    for (const т of this.точки) {
      const [px, py, pz] = т.позиция;
      const [ш, в, г] = т.размер;
      // локальные оси изделия в мире: Ry(−θ)
      const ox: В3 = [т.cos, 0, т.sin];
      const oz: В3 = [-т.sin, 0, т.cos];
      const мир = (x: number, y: number, z: number): В3 => [px + ox[0] * x + oz[0] * z, py + y, pz + ox[2] * x + oz[2] * z];
      const оси: { ось: ОсьСтрелки; начало: В3; д: В3 }[] = [];
      if (this.режим === 'крутить') {
        оси.push({ ось: 'Y', начало: [px, py, pz], д: [0, 1, 0] });
      } else if (this.режим === 'растянуть') {
        оси.push({ ось: 'X', начало: мир(ш / 2, в / 2, 0), д: ox });
        оси.push({ ось: 'Y', начало: мир(0, в, 0), д: [0, 1, 0] });
        оси.push({ ось: 'Z', начало: мир(0, в / 2, г / 2), д: oz });
      } else {
        оси.push({ ось: 'X', начало: [px, py, pz], д: [1, 0, 0] });
        оси.push({ ось: 'Y', начало: [px, py, pz], д: [0, 1, 0] });
        оси.push({ ось: 'Z', начало: [px, py, pz], д: [0, 0, 1] });
      }
      for (const о of оси) {
        this._п.set(о.начало[0], о.начало[1], о.начало[2]);
        const расстояние = Math.max(0.3, this._п.distanceTo(камера.position));
        const L = Math.min(3, Math.max(0.12, ((ДЛИНА_СТРЕЛКИ_ПИКС * 2 * расстояние * tg) / Math.max(200, высотаОкнаПикс))));
        список.push({
          id: т.id,
          ось: о.ось,
          начало: о.начало,
          кончик: [о.начало[0] + о.д[0] * L, о.начало[1] + о.д[1] * L, о.начало[2] + о.д[2] * L],
          направление: о.д,
        });
      }
    }
    this.список = список;
    if (список.length > this.ёмкость) {
      this.ёмкость = список.length * 2;
      this.mesh.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(this.ёмкость * 16), 16);
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.ёмкость * 3), 3);
    }
    список.forEach((с, i) => {
      this._d.set(с.направление[0], с.направление[1], с.направление[2]);
      this._к.setFromUnitVectors(this._в, this._d);
      const L = Math.hypot(с.кончик[0] - с.начало[0], с.кончик[1] - с.начало[1], с.кончик[2] - с.начало[2]);
      this._п.set(с.начало[0], с.начало[1], с.начало[2]);
      this._м2.set(L, L, L);
      this._м.compose(this._п, this._к, this._м2);
      this.mesh.setMatrixAt(i, this._м);
      this._с.set(ЦВЕТА[с.ось]);
      this.mesh.setColorAt(i, this._с);
    });
    this.mesh.count = список.length;
    this.mesh.visible = список.length > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /**
   * Попадание по экранным координатам (пиксели от левого верха холста). Ближайшая стрелка по пикселям.
   * `проекция` переводит точку мира в пиксели.
   */
  найти(x: number, y: number, проекция: (p: В3) => { x: number; y: number }): Стрелка | null {
    let лучшая: Стрелка | null = null;
    let лучшее = РАДИУС_ПОПАДАНИЯ_ПИКС;
    for (const с of this.список) {
      const a = проекция(с.начало);
      const b = проекция(с.кончик);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const л2 = dx * dx + dy * dy;
      let d: number;
      if (л2 < 64) {
        // стрелка смотрит в камеру и проецируется в точку: круг вокруг начала
        d = Math.hypot(x - a.x, y - a.y) - 4;
      } else {
        const t = ((x - a.x) * dx + (y - a.y) * dy) / л2;
        // проекция курсора внутри отрезка (с небольшим запасом у конца)
        if (t < -0.02 || t > 1.06) continue;
        const tt = Math.max(0, Math.min(1, t));
        d = Math.hypot(x - (a.x + dx * tt), y - (a.y + dy * tt));
      }
      if (d <= лучшее) {
        лучшее = d;
        лучшая = с;
      }
    }
    return лучшая;
  }

  освободить() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
