/**
 * <Холст/>: Canvas R3F, профиль качества, подключение ядра. R3F остаётся для холста, камеры и цикла кадров
 * (frameloop="demand"); всё остальное строит ядро императивно.
 */
import { memo, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import { useКухня } from '../store';
import { Ядро } from './ядро';
import { ПРОФИЛИ, определитьВидеокарту, профильПоВидеокарте } from './качество';
import { вКлиентские } from './отладка';

let видеокартаКэш: ReturnType<typeof профильПоВидеокарте> | null = null;
const видеокарта = () => (видеокартаКэш ??= профильПоВидеокарте(определитьВидеокарту()));

function ЯдроРендера({ оверлей }: { оверлей: React.RefObject<HTMLDivElement | null> }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const setDpr = useThree((s) => s.setDpr);
  const ядро = useRef<Ядро | null>(null);

  useEffect(() => {
    const я = new Ядро({
      gl,
      scene,
      camera: camera as import('three').PerspectiveCamera,
      invalidate: () => invalidate(),
      setDpr: (d) => setDpr(d),
      оверлей: оверлей.current,
    });
    ядро.current = я;
    вКлиентские(я, gl, scene, camera as import('three').PerspectiveCamera);
    return () => {
      я.освободить();
      ядро.current = null;
      delete (window as unknown as Record<string, unknown>).__кухня;
    };
  }, [gl, scene, camera, invalidate, setDpr, оверлей]);

  useFrame((state, dt) => {
    ядро.current?.кадр(dt, performance.now());
  });
  return null;
}

function СеткаПола() {
  const шаг = useКухня((s) => s.шагСетки);
  const видна = useКухня((s) => s.сеткаВидна);
  return (
    <Grid
      visible={видна}
      args={[40, 40]}
      cellSize={шаг / 1000}
      cellThickness={0.6}
      cellColor="#3a4150"
      sectionSize={(шаг / 1000) * 10}
      sectionThickness={1}
      sectionColor="#5b667a"
      fadeDistance={45}
      fadeStrength={1}
      position={[0, 0.002, 0]}
      infiniteGrid
    />
  );
}

function ХолстВнутри() {
  const оверлей = useRef<HTMLDivElement>(null);
  // сглаживание задаётся при создании холста: берём из профиля при открытии редактора
  const msaa = useMemo(() => {
    const настройка = useКухня.getState().проект2.настройки.качество;
    const имя = настройка === 'авто' ? видеокарта().профиль : настройка;
    return ПРОФИЛИ[имя].msaa;
  }, []);

  return (
    <>
      <Canvas
        shadows="percentage"
        frameloop="demand"
        dpr={1}
        gl={{ antialias: msaa, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
        camera={{ fov: 55, near: 0.05, far: 300, position: [0, 3, 6] }}
      >
        <ЯдроРендера оверлей={оверлей} />
        <СеткаПола />
      </Canvas>
      <div ref={оверлей} className="оверлей-меток" />
    </>
  );
}

export const Холст = memo(ХолстВнутри);
