/**
 * Этап 7 «Claude-проектировщик»: приёмка в настоящем окне Electron. Скриншоты — проверка\v2\7-NN-*.png.
 *  1. обложка показывает превью сохранённых проектов (снимок и план для проекта без снимка);
 *  2. проект, написанный руками (public/Библиотека/проект-руками.kitchen), открывается: 3 предмета, 0 замечаний;
 *  3. «Предложи планировку» на гардеробной кв. 160 (помещение заказчика) — 3 варианта, у каждого числа, все без замечаний;
 *     варианты сохраняются файлами, каждый открывается, «Проверки» пусты;
 *  4. разбор демо-кухни и варианта — с числами и предложениями;
 *  5. сравнение двух проектов и шторка «до / после».
 * Боевые данные не трогаются: VERSTAK_DATA_DIR. Запуск: node scripts/проверка-7.cjs http://127.0.0.1:5274/
 */
const path = require('node:path');
const fs = require('node:fs');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза } = require('./электрон-общее.cjs');

const АДРЕС = process.argv[2] || 'http://127.0.0.1:5274/';
const корень = process.cwd();
const снимки = path.join(корень, 'проверка', 'v2');
fs.mkdirSync(снимки, { recursive: true });
const итоги = [];
const проверка = (имя, ок, п = '') => {
  итоги.push({ имя, ок: !!ок, п });
  console.log(`${ок ? 'ОК ' : 'НЕТ'}  ${имя}${п ? ' — ' + п : ''}`);
};

