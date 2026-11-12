/**
 * Кэш материалов: один на класс шейдера. Цвет, шероховатость, металл, кромка и размер — атрибуты инстанса,
 * поэтому новые цвета не добавляют ни материалов, ни draw calls.
 * У каждого патча свой customProgramCacheKey, и обязательно customDepthMaterial с тем же вершинным патчем
 * (без него тени строятся по единичным кубам).
 */
import * as THREE from 'three';
import { ФАСАДЫ, СТОЛЕШНИЦЫ, ОБОИ, ПОЛЫ } from '../data/materials';
import { ПОИД, слойТекстуры, ТЕКСТУРЫ, МАСШТАБ_ТЕКСТУР } from '../data/библиотека';
import { МАССИВ_ТЕКСТУР, МАСШТАБЫ_СЛОЁВ, ключПрограммы, определения, патчГлубины, патчЦвета, type ОпцииШейдера } from './шейдер-плиты';

export type КлассМатериала = 'плита' | 'плита-фаска' | 'прим' | 'стена' | 'стекло';

export interface ДеталиШейдера {
  скругление: boolean;
  кромка: boolean;
  шум: boolean;
}

/** Поверхность детали: цвет (линейный RGB), шероховатость, металл */
export interface Поверхность {
  цвет: [number, number, number];
  шер: number;
  мет: number;
  /** слой текстуры (1…N), 0 — без текстуры */
  слой?: number;
}

const цветаКэш = new Map<string, [number, number, number]>();
const _с = new THREE.Color();
export function цветИзСтроки(ц: string): [number, number, number] {
  let в = цветаКэш.get(ц);
  if (!в) {
    _с.set(ц);
    в = [_с.r, _с.g, _с.b];
    цветаКэш.set(ц, в);
  }
  return в;
}

/** Умолчания: цвета v1 из Furniture.tsx */
const УМОЛЧАНИЕ: Record<string, { цвет: string; шер: number; мет: number }> = {
  корпус: { цвет: '#cfc7ba', шер: 0.75, мет: 0.05 },
  фасад: { цвет: '#c08a4a', шер: 0.75, мет: 0.05 },
  задник: { цвет: '#b7ad9d', шер: 0.8, мет: 0.05 },
  столешница: { цвет: '#e6e2da', шер: 0.5, мет: 0.05 },
  стена: { цвет: '#cbb79a', шер: 0.95, мет: 0 },
  пол: { цвет: '#8a6a4b', шер: 0.7, мет: 0 },
  ручки: { цвет: '#9a9a9a', шер: 0.3, мет: 0.8 },
  стекло: { цвет: '#bcd8e8', шер: 0.05, мет: 0 },
  зеркало: { цвет: '#cfe4ec', шер: 0.06, мет: 0.95 },
  техника: { цвет: '#e8eaec', шер: 0.45, мет: 0.2 },
  цоколь: { цвет: '#cfc7ba', шер: 0.75, мет: 0.05 },
};

const поИд = new Map<string, { цвет: string; шер: number; мет: number }>();
for (const ф of ФАСАДЫ) поИд.set(ф.id, { цвет: ф.цвет, шер: 1 - 0.9 * ф.блеск, мет: ф.металличность });
for (const с of СТОЛЕШНИЦЫ) поИд.set(с.id, { цвет: с.цвет, шер: с.шероховатость, мет: 0 });
for (const о of ОБОИ) поИд.set(о.id, { цвет: о.цвет, шер: 0.95, мет: 0 });
for (const п of ПОЛЫ) поИд.set(п.id, { цвет: п.цвет, шер: 0.7, мет: 0 });

const поверхностиКэш = new Map<string, Поверхность>();

