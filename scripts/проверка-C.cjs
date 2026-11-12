/**
 * Приёмка добавки C «Производство 2.0» в окне Electron: PDF с видами спереди и номерами листов, несколько видов на листе без обрезки.
 * Запуск: node scripts/проверка-C.cjs http://127.0.0.1:5274/ ; скриншоты — проверка\v2\C-*.png, выгрузка — проверка\выгрузка-C\
 */
const path = require('node:path');
const fs = require('node:fs');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза, puppeteer } = require('./электрон-общее.cjs');
const АДРЕС = process.argv[2] || 'http://127.0.0.1:5274/';
const корень = process.cwd();
const данные = path.join(корень, 'проверка', 'данные-C');
const выгрузка = path.join(корень, 'проверка', 'выгрузка-C');
const снимки = path.join(корень, 'проверка', 'v2');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(снимки, { recursive: true });
const итоги = [];
const проверка = (имя, ок, п = '') => {
  итоги.push({ имя, ок: !!ок, п });
  console.log(`${ок ? 'ОК ' : 'НЕТ'}  ${имя}${п ? ' — ' + п : ''}`);
};

(async () => {
  for (const папка of [данные, выгрузка]) fs.rmSync(папка, { recursive: true, force: true });
  fs.mkdirSync(path.join(данные, 'Проекты'), { recursive: true });
  const процесс = запуститьElectron({ адрес: АДРЕС, данные, порт: 9389, доп: { VERSTAK_AUTOSAVE_SEC: '3600', VERSTAK_EXPORT_DIR: выгрузка } });
  const t0 = Date.now();
  try {
    const { браузер, стр } = await подключиться(АДРЕС, 9389);
    const к = слушатьКонсоль(стр);
    const S = (fn, ...а) => стр.evaluate(fn, ...а);
    await пауза(2500);
    await S(() => localStorage.setItem('верстак:интерфейс', JSON.stringify({ туркПройден: true, заказ: '2026-0142', клиент: 'Иванов И. И.', дизайнер: 'Макар' })));
    await стр.reload();
    await пауза(2000);
    await S(() => [...document.querySelectorAll('.действие')].find((x) => x.textContent.includes('Пример кухни'))?.click());
    await пауза(3000);
    // добавляем предметы на правую и переднюю стены, чтобы видов было три
    const новые = await S(() => {
      const с = () => window.__верстакStore.getState();
      const ид = [];
      for (const [изд, x, z] of [['тумба-ящики-600', 1820, -600], ['тумба-ящики-600', 1820, 0], ['шкаф-распашной-900', 1800, 700], ['тумба-ящики-600', -600, 1220], ['тумба-ящики-800', 200, 1220]]) ид.push(с().добавитьМодуль(изд, [x, 0, z]));
      return ид;
    });
    await S((ид) => {
      const с = window.__верстакStore.getState();
      const п = с.проект2;
      const пов = { [ид[0]]: 90, [ид[1]]: 90, [ид[2]]: 90, [ид[3]]: 180, [ид[4]]: 180 };
      с.загрузить({ ...п, объекты: п.объекты.map((x) => (x.id in пов ? { ...x, поворот: пов[x.id] } : x)) });
    }, новые);
    await пауза(800);
    const виды = await S(async () => {
      const м = await import('/src/export/виды.ts');
      const п = window.__верстакStore.getState().проект2;
      const в = м.видыСпереди(п);
      const р = м.раскладкаЛистов(в);
      return { видов: в.length, предметов: в.map((x) => x.предметы.length), масштаб: р?.масштаб, листов: р?.листы.length, поЛистам: р?.листы.map((л) => л.length) };
    });
    проверка('виды спереди строятся по трём стенам', виды.видов === 3, JSON.stringify(виды));
    const ок = await S(() => window.__верстакВыгрузка('pdf'));
    проверка('PDF выгружен', ок === true);
    проверка('в консоли нет ошибок', к.шейдер.length === 0 && к.ошибки.filter((e) => !/favicon|ResizeObserver/.test(e)).length === 0, (к.ошибки[0] ?? '').slice(0, 200));
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

  const файлы = fs.existsSync(выгрузка) ? fs.readdirSync(выгрузка) : [];
  const pdfИмя = файлы.find((x) => x.endsWith('.pdf'));
  const htmlИмя = файлы.find((x) => x.endsWith('.html'));
  if (pdfИмя && htmlИмя) {
    const pdf = fs.readFileSync(path.join(выгрузка, pdfИмя));
    const страниц = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    const html = fs.readFileSync(path.join(выгрузка, htmlИмя), 'utf8');
    const листов = [...html.matchAll(/Лист (\d+)\. /g)].map((m) => Number(m[1]));
    const видовНаЛистах = [...html.matchAll(/class="вид"/g)].length;
    проверка('в PDF есть листы видов с номерами подряд после плана', листов.length >= 2 && листов.every((n, i) => n === i + 1), `листы: ${листов.join(', ')}, страниц в PDF: ${страниц}`);
    проверка('все виды спереди на листах', видовНаЛистах === 3, `видов: ${видовНаЛистах}`);
    проверка('PDF не короче, чем листы с графикой и таблицами', pdf.slice(0, 5).toString() === '%PDF-' && страниц >= листов.length + 3, `байт ${pdf.length}`);
    // скриншоты листов видов из HTML (как они лягут на страницу): размер блока — миллиметры страницы
    const браузер2 = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
    try {
      const с = await браузер2.newPage();
      await с.setViewport({ width: 1120, height: 800, deviceScaleFactor: 1.5 });
      await с.goto('file:///' + path.join(выгрузка, htmlИмя).replace(/\\/g, '/'));
      await пауза(500);
      const листыВидов = await с.$$('.лист.виды');
      проверка('листов с видами в HTML', листыВидов.length >= 1, `${листыВидов.length}`);
      const все = await с.$$('.лист');
      for (let i = 0; i < все.length; i++) await все[i].screenshot({ path: path.join(снимки, `C-лист-${String(i + 1).padStart(2, '0')}.png`) });
      const итогСтраниц = await с.evaluate(() => {
        const листы = [...document.querySelectorAll('.лист')];
        const номера = листы.map((л) => [л.querySelector('.номер')?.textContent, л.querySelector('.всего')?.textContent]);
        const перелив = листы.map((л, i) => ({ i: i + 1, ок: л.querySelector('.поле').scrollHeight <= л.querySelector('.поле').clientHeight + 1 })).filter((x) => !x.ок).map((x) => x.i);
        const строкШаблонов = [...document.querySelectorAll('template.пагинация')].reduce((s, т) => s + т.content.querySelectorAll('tbody tr').length, 0);
        const строкНаЛистах = document.querySelectorAll('.лист.таблица tbody tr').length;
        return { листов: листы.length, номераПодряд: номера.every((н, k) => н[0] === String(k + 1) && н[1] === String(листы.length)), перелив, строкШаблонов, строкНаЛистах };
      });
      проверка('страниц в PDF столько же, сколько листов в чертеже', страниц === итогСтраниц.листов, `PDF ${страниц}, листов ${итогСтраниц.листов}`);
      проверка('в штампе каждого листа «Лист N из M» подряд', итогСтраниц.номераПодряд);
      проверка('ничего не выходит за поле листа (нет обрезки)', итогСтраниц.перелив.length === 0, итогСтраниц.перелив.join(', '));
      проверка('все строки таблиц попали на листы (ничего не потеряно)', итогСтраниц.строкШаблонов === итогСтраниц.строкНаЛистах, `${итогСтраниц.строкНаЛистах} из ${итогСтраниц.строкШаблонов}`);
      // ничего не вылезает за полотно листа
      const выходит = await с.evaluate(() => {
        const плохие = [];
        for (const п of document.querySelectorAll('.полотно')) {
          const рп = п.getBoundingClientRect();
          for (const в of п.querySelectorAll('.вид')) {
            const р = в.getBoundingClientRect();
            if (р.left < рп.left - 0.5 || р.top < рп.top - 0.5 || р.right > рп.right + 0.5 || р.bottom > рп.bottom + 0.5) плохие.push(в.textContent.slice(0, 30));
          }
        }
        return плохие;
      });
      проверка('ни один вид не обрезан краем листа', выходит.length === 0, выходит.join('; '));
      // каждый лист — ровно одна страница A4 (209,5 мм)
      const высотыМм = await с.evaluate(() => [...document.querySelectorAll('.лист')].map((л) => +((л.getBoundingClientRect().height / 96) * 25.4).toFixed(1)));
      проверка('каждый лист — одна страница A4 (209,5 мм)', высотыМм.every((в) => Math.abs(в - 209.5) < 0.3), [...new Set(высотыМм)].join(', '));
    } finally {
      await браузер2.close();
    }
  } else проверка('выгрузка PDF и HTML сохранены', false, файлы.join(', '));
  const ок = итоги.filter((x) => x.ок).length;
  console.log(`\nИтог: ${ок} из ${итоги.length}, ${((Date.now() - t0) / 1000).toFixed(0)} с`);
  process.exit(ок === итоги.length ? 0 : 1);
})();
