/**
 * Модели glTF/GLB из папки приложения (docs/модели.md §4): грузятся по требованию, Draco-декодер — из `Библиотека/draco/`
 * (офлайн, в сеть не ходим). Модель нормализуется к основанию: низ габарита в нуле, центр по X и Z в нуле —
 * так её ставят «на» поверхность. Пока файл не загрузился, на месте модели ничего нет (коробку для выбора даёт габарит примитива).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const кэш = new Map<string, Promise<THREE.Object3D | null>>();
let загрузчик: GLTFLoader | null = null;
let основа = './Библиотека/модели/';

export function настроитьGLTF(папкаМоделей: string, папкаDraco: string) {
  основа = папкаМоделей;
  const draco = new DRACOLoader();
  draco.setDecoderPath(папкаDraco);
  draco.setDecoderConfig({ type: 'wasm' });
  загрузчик = new GLTFLoader();
  загрузчик.setDRACOLoader(draco);
}

/** Загрузить (один раз) и отдать оригинал, нормализованный к основанию; клоны делает вызывающий */
export function моделиGLTF(имя: string): Promise<THREE.Object3D | null> {
  let п = кэш.get(имя);
  if (!п) {
    if (!загрузчик) настроитьGLTF(основа, './Библиотека/draco/');
    п = загрузчик!
      .loadAsync(`${основа}${имя}.glb`)
      .then((g) => {
        const сцена = g.scene;
        const б = new THREE.Box3().setFromObject(сцена);
        const ц = б.getCenter(new THREE.Vector3());
        сцена.position.sub(new THREE.Vector3(ц.x, б.min.y, ц.z));
        const обёртка = new THREE.Group();
        обёртка.add(сцена);
        обёртка.traverse((о) => {
          const м = о as THREE.Mesh;
          if (м.isMesh) {
            м.castShadow = true;
            м.receiveShadow = true;
          }
        });
        обёртка.userData.габарит = б.getSize(new THREE.Vector3());
        return обёртка;
      })
      .catch(() => null);
    кэш.set(имя, п);
  }
  return п;
}