/** Значение материала: `#rrggbb` или id из библиотеки; ключ нужен для умолчаний (ручки — металл) */
export function поверхность(значение: string | undefined, ключ: string): Поверхность {
  const имя = `${ключ}|${значение ?? ''}`;
  const в = поверхностиКэш.get(имя);
  if (в) return в;
  const ум = УМОЛЧАНИЕ[ключ] ?? УМОЛЧАНИЕ.корпус;
  let п: Поверхность;
  const бм = значение ? ПОИД.get(значение) : undefined;
  if (бм) {
    const р = { цвет: цветИзСтроки(бм.цвет), шер: бм.шер, мет: бм.мет, слой: слойТекстуры(бм.текстура) };
    поверхностиКэш.set(имя, р);
    return р;
  }
  if (!значение) п = { цвет: цветИзСтроки(ум.цвет), шер: ум.шер, мет: ум.мет };
  else if (значение.startsWith('#')) {
    // ручки и зеркала сохраняют металл, у обычных плит — умолчание
    п = { цвет: цветИзСтроки(значение), шер: ум.шер, мет: ум.мет };
  } else {
    const м = поИд.get(значение);
    п = м ? { цвет: цветИзСтроки(м.цвет), шер: м.шер, мет: м.мет } : { цвет: цветИзСтроки(ум.цвет), шер: ум.шер, мет: ум.мет };
  }
  поверхностиКэш.set(имя, п);
  return п;
}

export const умолчаниеПоверхности = (ключ: string): Поверхность => поверхность(undefined, ключ);

const РАЗМЕР_ТЕКСТУРЫ = 512;
const СЛОЁВ = 16;
let загружено: Promise<void> | null = null;

/** Пустая текстура-заглушка, пока файлы не загрузились (sampler2DArray должен быть всегда привязан) */
function заглушка() {
  const т = new THREE.DataArrayTexture(new Uint8Array(4 * 4 * 4).fill(255), 1, 1, 4);
  т.needsUpdate = true;
  return т;
}
МАССИВ_ТЕКСТУР.value = заглушка();
ТЕКСТУРЫ.forEach((имя, i) => (МАСШТАБЫ_СЛОЁВ.value[i + 1] = МАСШТАБ_ТЕКСТУР[имя] ?? 0.6));

/** Грузит WebP-текстуры из папки приложения в один массив (работает офлайн); вызывается один раз */
export function загрузитьТекстуры(основа = './Библиотека/текстуры/'): Promise<void> {
  if (загружено) return загружено;
  загружено = (async () => {
    const данные = new Uint8Array(РАЗМЕР_ТЕКСТУРЫ * РАЗМЕР_ТЕКСТУРЫ * 4 * СЛОЁВ);
    const холст = document.createElement('canvas');
    холст.width = холст.height = РАЗМЕР_ТЕКСТУРЫ;
    const g = холст.getContext('2d', { willReadFrequently: true })!;
    for (let i = 0; i < ТЕКСТУРЫ.length; i++) {
      try {
        const ответ = await fetch(`${основа}${ТЕКСТУРЫ[i]}.webp`);
        const картинка = await createImageBitmap(await ответ.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
        g.clearRect(0, 0, РАЗМЕР_ТЕКСТУРЫ, РАЗМЕР_ТЕКСТУРЫ);
        g.drawImage(картинка, 0, 0, РАЗМЕР_ТЕКСТУРЫ, РАЗМЕР_ТЕКСТУРЫ);
        // canvas хранит премультиплицированную альфу; шероховатость 0.1…0.95 нас устраивает без обратного пересчёта цвета
        данные.set(g.getImageData(0, 0, РАЗМЕР_ТЕКСТУРЫ, РАЗМЕР_ТЕКСТУРЫ).data, i * РАЗМЕР_ТЕКСТУРЫ * РАЗМЕР_ТЕКСТУРЫ * 4);
      } catch {
        /* нет файла — слой остаётся пустым (цвет материала виден без узора) */
      }
    }
    const т = new THREE.DataArrayTexture(данные, РАЗМЕР_ТЕКСТУРЫ, РАЗМЕР_ТЕКСТУРЫ, СЛОЁВ);
    т.format = THREE.RGBAFormat;
    т.colorSpace = THREE.SRGBColorSpace;
    т.wrapS = т.wrapT = THREE.RepeatWrapping;
    т.minFilter = THREE.LinearMipmapLinearFilter;
    т.magFilter = THREE.LinearFilter;
    т.generateMipmaps = true;
    т.anisotropy = 4;
    т.needsUpdate = true;
    МАССИВ_ТЕКСТУР.value = т;
  })();
  return загружено;
}

export interface НаборМатериалов {
  цвет: Record<КлассМатериала, THREE.MeshStandardMaterial>;
  глубина: { плита: THREE.MeshDepthMaterial; 'плита-фаска': THREE.MeshDepthMaterial; прим: THREE.MeshDepthMaterial };
  пол: THREE.MeshStandardMaterial;
  применитьПрофиль(д: ДеталиШейдера): void;
  освободить(): void;
}

function стандартный(класс: КлассМатериала, о: ОпцииШейдера, деталь: boolean, доп: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const м = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, ...доп });
  м.defines = определения(о, деталь);
  м.onBeforeCompile = (ш) => патчЦвета(ш as unknown as Parameters<typeof патчЦвета>[0]);
  м.customProgramCacheKey = () => ключПрограммы(класс, о);
  return м;
}

