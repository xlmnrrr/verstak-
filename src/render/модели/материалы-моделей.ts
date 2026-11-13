/**
 * Классы материалов частей моделей (docs/модели.md §0, п. 5): один MeshPhysicalMaterial на класс на всю сессию.
 * Цвет инстанса умножает цвет класса (обивка изголовья, оттенок стали). Текстуры — из папки приложения (офлайн):
 * в WebP «Верстака» RGB — цвет, альфа = 0,4 + 0,6 × шероховатость; отдельный `.нормаль.webp` — normal-карта OpenGL.
 */
import * as THREE from 'three';

export type КлассМодели =
  | 'нержавейка'
  | 'нержавейка-пруток'
  | 'хром'
  | 'латунь'
  | 'никель'
  | 'стекло-тёмное'
  | 'стекло-светлое'
  | 'эмаль'
  | 'резина'
  | 'пластик'
  | 'металл-чёрный'
  | 'лампа'
  | 'дисплей'
  | 'ткань-стёганая'
  | 'рогожка'
  | 'берёза';

interface ОписаниеКласса {
  создать: () => THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  /** отбрасывает тень: всегда, только в «Фото» (мелочь меньше текселя карты 2048), никогда */
  тень: 'всегда' | 'фото' | 'нет';
  текстура?: { имя: string; шаг: number; вращение?: number };
}

const ф = (п: THREE.MeshPhysicalMaterialParameters) => () => new THREE.MeshPhysicalMaterial(п);

const КЛАССЫ: Record<КлассМодели, ОписаниеКласса> = {
  // шлифованная нержавейка: вытянутый блик поперёк шлифовки (анизотропия), шлифовка — текстура Metal009
  нержавейка: { создать: ф({ color: '#d4d7db', metalness: 0.9, roughness: 0.38, anisotropy: 0.75, anisotropyRotation: 0, envMapIntensity: 0.85 }), тень: 'всегда', текстура: { имя: 'металл-шлифованный', шаг: 0.3 } },
  'нержавейка-пруток': { создать: ф({ color: '#d4d7db', metalness: 0.92, roughness: 0.3, anisotropy: 0.8, anisotropyRotation: Math.PI / 2, envMapIntensity: 0.8 }), тень: 'фото', текстура: { имя: 'металл-шлифованный', шаг: 0.3, вращение: Math.PI / 2 } },
  латунь: { создать: ф({ color: '#d6b46a', metalness: 1, roughness: 0.3, anisotropy: 0.5, anisotropyRotation: Math.PI / 2 }), тень: 'фото' },
  хром: { создать: ф({ color: '#e6e8eb', metalness: 0.95, roughness: 0.08, envMapIntensity: 0.95 }), тень: 'фото' },
  никель: { создать: ф({ color: '#c3c7cc', metalness: 0.85, roughness: 0.34, envMapIntensity: 0.75 }), тень: 'фото' },
  // тёмное стекло духовки: отражает комнату (clearcoat), в «Фото» чуть пропускает свет — видна камера
  'стекло-тёмное': { создать: ф({ color: '#0a0b0d', metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05, ior: 1.5, specularIntensity: 0.8, envMapIntensity: 0.75 }), тень: 'всегда' },
  'стекло-светлое': { создать: ф({ color: '#dfe8ec', metalness: 0, roughness: 0.02, ior: 1.5, transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 1.2 }), тень: 'нет' },
  эмаль: { создать: ф({ color: '#3a3d43', metalness: 0, roughness: 0.4, clearcoat: 0.55, clearcoatRoughness: 0.25, envMapIntensity: 1.2 }), тень: 'всегда' },
  резина: { создать: ф({ color: '#1b1c1e', metalness: 0, roughness: 0.88 }), тень: 'фото' },
  пластик: { создать: ф({ color: '#121315', metalness: 0, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.1 }), тень: 'всегда' },
  'металл-чёрный': { создать: ф({ color: '#1e1f22', metalness: 0.65, roughness: 0.5 }), тень: 'всегда' },
  лампа: { создать: () => new THREE.MeshStandardMaterial({ color: '#fff4dc', emissive: '#ffe7b8', emissiveIntensity: 6, roughness: 0.4 }), тень: 'нет' },
  дисплей: { создать: () => new THREE.MeshStandardMaterial({ color: '#0b0b0b', emissive: '#ffae5c', emissiveIntensity: 1.3, roughness: 0.3 }), тень: 'нет' },
  // ткани: мягкий отблеск по краю (sheen), стёжка и ворс — normal-карта
  'ткань-стёганая': { создать: ф({ color: '#ffffff', roughness: 1, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color('#d8d4cc') }), тень: 'всегда', текстура: { имя: 'ткань-стёганая', шаг: 0.42 } },
  рогожка: { создать: ф({ color: '#ffffff', roughness: 1, sheen: 0.9, sheenRoughness: 0.55, sheenColor: new THREE.Color('#bdb6aa') }), тень: 'всегда', текстура: { имя: 'рогожка', шаг: 0.22 } },
  берёза: { создать: ф({ color: '#d9bd8f', roughness: 0.62, clearcoat: 0.15, clearcoatRoughness: 0.5 }), тень: 'всегда' },
};

