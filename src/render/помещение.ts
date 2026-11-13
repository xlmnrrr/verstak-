/**
 * Пол помещения (многоугольник контура) и пунктир по верхней кромке стен, если высота «неизвестна» (метка «уточнить»).
 * Натяжной потолок (13.11.2026): тот же многоугольник на уровне полотна лицом вниз — снаружи (камера сверху) отсекается
 * сам, изнутри («Прогулка», низкая камера) виден. Тень не отбрасывает, чтобы солнце по-прежнему освещало комнату.
 * Стены — инстансы в группе «стена» (сборщик-сцены.ts, геометрия — model/стены.ts).
 */
import * as THREE from 'three';
import { высотаДляРендера, стены as рёбра } from '../model/помещение';
import type { Помещение } from '../model/типы';
import { МАСШТАБ_ТЕКСТУР, ТЕКСТУРЫ } from '../data/библиотека';
import { поверхность } from './материалы';
import { уровеньПотолка } from '../model/потолок';

interface ТекстурыПола {
  карта: THREE.Texture;
  нормаль: THREE.Texture | null;
  масштаб: number;
}
const ОСНОВА = './Библиотека/текстуры/';
const кэшПола = new Map<string, Promise<ТекстурыПола | null>>();

function грузить(путь: string, цвет: boolean): Promise<THREE.Texture | null> {
  return new Promise((ok) => {
    new THREE.TextureLoader().load(
      путь,
      (т) => {
        т.wrapS = т.wrapT = THREE.RepeatWrapping;
        т.colorSpace = цвет ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        т.anisotropy = 8;
        ok(т);
      },
      undefined,
      () => ok(null),
    );
  });
}

/** Текстура пола: фото-файл, а нет его — процедурная из `запасные/`; normal-карта необязательна */
function текстурыПола(имя: string): Promise<ТекстурыПола | null> {
  let п = кэшПола.get(имя);
  if (!п) {
    п = (async () => {
      const карта = (await грузить(`${ОСНОВА}${имя}.webp`, true)) ?? (await грузить(`${ОСНОВА}запасные/${имя}.webp`, true));
      if (!карта) return null;
      const нормаль = await грузить(`${ОСНОВА}${имя}.нормаль.webp`, false);
      return { карта, нормаль, масштаб: МАСШТАБ_ТЕКСТУР[имя] ?? 1 };
    })();
    кэшПола.set(имя, п);
  }
  return п;
}

export class ПолПомещения {
  readonly mesh: THREE.Mesh;
  readonly пунктир: THREE.LineSegments;
  readonly потолок: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  private ссылка: Помещение | null = null;

  private запросТекстуры = 0;

  constructor(
    родитель: THREE.Object3D,
    private readonly материал: THREE.MeshStandardMaterial,
    private readonly послеЗагрузки: () => void = () => {},
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
    this.потолок = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial({ color: '#f5f4f0', roughness: 0.95 }));
    this.потолок.name = 'потолок-натяжной';
    this.потолок.castShadow = false;
    this.потолок.receiveShadow = false;
    this.потолок.frustumCulled = false;
    this.потолок.raycast = () => {};
    this.потолок.visible = false;
    родитель.add(this.mesh, this.пунктир, this.потолок);
  }

  обновить(п: Помещение | undefined) {
    if (!п) {
      this.mesh.visible = false;
      this.пунктир.visible = false;
      this.потолок.visible = false;
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
    // UV пола — координаты в метрах; повтор текстуры задаётся масштабом материала (map.repeat)
    г.setAttribute('uv', new THREE.Float32BufferAttribute(точки.flatMap((т) => [т.x, т.y]), 2));
    г.setIndex(индексы);
    this.mesh.geometry.dispose();
    this.mesh.geometry = г;
    this.обновитьПотолок(п, точки, треугольники);

    const пов = поверхность(п.отделка.пол, 'пол');
    this.материал.color.setRGB(пов.цвет[0], пов.цвет[1], пов.цвет[2], THREE.LinearSRGBColorSpace);
    this.материал.roughness = пов.шер;
    this.материал.metalness = пов.мет;
    this.применитьТекстуру(пов.слой ? ТЕКСТУРЫ[пов.слой - 1] : null);

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

  /** Полотно натяжного потолка: многоугольник контура на уровне полотна, нормаль вниз; фактура задаёт блеск */
  private обновитьПотолок(п: Помещение, точки: THREE.Vector2[], треугольники: number[][]) {
    const н = п.натяжной_потолок;
    this.потолок.visible = !!н;
    if (!н) return;
    const y = уровеньПотолка(п) / 1000;
    const позиции: number[] = [];
    const индексы: number[] = [];
    точки.forEach((т) => позиции.push(т.x, y, т.y));
    for (const [a, b, c] of треугольники) {
      const ux = точки[b].x - точки[a].x;
      const uz = точки[b].y - точки[a].y;
      const vx = точки[c].x - точки[a].x;
      const vz = точки[c].y - точки[a].y;
      // лицом вниз (−Y): обратный обход относительно пола
      if (uz * vx - ux * vz >= 0) индексы.push(a, c, b);
      else индексы.push(a, b, c);
    }
    const г = new THREE.BufferGeometry();
    г.setAttribute('position', new THREE.Float32BufferAttribute(позиции, 3));
    г.setAttribute('normal', new THREE.Float32BufferAttribute(точки.flatMap(() => [0, -1, 0]), 3));
    г.setAttribute('uv', new THREE.Float32BufferAttribute(точки.flatMap((т) => [т.x, т.y]), 2));
    г.setIndex(индексы);
    this.потолок.geometry.dispose();
    this.потолок.geometry = г;
    const м = this.потолок.material;
    м.color.set(н.цвет);
    // подсветка снизу отражённым светом: без неё полотно лицом вниз почти не освещено (в сцене нет переотражений)
    м.emissive.set(н.цвет).multiplyScalar(0.24);
    if (н.фактура === 'глянец') Object.assign(м, { roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.55 });
    else if (н.фактура === 'сатин') Object.assign(м, { roughness: 0.34, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.4 });
    else Object.assign(м, { roughness: 0.95, clearcoat: 0, clearcoatRoughness: 0, envMapIntensity: 0.2 });
    м.needsUpdate = true;
  }

  /** Подключает текстуру пола (или снимает её). Файлы грузятся один раз и кэшируются; нет файла — остаётся цвет. */
  private применитьТекстуру(имя: string | null) {
    const запрос = ++this.запросТекстуры;
    const м = this.материал;
    if (!имя) {
      if (м.map || м.normalMap) {
        м.map = null;
        м.normalMap = null;
        м.needsUpdate = true;
      }
      return;
    }
    void текстурыПола(имя).then((т) => {
      if (запрос !== this.запросТекстуры || !т) return;
      т.карта.repeat.set(1 / т.масштаб, 1 / т.масштаб);
      м.map = т.карта;
      if (т.нормаль) {
        т.нормаль.repeat.set(1 / т.масштаб, 1 / т.масштаб);
        м.normalMap = т.нормаль;
        м.normalScale.set(0.7, 0.7);
      } else м.normalMap = null;
      м.needsUpdate = true;
      this.послеЗагрузки();
    });
  }

  освободить() {
    this.mesh.geometry.dispose();
    this.пунктир.geometry.dispose();
    (this.пунктир.material as THREE.Material).dispose();
    this.потолок.geometry.dispose();
    this.потолок.material.dispose();
    this.mesh.parent?.remove(this.mesh, this.пунктир, this.потолок);
  }
}
