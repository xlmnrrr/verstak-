/**
 * Пол помещения (многоугольник контура) и пунктир по верхней кромке стен, если высота «неизвестна» (метка «уточнить»).
 * Стены — инстансы в группе «стена» (сборщик-сцены.ts, геометрия — model/стены.ts).
 */
import * as THREE from 'three';
import { высотаДляРендера, стены as рёбра } from '../model/помещение';
import type { Помещение } from '../model/типы';
import { поверхность } from './материалы';

export class ПолПомещения {
  readonly mesh: THREE.Mesh;
  readonly пунктир: THREE.LineSegments;
  private ссылка: Помещение | null = null;

  constructor(
    родитель: THREE.Object3D,
    private readonly материал: THREE.MeshStandardMaterial,
  ) {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), материал);
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.raycast = () => {};
    this.mesh.name = 'пол';
    const м = new THREE.LineDashedMaterial({ color: '#d9a441', dashSize: 0.12, gapSize: 0.08, fog: false, toneMapped: false });
    this.пунктир = new THREE.LineSegments(new THREE.BufferGeometry(), м);
    this.пунктир.frustumCulled = false;
    this.пунктир.raycast = () => {};
    this.пунктир.visible = false;
    this.пунктир.name = 'высота-неизвестна';
    родитель.add(this.mesh, this.пунктир);
  }

  обновить(п: Помещение | undefined) {
    if (!п) {
      this.mesh.visible = false;
      this.пунктир.visible = false;
      this.ссылка = null;
      return;
    }
    if (п === this.ссылка) return;
    this.ссылка = п;
    this.mesh.visible = true;

    const точки = п.контур.map(([x, z]) => new THREE.Vector2(x / 1000, z / 1000));
    const треугольники = THREE.ShapeUtils.triangulateShape(точки, []);
    const позиции: number[] = [];
    const индексы: number[] = [];
    точки.forEach((т) => позиции.push(т.x, 0, т.y));
    for (const [a, b, c] of треугольники) {
      // нормаль должна смотреть вверх (+Y): знак по перекрёстному произведению в плоскости XZ
      const ux = точки[b].x - точки[a].x;
      const uz = точки[b].y - точки[a].y;
      const vx = точки[c].x - точки[a].x;
      const vz = точки[c].y - точки[a].y;
      const ny = uz * vx - ux * vz;
      if (ny >= 0) индексы.push(a, b, c);
      else индексы.push(a, c, b);
    }
    const г = new THREE.BufferGeometry();
    г.setAttribute('position', new THREE.Float32BufferAttribute(позиции, 3));
    г.setAttribute('normal', new THREE.Float32BufferAttribute(точки.flatMap(() => [0, 1, 0]), 3));
    г.setIndex(индексы);
    this.mesh.geometry.dispose();
    this.mesh.geometry = г;

    const пов = поверхность(п.отделка.пол, 'пол');
    this.материал.color.setRGB(пов.цвет[0], пов.цвет[1], пов.цвет[2], THREE.LinearSRGBColorSpace);

    // пунктир по верхней кромке стен
    const неизвестна = п.высота === 'неизвестна';
    this.пунктир.visible = неизвестна;
    if (неизвестна) {
      const h = высотаДляРендера(п) / 1000;
      const вершины: number[] = [];
      for (const с of рёбра(п.контур)) вершины.push(с.а[0] / 1000, h, с.а[1] / 1000, с.б[0] / 1000, h, с.б[1] / 1000);
      const пг = new THREE.BufferGeometry();
      пг.setAttribute('position', new THREE.Float32BufferAttribute(вершины, 3));
      this.пунктир.geometry.dispose();
      this.пунктир.geometry = пг;
      this.пунктир.computeLineDistances();
    }
  }

  освободить() {
    this.mesh.geometry.dispose();
    this.пунктир.geometry.dispose();
    (this.пунктир.material as THREE.Material).dispose();
    this.mesh.parent?.remove(this.mesh, this.пунктир);
  }
}
