import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useКухня, зарегистрироватьПревью } from '../store';
import { м } from '../lib/utils';
import { Деталь } from './Furniture';
import type { Dims, Obj, Room } from '../types';

/** Состояние гизмо — нужно, чтобы камера не крутилась, когда тянут за ручку */
export const гизмо = { тащат: false };

/* ------------------------------- Комната ------------------------------- */

function Стена({
  ширина,
  высота,
  толщина,
  позиция,
  поворот,
  цвет,
  meshRef,
}: {
  ширина: number;
  высота: number;
  толщина: number;
  позиция: [number, number, number];
  поворот: number;
  цвет: string;
  meshRef?: React.Ref<THREE.Mesh>;
}) {
  return (
    <mesh ref={meshRef} position={позиция} rotation={[0, поворот, 0]} castShadow receiveShadow>
      <boxGeometry args={[ширина, высота, толщина]} />
      <meshStandardMaterial color={цвет} roughness={0.95} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Комната({ комната }: { комната: Room }) {
  const д = м(комната.длина);
  const ш = м(комната.ширина);
  const в = м(комната.высота_стен);
  const т = м(комната.толщина_стен);
  const { camera } = useThree();

  // Стена, которая стоит между камерой и комнатой, скрывается — иначе она закрывает вид.
  const задняя = useRef<THREE.Mesh>(null);
  const передняя = useRef<THREE.Mesh>(null);
  const левая = useRef<THREE.Mesh>(null);
  const правая = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const к = camera.position;
    if (задняя.current) задняя.current.visible = к.z > -ш / 2;
    if (передняя.current) передняя.current.visible = к.z < ш / 2;
    if (левая.current) левая.current.visible = к.x > -д / 2;
    if (правая.current) правая.current.visible = к.x < д / 2;
  });

  return (
    <group>
      {/* пол */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[д, ш]} />
        <meshStandardMaterial color={комната.пол} roughness={0.7} />
      </mesh>

      {/* четыре стены. Потолка нет — по требованию заказчика. */}
      <Стена meshRef={задняя} ширина={д + т * 2} высота={в} толщина={т} позиция={[0, в / 2, -ш / 2 - т / 2]} поворот={0} цвет={комната.обои} />
      <Стена meshRef={передняя} ширина={д + т * 2} высота={в} толщина={т} позиция={[0, в / 2, ш / 2 + т / 2]} поворот={0} цвет={комната.обои} />
      <Стена meshRef={левая} ширина={ш + т * 2} высота={в} толщина={т} позиция={[-д / 2 - т / 2, в / 2, 0]} поворот={Math.PI / 2} цвет={комната.обои} />
      <Стена meshRef={правая} ширина={ш + т * 2} высота={в} толщина={т} позиция={[д / 2 + т / 2, в / 2, 0]} поворот={Math.PI / 2} цвет={комната.обои} />
    </group>
  );
}

/* ------------------------------- Камера -------------------------------- */

const ПРЕСЕТЫ = {
  сверху: { pitch: -0.78, yaw: 0, высота: 1.55, отступ: 0.95, глаза: false },
  прогулка: { pitch: -0.05, yaw: 0, высота: 0, отступ: 0.42, глаза: true },
} as const;