export const теньКласса = (к: КлассМодели) => КЛАССЫ[к]?.тень ?? 'всегда';

const кэш = new Map<КлассМодели, THREE.Material>();
const карты = new Map<string, Promise<{ map: THREE.Texture; roughnessMap: THREE.Texture; normalMap: THREE.Texture | null } | null>>();
let основаТекстур = './Библиотека/текстуры/';
let попросить: () => void = () => {};

/** Куда смотреть за текстурами и кого звать, когда они догрузились (ядро рендера) */
export function настроитьЗагрузку(основа: string, кадр: () => void) {
  основаТекстур = основа;
  попросить = кадр;
}

async function картинка(путь: string): Promise<ImageBitmap | null> {
  try {
    const о = await fetch(путь);
    if (!о.ok) return null;
    return await createImageBitmap(await о.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  } catch {
    return null;
  }
}

/** Цвет, шероховатость (из альфы) и нормаль одного WebP «Верстака» */
function загрузитьКарты(имя: string) {
  let п = карты.get(имя);
  if (!п) {
    п = (async () => {
      const ц = await картинка(`${основаТекстур}${имя}.webp`);
      if (!ц) return null;
      const N = ц.width;
      const холст = document.createElement('canvas');
      холст.width = холст.height = N;
      const g = холст.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(ц, 0, 0, N, N);
      const д = g.getImageData(0, 0, N, N);
      const цвет = new ImageData(new Uint8ClampedArray(д.data), N, N);
      const шер = new ImageData(N, N);
      for (let i = 0; i < N * N; i++) {
        цвет.data[i * 4 + 3] = 255;
        const r = Math.max(0, Math.min(255, Math.round(((д.data[i * 4 + 3] / 255 - 0.4) / 0.6) * 255)));
        шер.data[i * 4] = r;
        шер.data[i * 4 + 1] = r;
        шер.data[i * 4 + 2] = r;
        шер.data[i * 4 + 3] = 255;
      }
      const текстура = (данные: ImageData, цветная: boolean) => {
        const к = document.createElement('canvas');
        к.width = к.height = N;
        к.getContext('2d')!.putImageData(данные, 0, 0);
        const т = new THREE.CanvasTexture(к);
        т.colorSpace = цветная ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        т.wrapS = т.wrapT = THREE.RepeatWrapping;
        т.anisotropy = 8;
        т.needsUpdate = true;
        return т;
      };
      const н = await картинка(`${основаТекстур}${имя}.нормаль.webp`);
      let normalMap: THREE.Texture | null = null;
      if (н) {
        normalMap = new THREE.Texture(н as unknown as HTMLImageElement);
        normalMap.colorSpace = THREE.NoColorSpace;
        normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
        normalMap.needsUpdate = true;
      }
      return { map: текстура(цвет, true), roughnessMap: текстура(шер, false), normalMap };
    })();
    карты.set(имя, п);
  }
  return п;
}

/**
 * Окружение моделей: металл и стекло отражают HDRI комнаты своей силой (envMapIntensity класса),
 * независимо от слабого общего окружения плит (scene.environmentIntensity действует только без своего envMap).
 */
let окружение: THREE.Texture | null = null;
let студия: THREE.Texture | null = null;
/**
 * Металл отражает «студию» (RoomEnvironment: ровные мягкие блики, как на предметной съёмке): HDRI чужой комнаты
 * за спиной зрителя часто тёмный, и плоская шлифованная панель в нём становится чёрной. Стекло, лак и ткань
 * отражают HDRI комнаты — там отражение и должно читаться как окно и комната.
 */
const МЕТАЛЛ = new Set<КлассМодели>(['нержавейка', 'нержавейка-пруток', 'хром', 'никель', 'латунь', 'металл-чёрный']);
const окружениеКласса = (к: КлассМодели) => (МЕТАЛЛ.has(к) ? (студия ?? окружение) : окружение);
export function установитьОкружениеМоделей(т: THREE.Texture | null, студийное: THREE.Texture | null = т) {
  окружение = т;
  студия = студийное;
  for (const [к, м] of кэш) {
    const ст = м as THREE.MeshStandardMaterial;
    const нужное = окружениеКласса(к);
    if (ст.envMap === нужное) continue;
    ст.envMap = нужное;
    ст.needsUpdate = true;
  }
}

/** Материал класса (кэш): текстуры подтягиваются асинхронно, до загрузки класс рисуется цветом */
export function материалКласса(к: КлассМодели): THREE.Material {
  let м = кэш.get(к);
  if (м) return м;
  const о = КЛАССЫ[к] ?? КЛАССЫ.пластик;
  м = о.создать();
  (м as THREE.MeshStandardMaterial).envMap = окружениеКласса(к);
  кэш.set(к, м);
  if (о.текстура) {
    const { имя, шаг, вращение } = о.текстура;
    const мат = м as THREE.MeshPhysicalMaterial;
    void загрузитьКарты(имя).then((т) => {
      if (!т) return;
      for (const x of [т.map, т.roughnessMap, т.normalMap]) {
        if (!x) continue;
        x.repeat.set(1 / шаг, 1 / шаг);
        if (вращение) {
          x.rotation = вращение;
        }
      }
      мат.map = т.map;
      мат.roughnessMap = т.roughnessMap;
      if (т.normalMap) {
        мат.normalMap = т.normalMap;
        мат.normalScale.set(0.9, 0.9);
      }
      мат.needsUpdate = true;
      попросить();
    });
  }
  return м;
}

/**
 * Профиль: в «Фото» тёмное стекло чуть пропускает свет (видна камера духовки), светлое — настоящее стекло
 * с пропусканием (IOR 1,5); в остальных профилях — отражение и прозрачность без лишнего прохода сцены.
 */
export function применитьПрофильМоделей(фото: boolean) {
  const тёмное = кэш.get('стекло-тёмное') as THREE.MeshPhysicalMaterial | undefined;
  if (тёмное) {
    тёмное.transmission = фото ? 0.22 : 0;
    тёмное.thickness = фото ? 0.004 : 0;
    тёмное.needsUpdate = true;
  }
  const светлое = кэш.get('стекло-светлое') as THREE.MeshPhysicalMaterial | undefined;
  if (светлое) {
    светлое.transmission = фото ? 1 : 0;
    светлое.transparent = !фото;
    светлое.opacity = фото ? 1 : 0.22;
    светлое.thickness = фото ? 0.004 : 0;
    светлое.needsUpdate = true;
  }
}

export function освободитьМатериалыМоделей() {
  for (const м of кэш.values()) м.dispose();
  кэш.clear();
}
