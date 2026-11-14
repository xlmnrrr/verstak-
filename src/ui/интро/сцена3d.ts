/**
 * 3D-сцена вступления: комната-студия строится на глазах (пол, стены, мебель по очереди «опускается» на места),
 * потом камера влетает внутрь, вечером зажигается свет. Рисуется отдельным рендерером поверх тех же моделей, что и редактор
 * (`примитивыЭкземпляра`), поэтому в кадре настоящая техника, ручки, петли, шторы, растения — не картинки.
 * Время `t` — секунды от начала вступления; сцена сама ничего не планирует, её кадр — чистая функция времени.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { изделиеПоИд } from '../../model/каталог';
import { новыйЭкземпляр } from '../../model/проект';
import { КУХНЯ_СТУДИЯ } from '../../model/идеи';
import type { Экземпляр } from '../../model/типы';
import { геометрияМодели } from '../../render/модели/геометрии-моделей';
import { новыйМатериалКласса, type КлассМодели } from '../../render/модели/материалы-моделей';
import { примитивыОкна } from '../../render/модели/проёмы';
import { примитивыЭкземпляра, type Примитив } from '../../render/примитивы';

/** Состав сцены — та же «Кухня-студия», что в «Идеях от Claude»; порядок в списке — порядок появления */
const ПРЕДМЕТЫ = КУХНЯ_СТУДИЯ;
const W = 6400;
const D = 4400;
const H = 2700;

/** Ключи материалов плит → цвет по умолчанию (когда в материалах изделия не hex) */
const ПЛИТА: Record<string, string> = { корпус: '#d9d3c7', фасад: '#cdbba0', столешница: '#d8d3c9', ручки: '#cfd2d6', задник: '#cfc9bc', цоколь: '#2b2b2b', техника: '#cfd2d6' };

interface Часть {
  ключ: string;
  /** мировая матрица части в готовом положении (метры) */
  B: THREE.Matrix4;
  цвет: THREE.Color;
  предмет: number;
}

interface Группа {
  геом: THREE.BufferGeometry;
  mesh: THREE.InstancedMesh | null;
  части: Часть[];
}

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const easeBack = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  const c1 = 1.4;
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const плавно = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Как `матрицаПримитива` сборщика: поворот изделия вокруг вертикали и поворот детали, мм → метры */
function матрицаПримитива(позиция: [number, number, number], поворотГр: number, п: Примитив): THREE.Matrix4 {
  const θ = (поворотГр * Math.PI) / 180;
  const c = Math.cos(θ);
  const s = Math.sin(θ);
  const Ry = [c, 0, -s, 0, 1, 0, s, 0, c];
  const R = п.R;
  const T = new Array<number>(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) T[i * 3 + j] = Ry[i * 3] * R[j] + Ry[i * 3 + 1] * R[3 + j] + Ry[i * 3 + 2] * R[6 + j];
  const [tx, ty, tz] = п.t;
  const m = new THREE.Matrix4();
  m.set(T[0], T[1], T[2], позиция[0] / 1000 + (Ry[0] * tx + Ry[1] * ty + Ry[2] * tz) / 1000, T[3], T[4], T[5], позиция[1] / 1000 + ty / 1000, T[6], T[7], T[8], позиция[2] / 1000 + (Ry[6] * tx + Ry[7] * ty + Ry[8] * tz) / 1000, 0, 0, 0, 1);
  return m;
}

export interface Интро3D {
  /** кадр сцены в момент t (секунды от начала вступления) */
  кадр: (t: number) => void;
  изменитьРазмер: (ширина: number, высота: number) => void;
  освободить: () => void;
}

