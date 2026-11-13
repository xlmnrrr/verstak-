/**
 * Проход 2: контрольные листы изделий — каждое с «одного метра» (меньше — ближе, крупные — чтобы влезло целиком),
 * в профиле «Стандарт», днём, с детальными моделями (режим «настоящая»). Плитки по 3 × 2 на лист, подписанные id.
 * Запуск (dev-сервер на 5274):
 *   node scripts/лист-изделий.cjs http://127.0.0.1:5274/ --id холодильник-600,плита-600 [--имя техника] [--открыть] [--профиль фото] [--колонки 3]
 *   node scripts/лист-изделий.cjs http://127.0.0.1:5274/ --категория Техника
 *   node scripts/лист-изделий.cjs http://127.0.0.1:5274/ --все
 * Выход: проверка/v2/листы/<имя>-<n>.png
 */
const path = require('node:path');
const fs = require('node:fs');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза } = require('./электрон-общее.cjs');

const арг = process.argv.slice(2);
const АДРЕС = арг.find((а) => /^https?:\/\//.test(а)) || 'http://127.0.0.1:5274/';
const знач = (имя) => {
  const i = арг.indexOf(имя);
  return i >= 0 ? арг[i + 1] : null;
};
const ИДЫ = знач('--id') ? знач('--id').split(',') : null;
const КАТЕГОРИЯ = знач('--категория');
const ВСЕ = арг.includes('--все');
const ИМЯ = знач('--имя') || (КАТЕГОРИЯ ? КАТЕГОРИЯ.replace(/[^\wа-яё]+/gi, '-') : ВСЕ ? 'все' : 'выборка');
const ОТКРЫТЬ = арг.includes('--открыть');
const ПРОФИЛЬ = знач('--профиль') || 'стандарт';
const КОЛОНКИ = Number(знач('--колонки') || 3);
const СТРОК = Number(знач('--строк') || 2);
const АЗИМУТ = Number(знач('--азимут') || 28);
const ВОЗВЫШЕНИЕ = Number(знач('--возвышение') || 14);

const корень = process.cwd();
const выход = path.join(корень, 'проверка', 'v2', 'листы');
const данные = path.join(корень, 'проверка', 'данные-листы');
fs.mkdirSync(выход, { recursive: true });

(async () => {
  fs.rmSync(данные, { recursive: true, force: true });
  fs.mkdirSync(path.join(данные, 'Проекты'), { recursive: true });
  const процесс = запуститьElectron({ адрес: АДРЕС, данные, порт: 9363, доп: { VERSTAK_AUTOSAVE_SEC: '3600' } });
  try {
    const { браузер, стр } = await подключиться(АДРЕС, 9363);
    const к = слушатьКонсоль(стр);
    const S = (fn, ...а) => стр.evaluate(fn, ...а);
    await пауза(2500);
    await S(() => localStorage.setItem('верстак:интерфейс', JSON.stringify({ туркПройден: true })));
    await стр.reload();
    await пауза(2000);
    await S(
      (профиль) => {
        const с = window.__верстакStore.getState();
        с.создать('листы', { длина: 14000, ширина: 14000, высота_стен: 3000, толщина_стен: 100, форма: 'прямоугольник', обои: '#d9d3c8', пол: '#c9c3b6', фон: '#d9d3c8' });
        if (с.сеткаВидна) с.переключитьСетку();
        try {
          с.задатьКачество?.(профиль);
        } catch {
          /* нет такого действия */
        }
      },
      ПРОФИЛЬ,
    );
    await пауза(2000);
    await S(() => {
      const я = window.__кухня.ядро;
      const ст = я.сборщик.группы.get('стена');
      if (ст) ст.mesh.visible = false;
      я.режимФаски = 'настоящая';
    });
    const список = await S(async () => {
      const { КАТАЛОГ_V2 } = await import('/src/model/каталог/index.ts');
      return КАТАЛОГ_V2.map((и) => ({ id: и.id, название: и.название, категория: и.категория, тип: и.тип, габ: и.габариты, крепление: и.крепление, подъём: и.подъём ?? 0 }));
    });
    const нужные = список.filter((и) => (ИДЫ ? ИДЫ.includes(и.id) : КАТЕГОРИЯ ? и.категория === КАТЕГОРИЯ : ВСЕ));
    console.log(`изделий: ${нужные.length}`);
    const W = Number(знач('--w') || 640);
    const H = Math.round((W * 3) / 4);
    const плиток = [];
    for (const и of нужные) {
      const кадр = await S(
        async (изд, W, H, азимут, возвышение, открыть) => {
          const с = window.__верстакStore.getState();
          const я = window.__кухня.ядро;
          const { gl, scene, camera } = window.__кухня;
          const потолочное = изд.крепление === 'потолок';
          const стеновое = изд.крепление === 'стена';
          const y0 = потолочное ? (изд.подъём || 2700) : стеновое ? изд.подъём || 1000 : 0;
          const id = с.добавитьМодуль(изд.id, [0, y0, 0]);
          if (!id) return null;
          const y = window.__верстакStore.getState().проект2.объекты.find((о) => о.id === id)?.позиция[1] ?? y0;
          if (открыть) {
            const с3 = window.__верстакStore.getState();
            с3.выбрать([id]);
            const кн = [...document.querySelectorAll('button')].find((b) => /Открыть/.test(b.textContent || ''));
            if (кн) кн.click();
          }
          window.__верстакStore.getState().выбрать([]);
          const cy = (y + изд.габ.в / 2) / 1000;
          const R = Math.hypot(изд.габ.ш, изд.габ.г, изд.габ.в) / 2000;
          const fov = camera.fov;
          const d = Math.max(1.0, (R / Math.sin(((fov / 2) * Math.PI) / 180)) * 1.02);
          const φ = (азимут * Math.PI) / 180;
          const θ = ((потолочное ? -32 : возвышение) * Math.PI) / 180;
          const P = [d * Math.sin(φ) * Math.cos(θ), cy + d * Math.sin(θ), d * Math.cos(φ) * Math.cos(θ)];
          const dx = 0 - P[0];
          const dy = cy - P[1];
          const dz = 0 - P[2];
          window.__кухня.поставитьКамеру(P[0], P[1], P[2], Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
          scene.fog = null;
          я.попроситьКадр?.();
          await new Promise((r) => setTimeout(r, 900));
          я.тени.запросить();
          gl.shadowMap.needsUpdate = true;
          gl.render(scene, camera);
          const исх = gl.domElement;
          const холст = document.createElement('canvas');
          холст.width = W;
          холст.height = H;
          const g = холст.getContext('2d');
          // кадр окна шире 4:3 — вырезаем центральную часть по высоте
          const k = Math.min(исх.width / W, исх.height / H);
          const sw = W * k;
          const sh = H * k;
          g.drawImage(исх, (исх.width - sw) / 2, (исх.height - sh) / 2, sw, sh, 0, 0, W, H);
          const url = холст.toDataURL('image/png');
          // убрать изделие
          const с2 = window.__верстакStore.getState();
          с2.выбрать([id]);
          с2.удалитьВыбранное();
          return url;
        },
        и,
        W,
        H,
        АЗИМУТ,
        ВОЗВЫШЕНИЕ,
        ОТКРЫТЬ,
      );
      if (кадр) плиток.push({ и, кадр });
      else console.log('не добавилось:', и.id);
    }
    // листы
    const н = КОЛОНКИ * СТРОК;
    for (let s = 0; s * н < плиток.length; s++) {
      const группа = плиток.slice(s * н, s * н + н);
      const png = await S(
        async (группа, W, H, КОЛ, СТР) => {
          const загрузить = (u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = u; });
          const c = document.createElement('canvas');
          const подп = 26;
          c.width = W * КОЛ;
          c.height = (H + подп) * СТР;
          const g = c.getContext('2d');
          g.fillStyle = '#1e1914';
          g.fillRect(0, 0, c.width, c.height);
          for (let i = 0; i < группа.length; i++) {
            const x = (i % КОЛ) * W;
            const y = Math.floor(i / КОЛ) * (H + подп);
            g.drawImage(await загрузить(группа[i].кадр), x, y + подп, W, H);
            g.fillStyle = '#f3ece1';
            g.font = '600 15px Segoe UI, sans-serif';
            g.fillText(`${группа[i].и.id}  ${группа[i].и.габ.ш}×${группа[i].и.габ.г}×${группа[i].и.габ.в}`, x + 8, y + 18);
          }
          return c.toDataURL('image/png').split(',')[1];
        },
        группа,
        W,
        H,
        КОЛОНКИ,
        СТРОК,
      );
      const файл = path.join(выход, `${ИМЯ}-${s + 1}.png`);
      fs.writeFileSync(файл, Buffer.from(png, 'base64'));
      console.log('лист:', файл);
    }
    if (к.шейдер.length) console.log('ОШИБКИ ШЕЙДЕРА:', к.шейдер.slice(0, 3));
    if (к.ошибки.length) console.log('ошибки консоли:', к.ошибки.slice(0, 5));
    браузер.disconnect();
  } finally {
    процесс.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
