/**
 * Ядро рендера: связывает сборщик сцены, тени, камеру, жесты, стрелки, профили качества и подписку на store.
 * R3F остаётся для холста, камеры и цикла кадров (frameloop="demand"); весь рисуемый мир строится здесь императивно.
 * Кадр просит одна функция `попроситьКадр()`.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { границыКонтура, высотаДляРендера } from '../model/помещение';
import { проверитьВлезает, type Проблема } from '../model/проверка';
import type { ПроектV2 } from '../model/типы';
import { useКухня, зарегистрироватьПревью } from '../store';
import { КамераОбзора } from './камера';
import { Жесты } from './жесты';
import { ВыборФаски } from './lod';
import { создатьМатериалы, type НаборМатериалов } from './материалы';
import { ПолПомещения } from './помещение';
import {
  МониторКадров,
  ПРОФИЛИ,
  профильПоВидеокарте,
  профильПослеСамопроверки,
  определитьВидеокарту,
  type ИмяПрофиля,
  type Профиль,
} from './качество';
import { СборщикСцены } from './сборщик-сцены';
import { Стрелки } from './стрелки';
import { Контур } from './выделение';
import { Тени } from './тени';
import { ПОЛОЖЕНИЕ_КАМЕРЫ } from './шейдер-плиты';

export interface ОпцииЯдра {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  invalidate: () => void;
  setDpr: (dpr: number) => void;
  /** контейнер для HTML-меток «не влезает» и островка действий (над холстом) */
  оверлей: HTMLElement | null;
  /** «обложка»: сцена на фоне меню — облёт камерой, без жестов, выбора и стрелок */
  режим?: 'редактор' | 'обложка';
}

export interface КадрыСтатистика {
  кадров: number;
  теней: number;
}

export class Ядро {
  readonly сборщик: СборщикСцены;
  readonly тени: Тени;
  readonly камераОбзора: КамераОбзора;
  readonly жесты: Жесты;
  readonly стрелки: Стрелки;
  readonly материалы: НаборМатериалов;
  readonly пол: ПолПомещения;
  readonly контурВыделения: Контур;
  readonly контурПроблем: Контур;
  readonly lod: ВыборФаски;
  readonly видеокарта: { имя: string; профиль: ИмяПрофиля; программная: boolean };

  readonly режим: 'редактор' | 'обложка';
  профиль: Профиль;
  режимКачества: 'авто' | ИмяПрофиля;
  /** MSAA, с которым создан холст: меняется только пересозданием */
  readonly msaa: boolean;
  проблемы: Проблема[] = [];
  /** журнал переключений качества и предупреждений */
  readonly журнал: string[] = [];
  readonly самопроверкаГотова: Promise<{ медиана: number; профиль: ИмяПрофиля }>;
  private завершитьСамопроверку!: (v: { медиана: number; профиль: ИмяПрофиля }) => void;
  кадров = 0;

  private флагКадра = false;
  private отписка: (() => void) | null = null;
  private открытий = -1;
  private ключОбласти = '';
  private ключГраниц = '';
  private последнийОбзор = '';
  private выбраноКлюч = '';
  private ссылки: { о?: unknown; п?: unknown; а?: string; в?: unknown; и?: string; ж?: string } = {};
  private таймерПроверки = 0;
  private метки = new Map<string, HTMLElement>();
  private монитор: МониторКадров;
  private окружение: THREE.Texture | null = null;
  private hidden = false;
  private освобождено = false;
  private _в = new THREE.Vector3();
  private _в2 = new THREE.Vector3();