export function создатьИнтро3D(холст: HTMLCanvasElement): Интро3D {
  const gl = new THREE.WebGLRenderer({ canvas: холст, antialias: true, alpha: false, powerPreference: 'high-performance' });
  gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = 1.0;
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  const сцена = new THREE.Scene();
  сцена.background = new THREE.Color('#15110e');
  const pmrem = new THREE.PMREMGenerator(gl);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  сцена.environment = env;
  сцена.environmentIntensity = 0.38;
  const камера = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 60);

  /* ---------------- свет */
  const полусфера = new THREE.HemisphereLight('#fff3e0', '#6b5a45', 0.55);
  сцена.add(полусфера);
  const солнце = new THREE.DirectionalLight('#ffe9c8', 2.1);
  солнце.position.set(5.5, 6.5, -2.5);
  солнце.target.position.set(0, 0.5, 0);
  солнце.castShadow = true;
  солнце.shadow.mapSize.set(2048, 2048);
  солнце.shadow.camera.left = -5;
  солнце.shadow.camera.right = 5;
  солнце.shadow.camera.top = 5;
  солнце.shadow.camera.bottom = -5;
  солнце.shadow.camera.near = 1;
  солнце.shadow.camera.far = 18;
  солнце.shadow.bias = -0.0004;
  солнце.shadow.normalBias = 0.02;
  сцена.add(солнце, солнце.target);
  // вечерние источники: над столом, над диваном, на кухне
  const лампы = [
    new THREE.PointLight('#ffb866', 0, 5.5, 1.6),
    new THREE.PointLight('#ffb866', 0, 5.5, 1.6),
    new THREE.PointLight('#ffb866', 0, 4.5, 1.6),
  ];
  лампы[0].position.set(-1.5, 2.2, 0.5);
  лампы[1].position.set(0.9, 2.0, 0.3);
  лампы[2].position.set(-1.3, 2.35, -1.6);
  for (const л of лампы) сцена.add(л);

  /* ---------------- комната: пол и стены */
  const корень = new THREE.Group();
  сцена.add(корень);
  const пол = new THREE.Mesh(
    new THREE.BoxGeometry(W / 1000, 0.1, D / 1000),
    new THREE.MeshStandardMaterial({ color: '#b08a5e', roughness: 0.55, metalness: 0 }),
  );
  пол.position.set(0, -0.05, 0);
  пол.receiveShadow = true;
  корень.add(пол);
  // паркет: текстура приложения (офлайн), оттенок тёплый
  new THREE.TextureLoader().load('./Библиотека/текстуры/паркет.webp', (т) => {
    т.wrapS = т.wrapT = THREE.RepeatWrapping;
    т.colorSpace = THREE.SRGBColorSpace;
    т.repeat.set(W / 1000 / 1.6, D / 1000 / 1.6);
    т.anisotropy = 8;
    const м = пол.material as THREE.MeshStandardMaterial;
    м.map = т;
    м.color.set('#e9d3b4');
    м.needsUpdate = true;
  });
  // потолок: появляется, когда камера опускается под него (сверху комнату не закрывает)
  const потолокМат = new THREE.MeshStandardMaterial({ color: '#ece6da', roughness: 0.95, transparent: true, opacity: 0, side: THREE.FrontSide, depthWrite: false });
  const потолок = new THREE.Mesh(new THREE.PlaneGeometry(W / 1000, D / 1000), потолокМат);
  потолок.rotation.x = Math.PI / 2;
  потолок.position.set(0, H / 1000, 0);
  потолок.visible = false;
  корень.add(потолок);
  const стеныМат = (ц: string) => new THREE.MeshStandardMaterial({ color: ц, roughness: 0.9, metalness: 0 });
  const стены: { m: THREE.Mesh; ось: 'y'; низ: number; высота: number; старт: number }[] = [];
  const коробка = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, ц: string, старт: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry((x1 - x0) / 1000, (y1 - y0) / 1000, (z1 - z0) / 1000), стеныМат(ц));
    m.position.set((x0 + x1) / 2000, y0 / 1000, (z0 + z1) / 2000);
    m.geometry.translate(0, (y1 - y0) / 2000, 0);
    m.castShadow = true;
    m.receiveShadow = true;
    корень.add(m);
    стены.push({ m, ось: 'y', низ: y0 / 1000, высота: (y1 - y0) / 1000, старт });
  };
  const T = 100;
  // задняя стена с окном x 1100…2700, y 900…2300
  const wx0 = 1100;
  const wx1 = 2700;
  const wy0 = 900;
  const wy1 = 2300;
  коробка(-W / 2 - T, wx0, 0, H, -D / 2 - T, -D / 2, '#cdbfa9', 5.0);
  коробка(wx1, W / 2 + T, 0, H, -D / 2 - T, -D / 2, '#cdbfa9', 5.1);
  коробка(wx0, wx1, 0, wy0, -D / 2 - T, -D / 2, '#cdbfa9', 5.1);
  коробка(wx0, wx1, wy1, H, -D / 2 - T, -D / 2, '#cdbfa9', 5.1);
  // боковые стены
  коробка(-W / 2 - T, -W / 2, 0, H, -D / 2 - T, D / 2, '#d6cab5', 5.3);
  коробка(W / 2, W / 2 + T, 0, H, -D / 2 - T, D / 2, '#c9bda7', 5.4);
  // плинтус
  const плинтус = (x0: number, x1: number, z0: number, z1: number, старт: number) => коробка(x0, x1, 0, 60, z0, z1, '#f3f0ea', старт);
  плинтус(-W / 2, wx0, -D / 2, -D / 2 + 16, 5.9);
  плинтус(wx1, W / 2, -D / 2, -D / 2 + 16, 5.9);
  плинтус(-W / 2, -W / 2 + 16, -D / 2, D / 2, 6.0);
  плинтус(W / 2 - 16, W / 2, -D / 2, D / 2, 6.0);

  // за окном — светлое небо с мягким градиентом (не чёрная пустота)
  {
    const к = document.createElement('canvas');
    к.width = 8;
    к.height = 128;
    const g = к.getContext('2d')!;
    const гр = g.createLinearGradient(0, 0, 0, 128);
    гр.addColorStop(0, '#9cc6ee');
    гр.addColorStop(0.55, '#d9ecf8');
    гр.addColorStop(1, '#f6efe0');
    g.fillStyle = гр;
    g.fillRect(0, 0, 8, 128);
    const т = new THREE.CanvasTexture(к);
    т.colorSpace = THREE.SRGBColorSpace;
    const небо = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.0), new THREE.MeshBasicMaterial({ map: т, toneMapped: false }));
    небо.position.set(1.9, 1.6, -D / 2000 - 0.35);
    корень.add(небо);
  }

  /* ---------------- предметы → части → инстансы */
  const группы = new Map<string, Группа>();
  const части: Часть[] = [];
  const предметыИнфо: { позиция: THREE.Vector3; старт: number }[] = [];
  const материалы = new Map<string, THREE.Material>();
  const материал = (ключ: string): THREE.Material => {
    let м = материалы.get(ключ);
    if (!м) {
      if (ключ === 'плита') м = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.52, metalness: 0.04 });
      else if (ключ === 'стекло') {
        м = new THREE.MeshPhysicalMaterial({ color: '#cfe0e6', roughness: 0.04, transparent: true, opacity: 0.22, depthWrite: false, metalness: 0, envMapIntensity: 1.2 });
      } else if (ключ === 'зеркало') м = new THREE.MeshStandardMaterial({ color: '#eef1f3', roughness: 0.04, metalness: 1 });
      else м = новыйМатериалКласса(ключ.split('|')[1] as КлассМодели, env);
      материалы.set(ключ, м);
    }
    return м;
  };
  const единичный = new THREE.BoxGeometry(1, 1, 1);
  const цилиндр = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);

  const цветПлиты = (э: Экземпляр, мат: Примитив['мат']): THREE.Color => {
    if (typeof мат !== 'string') return new THREE.Color(мат.цвет);
    const изд = изделиеПоИд(э.изделие)!;
    const знач = э.материалы?.[мат as 'корпус'] ?? изд.материалы[мат as 'корпус'];
    if (знач && знач.startsWith('#')) return new THREE.Color(знач);
    if (мат === 'столешница' && изд.тип === 'стол') return new THREE.Color(э.материалы?.фасад ?? изд.материалы.фасад ?? '#b88f5e');
    return new THREE.Color(ПЛИТА[мат] ?? '#cccccc');
  };

  const добавитьПримитивы = (примитивы: Примитив[], позиция: [number, number, number], поворот: number, э: Экземпляр | null, индекс: number) => {
    for (const п of примитивы) {
      let ключ: string;
      let геом: THREE.BufferGeometry;
      let цвет = new THREE.Color('#ffffff');
      const B = матрицаПримитива(позиция, поворот, п);
      if (п.форма === 'модель' && п.модель) {
        if (п.модель.геом.startsWith('gltf:')) continue;
        ключ = `модель|${п.модель.класс}|${п.модель.геом}`;
        геом = геометрияМодели(п.модель.геом);
        if (typeof п.мат !== 'string') цвет = new THREE.Color(п.мат.цвет);
        ключ = `${п.модель.геом}|${п.модель.класс}`;
      } else {
        // плита, стекло, цилиндр и прочие простые формы — единичный куб или цилиндр с масштабом по размеру
        const стекло = п.форма === 'стекло' || п.мат === 'стекло';
        const зеркало = п.мат === 'зеркало';
        const цил = п.форма === 'цилиндр';
        ключ = стекло ? 'стекло' : зеркало ? 'зеркало' : 'плита';
        геом = цил ? цилиндр : единичный;
        const масштаб = new THREE.Matrix4().makeScale(п.размер[0] / 1000, п.размер[1] / 1000, п.размер[2] / 1000);
        B.multiply(масштаб);
        if (цил) ключ = ключ + '|цил';
        if (э) цвет = стекло || зеркало ? new THREE.Color('#ffffff') : цветПлиты(э, п.мат);
        else if (typeof п.мат !== 'string') цвет = new THREE.Color(п.мат.цвет);
      }
      const полныйКлюч = ключ;
      let г = группы.get(полныйКлюч);
      if (!г) {
        г = { геом, mesh: null, части: [] };
        группы.set(полныйКлюч, г);
      }
      const ч: Часть = { ключ: полныйКлюч, B, цвет, предмет: индекс };
      г.части.push(ч);
      части.push(ч);
    }
  };

  // окно в задней стене: рама, створки, стекло, откосы, подоконник
  {
    const окно = примитивыОкна(1600, 1400, 100);
    добавитьПримитивы(окно, [1900, 900, -D / 2 - T / 2], 0, null, 0);
    предметыИнфо.push({ позиция: new THREE.Vector3(1.9, 0.9, -D / 2000), старт: 5.5 });
  }
  // мебель и техника: порядок списка — порядок появления
  let число = 0;
  const старт0 = 6.1;
  const шаг = 0.2;
  for (const [id, x, z, поворот, y = 0, палитра] of ПРЕДМЕТЫ) {
    const изд = изделиеПоИд(id);
    if (!изд) continue;
    const э = новыйЭкземпляр(изд, 'п1', [x, y, z], `и${число}`);
    э.поворот = поворот;
    if (палитра) э.материалы = палитра;
    if (id === 'столешница-3000') э.габариты = { ...э.габариты, ш: 3200 };
    if (id === 'ковёр-2000') э.габариты = { ...э.габариты, ш: 2300, г: 1700 };
    if (id === 'шторы-с-тюлем-2000') э.габариты = { ...э.габариты, ш: 2100 };
    const индекс = предметыИнфо.length;
    const р = примитивыЭкземпляра(изд, э, true);
    добавитьПримитивы(р.примитивы, [x, y, z], поворот, э, индекс);
    // свет, ковёр и мелочи появляются позже, основная мебель — равномерно
    const старт = старт0 + число * шаг + (число > 24 ? 0.4 : 0);
    предметыИнфо.push({ позиция: new THREE.Vector3(x / 1000, y / 1000, z / 1000), старт });
    число++;
  }

  // инстансы по группам
  const meshи: THREE.InstancedMesh[] = [];
  for (const [ключ, г] of группы) {
    const геом = г.геом;
    const основа = ключ.split('|цил')[0];
    const прозрачное = основа === 'стекло';
    const m = new THREE.InstancedMesh(геом, материал(основа.startsWith('плита') ? 'плита' : основа.startsWith('стекло') ? 'стекло' : основа.startsWith('зеркало') ? 'зеркало' : ключ), г.части.length);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(г.части.length * 3), 3);
    г.части.forEach((ч, i) => m.setColorAt(i, ч.цвет));
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = !прозрачное;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.renderOrder = прозрачное ? 2 : 0;
    корень.add(m);
    г.mesh = m;
    meshи.push(m);
  }

  /* ---------------- анимация */
  const нулевая = new THREE.Matrix4().makeScale(0, 0, 0);
  const A = new THREE.Matrix4();
  const tmp = new THREE.Matrix4();
  const масштабM = new THREE.Matrix4();
  const сдвигM = new THREE.Matrix4();
  const вОтриц = new THREE.Matrix4();
  /** Состояние предмета в буфере: 0 — скрыт, 1 — в движении, 2 — стоит на месте (матрицы записаны, повторно не трогаем) */
  const записано = new Int8Array(предметыИнфо.length).fill(-1);

  const применитьПредметы = (t: number) => {
    const n = предметыИнфо.length;
    const состояние = new Int8Array(n);
    const доли = new Float32Array(n);
    const фактор = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const и = предметыИнфо[i];
      доли[i] = easeBack((t - и.старт) / 0.55);
      фактор[i] = ease((t - и.старт) / 0.35);
      состояние[i] = t < и.старт ? 0 : t >= и.старт + 0.6 ? 2 : 1;
    }
    for (const г of группы.values()) {
      const m = г.mesh!;
      let изменено = false;
      for (let i = 0; i < г.части.length; i++) {
        const ч = г.части[i];
        const и = ч.предмет;
        const ст = состояние[и];
        if (ст === записано[и] && ст !== 1) continue;
        if (ст === 0) m.setMatrixAt(i, нулевая);
        else if (ст === 2) m.setMatrixAt(i, ч.B);
        else {
          const O = предметыИнфо[и].позиция;
          const s = 0.82 + 0.18 * фактор[и];
          вОтриц.makeTranslation(-O.x, -O.y, -O.z);
          масштабM.makeScale(s, s, s);
          сдвигM.makeTranslation(O.x, O.y + (1 - доли[и]) * 0.55, O.z);
          A.copy(сдвигM).multiply(масштабM).multiply(вОтриц);
          tmp.copy(A).multiply(ч.B);
          m.setMatrixAt(i, tmp);
        }
        изменено = true;
      }
      if (изменено) m.instanceMatrix.needsUpdate = true;
    }
    for (let i = 0; i < n; i++) записано[i] = состояние[i];
  };

  /* ---------------- камера по ключевым точкам */
  const точкиP = [
    new THREE.Vector3(0.5, 9.8, 9.2),
    new THREE.Vector3(-5.8, 6.6, 6.8),
    new THREE.Vector3(-3.2, 2.6, 4.6),
    new THREE.Vector3(0.6, 1.7, 3.7),
    new THREE.Vector3(1.5, 1.7, 3.6),
  ];
  const точкиT = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.4, 0.4, -0.4),
    new THREE.Vector3(0.4, 1.0, -0.6),
    new THREE.Vector3(-1.0, 1.1, -1.4),
    new THREE.Vector3(-0.8, 1.2, -1.2),
  ];
  const кривая = (т: THREE.Vector3[]) => new THREE.CatmullRomCurve3(т, false, 'centripetal', 0.5);
  const путьP = кривая(точкиP);
  const путьT = кривая(точкиT);
  const ИНТРО_С = 4.2; // камера оживает вместе со сценой
  const ИНТРО_ДО = 17.2;
  const emissive = [...материалы.values()].filter((m) => (m as THREE.MeshStandardMaterial).emissive && (m as THREE.MeshStandardMaterial).emissiveIntensity > 0) as THREE.MeshStandardMaterial[];
  const эмиссияБаза = emissive.map((m) => m.emissiveIntensity);

  const кадр = (сырое: number) => {
    // сцена идёт на 0,7 с впереди логотипа: пол начинает расти, пока знак ещё растворяется
    const t = сырое + 0.7;
    const u = плавно((t - ИНТРО_С) / (ИНТРО_ДО - ИНТРО_С));
    // чуть замедляем начало и конец: камера «выдыхает» на герое
    const p = путьP.getPoint(Math.min(1, Math.max(0, u)));
    const q = путьT.getPoint(Math.min(1, Math.max(0, u)));
    камера.position.copy(p);
    камера.lookAt(q);
    камера.fov = 42 - 8 * плавно((t - 8) / 8);
    камера.updateProjectionMatrix();
    const прозрачностьПотолка = Math.min(1, Math.max(0, (3.6 - p.y) / 0.9));
    потолокМат.opacity = прозрачностьПотолка;
    потолок.visible = прозрачностьПотолка > 0.01;
    // пол и стены
    const пт = ease((t - 4.6) / 1.0);
    пол.scale.set(пт, 1, пт);
    for (const с of стены) {
      const k = ease((t - с.старт) / 0.9);
      с.m.scale.set(1, Math.max(0.0001, k), 1);
      с.m.visible = k > 0.001;
    }
    применитьПредметы(t);
    // свет по времени: день → вечер. С 12.5 с лампы нарастают, солнце мягко садится
    const вечер = плавно((t - 12.2) / 3.2);
    солнце.intensity = 2.1 * (1 - 0.55 * вечер);
    солнце.color.set(вечер > 0.5 ? '#ffd2a0' : '#ffe9c8');
    полусфера.intensity = 0.55 - 0.18 * вечер;
    сцена.environmentIntensity = 0.38 - 0.12 * вечер;
    лампы.forEach((л, i) => (л.intensity = (i === 2 ? 5 : 9) * вечер));
    emissive.forEach((m, i) => (m.emissiveIntensity = эмиссияБаза[i] * (0.15 + 0.85 * вечер)));
    gl.toneMappingExposure = 0.95 + 0.1 * вечер;
    gl.render(сцена, камера);
  };

  const изменитьРазмер = (ширина: number, высота: number) => {
    gl.setSize(ширина, высота, false);
    камера.aspect = ширина / Math.max(1, высота);
    камера.updateProjectionMatrix();
  };

  const освободить = () => {
    for (const m of meshи) m.dispose();
    for (const м of материалы.values()) м.dispose();
    единичный.dispose();
    цилиндр.dispose();
    env.dispose();
    pmrem.dispose();
    gl.dispose();
  };

  return { кадр, изменитьРазмер, освободить };
}

/** Сколько секунд занимает вступление целиком (логотип, стройка, пролёт, переход) */
export const ДЛИТЕЛЬНОСТЬ_ИНТРО = 18.4;