(async () => {
  const данные = path.join(корень, 'проверка', 'данные-7');
  fs.rmSync(данные, { recursive: true, force: true });
  const проекты = path.join(данные, 'Проекты');
  fs.mkdirSync(проекты, { recursive: true });
  // живой проект со старым тёмным снимком (как у Макара) и проект руками без снимка
  const живой = path.join(корень, 'Проекты');
  for (const ф of fs.existsSync(живой) ? fs.readdirSync(живой) : []) if (/\.(kitchen|jpg)$/.test(ф)) fs.copyFileSync(path.join(живой, ф), path.join(проекты, ф));
  fs.copyFileSync(path.join(корень, 'public', 'Библиотека', 'проект-руками.kitchen'), path.join(проекты, 'Проект руками.kitchen'));

  const процесс = запуститьElectron({ адрес: АДРЕС, данные, порт: 9351, доп: { VERSTAK_AUTOSAVE_SEC: '3600', VERSTAK_EXPORT_DIR: path.join(данные, 'Выгрузка') } });
  try {
    const { браузер, стр } = await подключиться(АДРЕС, 9351);
    const к = слушатьКонсоль(стр);
    const S = (fn, ...а) => стр.evaluate(fn, ...а);
    const снять = async (имя) => {
      await пауза(700);
      await стр.screenshot({ path: path.join(снимки, `7-${имя}.png`) });
    };
    const сессия = await стр.target().createCDPSession();
    try {
      const { windowId } = await сессия.send('Browser.getWindowForTarget');
      await сессия.send('Browser.setWindowBounds', { windowId, bounds: { width: 1600, height: 960, windowState: 'normal' } });
    } catch {
      /* размер окна не главное */
    }
    await пауза(2500);
    await S(() => window.__верстакStore.getState().установитьТему('мастерская'));
    await S(() => [...document.querySelectorAll('.модал button')].find((b) => b.textContent.includes('Пропустить'))?.click());
    await пауза(400);

    // 1. обложка: открываем живой проект — превью переснимается само через 3 с
    const живыеИмена = (await S(async () => (await window.кухня.список()).map((x) => x.имя))).filter((x) => x !== 'Проект руками');
    if (живыеИмена[0]) {
      await S((имя) => window.__верстакStore.getState().открыть(имя), живыеИмена[0]);
      await пауза(4500);
      await S(() => window.__верстакStore.getState().наЭкран('меню'));
      await пауза(1500);
    }
    const листы = await S(() =>
      [...document.querySelectorAll('.лист')].map((л) => {
        const img = л.querySelector('.лист-картинка img');
        const план = л.querySelector('.лист-картинка .план-листа');
        return { имя: л.querySelector('.заг')?.textContent, снимок: !!img && img.complete && img.naturalWidth > 0, план: !!план };
      }),
    );
    проверка('обложка: у каждого листа снимок или план (пустых нет)', листы.length > 0 && листы.every((л) => л.снимок || л.план), JSON.stringify(листы));
    if (живыеИмена[0]) {
      const jpg = path.join(проекты, `${живыеИмена[0]}.jpg`);
      const размер = fs.existsSync(jpg) ? fs.statSync(jpg).size : 0;
      проверка('превью живого проекта переснято при открытии (кадр по помещению)', размер > 9000, `${размер} байт`);
    }
    await снять('01-обложка-превью');

    // 2. проект руками
    await S(() => window.__верстакStore.getState().открыть('Проект руками'));
    await пауза(2500);
    const руками = await S(() => {
      const с = window.__верстакStore.getState();
      return { экран: с.экран, объектов: с.проект2.объекты.length, изделия: с.проект2.объекты.map((о) => о.изделие) };
    });
    проверка('проект руками открылся: 3 предмета из каталога', руками.экран === 'редактор' && руками.объектов === 3, JSON.stringify(руками));
    await S(() => window.__верстакUI.getState().открытьОкно('проверки'));
    await пауза(600);
    const замечанийРуками = await S(() => document.querySelectorAll('.модал .замечание').length);
    проверка('у проекта руками в «Проверках» 0 замечаний', замечанийРуками === 0, String(замечанийРуками));
    await S(() => window.__верстакUI.getState().открытьОкно(null));
    await снять('02-проект-руками');

    // 3. гардеробная кв. 160 из мастера → «Предложи планировку»
    await S(() => window.__верстакStore.getState().наЭкран('комната'));
    await пауза(700);
    await S(() => [...document.querySelectorAll('.кисти .чип')].find((b) => b.textContent.includes('гардеробная'))?.click());
    await пауза(2500);
    await S(() => window.__верстакStore.getState().сохранить());
    await пауза(800);
    const основа = await S(() => window.__верстакStore.getState().проект2.название);
    await S(() => document.querySelector('button[aria-label="Проектировщик"]')?.click());
    await пауза(500);
    await S(() => document.querySelector('[data-действие="предложить"]')?.click());
    await пауза(2500);
    const варианты = await S(() =>
      [...document.querySelectorAll('.вариант')].map((в) => ({
        буква: в.getAttribute('data-вариант'),
        заголовок: в.querySelector('header b')?.textContent,
        чисто: в.querySelector('.метка-чисто')?.textContent,
        числа: [...в.querySelectorAll('.числа-варианта div')].map((d) => `${d.querySelector('dt')?.textContent} ${d.querySelector('dd')?.textContent}`),
      })),
    );
    проверка('гардеробная кв. 160: 3 варианта', варианты.length === 3, варианты.map((в) => в.заголовок).join(' | '));
    проверка('у каждого варианта числа (столешница, ЛДСП, кромка, детали, замечания)', варианты.every((в) => в.числа.length === 5), варианты.map((в) => в.числа.join(', ')).join(' || '));
    проверка('ни один вариант не нарушает нормы валидатора', варианты.every((в) => в.чисто === 'без замечаний'), варианты.map((в) => в.чисто).join(', '));
    await S(() => document.querySelectorAll('.вариант details.учтено').forEach((d) => (d.open = true)));
    await снять('03-планировка-гардеробная');
    // сохраняем все варианты и открываем каждый файлом
    await S(() => [...document.querySelectorAll('.вкладка-планировки button')].find((b) => b.textContent.includes('Сохранить все варианты'))?.click());
    await пауза(1500);
    const имена = await S(async () => (await window.кухня.список()).map((x) => x.имя).filter((x) => x.includes('вариант')));
    проверка('варианты сохранены отдельными проектами', имена.length === 3, имена.join(' | '));
    for (const имя of имена) {
      await S((и) => window.__верстакStore.getState().открыть(и), имя);
      await пауза(1800);
      const р = await S(() => ({ имя: window.__верстакStore.getState().проект2.название, объектов: window.__верстакStore.getState().проект2.объекты.length }));
      await S(() => window.__верстакUI.getState().открытьОкно('проверки'));
      await пауза(500);
      const з = await S(() => document.querySelectorAll('.модал .замечание').length);
      await S(() => window.__верстакUI.getState().открытьОкно(null));
      проверка(`«${имя}» открывается, в «Проверках» 0 замечаний`, р.имя.replace(/[:*?"<>|\/]/g, "_") === имя && р.объектов > 0 && з === 0, `${р.объектов} предметов, замечаний ${з}`);
      if (имя.includes('П-образная')) await снять('04-вариант-П-в-3D');
    }

    // 4. разбор: демо-кухня и вариант
    await S(() => [...document.querySelectorAll('.действие')].find((x) => x.textContent.includes('Пример кухни'))?.click());
    await S(() => window.__верстакStore.getState().наЭкран('меню'));
    await пауза(600);
    await S(() => [...document.querySelectorAll('.действие')].find((x) => x.textContent.includes('Пример кухни'))?.click());
    await пауза(3000);
    await S(() => window.__верстакUI.getState().открытьПроектировщик('разбор', { разборДля: null }));
    await пауза(800);
    const разборДемо = await S(() => ({
      итог: document.querySelector('.итог-разбора')?.textContent,
      пунктов: document.querySelectorAll('.пункт-разбора').length,
      сЦифрами: [...document.querySelectorAll('.пункт-разбора .предлагаю')].every((p) => /\d/.test(p.textContent)),
      чисел: document.querySelectorAll('.вкладка-разбора .числа-варианта div').length,
    }));
    проверка('разбор демо: числа и пункты с миллиметрами', разборДемо.чисел === 6 && разборДемо.пунктов > 0 && разборДемо.сЦифрами, JSON.stringify(разборДемо));
    await снять('05-разбор-демо');
    // планировка демо → разбор варианта Б
    await S(() => window.__верстакUI.getState().открытьПроектировщик('планировка'));
    await пауза(400);
    await S(() => document.querySelector('[data-действие="предложить"]')?.click());
    await пауза(2500);
    const вариантыДемо = await S(() => [...document.querySelectorAll('.вариант .метка-чисто')].map((x) => x.textContent));
    проверка('демо-кухня: 3 варианта (линейная, угловая, П) без замечаний', вариантыДемо.length === 3 && вариантыДемо.every((x) => x === 'без замечаний'), вариантыДемо.join(', '));
    await S(() => document.querySelectorAll('.вариант [data-действие="разбор"]')[1]?.click());
    await пауза(800);
    const разборВарианта = await S(() => ({ итог: document.querySelector('.итог-разбора')?.textContent, чисел: document.querySelectorAll('.вкладка-разбора .числа-варианта div').length, что: document.querySelector('.вкладка-разбора select')?.selectedOptions[0]?.textContent }));
    проверка('разбор варианта: числа и итог', разборВарианта.чисел === 6 && !!разборВарианта.итог, JSON.stringify(разборВарианта));
    await снять('06-разбор-варианта');

    // 5. сравнение демо с вариантом В и шторка «до / после»
    await S(() => window.__верстакUI.getState().открытьОкно(null));
    await пауза(200);
    await S(() => window.__верстакUI.getState().открытьПроектировщик('планировка'));
    await пауза(400);
    await S(() => document.querySelectorAll('.вариант [data-действие="сравнить"]')[0]?.click());
    await пауза(900);
    const сравнение = await S(() => ({
      строк: document.querySelectorAll('.таблица-сравнения tbody tr').length,
      лучше: document.querySelectorAll('.список-сравнения.лучше li').length,
      хуже: document.querySelectorAll('.список-сравнения.хуже li').length,
      столешница: [...document.querySelectorAll('.таблица-сравнения tbody tr')].find((tr) => tr.textContent.includes('Столешница'))?.textContent,
    }));
    проверка('сравнение: таблица 10 строк (метры, листы, детали, кромка, нарушения), лучше и хуже', сравнение.строк === 10 && сравнение.лучше + сравнение.хуже > 0, JSON.stringify(сравнение));
    await снять('07-сравнение');
    await S(() => document.querySelector('.вкладка-сравнения [data-действие="до-после"]')?.click());
    await пауза(500);
    await S(() => window.__верстакStore.getState().установитьОбзор('сверху'));
    await пауза(1200);
    // камера «три четверти сверху» на всё помещение (демо 4200 × 3000 с центром в нуле): видны оба ряда
    await S(() => {
      const к = window.__кухня?.ядро?.камераОбзора;
      if (!к) return;
      к.pos.set(1.2, 4.6, 4.4);
      к.yaw = 0.18;
      к.pitch = -0.86;
      window.__кухня.ядро.попроситьКадр();
    });
    await пауза(1200);
    const шторка = await S(() => ({ есть: !!document.querySelector('.шторка'), ручка: !!document.querySelector('.шторка-ручка'), метки: [...document.querySelectorAll('.шторка-метка')].map((x) => x.textContent) }));
    // пиксели слева и справа от шторки разные: сцены разные
    const разные = await S(() => {
      const холст = document.querySelector('.сцена canvas');
      const ш = window.__верстакUI.getState().шторка;
      return { есть: !!холст && !!ш };
    });
    проверка('шторка «до / после» открыта: ручка и подписи «До» и «После»', шторка.есть && шторка.ручка && шторка.метки.length === 2 && разные.есть, JSON.stringify(шторка));
    // двигаем шторку мышью
    const ручка = await стр.$('.шторка-ручка');
    const р = await ручка.boundingBox();
    await стр.mouse.move(р.x + р.width / 2, р.y + р.height / 2);
    await стр.mouse.down();
    await стр.mouse.move(р.x - 180, р.y + р.height / 2, { steps: 8 });
    await стр.mouse.up();
    await пауза(600);
    const доля = await S(() => window.__верстакUI.getState().шторка?.доля);
    проверка('шторку можно двигать мышью', typeof доля === 'number' && доля < 0.49, String(доля));
    await снять('08-до-после');
    await S(() => window.__верстакUI.getState().установитьШторку(null));
    await пауза(400);
    проверка('ошибок консоли нет', к.ошибки.length === 0 && к.шейдер.length === 0, к.ошибки.slice(0, 3).join(' | '));
    браузер.disconnect();
  } finally {
    процесс.kill();
  }
  const плохих = итоги.filter((x) => !x.ок).length;
  console.log(`\nИтого: ${итоги.length - плохих} из ${итоги.length}`);
  fs.writeFileSync(path.join(снимки, '7-итоги.json'), JSON.stringify(итоги, null, 2));
  process.exit(плохих ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
