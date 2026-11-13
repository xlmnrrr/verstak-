/**
 * Проход 2: квартира целиком (пять комнат из шести сцен) одним кадром сверху — для скриншота в профиле «Фото».
 * Запуск: node scripts/квартира-фото.cjs <адрес> [--профиль фото|высокое] [--имя Р2-квартира-фото]
 */
const path = require('node:path');
const fs = require('node:fs');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза } = require('./электрон-общее.cjs');
const { СЦЕНЫ, взгляд } = require('./сцены-прохода2.cjs');

const арг = process.argv.slice(2);
const АДРЕС = арг.find((а) => /^https?:\/\//.test(а)) || 'http://127.0.0.1:5274/';
const знач = (имя) => {
  const i = арг.indexOf(имя);
  return i >= 0 ? арг[i + 1] : null;
};
const ПРОФИЛЬ = знач('--профиль') || 'фото';
const ИМЯ = знач('--имя') || 'Р2-квартира-фото';
const корень = process.cwd();
const снимки = path.join(корень, 'проверка', 'v2');

// раскладка комнат на сетке 100 мм: [номер, x0, z0, x1, z1, сцена]
const КОМНАТЫ = [
  [1, 0, 0, 17, 13, 'гостиная'],
  [2, 17, 0, 31, 10, 'кухня'],
  [3, 0, 13, 13, 25, 'спальня'],
  [4, 13, 13, 22, 21, 'прихожая'],
  [5, 22, 13, 30, 19, 'ванная'],
];

(async () => {
  const данные = path.join(корень, 'проверка', 'данные-квартира');
  fs.rmSync(данные, { recursive: true, force: true });
  fs.mkdirSync(path.join(данные, 'Проекты'), { recursive: true });
  const процесс = запуститьElectron({ адрес: АДРЕС, данные, порт: 9391, доп: { VERSTAK_AUTOSAVE_SEC: '3600' } });
  try {
    const { браузер, стр } = await подключиться(АДРЕС, 9391);
    const к = слушатьКонсоль(стр);
    const S = (fn, ...а) => стр.evaluate(fn, ...а);
    const сессия = await стр.target().createCDPSession();
    try {
      const { windowId } = await сессия.send('Browser.getWindowForTarget');
      await сессия.send('Browser.setWindowBounds', { windowId, bounds: { width: 1600, height: 960, windowState: 'normal' } });
    } catch {
      /* размер окна не главное */
    }
    await пауза(2500);
    await S(() => localStorage.setItem('верстак:интерфейс', JSON.stringify({ туркПройден: true })));
    await стр.reload();
    await пауза(2500);
    await S(() => [...document.querySelectorAll('.модал button')].find((b) => b.textContent.includes('Пропустить'))?.click());
    const итог = await S(
      async (КОМНАТЫ, СЦЕНЫ, профиль) => {
        const м = {
          проект: await import('/src/model/проект.ts'),
          кв: await import('/src/model/квартира.ts'),
          каталог: await import('/src/model/каталог/index.ts'),
        };
        const клетка = 300;
        const Z = 28;
        const X = 34;
        const клетки = Array.from({ length: Z }, () => new Array(X).fill(0));
        for (const [н, x0, z0, x1, z1] of КОМНАТЫ) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) клетки[z][x] = н;
        const комнаты = {};
        for (const [н, , , , , сц] of КОМНАТЫ) комнаты[н] = { тип: СЦЕНЫ[сц].тип, название: сц[0].toUpperCase() + сц.slice(1), высота: 2700 };
        const проёмы = [
          { клетка: [4, 16], сторона: 'в', вид: 'арка', ширина: 1500, высота: 2100 },
          { клетка: [12, 5], сторона: 'ю', вид: 'дверь', ширина: 900, высота: 2050 },
          { клетка: [12, 15], сторона: 'ю', вид: 'дверь', ширина: 900, высота: 2050 },
          { клетка: [15, 21], сторона: 'в', вид: 'дверь', ширина: 700, высота: 2050 },
          { клетка: [5, 0], сторона: 'з', вид: 'окно', ширина: 1600, высота: 1400, от_пола: 850 },
          { клетка: [3, 30], сторона: 'в', вид: 'окно', ширина: 900, высота: 1200, от_пола: 1000 },
          { клетка: [18, 0], сторона: 'з', вид: 'окно', ширина: 1600, высота: 1400, от_пола: 850 },
        ];
        const р = м.кв.квартираПоСетке({ клетка, клетки, комнаты, проёмы, толщина_стен: 100 });
        const п = м.проект.новыйПроектV2('Квартира', р.помещения[0]);
        п.помещения = р.помещения;
        п.связи = р.связи;
        п.настройки.качество = профиль;
        п.настройки.свободная_сборка = true;
        let n = 0;
        for (const [н, , , , , сц] of КОМНАТЫ) {
          const пом = р.помещения.find((x) => x.название.toLowerCase() === сц);
          if (!пом) continue;
          const xs = пом.контур.map((т) => т[0]);
          const zs = пом.контур.map((т) => т[1]);
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
          const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
          for (const [id, x, z, поворот, y, св] of СЦЕНЫ[сц].предметы) {
            const изд = м.каталог.изделиеПоИд(id);
            if (!изд) continue;
            const э = м.проект.новыйЭкземпляр(изд, пом.id, [cx + x, y ?? (изд.крепление === 'стена' ? (изд.подъём ?? 1500) : 0), cz + z], `к${n++}`);
            э.поворот = поворот;
            if (св) Object.assign(э, св);
            п.объекты.push(э);
          }
        }
        window.__верстакStore.getState().загрузить(п);
        const всеX = р.помещения.flatMap((q) => q.контур.map((т) => т[0]));
        const всеZ = р.помещения.flatMap((q) => q.контур.map((т) => т[1]));
        return { ошибки: р.ошибки, помещений: р.помещения.length, объектов: п.объекты.length, ц: [(Math.min(...всеX) + Math.max(...всеX)) / 2, (Math.min(...всеZ) + Math.max(...всеZ)) / 2], размер: [Math.max(...всеX) - Math.min(...всеX), Math.max(...всеZ) - Math.min(...всеZ)] };
      },
      КОМНАТЫ,
      СЦЕНЫ,
      ПРОФИЛЬ,
    );
    console.log(JSON.stringify(итог));
    for (let i = 0; i < 40 && !(await S(() => !!window.__кухня?.поставитьКамеру)); i++) await пауза(250);
    await пауза(3500);
    // приложение показывает одно помещение за раз; для общего кадра включаем все (только в снимке)
    await S(() => {
      const я = window.__кухня.ядро;
      const п = window.__верстакStore.getState().проект2;
      я.сборщик.применить(п, new Set(п.помещения.map((x) => x.id)));
      я.тени.запросить();
      я.попроситьКадр();
    });
    const [cx, cz] = итог.ц.map((v) => v / 1000);
    const P = [cx + 0.4, 12.5, cz + 5.5];
    const T = [cx, 0.3, cz - 0.3];
    const [yaw, pitch] = взгляд(P, T);
    await S((P, yaw, pitch) => window.__кухня.поставитьКамеру(P[0], P[1], P[2], yaw, pitch), P, yaw, pitch);
    await пауза(5000);
    const область = await S(() => {
      const r = window.__кухня.gl.domElement.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });
    await стр.screenshot({ path: path.join(снимки, `${ИМЯ}.png`), clip: область });
    console.log('снято', ИМЯ);
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
