/**
 * Этап 8, п. 6: живой сценарий в окне Electron. Новый проект → кухня из 6 модулей с холодильником → открыть дверцы → проверки →
 * PDF и XLSX → сохранить → открыть заново. Скриншоты — проверка\v2\8-сценарий-*.png, выгрузка — проверка\выгрузка-8\
 * Запуск: node scripts/сценарий-8.cjs http://127.0.0.1:5274/
 */
const path = require('node:path');
const fs = require('node:fs');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза } = require('./электрон-общее.cjs');
const { spawnSync } = require('node:child_process');
const АДРЕС = process.argv[2] || 'http://127.0.0.1:5274/';
const корень = process.cwd();
const данные = path.join(корень, 'проверка', 'данные-сценарий');
const выгрузка = path.join(корень, 'проверка', 'выгрузка-8');
const снимки = path.join(корень, 'проверка', 'v2');
const итоги = [];
const проверка = (имя, ок, п = '') => {
  итоги.push({ имя, ок: !!ок });
  console.log(`${ок ? 'ОК ' : 'НЕТ'}  ${имя}${п ? ' — ' + п : ''}`);
};

(async () => {
  for (const п of [данные, выгрузка]) fs.rmSync(п, { recursive: true, force: true });
  fs.mkdirSync(path.join(данные, 'Проекты'), { recursive: true });
  const процесс = запуститьElectron({ адрес: АДРЕС, данные, порт: 9398, доп: { VERSTAK_AUTOSAVE_SEC: '3600', VERSTAK_EXPORT_DIR: выгрузка } });
  try {
    const { браузер, стр } = await подключиться(АДРЕС, 9398);
    const к = слушатьКонсоль(стр);
    const S = (fn, ...а) => стр.evaluate(fn, ...а);
    await пауза(2500);
    await S(() => localStorage.setItem('верстак:интерфейс', JSON.stringify({ туркПройден: true, заказ: '2026-0150', клиент: 'Петрова А. С.', дизайнер: 'Макар' })));
    await стр.reload();
    await пауза(2000);

    // 1. новый проект и 6 модулей вдоль задней стены: 4 напольных вплотную от левой стены, 2 навесных над тумбами
    await S(() => {
      const с = () => window.__верстакStore.getState();
      с().создать('Кухня Петровых', { длина: 4000, ширина: 3000, высота_стен: 2700, толщина_стен: 100, форма: 'прямоугольник', обои: '#d8cdb8', пол: '#a58865', фон: '#171a1f' });
      if (!с().прилипание) с().переключитьПрилипание();
      for (const изд of ['холодильник-600', 'тумба-ящики-600', 'тумба-под-мойку-600', 'тумба-ящики-800']) с().добавитьМодуль(изд, [0, 0, 0]);
      for (const изд of ['навесной-600', 'навесной-600']) с().добавитьМодуль(изд, [0, 1400, 0]);
      const п = с().проект2;
      const пол = п.объекты.filter((о) => о.позиция[1] === 0);
      const новые = new Map();
      const центры = [];
      let x = -2000;
      for (const о of пол) {
        x += о.габариты.ш / 2;
        новые.set(о.id, [x, 0, -1500 + о.габариты.г / 2 + 1]);
        центры.push(x);
        x += о.габариты.ш / 2 + 2;
      }
      п.объекты.filter((о) => о.позиция[1] > 0).forEach((о, i) => новые.set(о.id, [центры[1 + i], 1400, -1500 + о.габариты.г / 2 + 1]));
      с().загрузить({ ...п, объекты: п.объекты.map((о) => (новые.has(о.id) ? { ...о, позиция: новые.get(о.id) } : о)) });
    });
    await пауза(800);
    await S(() => window.__верстакStore.getState().установитьОбзор('сверху'));
    await S(() => window.__кухня.поставитьКамеру(0, 5.0, 3.0, 0, -0.75));
    await пауза(800);
    await стр.screenshot({ path: path.join(снимки, '8-сценарий-1-собрано.png') });
    const сост = await S(() => window.__верстакStore.getState().проект2.объекты.map((о) => о.изделие));
    проверка('кухня из 6 модулей, холодильник на месте', сост.length === 6 && сост.includes('холодильник-600'), сост.join(', '));

    // 2. открыть все дверцы и ящики
    await S(() => window.__верстакStore.getState().открытьВсё(true));
    await пауза(1500);
    await стр.screenshot({ path: path.join(снимки, '8-сценарий-2-открыто.png') });
    const открыто = await S(() => window.__верстакStore.getState().проект2.объекты.filter((о) => о.открыт || (о.открыто && о.открыто.length)).length);
    проверка('«Открыть всё»: дверцы и ящики открыты', открыто >= 4, `открыто изделий: ${открыто}`);

    // 3. проверки валидатором
    const замечания = await S(async () => {
      const { проверитьПроект } = await import('/src/model/валидатор.ts');
      return проверитьПроект(window.__верстакStore.getState().проект2).map((з) => `${з.важность}: ${з.текст}`);
    });
    console.log('   замечания валидатора:', замечания.length ? '\n     ' + замечания.join('\n     ') : 'нет');
    await S(() => document.querySelector('button[aria-label="Проверки"]')?.click());
    await пауза(700);
    await стр.screenshot({ path: path.join(снимки, '8-сценарий-3-проверки.png') });
    const окно = await S(() => document.querySelector('.модал.окно')?.innerText ?? '');
    const строк = await S(() => document.querySelectorAll('.замечание').length);
    проверка('окно «Проверки» показывает ровно столько замечаний, сколько насчитал валидатор', замечания.length === 0 ? /Всё в порядке/.test(окно) : строк === замечания.length, `замечаний: ${замечания.length}, строк в окне: ${строк}`);
    await стр.keyboard.press('Escape');
    await пауза(300);

    // 4. выгрузки
    const ф = {};
    for (const формат of ['pdf', 'xlsx']) ф[формат] = await S((х) => window.__верстакВыгрузка(х), формат);
    await пауза(1500);
    const файлы = fs.existsSync(выгрузка) ? fs.readdirSync(выгрузка) : [];
    const pdf = файлы.find((x) => x.endsWith('.pdf'));
    const xlsx = файлы.find((x) => x.endsWith('.xlsx'));
    const pdfБайт = pdf ? fs.statSync(path.join(выгрузка, pdf)).size : 0;
    const xlsxБайт = xlsx ? fs.statSync(path.join(выгрузка, xlsx)).size : 0;
    проверка('PDF выгружен', ф.pdf === true && pdfБайт > 20000 && fs.readFileSync(path.join(выгрузка, pdf)).slice(0, 5).toString() === '%PDF-', `${pdf}: ${pdfБайт} байт`);
    проверка('XLSX выгружен', ф.xlsx === true && xlsxБайт > 3000 && fs.readFileSync(path.join(выгрузка, xlsx)).slice(0, 2).toString() === 'PK', `${xlsx}: ${xlsxБайт} байт`);

    // 5. сохранить и открыть заново
    await стр.keyboard.down('Control');
    await стр.keyboard.press('KeyS');
    await стр.keyboard.up('Control');
    await пауза(2500);
    const проекты = path.join(данные, 'Проекты');
    const файл = fs.existsSync(проекты) ? fs.readdirSync(проекты).find((x) => x.endsWith('.kitchen')) : null;
    проверка('проект сохранён в Проекты\\', !!файл, файл);
    await S(() => window.__верстакStore.getState().наЭкран('проекты'));
    await пауза(1200);
    await стр.screenshot({ path: path.join(снимки, '8-сценарий-4-список-проектов.png') });
    // перезагрузка страницы очищает хранилище: открываем именно с диска
    await стр.reload();
    await пауза(2500);
    const пусто = await S(() => window.__верстакStore.getState().проект2.объекты.length);
    await S(() => window.__верстакStore.getState().наЭкран('проекты'));
    await пауза(1200);
    await S(() => document.querySelector('.проект-карточка .кн.главная')?.click());
    await пауза(3500);
    const после = await S(() => ({ экран: window.__верстакStore.getState().экран, название: window.__верстакStore.getState().проект2.название, объектов: window.__верстакStore.getState().проект2.объекты.length }));
    await S(() => window.__верстакStore.getState().установитьОбзор('сверху'));
    await S(() => window.__кухня?.поставитьКамеру?.(0, 5.0, 3.0, 0, -0.75));
    await пауза(800);
    await стр.screenshot({ path: path.join(снимки, '8-сценарий-5-открыт-заново.png') });
    проверка('после перезагрузки и открытия с диска: «Кухня Петровых», 6 объектов, редактор', пусто !== 6 && после.название === 'Кухня Петровых' && после.объектов === 6 && после.экран === 'редактор', JSON.stringify({ ...после, доОткрытия: пусто }));
    проверка('ошибок консоли и шейдеров нет', к.шейдер.length === 0 && к.ошибки.filter((e) => !/favicon|ResizeObserver/.test(e)).length === 0, (к.ошибки[0] ?? '').slice(0, 200));
    await браузер.disconnect();
  } catch (е) {
    проверка('сбой сценария', false, е && е.message ? е.message : String(е));
  } finally {
    spawnSync('taskkill', ['/PID', String(процесс.pid), '/T', '/F'], { stdio: 'ignore' });
  }
  const ок = итоги.filter((x) => x.ок).length;
  console.log(`Итог: ${ок} из ${итоги.length}`);
  process.exit(ок === итоги.length ? 0 : 1);
})();