  constructor(private readonly о: ОпцииЯдра) {
    const { gl, scene, camera } = о;
    this.режим = о.режим ?? 'редактор';
    this.видеокарта = профильПоВидеокарте(определитьВидеокарту());
    const настройка = useКухня.getState().проект2.настройки.качество;
    this.режимКачества = настройка;
    const старт: ИмяПрофиля = настройка === 'авто' ? this.видеокарта.профиль : настройка;
    this.профиль = ПРОФИЛИ[старт];
    this.msaa = gl.getContextAttributes()?.antialias ?? true;
    this.монитор = new МониторКадров({ интервалЭкрана: 1000 / 60 }, старт);
    this.самопроверкаГотова = new Promise((r) => (this.завершитьСамопроверку = r));

    // положение камеры для стен: работает и при ручном gl.render (замеры)
    scene.onBeforeRender = (_r, _s, cam) => ПОЛОЖЕНИЕ_КАМЕРЫ.value.copy(cam.position);

    this.материалы = создатьМатериалы(this.профиль.шейдер);
    this.сборщик = new СборщикСцены(scene, this.материалы);
    this.тени = new Тени(gl, scene);
    this.пол = new ПолПомещения(scene, this.материалы.пол);
    this.стрелки = new Стрелки(scene);
    this.контурВыделения = new Контур(scene, '#f0b429', 0.9, 11);
    this.контурПроблем = new Контур(scene, '#ff3b30', 1, 12);
    this.lod = new ВыборФаски(
      camera,
      (id, p) => this.сборщик.расстояниеДо(id, p),
      () => this.сборщик.идыЭкземпляров(),
    );
    this.камераОбзора = new КамераОбзора(camera, gl.domElement, () => this.попроситьКадр());
    this.жесты = new Жесты({ el: gl.domElement, camera, сборщик: this.сборщик, стрелки: this.стрелки, камераОбзора: this.камераОбзора, попроситьКадр: () => this.попроситьКадр() });

    this.применитьПрофиль(this.профиль, 'старт');
    if (this.режим === 'редактор') {
      this.камераОбзора.подключить();
      this.жесты.подключить();
    }
    this.подписаться();
    this.синхронизировать(true);
    this.наблюдательТемы = new MutationObserver(() => {
      this.синхронизировать(false);
      this.попроситьКадр();
    });
    this.наблюдательТемы.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    зарегистрироватьПревью(() => this.снятьПревью());
    document.addEventListener('visibilitychange', this.видимость);
    gl.domElement.addEventListener('webglcontextrestored', this.контекстВосстановлен);
    this.hidden = document.hidden;
    void this.запуститьСамопроверку();
    this.спокойствие = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private спокойствие = false;

  /* ------------------------------------------------------------ кадры */

  /** Единственная просьба кадра: не больше одного invalidate за тик */
  попроситьКадр = () => {
    if (this.флагКадра || this.hidden || this.освобождено) return;
    this.флагКадра = true;
    this.о.invalidate();
  };

  /** Потеря контекста WebGL (сон ноутбука, сбой драйвера): полная пересборка сцены и пересчёт теней */
  private контекстВосстановлен = () => {
    this.журнал.push('контекст WebGL восстановлен: пересборка сцены');
    this.открытий = -1;
    this.синхронизировать(true);
    this.тени.запросить();
  };

  private видимость = () => {
    this.hidden = document.hidden;
    if (!this.hidden) this.попроситьКадр();
  };

  /** Вызывается из useFrame до рендера */
  кадр(dt: number, сейчас: number) {
    this.флагКадра = false;
    this.кадров++;
    const { camera, gl } = this.о;
    if (this.режим === 'обложка') this.облёт(сейчас);
    this.камераОбзора.кадр(dt);
    ПОЛОЖЕНИЕ_КАМЕРЫ.value.copy(camera.position);
    camera.updateMatrixWorld();

    const высотаCSS = gl.domElement.clientHeight || 800;
    this.стрелки.обновить(camera, высотаCSS);

    this.проверитьФаску(сейчас);

    this.тени.передКадром(сейчас);
    this.обновитьМетки();

    if (this.режимКачества === 'авто' && !this.самопроверкаИдёт) {
      const н = this.монитор.кадр(сейчас);
      if (н) this.переключитьКачество(н, 'кадры');
    }
  }

  /** Обложка: медленный облёт камеры вокруг помещения (один постановочный момент приложения, §6 DESIGN.md) */
  private облёт(сейчас: number) {
    const о = this.камераОбзора.текущаяОбласть;
    const cx = (о.x0 + о.x1) / 2;
    const cz = (о.z0 + о.z1) / 2;
    const размер = Math.max(о.x1 - о.x0, о.z1 - о.z0, 2);
    const R = Math.min(размер * 0.72 + 1.3, размер / 2 + 2.8);
    const a = this.спокойствие || this.профиль.имя === 'слабый ноутбук' ? 0.55 : (сейчас / 1000) * 0.09 + 0.55;
    const px = cx + Math.sin(a) * R;
    const pz = cz + Math.cos(a) * R;
    const py = о.высота * 0.85 + размер * 0.2;
    const dx = cx - px;
    const dy = о.высота * 0.3 - py;
    const dz = cz - pz;
    this.камераОбзора.pos.set(px, py, pz);
    this.камераОбзора.yaw = Math.atan2(-dx, -dz);
    this.камераОбзора.pitch = Math.asin(dy / Math.hypot(dx, dy, dz));
    if (!this.спокойствие && this.профиль.имя !== 'слабый ноутбук' && !this.hidden) {
      if (this.профиль.имя === 'среднее') window.setTimeout(() => this.попроситьКадр(), 33);
      else this.попроситьКадр();
    }
  }

  /** Настоящая фаска вблизи: проверка, когда камера заметно сдвинулась (не чаще раза в 100 мс) */
  /** Для проверок: принудительно «настоящая» (все изделия с фаской) или «шейдер» (ни одного); 'авто' — по расстоянию */
  режимФаски: 'авто' | 'шейдер' | 'настоящая' = 'авто';
  private применённыйРежимФаски = 'авто';

  проверитьФаску(сейчас: number) {
    if (this.режимФаски !== 'авто') {
      if (this.применённыйРежимФаски !== this.режимФаски) {
        this.применённыйРежимФаски = this.режимФаски;
        this.сборщик.установитьФаски(this.режимФаски === 'настоящая' ? new Set(this.сборщик.идыЭкземпляров()) : new Set());
        this.попроситьКадр();
      }
      return;
    }
    if (this.применённыйРежимФаски !== 'авто') {
      this.применённыйРежимФаски = 'авто';
      this.lod.сброс();
      this.сборщик.установитьФаски(new Set());
    }
    if (this.профиль.фаскиМакс <= 0 || !this.lod.нужна(сейчас)) return;
    const { gl } = this.о;
    const высотаПикс = (gl.domElement.clientHeight || 800) * gl.getPixelRatio();
    const набор = this.lod.обновить(сейчас, высотаПикс, this.профиль.фаскиМакс);
    if (набор) {
      this.сборщик.установитьФаски(набор);
      this.попроситьКадр();
    }
  }

  /* ------------------------------------------------------------ подписка на store */

  private подписаться() {
    this.отписка = useКухня.subscribe(() => this.синхронизировать(false));
  }

  private синхронизировать(принудительно: boolean) {
    const с = useКухня.getState();
    const р = this.ссылки;
    const новыйПроект = с.открытий !== this.открытий;
    if (новыйПроект) {
      this.открытий = с.открытий;
      this.сборщик.сброс();
      this.lod.сброс();
      this.пол.обновить(undefined);
      р.о = undefined;
      р.п = undefined;
      this.ключОбласти = '';
      this.ключГраниц = '';
    }
    const изменилсяПроект = с.проект2.объекты !== р.о || с.проект2.помещения !== р.п || с.помещениеАктивное !== р.а || принудительно || новыйПроект;
    const изменилсяВид = с.выбрано !== р.в || с.инструмент !== р.и || с.обзор !== (р.ж as string);

    if (изменилсяПроект) {
      const было = р.о;
      р.о = с.проект2.объекты;
      р.п = с.проект2.помещения;
      р.а = с.помещениеАктивное;
      this.применитьПроект(с.проект2, с.помещениеАктивное, было === undefined);
    }
    const фонЭфф = this.эффективныйФон(с.проект2.настройки.фон);
    if (фонЭфф !== this.фонТекущий) this.установитьФон(фонЭфф);

    if (изменилсяПроект || изменилсяВид) {
      р.в = с.выбрано;
      р.и = с.инструмент;
      р.ж = с.обзор;
      this.обновитьВыделение();
    }
    if (с.обзор !== this.последнийОбзор) {
      this.последнийОбзор = с.обзор;
      this.камераОбзора.пресет(с.обзор);
    }
    this.попроситьКадр();
  }

  private применитьПроект(п: ПроектV2, активное: string, первый: boolean) {
    const видимые = new Set([активное]);
    const итог = this.сборщик.применить(п, видимые);
    const пом = п.помещения.find((x) => x.id === активное);
    this.пол.обновить(пом);
    // область камеры: границы контура ±3 м; при смене размеров помещения камера встаёт заново (как в v1)
    if (пом) {
      const г = границыКонтура(пом.контур);
      const ключ = `${активное}|${г.x0}|${г.x1}|${г.z0}|${г.z1}|${высотаДляРендера(пом)}`;
      this.камераОбзора.установитьОбласть({ x0: г.x0 / 1000, x1: г.x1 / 1000, z0: г.z0 / 1000, z1: г.z1 / 1000, высота: высотаДляРендера(пом) / 1000, контур: пом.контур });
      if (ключ !== this.ключОбласти) {
        const былПервым = this.ключОбласти === '';
        this.ключОбласти = ключ;
        if (!былПервым || первый) this.камераОбзора.пресет(useКухня.getState().обзор);
      }
    }
    if (итог.менялось || первый) {
      const б = this.сборщик.границы(п, видимые);
      const ключГраниц = [б.min.x, б.min.y, б.min.z, б.max.x, б.max.y, б.max.z].map((v) => v.toFixed(2)).join(',');
      if (ключГраниц !== this.ключГраниц) {
        this.ключГраниц = ключГраниц;
        this.тени.подогнать(б);
      }
      // тени по событиям: пересчёт нужен всегда, если менялась геометрия
      const вЖесте = useКухня.getState().жест === 'идёт';
      if (вЖесте && this.профиль.тениВЖесте === 'редкие') this.тени.запроситьВЖесте(this.профиль, performance.now());
      else this.тени.запросить();
      this.запланироватьПроверку();
    }
    if (useКухня.getState().жест !== 'идёт' && this.жестБылЖивым) {
      this.жестБылЖивым = false;
      this.тени.запросить();
    }
    if (useКухня.getState().жест === 'идёт') this.жестБылЖивым = true;
  }
  private жестБылЖивым = false;

  private фонТекущий = '';

  /** Фон по умолчанию (#171a1f) следует за темой интерфейса; свой цвет из настроек проекта — как задан. На обложке всегда по теме. */
  private эффективныйФон(фонПроекта: string): string {
    const поТеме = this.режим === 'обложка' || !фонПроекта || фонПроекта.toLowerCase() === '#171a1f';
    if (!поТеме) return фонПроекта;
    const ц = getComputedStyle(document.documentElement).getPropertyValue('--фон').trim();
    return ц || '#171a1f';
  }

  private наблюдательТемы: MutationObserver | null = null;

  private установитьФон(цвет: string) {
    const { scene } = this.о;
    this.фонТекущий = цвет;
    scene.background = new THREE.Color(цвет);
    scene.fog = this.профиль.туман ? new THREE.Fog(цвет, 18, 60) : null;
  }

  /** Контуры и стрелки выделенных; цели берутся из сборщика */
  private обновитьВыделение() {
    const с = useКухня.getState();
    const точки = [];
    const цели = [];
    for (const id of this.режим === 'обложка' ? [] : с.выбрано) {
      const з = this.сборщик.запись(id);
      if (!з) continue;
      цели.push(з.цель);
      точки.push({ id, позиция: з.цель.позиция, cos: з.цель.cos, sin: з.цель.sin, размер: [з.цель.полу[0] * 2, з.цель.полу[1] * 2, з.цель.полу[2] * 2] as [number, number, number] });
    }
    this.контурВыделения.обновить(цели);
    const режим = с.инструмент === 'крутить' ? 'крутить' : с.инструмент === 'растянуть' ? 'растянуть' : 'двигать';
    this.стрелки.задать(режим, точки);
    this.выбраноКлюч = с.выбрано.join(',');
  }

  /* ------------------------------------------------------------ проверка «влезает» */

  private запланироватьПроверку() {
    if (this.таймерПроверки || this.режим === 'обложка') return;
    this.таймерПроверки = window.setTimeout(() => {
      this.таймерПроверки = 0;
      if (this.освобождено) return;
      const с = useКухня.getState();
      this.проблемы = проверитьВлезает(с.проект2).filter((x) => с.проект2.объекты.find((о) => о.id === x.id)?.помещение === с.помещениеАктивное);
      const худшие = new Map<string, Проблема>();
      for (const п of this.проблемы) {
        const был = худшие.get(п.id);
        if (!был || п.мм > был.мм) худшие.set(п.id, п);
      }
      useКухня.setState({ проблем: худшие.size });
      const цели = [...худшие.keys()].map((id) => this.сборщик.запись(id)?.цель).filter((x) => !!x);
      this.контурПроблем.обновить(цели as NonNullable<(typeof цели)[number]>[]);
      // HTML-метки с цифрой
      const нужные = new Set(худшие.keys());
      for (const [id, эл] of this.метки) {
        if (!нужные.has(id)) {
          эл.remove();
          this.метки.delete(id);
        }
      }
      if (this.о.оверлей) {
        for (const [id, п] of худшие) {
          let эл = this.метки.get(id);
          if (!эл) {
            эл = document.createElement('div');
            эл.className = 'метка-влезает';
            this.о.оверлей.appendChild(эл);
            this.метки.set(id, эл);
          }
          эл.textContent = `⚠ ${п.мм} мм`;
          эл.title = п.текст;
          эл.dataset.вид = п.вид;
        }
      }
      this.попроситьКадр();
    }, 120);
  }

  /** Островок действий над выделенным объектом: позиция по проекции верха габарита */
  private обновитьОстровок(r: DOMRect) {
    const эл = this.о.оверлей?.querySelector<HTMLElement>('.островок');
    if (!эл) return;
    const с = useКухня.getState();
    const з = с.выбрано.length === 1 ? this.сборщик.запись(с.выбрано[0]) : undefined;
    if (!з || с.жест === 'идёт') {
      эл.dataset.скрыт = '1';
      return;
    }
    const ц = з.цель;
    this._в.set(ц.позиция[0], ц.позиция[1] + ц.полу[1] * 2, ц.позиция[2]).project(this.о.camera);
    const виден = this._в.z > -1 && this._в.z < 1;
    // островок стоит выше верха габарита И выше кончика стрелки «вверх» (90 px от основания), чтобы не перекрывать её
    const основание = this._в2.set(ц.позиция[0], ц.позиция[1], ц.позиция[2]).project(this.о.camera);
    const yВерха = ((1 - this._в.y) / 2) * r.height;
    const yКончика = ((1 - основание.y) / 2) * r.height - 90;
    эл.dataset.скрыт = виден ? '0' : '1';
    if (виден) {
      const x = Math.min(r.width - 120, Math.max(120, ((this._в.x + 1) / 2) * r.width));
      const выше = Math.min(yВерха, yКончика) - 16;
      if (выше >= 52) {
        эл.style.transform = `translate(${x}px, ${выше}px) translate(-50%, -100%)`;
      } else {
        // над объектом нет места (объект у верхнего края кадра): островок под основанием
        const ниже = Math.min(r.height - 60, ((1 - основание.y) / 2) * r.height + 104);
        эл.style.transform = `translate(${x}px, ${ниже}px) translate(-50%, 0)`;
      }
    }
  }

  private обновитьМетки() {
    const r0 = this.о.gl.domElement.getBoundingClientRect();
    if (this.режим === 'редактор') this.обновитьОстровок(r0);
    if (!this.метки.size) return;
    const r = r0;
    for (const [id, эл] of this.метки) {
      const з = this.сборщик.запись(id);
      if (!з) continue;
      const ц = з.цель;
      this._в.set(ц.позиция[0], ц.позиция[1] + ц.полу[1] * 2 + 0.08, ц.позиция[2]).project(this.о.camera);
      const виден = this._в.z > -1 && this._в.z < 1;
      эл.style.display = виден ? '' : 'none';
      if (виден) эл.style.transform = `translate(${((this._в.x + 1) / 2) * r.width}px, ${((1 - this._в.y) / 2) * r.height}px) translate(-50%, -100%)`;
    }
  }

  /* ------------------------------------------------------------ качество */

  применитьПрофиль(п: Профиль, причина: string) {
    const { scene } = this.о;
    this.профиль = п;
    this.о.setDpr(Math.min(window.devicePixelRatio || 1, п.dprМакс));
    this.тени.применитьПрофиль(п);
    this.материалы.применитьПрофиль(п.шейдер);
    if (п.отражения && !this.окружение) {
      const pmrem = new THREE.PMREMGenerator(this.о.gl);
      this.окружение = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }
    scene.environment = п.отражения ? this.окружение : null;
    scene.environmentIntensity = 0.18;
    const фон = useКухня.getState().проект2.настройки.фон || '#171a1f';
    scene.fog = п.туман ? new THREE.Fog(фон, 18, 60) : null;
    this.lod.сброс();
    this.журнал.push(`профиль «${п.имя}» (${причина})`);
    this.попроситьКадр();
  }

  private переключитьКачество(имя: ИмяПрофиля, причина: string) {
    if (ПРОФИЛИ[имя] === this.профиль) return;
    this.применитьПрофиль(ПРОФИЛИ[имя], причина);
    useКухня.getState().сообщить(`Качество: ${имя} — ${причина === 'кадры' ? 'кадры медленные' : причина}`);
    if (ПРОФИЛИ[имя].msaa !== this.msaa) this.журнал.push('сглаживание поменяется при следующем открытии редактора');
  }

  private самопроверкаИдёт = false;

  /** 60 кадров подряд при первом открытии: медиана больше 20 мс — на ступень ниже (только в режиме «авто») */
  private async запуститьСамопроверку() {
    if (this.режимКачества !== 'авто' || this.видеокарта.программная) {
      this.завершитьСамопроверку({ медиана: 0, профиль: this.профиль.имя });
      return;
    }
    await new Promise((r) => setTimeout(r, 600));
    if (this.освобождено || document.hidden) {
      this.завершитьСамопроверку({ медиана: 0, профиль: this.профиль.имя });
      return;
    }
    this.самопроверкаИдёт = true;
    const { gl, scene, camera } = this.о;
    const интервалы: number[] = [];
    await new Promise<void>((готово) => {
      let прошлый = performance.now();
      let n = 0;
      const шаг = (t: number) => {
        if (this.освобождено) return готово();
        if (n > 0) интервалы.push(t - прошлый);
        прошлый = t;
        gl.render(scene, camera);
        if (++n < 61) requestAnimationFrame(шаг);
        else готово();
      };
      requestAnimationFrame(шаг);
    });
    this.самопроверкаИдёт = false;
    const р = профильПослеСамопроверки(this.профиль.имя, интервалы);
    if (р.годится && р.профиль !== this.профиль.имя) this.переключитьКачество(р.профиль, `самопроверка: кадр ${р.медиана.toFixed(1)} мс`);
    this.журнал.push(`самопроверка: медиана кадра ${р.медиана.toFixed(1)} мс, профиль «${this.профиль.имя}»`);
    this.завершитьСамопроверку({ медиана: р.медиана, профиль: this.профиль.имя });
  }

  /* ------------------------------------------------------------ превью и отладка */

  private снятьПревью(): string | undefined {
    try {
      const { gl, scene, camera } = this.о;
      gl.render(scene, camera);
      const к = document.createElement('canvas');
      к.width = 320;
      к.height = Math.round((gl.domElement.height / gl.domElement.width) * 320) || 200;
      const ctx = к.getContext('2d');
      if (!ctx) return gl.domElement.toDataURL('image/jpeg', 0.6);
      ctx.drawImage(gl.domElement, 0, 0, к.width, к.height);
      return к.toDataURL('image/jpeg', 0.6);
    } catch {
      return undefined;
    }
  }

  /** Экранная точка (клиентские координаты) для мировой точки в метрах */
  экраннаяТочка(x: number, y: number, z: number) {
    const { gl, camera } = this.о;
    camera.updateMatrixWorld();
    const v = new THREE.Vector3(x, y, z).project(camera);
    const r = gl.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  освободить() {
    this.освобождено = true;
    this.отписка?.();
    this.наблюдательТемы?.disconnect();
    document.removeEventListener('visibilitychange', this.видимость);
    this.о.gl.domElement.removeEventListener('webglcontextrestored', this.контекстВосстановлен);
    window.clearTimeout(this.таймерПроверки);
    for (const эл of this.метки.values()) эл.remove();
    this.метки.clear();
    this.камераОбзора.отключить();
    this.жесты.отключить();
    this.сборщик.сброс();
    this.стрелки.освободить();
    this.контурВыделения.освободить();
    this.контурПроблем.освободить();
    this.пол.освободить();
    this.материалы.освободить();
    this.окружение?.dispose();
    this.о.scene.onBeforeRender = () => {};
  }
}
