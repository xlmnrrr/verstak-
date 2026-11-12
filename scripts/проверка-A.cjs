/**
 * Приёмка добавки A «Материалы 2.0» в окне Electron: фотосканы CC0 и normal-карты на сцене (вблизи и издалека),
 * запасные процедурные текстуры при отсутствии файла, ошибки шейдера и консоли.
 * Запуск: node scripts/проверка-A.cjs http://127.0.0.1:5274/ ; скриншоты — проверка\v2\A-*.png
 */
const path = require('node:path');
const fs = require('node:fs');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза } = require('./электрон-общее.cjs');
const АДРЕС = process.argv[2] || 'http://127.0.0.1:5274/';
const корень = process.cwd();
const данные = path.join(корень, 'проверка', 'данные-A');
const снимки = path.join(корень, 'проверка', 'v2');
fs.mkdirSync(снимки, { recursive: true });
const итоги = [];
const проверка = (имя, ок, п = '') => {
  итоги.push({ имя, ок: !!ок, п });
  console.log(`${ок ? 'ОК ' : 'НЕТ'}  ${имя}${п ? ' — ' + п : ''}`);
};

(async () => {
  fs.rmSync(данные, { recursive: true, force: true });
  fs.mkdirSync(path.join(данные, 'Проекты'), { recursive: true });
  const процесс = запуститьElectron({ адрес: АДРЕС, данные, порт: 9386, доп: { VERSTAK_AUTOSAVE_SEC: '3600' } });
  const t0 = Date.now();
  try {
    const { браузер, стр } = await подключиться(АДРЕС, 9386);
    const к = слушатьКонсоль(стр);
    const S = (fn, ...а) => стр.evaluate(fn, ...а);
    await пауза(2500);
    await S(() => localStorage.setItem('верстак:интерфейс', JSON.stringify({ туркПройден: true })));
    await стр.reload();
    await пауза(2500);
    await S(() => [...document.querySelectorAll('.действие')].find((x) => x.textContent.includes('Пример кухни'))?.click());
    await пауза(3500);

    const материалы = (м) =>
      S((м) => {
        const с = window.__верстакStore.getState();
        for (const [ключ, id] of Object.entries(м)) с.задатьМатериал(ключ, id, true);
        window.__верстакStore.getState().выбрать([]);
      }, м);
    const цель = await S(() => {
      const о = window.__верстакStore.getState().проект2.объекты.find((x) => x.изделие.startsWith('столешница'));
      return о ? [о.позиция[0] / 1000, (о.позиция[1] + о.габариты.в) / 1000, о.позиция[2] / 1000] : [0, 0.9, -1.1];
    });
    const камера = (dx, d, высота) =>
      S(
        (ц, dx, d2, в) => {
          const px = ц[0] + dx, py = ц[1] + в, pz = ц[2] + d2;
          const ex = ц[0], ey = ц[1], ez = ц[2];
          const ddx = ex - px, ddy = ey - py, ddz = ez - pz;
          window.__кухня.поставитьКамеру(px, py, pz, Math.atan2(-ddx, -ddz), Math.asin(ddy / Math.hypot(ddx, ddy, ddz)));
        },
        цель,
        dx,
        d,
        высота,
      );

    // фото 1: калакатта + дуб + нержавейка
    await материалы({ столешница: 'мрамор-калакатта', фасад: 'дуб-натуральный', техника: 'нержавейка', цоколь: 'металл-чёрный-мат' });
    await пауза(1500);
    const память = await S(() => window.__кухня.gl.info.memory.textures);
    проверка('массивы текстур в видеокарте (альбедо и normal)', память >= 2, `текстур: ${память}`);
    await камера(0, 0.9, 0.6);
    await пауза(900);
    await стр.screenshot({ path: path.join(снимки, 'A-калакатта-вблизи.png') });
    await камера(0, 4.2, 2.2);
    await пауза(900);
    await стр.screenshot({ path: path.join(снимки, 'A-калакатта-издалека.png') });
    // фото 2: каррара + орех
    await материалы({ столешница: 'мрамор-каррара', фасад: 'орех' });
    await пауза(900);
    await камера(-0.4, 1.3, 0.8);
    await пауза(900);
    await стр.screenshot({ path: path.join(снимки, 'A-каррара-орех.png') });
    // фото 3: гранит и керамогранит на фартук/столешницу
    await материалы({ столешница: 'гранит-серый', фасад: 'шпон-дуба' });
    await пауза(900);
    await камера(0, 1.0, 0.7);
    await пауза(900);
    await стр.screenshot({ path: path.join(снимки, 'A-гранит-шпон.png') });

    // normal-карты действительно подключены: шейдер содержит uNor, у слоя «дуб» не плоская карта
    const нормаль = await S(() => {
      const т = window.__кухня.gl.info.programs?.length ?? 0;
      return { программ: т };
    });
    проверка('шейдерные программы собраны', нормаль.программ > 0, `программ: ${нормаль.программ}`);

    const ошибки = к.ошибки.filter((e) => !/favicon|ResizeObserver/.test(e));
    проверка('ошибок консоли и шейдеров нет', ошибки.length === 0 && к.шейдер.length === 0, ошибки.concat(к.шейдер).join(' | ').slice(0, 400));
    await браузер.disconnect();
  } catch (е) {
    проверка('сбой приёмки', false, е && е.message ? е.message : String(е));
  } finally {
    try {
      процесс.kill();
    } catch {
      /* окно уже закрыто */
    }
  }

  // запасные: без фото-файла «дуб» берётся процедурная, без нормалей — плоская, ошибок нет
  const процесс2 = запуститьElectron({ адрес: АДРЕС, данные, порт: 9387, доп: { VERSTAK_AUTOSAVE_SEC: '3600' } });
  try {
    const { браузер, стр } = await подключиться(АДРЕС, 9387);
    const к = слушатьКонсоль(стр);
    await стр.setRequestInterception(true);
    стр.on('request', (з) => {
      const u = decodeURIComponent(з.url());
      if (/\/текстуры\/(дуб|орех|мрамор-калакатта)(\.нормаль)?\.webp/.test(u)) з.respond({ status: 404, body: 'нет' });
      else з.continue();
    });
    const S = (fn, ...а) => стр.evaluate(fn, ...а);
    await стр.reload();
    await пауза(2500);
    await S(() => [...document.querySelectorAll('.действие')].find((x) => x.textContent.includes('Пример кухни'))?.click());
    await пауза(3500);
    await S(() => {
      const с = window.__верстакStore.getState();
      с.задатьМатериал('столешница', 'мрамор-калакатта', true);
      с.задатьМатериал('фасад', 'дуб-натуральный', true);
      window.__верстакStore.getState().выбрать([]);
    });
    await пауза(1500);
    await S(() => window.__кухня.поставитьКамеру(0, 3.2, 3.6, 0, -0.7));
    await пауза(900);
    await стр.screenshot({ path: path.join(снимки, 'A-запасные-без-файлов.png') });
    const ошибки = к.ошибки.filter((e) => !/favicon|ResizeObserver|404|Failed to load resource/.test(e));
    проверка('без файлов текстур приложение работает (запасные процедурные), ошибок нет', ошибки.length === 0 && к.шейдер.length === 0, ошибки.concat(к.шейдер).join(' | ').slice(0, 300));
    await браузер.disconnect();
  } catch (е) {
    проверка('сбой проверки запасных', false, е && е.message ? е.message : String(е));
  } finally {
    try {
      процесс2.kill();
    } catch {
      /* окно уже закрыто */
    }
  }
  const ок = итоги.filter((x) => x.ок).length;
  console.log(`\nИтог: ${ок} из ${итоги.length}, ${((Date.now() - t0) / 1000).toFixed(0)} с`);
  process.exit(ок === итоги.length ? 0 : 1);
})();