function глубина(о: ОпцииШейдера, имя: string) {
  const м = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  м.defines = определения(о, false);
  м.onBeforeCompile = (ш) => патчГлубины(ш as unknown as Parameters<typeof патчГлубины>[0]);
  м.customProgramCacheKey = () => `глубина|${имя}`;
  return м;
}

export function создатьМатериалы(д: ДеталиШейдера): НаборМатериалов {
  const опц = (доп: Partial<ОпцииШейдера>): ОпцииШейдера => ({ фаска: false, скругление: false, кромка: false, шум: false, стена: false, ...доп });
  const о = {
    плита: опц({ скругление: д.скругление, кромка: д.кромка, шум: д.шум }),
    фаска: опц({ фаска: true, кромка: д.кромка, шум: д.шум }),
    прим: опц({}),
    стена: опц({ стена: true }),
    стекло: опц({}),
  };
  const цвет = {
    плита: стандартный('плита', о.плита, true),
    'плита-фаска': стандартный('плита-фаска', о.фаска, true),
    прим: стандартный('прим', о.прим, false),
    стена: стандартный('стена', о.стена, false, { side: THREE.DoubleSide }),
    стекло: стандартный('стекло', о.стекло, false, { transparent: true, opacity: 0.28, depthWrite: false }),
  };
  const гл = {
    плита: глубина(о.плита.скругление ? опц({}) : опц({}), 'плита'),
    'плита-фаска': глубина(опц({ фаска: true }), 'фаска'),
    прим: глубина(опц({}), 'прим'),
  };
  const пол = new THREE.MeshStandardMaterial({ color: 0x8a6a4b, roughness: 0.7, metalness: 0 });

  return {
    цвет,
    глубина: гл,
    пол,
    применитьПрофиль(новое) {
      const изменить = (м: THREE.MeshStandardMaterial, класс: КлассМатериала, о2: ОпцииШейдера, деталь: boolean) => {
        const ключ = ключПрограммы(класс, о2);
        м.defines = определения(о2, деталь);
        м.customProgramCacheKey = () => ключ;
        м.needsUpdate = true;
      };
      изменить(цвет.плита, 'плита', опц({ скругление: новое.скругление, кромка: новое.кромка, шум: новое.шум }), true);
      изменить(цвет['плита-фаска'], 'плита-фаска', опц({ фаска: true, кромка: новое.кромка, шум: новое.шум }), true);
    },
    освободить() {
      for (const м of Object.values(цвет)) м.dispose();
      for (const м of Object.values(гл)) м.dispose();
      пол.dispose();
    },
  };
}