function Камера() {
  const { camera, gl } = useThree();
  const invalidate = useThree((s) => s.invalidate);
  const обзор = useКухня((s) => s.обзор);
  const комната = useКухня((s) => s.проект.комната);
  const двиг = useRef({
    yaw: 0,
    pitch: -0.78,
    pos: new THREE.Vector3(0, 4, 6),
    клавиши: new Set<string>(),
    тащим: false,
    панорама: false,
    x: 0,
    y: 0,
    прошлоОбзора: '' as string,
  });

  // постановка камеры при смене режима обзора
  useEffect(() => {
    const п = ПРЕСЕТЫ[обзор];
    const д = м(комната.длина);
    const ш = м(комната.ширина);
    const в = м(комната.высота_стен);
    const размер = Math.max(д, ш);
    const ц = двиг.current;
    ц.yaw = п.yaw;
    ц.pitch = п.pitch;
    if (п.глаза) {
      ц.pos.set(0, 1.6, ш / 2 - 0.35);
      ц.yaw = 0;
      ц.pitch = -0.05;
    } else {
      // подбираем высоту и отступ так, чтобы комната целиком попала в кадр
      ц.pos.set(0, Math.max(в * 0.9, размер * 0.6), размер * 0.95 + 1.5);
      ц.pitch = -0.72;
    }
    ц.прошлоОбзора = обзор;
    camera.position.copy(ц.pos);
    camera.quaternion.setFromEuler(new THREE.Euler(ц.pitch, ц.yaw, 0, 'YXZ'));
    camera.lookAt(0, п.глаза ? 1.4 : в / 3, 0);
  }, [обзор, комната.длина, комната.ширина, комната.высота_стен, camera]);

  useEffect(() => {
    const el = gl.domElement;
    const наКлав = (e: KeyboardEvent, вниз: boolean) => {
      const ц = двиг.current;
      if (вниз) ц.клавиши.add(e.code);
      else ц.клавиши.delete(e.code);
      if (вниз && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) e.preventDefault();
    };
    const кд = (e: KeyboardEvent) => наКлав(e, true);
    const ку = (e: KeyboardEvent) => наКлав(e, false);

    const вниз = (e: PointerEvent) => {
      if (гизмо.тащат) return;
      // Левая кнопка — выбор и перетаскивание объектов. Камера — правая (наклон) и средняя (сдвиг).
      if (e.button !== 2 && e.button !== 1) return;
      const ц = двиг.current;
      ц.тащим = true;
      ц.панорама = e.button === 1;
      ц.x = e.clientX;
      ц.y = e.clientY;
      el.setPointerCapture?.(e.pointerId);
    };
    const двинуть = (e: PointerEvent) => {
      const ц = двиг.current;
      if (!ц.тащим) return;
      const dx = e.clientX - ц.x;
      const dy = e.clientY - ц.y;
      ц.x = e.clientX;
      ц.y = e.clientY;
      if (ц.панорама) {
        const вправо = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, ц.yaw, 0, 'YXZ'));
        const вверх = new THREE.Vector3(0, 1, 0);
        ц.pos.addScaledVector(вправо, -dx * 0.006);
        ц.pos.addScaledVector(вверх, dy * 0.006);
      } else {
        ц.yaw -= dx * 0.0035;
        ц.pitch = Math.max(-1.45, Math.min(1.45, ц.pitch - dy * 0.0032));
      }
      invalidate();
    };
    const вверх = (e: PointerEvent) => {
      двиг.current.тащим = false;
      el.releasePointerCapture?.(e.pointerId);
    };
    const показатьВсё = () => {
      const ц = двиг.current;
      const д = м(комната.длина);
      const ш = м(комната.ширина);
      const в = м(комната.высота_стен);
      const размер = Math.max(д, ш);
      ц.yaw = 0;
      ц.pitch = -0.72;
      ц.pos.set(0, в * 0.75 + размер * 0.55, размер * 0.95 + 1.5);
      camera.position.copy(ц.pos);
      camera.quaternion.setFromEuler(new THREE.Euler(ц.pitch, ц.yaw, 0, 'YXZ'));
      camera.lookAt(0, в / 3, 0);
    };
    window.addEventListener('кухня:показать-всё', показатьВсё);
    const колесо = (e: WheelEvent) => {
      e.preventDefault();
      const ц = двиг.current;
      const напр = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(ц.pitch, ц.yaw, 0, 'YXZ'));
      ц.pos.addScaledVector(напр, -Math.sign(e.deltaY) * 0.6);
      invalidate();
    };
    const контекст = (e: Event) => e.preventDefault();

    window.addEventListener('keydown', кд);
    window.addEventListener('keyup', ку);
    el.addEventListener('pointerdown', вниз);
    el.addEventListener('pointermove', двинуть);
    el.addEventListener('pointerup', вверх);
    el.addEventListener('pointercancel', вверх);
    el.addEventListener('wheel', колесо, { passive: false });
    el.addEventListener('contextmenu', контекст);
    return () => {
      window.removeEventListener('keydown', кд);
      window.removeEventListener('keyup', ку);
      window.removeEventListener('кухня:показать-всё', показатьВсё);
      el.removeEventListener('pointerdown', вниз);
      el.removeEventListener('pointermove', двинуть);
      el.removeEventListener('pointerup', вверх);
      el.removeEventListener('pointercancel', вверх);
      el.removeEventListener('wheel', колесо);
      el.removeEventListener('contextmenu', контекст);
    };
  }, [gl, camera, комната.длина, комната.ширина, комната.высота_стен, invalidate]);

  useFrame((_, dt) => {
    const ц = двиг.current;
    const шаг = (ц.клавиши.has('ShiftLeft') ? 9 : 3.2) * Math.min(dt, 0.05);
    const вперёд = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(ц.pitch, ц.yaw, 0, 'YXZ'));
    const вправо = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, ц.yaw, 0, 'YXZ'));
    if (ц.клавиши.has('KeyW')) ц.pos.addScaledVector(вперёд, шаг);
    if (ц.клавиши.has('KeyS')) ц.pos.addScaledVector(вперёд, -шаг);
    if (ц.клавиши.has('KeyD')) ц.pos.addScaledVector(вправо, шаг);
    if (ц.клавиши.has('KeyA')) ц.pos.addScaledVector(вправо, -шаг);
    if (ц.клавиши.has('KeyE') || ц.клавиши.has('Space')) ц.pos.y += шаг;
    if (ц.клавиши.has('KeyQ')) ц.pos.y -= шаг;

    const д = м(комната.длина);
    const ш = м(комната.ширина);
    const в = м(комната.высота_стен);
    const запас = 3;
    ц.pos.x = Math.max(-д / 2 - запас, Math.min(д / 2 + запас, ц.pos.x));
    ц.pos.z = Math.max(-ш / 2 - запас, Math.min(ш / 2 + запас, ц.pos.z));
    ц.pos.y = Math.max(0.15, Math.min(в + 6, ц.pos.y));

    camera.position.copy(ц.pos);
    camera.quaternion.setFromEuler(new THREE.Euler(ц.pitch, ц.yaw, 0, 'YXZ'));

    // в режиме «рендер по требованию» просим следующий кадр, пока летим
    if (
      ц.клавиши.size > 0 ||
      ц.тащим
    ) {
      invalidate();
    }
  });

  return null;
}

