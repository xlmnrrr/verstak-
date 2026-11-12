/**
 * Камера «Сверху» и «Прогулка»: математика v1 один к одному, но без React.
 * ПКМ — поворот, СКМ — сдвиг, колесо — вдоль взгляда, W A S D, Q / E, Пробел, Shift. ЛКМ камеру не трогает.
 * Клавиши не работают, пока фокус в поле ввода (в v1 они двигали камеру при наборе имени).
 */
import * as THREE from 'three';
import { точкаВнутри } from '../model/помещение';

export interface Область {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** высота стен, м */
  высота: number;
  /** контур помещения, мм (для точки старта «Прогулки») */
  контур?: [number, number][];
}

type Обзор = 'сверху' | 'прогулка';

const _эйлер = new THREE.Euler(0, 0, 0, 'YXZ');
const _вперёд = new THREE.Vector3();
const _вправо = new THREE.Vector3();

const этоПоле = (цель: EventTarget | null) => {
  const э = цель as HTMLElement | null;
  if (!э || !э.tagName) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(э.tagName) || э.isContentEditable;
};

export class КамераОбзора {
  yaw = 0;
  pitch = -0.72;
  readonly pos = new THREE.Vector3(0, 4, 6);
  private клавиши = new Set<string>();
  private тащим = false;
  private панорама = false;
  private x = 0;
  private y = 0;
  private область: Область = { x0: -2, x1: 2, z0: -2, z1: 2, высота: 2.7 };
  private подключена = false;
  /** жест объекта (стрелки, перетаскивание) держит мышь: камера не реагирует */
  занятаЖестом = false;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly el: HTMLElement,
    private readonly попроситьКадр: () => void,
  ) {}

  get текущаяОбласть(): Область {
    return this.область;
  }

  /** Камера занята и просит кадры каждый кадр */
  get активна() {
    return this.клавиши.size > 0 || this.тащим;
  }

  установитьОбласть(о: Область) {
    this.область = о;
  }

  /** Постановка камеры при смене режима обзора или размеров помещения */
  пресет(обзор: Обзор) {
    const { x0, x1, z0, z1, высота: в, контур } = this.область;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const размер = Math.max(x1 - x0, z1 - z0);
    this.yaw = 0;
    if (обзор === 'прогулка') {
      const кандидаты: [number, number][] = [
        [cx, z1 - 0.35],
        [cx, cz],
      ];
      if (контур?.length) {
        const ср = контур.reduce((а, п) => [а[0] + п[0], а[1] + п[1]], [0, 0]);
        кандидаты.push([ср[0] / контур.length / 1000, ср[1] / контур.length / 1000]);
      }
      const внутри = контур ? кандидаты.find(([x, z]) => точкаВнутри(контур, x * 1000, z * 1000)) : кандидаты[0];
      const [px, pz] = внутри ?? кандидаты[0];
      this.pos.set(px, 1.6, pz);
      this.pitch = -0.05;
    } else {
      this.pos.set(cx, Math.max(в * 0.9, размер * 0.6), cz + размер * 0.95 + 1.5);
      this.pitch = -0.72;
    }
    this.применить();
    this.попроситьКадр();
  }

  /** «Показать всё» (Home) */
  показатьВсё() {
    const { x0, x1, z0, z1, высота: в } = this.область;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const размер = Math.max(x1 - x0, z1 - z0);
    this.yaw = 0;
    this.pitch = -0.72;
    this.pos.set(cx, в * 0.75 + размер * 0.55, cz + размер * 0.95 + 1.5);
    this.применить();
    this.попроситьКадр();
  }

  private применить() {
    this.camera.position.copy(this.pos);
    _эйлер.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(_эйлер);
  }

  /** Вызывать на каждом кадре до рендера */
  кадр(dt: number) {
    const шаг = (this.клавиши.has('ShiftLeft') || this.клавиши.has('ShiftRight') ? 9 : 3.2) * Math.min(dt, 0.05);
    _эйлер.set(this.pitch, this.yaw, 0, 'YXZ');
    _вперёд.set(0, 0, -1).applyEuler(_эйлер);
    _эйлер.set(0, this.yaw, 0, 'YXZ');
    _вправо.set(1, 0, 0).applyEuler(_эйлер);
    const к = this.клавиши;
    if (к.has('KeyW')) this.pos.addScaledVector(_вперёд, шаг);
    if (к.has('KeyS')) this.pos.addScaledVector(_вперёд, -шаг);
    if (к.has('KeyD')) this.pos.addScaledVector(_вправо, шаг);
    if (к.has('KeyA')) this.pos.addScaledVector(_вправо, -шаг);
    if (к.has('KeyE') || к.has('Space')) this.pos.y += шаг;
    if (к.has('KeyQ')) this.pos.y -= шаг;

    const { x0, x1, z0, z1, высота: в } = this.область;
    const запас = 3;
    this.pos.x = Math.max(x0 - запас, Math.min(x1 + запас, this.pos.x));
    this.pos.z = Math.max(z0 - запас, Math.min(z1 + запас, this.pos.z));
    this.pos.y = Math.max(0.15, Math.min(в + 6, this.pos.y));
    this.применить();
    if (this.активна) this.попроситьКадр();
  }

  /* ------------------------------------------------------------ события */

  private наКлавиши = (e: KeyboardEvent, вниз: boolean) => {
    if (вниз && (этоПоле(e.target) || e.ctrlKey || e.metaKey || e.altKey)) return;
    if (вниз) this.клавиши.add(e.code);
    else this.клавиши.delete(e.code);
    if (вниз && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) e.preventDefault();
    this.попроситьКадр();
  };
  private кд = (e: KeyboardEvent) => this.наКлавиши(e, true);
  private ку = (e: KeyboardEvent) => this.наКлавиши(e, false);
  private потерянФокус = () => {
    this.клавиши.clear();
    this.тащим = false;
  };

  private вниз = (e: PointerEvent) => {
    if (this.занятаЖестом) return;
    if (e.button !== 2 && e.button !== 1) return;
    this.тащим = true;
    this.панорама = e.button === 1;
    this.x = e.clientX;
    this.y = e.clientY;
    this.el.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  private двинуть = (e: PointerEvent) => {
    if (!this.тащим) return;
    const dx = e.clientX - this.x;
    const dy = e.clientY - this.y;
    this.x = e.clientX;
    this.y = e.clientY;
    if (this.панорама) {
      _эйлер.set(0, this.yaw, 0, 'YXZ');
      _вправо.set(1, 0, 0).applyEuler(_эйлер);
      this.pos.addScaledVector(_вправо, -dx * 0.006);
      this.pos.y += dy * 0.006;
    } else {
      this.yaw -= dx * 0.0035;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * 0.0032));
    }
    this.применить();
    this.попроситьКадр();
  };
  private вверх = (e: PointerEvent) => {
    if (!this.тащим) return;
    this.тащим = false;
    this.el.releasePointerCapture?.(e.pointerId);
    this.попроситьКадр();
  };
  private колесо = (e: WheelEvent) => {
    e.preventDefault();
    _эйлер.set(this.pitch, this.yaw, 0, 'YXZ');
    _вперёд.set(0, 0, -1).applyEuler(_эйлер);
    this.pos.addScaledVector(_вперёд, -Math.sign(e.deltaY) * 0.6);
    this.применить();
    this.попроситьКадр();
  };
  private контекст = (e: Event) => e.preventDefault();
  private всё = () => this.показатьВсё();

  подключить() {
    if (this.подключена) return;
    this.подключена = true;
    window.addEventListener('keydown', this.кд);
    window.addEventListener('keyup', this.ку);
    window.addEventListener('blur', this.потерянФокус);
    window.addEventListener('кухня:показать-всё', this.всё);
    this.el.addEventListener('pointerdown', this.вниз);
    this.el.addEventListener('pointermove', this.двинуть);
    this.el.addEventListener('pointerup', this.вверх);
    this.el.addEventListener('pointercancel', this.вверх);
    this.el.addEventListener('wheel', this.колесо, { passive: false });
    this.el.addEventListener('contextmenu', this.контекст);
  }

  отключить() {
    if (!this.подключена) return;
    this.подключена = false;
    window.removeEventListener('keydown', this.кд);
    window.removeEventListener('keyup', this.ку);
    window.removeEventListener('blur', this.потерянФокус);
    window.removeEventListener('кухня:показать-всё', this.всё);
    this.el.removeEventListener('pointerdown', this.вниз);
    this.el.removeEventListener('pointermove', this.двинуть);
    this.el.removeEventListener('pointerup', this.вверх);
    this.el.removeEventListener('pointercancel', this.вверх);
    this.el.removeEventListener('wheel', this.колесо);
    this.el.removeEventListener('contextmenu', this.контекст);
  }
}
