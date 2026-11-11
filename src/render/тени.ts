/**
 * Свет и тени. shadowMap.autoUpdate = false: карта пересчитывается только по событиям (см. рендер.md §4.2),
 * флаг ставит одна функция здесь, перед кадром. Стены тень не отбрасывают. Камера тени подгоняется под границы сцены.
 * В three 0.187 PCFSoftShadowMap удалён: мягкость — PCFShadowMap + shadow.radius.
 */
import * as THREE from 'three';
import type { Профиль } from './качество';

const НАПРАВЛЕНИЕ = new THREE.Vector3(3, 10, 2).normalize();

export class Тени {
  readonly свет: THREE.DirectionalLight;
  readonly заполняющий: THREE.DirectionalLight;
  readonly полусфера: THREE.HemisphereLight;
  private нужно = true;
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
    const центр = б.getCenter(new THREE.Vector3());
    const размер = б.getSize(new THREE.Vector3());
    const R = Math.max(1, размер.length() / 2 + 0.3);
    const расстояние = R * 1.2 + 1;
    this.свет.position.copy(центр).addScaledVector(НАПРАВЛЕНИЕ, расстояние);
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