/* ------------------------------ Стрелки осей ---------------------------- */

function Стрелка({
  ось,
  цвет,
  длина,
  onDown,
}: {
  ось: 'x' | 'y' | 'z';
  цвет: string;
  длина: number;
  onDown: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const поворот: [number, number, number] =
    ось === 'x' ? [0, 0, -Math.PI / 2] : ось === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  return (
    <group rotation={поворот}>
      <mesh position={[0, длина / 2, 0]} onPointerDown={onDown}>
        <cylinderGeometry args={[0.014, 0.014, длина, 8]} />
        <meshBasicMaterial color={цвет} depthTest={false} transparent />
      </mesh>
      <mesh position={[0, длина + 0.06, 0]} onPointerDown={onDown}>
        <coneGeometry args={[0.05, 0.13, 12]} />
        <meshBasicMaterial color={цвет} depthTest={false} transparent />
      </mesh>
      {/* невидимая широкая зона, чтобы мышкой было легко попасть */}
      <mesh position={[0, длина / 2, 0]} onPointerDown={onDown} name={ось.toUpperCase()}>
        <cylinderGeometry args={[0.075, 0.075, длина + 0.12, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------ Объекты -------------------------------- */

function Объект({
  obj,
  выбран,
  режим,
  шаг,
  прилипание,
}: {
  obj: Obj;
  выбран: boolean;
  режим: 'translate' | 'rotate' | 'scale';
  шаг: number;
  прилипание: boolean;
}) {
  const группа = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const выбрать = useКухня((s) => s.выбрать);
  const добавитьКлик = useКухня((s) => s.добавитьКлик);
  const обновитьОбъект = useКухня((s) => s.обновитьОбъект);
  const обновитьГабариты = useКухня((s) => s.обновитьГабариты);
  const начатьИзменение = useКухня((s) => s.начатьИзменение);
  const комната = useКухня((s) => s.проект.комната);

  const позиция: [number, number, number] = [
    м(obj.позиция[0]),
    м(obj.подъём && obj.подъём > 0 ? obj.подъём : obj.позиция[1]),
    м(obj.позиция[2]),
  ];

  const углы: [number, number, number] = [
    ((obj.наклон_X ?? 0) * Math.PI) / 180,
    (-obj.поворот * Math.PI) / 180,
    ((obj.наклон_Z ?? 0) * Math.PI) / 180,
  ];

  // --- перетаскивание объекта мышкой по полу ---
  const тащим = useRef(false);
  const смещение = useRef(new THREE.Vector3());
  const высотаY = useRef(0);
  const луч = useRef(new THREE.Raycaster());

  // --- тяга за стрелки осей ---
  const осьТяга = useRef<null | {
    ось: 'x' | 'y' | 'z';
    t0: number;
    началоМ: THREE.Vector3;
    стартПоз: [number, number, number];
    стартРазмер: Dims;
    стартУглы: [number, number, number];
    стартY: number;
  }>(null);

  const лучИз = (clientX: number, clientY: number) => {
    const r = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1,
    );
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, camera);
    return rc.ray;
  };

  /** Где вдоль оси находится точка, ближайшая к курсору (метры от начала оси) */
  const параметрОси = (
    clientX: number,
    clientY: number,
    ось: 'x' | 'y' | 'z',
    начало: THREE.Vector3,
  ): number | null => {
    const ray = лучИз(clientX, clientY);
    const D = new THREE.Vector3(ось === 'x' ? 1 : 0, ось === 'y' ? 1 : 0, ось === 'z' ? 1 : 0);
    const w0 = начало.clone().sub(ray.origin);
    const b = D.dot(ray.direction);
    const d = D.dot(w0);
    const e = ray.direction.dot(w0);
    const denom = 1 - b * b;
    if (Math.abs(denom) < 1e-6) return null;
    return (b * e - d) / denom;
  };

  const начатьОсь = (ось: 'x' | 'y' | 'z') => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.nativeEvent.button !== 0) return;
    выбрать([obj.id]);
    const началоМ = new THREE.Vector3(позиция[0], позиция[1], позиция[2]);
    const t0 = параметрОси(e.nativeEvent.clientX, e.nativeEvent.clientY, ось, началоМ);
    if (t0 === null) return;
    начатьИзменение();
    осьТяга.current = {
      ось,
      t0,
      началоМ,
      стартПоз: [obj.позиция[0], obj.позиция[1], obj.позиция[2]],
      стартРазмер: { ...obj.габариты },
      стартУглы: [obj.поворот, obj.наклон_X ?? 0, obj.наклон_Z ?? 0],
      стартY: e.nativeEvent.clientY,
    };
    гизмо.тащат = true;
    gl.domElement.style.cursor = 'grabbing';
  };

  /** Проверяем, что под курсором именно наш объект */
  const моёЛи = (o: THREE.Object3D | null | undefined) => {
    let т: THREE.Object3D | null | undefined = o;
    while (т) {
      if (т === группа.current) return true;
      т = т.parent;
    }
    return false;
  };

  const взять = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.nativeEvent.shiftKey) добавитьКлик(obj.id);
    else выбрать([obj.id]);
    if (e.nativeEvent.button !== 0) return;
    if (!моёЛи(e.intersections[0]?.object)) return;
    if (гизмо.тащат) return;

    высотаY.current = м(obj.подъём && obj.подъём > 0 ? obj.подъём : obj.позиция[1]);
    смещение.current.set(позиция[0] - e.point.x, 0, позиция[2] - e.point.z);
    тащим.current = true;
    гизмо.тащат = true;
    начатьИзменение();
    gl.domElement.style.cursor = 'grabbing';
  };

  useEffect(() => {
    const плоскость = new THREE.Plane();
    const точка = new THREE.Vector3();
    const ndc = new THREE.Vector2();
    const нормаль = new THREE.Vector3(0, 1, 0);

    const двигать = (ev: PointerEvent) => {
      if (!тащим.current) return;
      const r = gl.domElement.getBoundingClientRect();
      ndc.set(
        ((ev.clientX - r.left) / r.width) * 2 - 1,
        -((ev.clientY - r.top) / r.height) * 2 + 1,
      );
      луч.current.setFromCamera(ndc, camera);
      плоскость.setFromNormalAndCoplanarPoint(нормаль, new THREE.Vector3(0, высотаY.current, 0));
      if (!луч.current.ray.intersectPlane(плоскость, точка)) return;
      let x = (точка.x + смещение.current.x) * 1000;
      let z = (точка.z + смещение.current.z) * 1000;
      if (прилипание && шаг > 0) {
        x = Math.round(x / шаг) * шаг;
        z = Math.round(z / шаг) * шаг;
      }
      // не выпускаем объект за стены. Math.max(0, …) обязателен:
      // если модуль шире комнаты, граница становится отрицательной и объект начинает прыгать.
      const полД = Math.max(0, м(комната.длина) / 2 - м(obj.габариты.ш) / 2);
      const полШ = Math.max(0, м(комната.ширина) / 2 - м(obj.габариты.г) / 2);
      x = Math.max(-полД * 1000, Math.min(полД * 1000, x));
      z = Math.max(-полШ * 1000, Math.min(полШ * 1000, z));
      const y = Math.round(высотаY.current * 1000);
      const нов: Partial<Obj> = { позиция: [Math.round(x), y, Math.round(z)] };
      if ((obj.подъём ?? 0) > 0) нов.подъём = y;
      обновитьОбъект(obj.id, нов);
    };

    const отпустить = () => {
      if (!тащим.current) return;
      тащим.current = false;
      гизмо.тащат = false;
      gl.domElement.style.cursor = 'default';
    };

    window.addEventListener('pointermove', двигать);
    window.addEventListener('pointerup', отпустить);
    window.addEventListener('pointercancel', отпустить);
    return () => {
      window.removeEventListener('pointermove', двигать);
      window.removeEventListener('pointerup', отпустить);
      window.removeEventListener('pointercancel', отпустить);
    };
  }, [gl, camera, прилипание, шаг, obj.id, obj.подъём, обновитьОбъект, комната.длина, комната.ширина, obj.габариты.ш, obj.габариты.г]);

  // --- движение по стрелкам осей: двигать / растянуть / крутить ---
  useEffect(() => {
    const двигатьОсь = (ev: PointerEvent) => {
      const т = осьТяга.current;
      if (!т) return;

      // «крутить»: тянем вверх-вниз, угол меняется
      if (режим === 'rotate') {
        const дельта = (ev.clientY - т.стартY) * 0.6;
        const [уголY, уголX, уголZ] = т.стартУглы;
        const патч: Partial<Obj> =
          т.ось === 'y'
            ? { поворот: (((Math.round(уголY + дельта) % 360) + 360) % 360) }
            : т.ось === 'x'
              ? { наклон_X: Math.round(уголX + дельта) }
              : { наклон_Z: Math.round(уголZ + дельта) };
        обновитьОбъект(obj.id, патч);
        return;
      }

      const t = параметрОси(ev.clientX, ev.clientY, т.ось, т.началоМ);
      if (t === null) return;
      const дельта = t - т.t0; // метры вдоль оси

      // «растянуть»: тот же жест меняет размер по этой оси
      if (режим === 'scale') {
        const поле: keyof Dims = т.ось === 'x' ? 'ш' : т.ось === 'z' ? 'г' : 'в';
        let размер = т.стартРазмер[поле] + дельта * 1000;
        if (прилипание && шаг > 0) размер = Math.round(размер / шаг) * шаг;
        обновитьГабариты(obj.id, { [поле]: Math.max(50, Math.round(размер)) } as Partial<Dims>);
        return;
      }

      // «двигать»: смещение строго по одной оси
      const смещ: [number, number, number] = [0, 0, 0];
      смещ[т.ось === 'x' ? 0 : т.ось === 'y' ? 1 : 2] = дельта * 1000;
      let x = т.стартПоз[0] + смещ[0];
      let y = т.стартПоз[1] + смещ[1];
      let z = т.стартПоз[2] + смещ[2];
      if (прилипание && шаг > 0) {
        x = Math.round(x / шаг) * шаг;
        y = Math.round(y / шаг) * шаг;
        z = Math.round(z / шаг) * шаг;
      }
      y = Math.max(0, Math.min(м(комната.высота_стен), y));
      const патч: Partial<Obj> = { позиция: [Math.round(x), Math.round(y), Math.round(z)] };
      if (т.ось === 'y') патч.подъём = Math.round(y);
      обновитьОбъект(obj.id, патч);
    };

    const отпуститьОсь = () => {
      if (!осьТяга.current) return;
      осьТяга.current = null;
      гизмо.тащат = false;
      gl.domElement.style.cursor = 'default';
    };

    window.addEventListener('pointermove', двигатьОсь);
    window.addEventListener('pointerup', отпуститьОсь);
    window.addEventListener('pointercancel', отпуститьОсь);
    return () => {
      window.removeEventListener('pointermove', двигатьОсь);
      window.removeEventListener('pointerup', отпуститьОсь);
      window.removeEventListener('pointercancel', отпуститьОсь);
    };
  }, [
    gl,
    camera,
    режим,
    прилипание,
    шаг,
    obj.id,
    obj.поворот,
    obj.наклон_X,
    obj.наклон_Z,
    обновитьОбъект,
    обновитьГабариты,
    комната.высота_стен,
  ]);

  const шагСнапа = прилипание ? Math.max(шаг, 1) / 1000 : undefined;

  return (
    <>
      <group
        ref={группа}
        position={позиция}
        rotation={углы}
        onPointerDown={взять}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'grab';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      >
        <Деталь obj={obj} />
        {выбран && (
          <mesh position={[0, м(obj.габариты.в) / 2, 0]}>
            <boxGeometry
              args={[м(obj.габариты.ш) + 0.02, м(obj.габариты.в) + 0.02, м(obj.габариты.г) + 0.02]}
            />
            <meshBasicMaterial color="#f0b429" wireframe transparent opacity={0.35} />
          </mesh>
        )}
      </group>

      {/* Стрелки осей: свои, а не TransformControls — так они гарантированно ловят мышь */}
      {выбран && (
        <group position={позиция}>
          <Стрелка ось="x" цвет="#e0563f" длина={0.55} onDown={начатьОсь('x')} />
          <Стрелка ось="y" цвет="#5fb87a" длина={0.55} onDown={начатьОсь('y')} />
          <Стрелка ось="z" цвет="#4f7fd0" длина={0.55} onDown={начатьОсь('z')} />
        </group>
      )}
    </>
  );
}

