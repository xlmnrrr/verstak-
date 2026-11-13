/**
 * <Холст/>: Canvas R3F, профиль качества, подключение ядра. R3F остаётся для холста, камеры и цикла кадров
 * (frameloop="demand"); всё остальное строит ядро императивно.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import { useКухня } from '../store';
import { useUI } from '../store/интерфейс';
import { Ядро } from './ядро';
import { ПРОФИЛИ, определитьВидеокарту, профильПоВидеокарте } from './качество';
import { вКлиентские } from './отладка';

let видеокартаКэш: ReturnType<typeof профильПоВидеокарте> | null = null;
const видеокарта = () => (видеокартаКэш ??= профильПоВидеокарте(определитьВидеокарту()));

function ЯдроРендера({ оверлей, режим }: { оверлей: React.RefObject<HTMLDivElement | null>; режим: 'редактор' | 'обложка' }) {
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
      режим,
    });
    ядро.current = я;
    вКлиентские(я, gl, scene, camera as import('three').PerspectiveCamera);
    return () => {
      я.освободить();
      ядро.current = null;
      delete (window as unknown as Record<string, unknown>).__кухня;
    };
  }, [gl, scene, camera, invalidate, setDpr, оверлей, режим]);

  useFrame((state, dt) => {
    ядро.current?.кадр(dt, performance.now());
  });
  // «До / после»: пока шторка открыта, кадр рисует ядро двумя проходами (useFrame с приоритетом 1 отключает рендер R3F)
  const шторка = useUI((s) => !!s.шторка) && режим === 'редактор';
  // «Фото»: кадр через постобработку (GTAO, bloom, OutputPass); шторка «до / после» важнее
  const фото = useUI((s) => s.фотоРежим) && режим === 'редактор';
  return шторка ? <ПроходШторки ядро={ядро} /> : фото ? <ПроходФото ядро={ядро} /> : null;
}

function ПроходФото({ ядро }: { ядро: React.RefObject<Ядро | null> }) {
  useFrame((state) => {
    if (!ядро.current?.отрисоватьФото()) state.gl.render(state.scene, state.camera);
  }, 1);
  return null;
}

function ПроходШторки({ ядро }: { ядро: React.RefObject<Ядро | null> }) {
  useFrame((state) => {
    if (!ядро.current?.отрисоватьШторку()) state.gl.render(state.scene, state.camera);
  }, 1);
  return null;
}

/** Цвета сетки по теме интерфейса: тёплые линии в Мастерской, холодные в Кальке */
function useСветлая() {
  const [светлая, установить] = useState(document.documentElement.dataset.theme === 'light');
  useEffect(() => {
    const н = new MutationObserver(() => установить(document.documentElement.dataset.theme === 'light'));
    н.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => н.disconnect();
  }, []);
  return светлая;
}

function СеткаПола({ показывать }: { показывать: boolean }) {
  const светлая = useСветлая();
  const шаг = useКухня((s) => s.шагСетки);
  const видна = useКухня((s) => s.сеткаВидна);
  return (
    <Grid
      name="сетка-пола"
      visible={видна && показывать}
      args={[40, 40]}
      cellSize={шаг / 1000}
      cellThickness={0.6}
      cellColor={светлая ? '#c3ccc7' : '#3a3126'}
      sectionSize={(шаг / 1000) * 10}
      sectionThickness={1}
      sectionColor={светлая ? '#97a39d' : '#5a4c3c'}
      fadeDistance={45}
      fadeStrength={1}
      position={[0, 0.002, 0]}
      infiniteGrid
    />
  );
}

function ХолстВнутри({ режим = 'редактор', children }: { режим?: 'редактор' | 'обложка'; children?: React.ReactNode }) {
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
        <ЯдроРендера оверлей={оверлей} режим={режим} />
        <СеткаПола показывать={режим === 'редактор'} />
      </Canvas>
      <div ref={оверлей} className="оверлей-меток">
        {children}
      </div>
    </>
  );
}

export const Холст = memo(ХолстВнутри);
