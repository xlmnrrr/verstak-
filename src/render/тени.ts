/**
 * Свет и тени. shadowMap.autoUpdate = false: карта пересчитывается только по событиям (см. рендер.md §4.2),
 * флаг ставит одна функция здесь, перед кадром. Стены тень не отбрасывают. Камера тени подгоняется под границы сцены.
 * В three 0.187 PCFSoftShadowMap удалён: мягкость — PCFShadowMap + shadow.radius.
 */
import * as THREE from 'three';
import type { Профиль } from './качество';

const НАПРАВЛЕНИЕ_ПО_УМОЛЧАНИЮ = new THREE.Vector3(3, 10, 2).normalize();

export class Тени {
  readonly свет: THREE.DirectionalLight;
  readonly заполняющий: THREE.DirectionalLight;
  readonly полусфера: THREE.HemisphereLight;
  private нужно = true;
  private направление = НАПРАВЛЕНИЕ_ПО_УМОЛЧАНИЮ.clone();
  private границы: THREE.Box3 | null = null;
  /** сколько раз карта теней пересчитывалась (для отчёта и проверок) */
  пересчётов = 0;
  private последнийПересчёт = 0;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    сцена: THREE.Object3D,
  ) {
    gl.shadowMap.enabled = true;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.type = THREE.PCFShadowMap;

    this.полусфера = new THREE.HemisphereLight('#dfe6ef', '#3a3a3a', 0.75);
    this.свет = new THREE.DirectionalLight('#ffffff', 1.5);
    this.свет.castShadow = true;
    this.свет.shadow.bias = -0.0002;
    this.свет.shadow.normalBias = 0.004;
    this.свет.shadow.camera.near = 0.1;
    this.заполняющий = new THREE.DirectionalLight('#ffffff', 0.35);
    this.заполняющий.position.set(-6, 5, -4);
    сцена.add(this.полусфера, this.свет, this.свет.target, this.заполняющий);
  }

  применитьПрофиль(п: Профиль) {
    const ш = this.свет.shadow;
    if (ш.mapSize.x !== п.карта) {
      ш.mapSize.set(п.карта, п.карта);
      ш.map?.dispose();
      ш.map = null;
    }
    ш.radius = п.размытие;
    this.запросить();
  }

  /** Подогнать камеру тени под границы сцены (метры) + 0,3 м */
  подогнать(б: THREE.Box3) {
    this.границы = б;
    const центр = б.getCenter(new THREE.Vector3());
    const размер = б.getSize(new THREE.Vector3());
    const R = Math.max(1, размер.length() / 2 + 0.3);
    const расстояние = R * 1.2 + 1;
    this.свет.position.copy(центр).addScaledVector(this.направление, расстояние);
    this.свет.target.position.copy(центр);
    const к = this.свет.shadow.camera;
    к.left = -R;
    к.right = R;
    к.top = R;
    к.bottom = -R;
    к.near = 0.1;
    к.far = расстояние + R * 1.1;
    к.updateProjectionMatrix();
    this.свет.target.updateMatrixWorld();
    this.запросить();
  }

  /**
   * Солнце по времени суток (6…22): восток утром, юг днём, запад вечером; низкое солнце тёплое и слабее.
   * null — как раньше (фиксированный свет). Вечером и ночью падают рассеянный свет и солнце.
   */
  установитьСолнце(час: number | null) {
    if (час === null) {
      this.направление.copy(НАПРАВЛЕНИЕ_ПО_УМОЛЧАНИЮ);
      this.свет.intensity = 1.5;
      this.свет.color.set('#ffffff');
      this.полусфера.intensity = 0.75;
    } else {
      const t = Math.min(1, Math.max(0, (час - 6) / 16));
      const высота = 0.09 + Math.sin(Math.PI * t) * 1.0; // радианы над горизонтом: 5° утром, ~62° в 14:00
      const a = Math.PI * t;
      this.направление.set(Math.cos(a) * Math.cos(высота), Math.sin(высота), Math.sin(a) * Math.cos(высота)).normalize();
      const яркость = Math.min(1, Math.sin(Math.PI * t) * 1.6);
      this.свет.intensity = 0.15 + 1.4 * яркость;
      this.свет.color.set('#ffd7a3').lerp(new THREE.Color('#ffffff'), Math.min(1, высота / 0.8));
      this.полусфера.intensity = 0.28 + 0.5 * яркость;
    }
    if (this.границы) this.подогнать(this.границы);
    this.запросить();
  }

  /** Событие из списка §4.2: пересчитать тени в ближайшем кадре */
  запросить() {
    this.нужно = true;
  }

  /** Во время жеста в слабом профиле тени пересчитываются не чаще раза в 250 мс */
  запроситьВЖесте(п: Профиль, сейчас: number): boolean {
    if (п.тениВЖесте === 'живые' || сейчас - this.последнийПересчёт > 250) {
      this.нужно = true;
      return true;
    }
    return false;
  }

  get ожидает() {
    return this.нужно;
  }

  /** Перед рендером кадра: поставить флаг пересчёта не больше раза за кадр */
  передКадром(сейчас: number) {
    if (!this.нужно) return;
    this.gl.shadowMap.needsUpdate = true;
    this.нужно = false;
    this.пересчётов++;
    this.последнийПересчёт = сейчас;
  }
}