/* -------------------------------- Сцена -------------------------------- */

function РегистрацияПревью() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    // небольшой хук для автотестов: перевод мировой точки в координаты экрана
    (window as unknown as Record<string, unknown>).__кухня = {
      camera,
      gl,
      scene,
      экраннаяТочка: (x: number, y: number, z: number) => {
        const v = new THREE.Vector3(x, y, z).project(camera as THREE.Camera);
        const r = gl.domElement.getBoundingClientRect();
        return {
          x: r.left + ((v.x + 1) / 2) * r.width,
          y: r.top + ((1 - v.y) / 2) * r.height,
        };
      },
      /** Где на экране находится стрелка гизмо с данным именем ('X','Y','Z') */
      стрелкаГизмо: (имя: string) => {
        let найдено: THREE.Object3D | null = null;
        scene.traverse((o) => {
          if (!найдено && o.name === имя && (o as THREE.Mesh).isMesh) найдено = o;
        });
        if (!найдено) return null;
        const точка = найдено as THREE.Object3D;
        точка.updateWorldMatrix(true, false);
        const основание = new THREE.Vector3().setFromMatrixPosition(точка.matrixWorld);
        const масштаб = new THREE.Vector3().setFromMatrixScale(точка.matrixWorld).y || 1;
        const верх = основание.clone().add(new THREE.Vector3(0, 0.75 * масштаб, 0));
        const проекция = (т: THREE.Vector3) => {
          const v = т.clone().project(camera as THREE.Camera);
          const r = gl.domElement.getBoundingClientRect();
          return {
            x: r.left + ((v.x + 1) / 2) * r.width,
            y: r.top + ((1 - v.y) / 2) * r.height,
          };
        };
        return { основание: проекция(основание), верх: проекция(верх) };
      },
    };
  }, [gl, scene, camera]);

  useEffect(() => {
    // регистрируем функцию снятия кадра для превью проекта
    зарегистрироватьПревью(() => {
      try {
        gl.render(scene, camera);
        const полный = gl.domElement.toDataURL('image/jpeg', 0.6);
        // уменьшаем до 320 px по ширине
        const к = document.createElement('canvas');
        к.width = 320;
        к.height = Math.round((gl.domElement.height / gl.domElement.width) * 320) || 200;
        const ctx = к.getContext('2d');
        if (!ctx) return полный;
        ctx.drawImage(gl.domElement, 0, 0, к.width, к.height);
        return к.toDataURL('image/jpeg', 0.6);
      } catch {
        return undefined;
      }
    });
  }, [gl, scene, camera]);
  return null;
}

