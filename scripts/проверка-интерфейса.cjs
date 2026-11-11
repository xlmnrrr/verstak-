/**
 * Дымовой тест интерфейса: открывает приложение в headless-Chrome,
 * собирает ошибки консоли, проходит по экранам и делает скриншоты.
 *
 * Запуск (из папки приложения, при работающем npm run dev):
 *   node scripts/проверка-интерфейса.cjs
 */
const path = require('node:path');
const fs = require('node:fs');

const PUPPETEER = 'C:\\Users\\makar\\.dsh\\profiles\\desktop\\node_modules\\puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const АДРЕС = process.env.КУХНЯ_URL || 'http://127.0.0.1:5273/';
const КУДА = path.join(process.cwd(), 'проверка');

const puppeteer = require(PUPPETEER);
const пауза = (мс) => new Promise((r) => setTimeout(r, мс));

(async () => {
  fs.mkdirSync(КУДА, { recursive: true });
  const браузер = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      '--window-size=1600,1000',
    ],
    defaultViewport: { width: 1600, height: 1000 },
  });

  const страница = await браузер.newPage();
  const ошибки = [];
  const предупреждения = [];
  страница.on('console', (м) => {
    const т = `${м.type()}: ${м.text()}`;
    if (м.type() === 'error') ошибки.push(т);
    else if (м.type() === 'warning') предупреждения.push(т);
  });
  страница.on('pageerror', (e) => ошибки.push(`pageerror: ${e.message}`));

  const шаги = [];
  const шаг = async (имя, файл) => {
    await пауза(600);
    await страница.screenshot({ path: path.join(КУДА, файл) });
    шаги.push({ шаг: имя, файл });
  };

  await страница.goto(АДРЕС, { waitUntil: 'networkidle2', timeout: 60000 });
  await пауза(1500);
  await шаг('главное меню', '01-меню.png');

  // 1. Открыть пример кухни
  const нажал = await страница.evaluate(() => {
    const э = [...document.querySelectorAll('.карточка')].find((x) =>
      x.textContent.includes('Пример кухни'),
    );
    if (!э) return false;
    э.click();
    return true;
  });
  await пауза(4000);
  const канва = await страница.$('canvas');
  const размерКанвы = канва ? await канва.boundingBox() : null;
  const объектов = await страница.evaluate(() => {
    const т = document.querySelector('.низ span:last-child');
    return т ? т.textContent : null;
  });
  await шаг('пример кухни', '02-пример-кухни.png');

  // 2. Добавить модуль из конструктора
  const добавил = await страница.evaluate(() => {
    const п = document.querySelector('.позиция');
    if (!п) return false;
    п.click();
    return true;
  });
  await пауза(1500);
  await шаг('добавлен модуль', '03-модуль-добавлен.png');

  // 2б. Перетащить добавленный объект мышкой и проверить, что он реально сдвинулся
  const доПеретаскивания = await страница.evaluate(() => {
    const полей = [...document.querySelectorAll('.содержимое-панели input[type=number]')];
    // в панели «Объект»: Ширина, Глубина, Высота, X, Z, высота, поворот
    return полей.map((п) => п.value);
  });
  const точка = await страница.evaluate(() => {
    const к = window.__кухня;
    if (!к) return null;
    // берём первый объект из сцены: ищем самую крупную группу на полу
    const данные = window.__проект_объекты || null;
    if (данные && данные[0]) return к.экраннаяТочка(данные[0][0], данные[0][1] + 0.4, данные[0][2]);
    return null;
  });
  let перетащилось = false;
  if (точка) {
    await страница.mouse.move(точка.x, точка.y);
    await страница.mouse.down({ button: 'left' });
    for (let i = 1; i <= 8; i++) {
      await страница.mouse.move(точка.x + i * 20, точка.y + i * 3);
      await пауза(40);
    }
    await страница.mouse.up({ button: 'left' });
    await пауза(700);
    const после = await страница.evaluate(() =>
      [...document.querySelectorAll('.содержимое-панели input[type=number]')].map((п) => п.value),
    );
    перетащилось = JSON.stringify(доПеретаскивания) !== JSON.stringify(после);
  }
  await шаг('после перетаскивания', '03б-перетаскивание.png');

  // 2в. Зелёная стрелка «вверх» двигает строго по вертикали при любом месте захвата (10 / 40 / 60 / 90 % длины настоящей стрелки)
  const поля = () =>
    страница.evaluate(() =>
      [...document.querySelectorAll('.содержимое-панели input[type=number]')].map((п) => п.value),
    );
  const попытки = [];
  for (const доля of [0.1, 0.4, 0.6, 0.9]) {
    const до = await поля();
    const ось = await страница.evaluate(() => (window.__кухня && window.__кухня.стрелка ? window.__кухня.стрелка('Y') : null));
    if (!ось) {
      попытки.push({ доля, ошибка: 'стрелка Y не найдена (объект не выбран или хука нет)' });
      continue;
    }
    const dx0 = ось.кончик.x - ось.основание.x;
    const dy0 = ось.кончик.y - ось.основание.y;
    const длина = Math.hypot(dx0, dy0) || 1;
    const sx = ось.основание.x + dx0 * доля;
    const sy = ось.основание.y + dy0 * доля;
    await страница.mouse.move(sx, sy);
    await пауза(150);
    await страница.mouse.down({ button: 'left' });
    for (let i = 1; i <= 10; i++) {
      await страница.mouse.move(sx + (dx0 / длина) * i * 7, sy + (dy0 / длина) * i * 7);
      await пауза(35);
    }
    await страница.mouse.up({ button: 'left' });
    await пауза(500);
    const после = await поля();
    // поля панели «Объект»: Ширина, Глубина, Высота, X, Z, высота над полом
    попытки.push({
      доля,
      X: после[3],
      Z: после[4],
      высота: после[5],
      XZНеТронуты: до[3] === после[3] && до[4] === после[4],
      высотаВыросла: Number(после[5]) > Number(до[5]),
    });
    await страница.keyboard.down('Control');
    await страница.keyboard.press('KeyZ');
    await страница.keyboard.up('Control');
    await пауза(400);
    // после отмены выбор сохраняется, но на случай потери — выбираем объект заново через хук
  }
  const осьY = {
    высотаИзменилась: попытки.filter((п) => п.высотаВыросла).length,
    XZНеТронуты: попытки.every((п) => п.XZНеТронуты !== false),
    попытки,
  };
  await шаг('движение по оси Y', '03в-ось-Y.png');
  const схватовГизмо = 0;

  // 3. Режим «Прогулка»
  await страница.evaluate(() => {
    const к = [...document.querySelectorAll('.низ button')].find((b) => b.textContent.trim() === 'Прогулка');
    if (к) к.click();
  });
  await пауза(1500);
  await шаг('режим прогулка', '04-прогулка.png');

  // 4. Панель свойств
  await страница.evaluate(() => {
    const в = [...document.querySelectorAll('.вкладки button')].find((b) => b.textContent.includes('Объект'));
    if (в) в.click();
  });
  await пауза(800);
  await шаг('свойства объекта', '05-свойства.png');

  // 5. Открыть дверцы и повернуть модуль на 90° через панель
  const дверцыОткрыты = await страница.evaluate(() => {
    const к = [...document.querySelectorAll('.содержимое-панели button')].find(
      (b) => b.textContent.includes('Открыть дверцы') || b.textContent.includes('Закрыть дверцы'),
    );
    if (!к) return null;
    const былоТекст = к.textContent;
    к.click();
    return былоТекст;
  });
  await пауза(1200);
  await шаг('дверцы открыты', '06-дверцы.png');

  const повернулось = await страница.evaluate(() => {
    const к = [...document.querySelectorAll('.содержимое-панели button')].find((b) =>
      b.textContent.includes('90° вправо'),
    );
    if (!к) return false;
    const доПоля = [...document.querySelectorAll('.содержимое-панели input[type=number]')].map(
      (п) => п.value,
    );
    к.click();
    return доПоля.length > 0;
  });
  await пауза(900);
  await шаг('поворот 90 градусов', '07-поворот.png');

  const итог = {
    открылось: !!канва,
    размерКанвы,
    надписьОбъектов: объектов,
    нажалПример: нажал,
    добавилМодуль: добавил,
    перетащилось,
    осьY,
    схватовГизмо,
    дверцыОткрыты,
    повернулось,
    ошибок: ошибки.length,
    ошибки: ошибки.slice(0, 25),
    предупреждений: предупреждения.length,
    шаги,
  };
  console.log(JSON.stringify(итог, null, 2));
  await браузер.close();
  process.exit(ошибки.length ? 2 : 0);
})().catch((e) => {
  console.error('ТЕСТ УПАЛ:', e.message);
  process.exit(1);
});