export function Сцена() {
  const проект = useКухня((s) => s.проект);
  const выбрано = useКухня((s) => s.выбрано);
  const инструмент = useКухня((s) => s.инструмент);
  const обзор = useКухня((s) => s.обзор);
  const шаг = useКухня((s) => s.шагСетки);
  const сеткаВидна = useКухня((s) => s.сеткаВидна);
  const прилипание = useКухня((s) => s.прилипание);
  const выбрать = useКухня((s) => s.выбрать);

  const режим: 'translate' | 'rotate' | 'scale' =
    инструмент === 'крутить' ? 'rotate' : инструмент === 'растянуть' ? 'scale' : 'translate';

  const выбранные = useMemo(() => new Set(выбрано), [выбрано]);

  // хук для автотестов: мировые координаты объектов в метрах
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__проект_объекты = проект.объекты.map((o) => [
      м(o.позиция[0]),
      м(o.подъём && o.подъём > 0 ? o.подъём : o.позиция[1]),
      м(o.позиция[2]),
    ]);
  }, [проект.объекты]);
  const цель = обзор === 'прогулка' ? new THREE.Vector3(0, 1.5, 0) : new THREE.Vector3(0, 0.8, 0);

  return (
    <Canvas
      shadows
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
      camera={{ fov: 55, near: 0.05, far: 300, position: [0, 3, 6] }}
      onPointerMissed={() => выбрать([])}
    >
      <color attach="background" args={[проект.комната.фон || '#171a1f']} />
      <fog attach="fog" args={[проект.комната.фон || '#171a1f', 18, 60]} />

      <hemisphereLight args={['#dfe6ef', '#3a3a3a', 0.75]} />
      <directionalLight
        position={[5, 9, 4]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <directionalLight position={[-6, 5, -4]} intensity={0.35} />

      <Комната комната={проект.комната} />

      <Grid
        visible={сеткаВидна}
        args={[40, 40]}
        cellSize={м(шаг)}
        cellThickness={0.6}
        cellColor="#3a4150"
        sectionSize={м(шаг) * 10}
        sectionThickness={1}
        sectionColor="#5b667a"
        fadeDistance={45}
        fadeStrength={1}
        position={[0, 0.002, 0]}
        infiniteGrid
      />

      {проект.объекты.map((o) => (
        <Объект
          key={o.id}
          obj={o}
          выбран={выбранные.has(o.id)}
          режим={режим}
          шаг={шаг}
          прилипание={прилипание}
        />
      ))}

      <Камера />
      <ОбновлениеПоИзменению />
      <РегистрацияПревью />
    </Canvas>
  );
}

/** В режиме «рендер по требованию» просим кадр, когда меняется проект */
function ОбновлениеПоИзменению() {
  const проект = useКухня((s) => s.проект);
  const выбрано = useКухня((s) => s.выбрано);
  const инструмент = useКухня((s) => s.инструмент);
  const сеткаВидна = useКухня((s) => s.сеткаВидна);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [проект, выбрано, инструмент, сеткаВидна, invalidate]);
  return null;
}
