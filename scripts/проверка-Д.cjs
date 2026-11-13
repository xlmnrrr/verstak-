/**
 * Добавки после прохода 1 (13.11.2026): свой прогон в настоящем окне Electron. Скриншоты — проверка\v2\Д-*.png.
 *   стены   — план стен в окне «Помещение»: тянуть угол мышью, вырезать угол (Г-образная кухня), обмер, единицы мм / см / м;
 *   потолок — натяжной потолок по кнопке, точечные светильники сеткой, высота полотна, вечер и глянец изнутри комнаты;
 *   смета   — окно «Смета»: строки, цена мастера, итог; размеры изделия в см и м.
 * Боевые данные не трогаются: VERSTAK_DATA_DIR. Запуск: node scripts/проверка-Д.cjs http://127.0.0.1:5274/
 */
const path = require('node:path');
const fs = require('node:fs');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза } = require('./электрон-общее.cjs');

const АДРЕС = process.argv.find((а) => /^https?:\/\//.test(а)) || 'http://127.0.0.1:5274/';
const корень = process.cwd();
const снимки = path.join(корень, 'проверка', 'v2');
fs.mkdirSync(снимки, { recursive: true });
const итоги = [];
const проверка = (имя, ок, п = '') => {
  итоги.push({ имя, ок: !!ок, п });
  console.log(`${ок ? 'ОК ' : 'НЕТ'}  ${имя}${п ? ' — ' + п : ''}`);
};
function взгляд(P, T) {
  const dx = T[0] - P[0];
  const dy = T[1] - P[1];
  const dz = T[2] - P[2];
  return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))];
}

(async () => {
  const данные = path.join(корень, 'проверка', 'данные-Д');
  fs.rmSync(данные, { recursive: true, force: true });
  fs.mkdirSync(path.join(данные, 'Проекты'), { recursive: true });
  const процесс = запуститьElectron({ адрес: АДРЕС, данные, порт: 9373, доп: { VERSTAK_AUTOSAVE_SEC: '3600' } });
  try {
    const { браузер, стр } = await подключиться(АДРЕС, 9373);
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
    await S(() => window.__верстакStore.getState().установитьТему('мастерская'));
    await S(() => [...document.querySelectorAll('.модал button')].find((b) => b.textContent.includes('Пропустить'))?.click());
    await пауза(400);
    const снять = async (имя, ждать = 900) => {
      await пауза(ждать);
      await стр.screenshot({ path: path.join(снимки, `Д-${имя}.png`) });
    };
    const камера = async (P, T) => {
      const [yaw, pitch] = взгляд(P, T);
      await S((P, yaw, pitch) => window.__кухня.поставитьКамеру(P[0], P[1], P[2], yaw, pitch), P, yaw, pitch);
    };
    /** камера может доводиться плавно: ставим, ждём, ставим ещё раз и снимаем */
    const снятьОтсюда = async (имя, P, T, ждать = 1200) => {
      await камера(P, T);
      await пауза(ждать);
      await камера(P, T);
      await снять(имя, 500);
    };
    const клик = (селектор) => S((с) => document.querySelector(с)?.click(), селектор);
    const пом = () => S(() => {
      const с = window.__верстакStore.getState();
      return с.проект2.помещения.find((п) => п.id === с.помещениеАктивное);
    });

    // кухня 3600 × 2800: шкаф, тумба с ящиками, навесной
    await S(async () => {
      const пр = await import('/src/model/проект.ts');
      const по = await import('/src/model/помещение.ts');
      const кат = await import('/src/model/каталог/index.ts');
      const п = пр.новыйПроектV2('Добавки', по.новоеПомещение('п1', 'кухня', 'Кухня', по.прямоугольник(3600, 2800)));
      const э = (ид, x, y, z, пов = 0) => ({ ...пр.новыйЭкземпляр(кат.изделиеПоИд(ид), 'п1', [x, y, z]), поворот: пов });
      п.объекты = [э('шкаф-распашной-900', -1250, 0, -1100), э('тумба-ящики-600', -500, 0, -1100), э('тумба-ящики-600', 100, 0, -1100), э('навесной-подъёмник-800', -350, 1500, -1240)];
      window.__верстакStore.getState().загрузить(п);
    });
    await пауза(1500);
    for (let i = 0; i < 40 && !(await S(() => !!window.__кухня?.поставитьКамеру)); i++) await пауза(250);

    /* ---------------------------------------------------------------- стены */
    await S(() => window.__верстакStore.getState().переключитьКомнату(true));
    await пауза(700);
    const былоУглов = (await пом()).контур.length;
    проверка('стены: план стен в окне «Помещение» показан, 4 угла и 4 подписи длин', (await S(() => document.querySelectorAll('.план-стен [data-угол]').length)) === 4 && (await S(() => document.querySelectorAll('.план-размер').length)) === 4);
    // тянем угол 2 (правый нижний) мышью: сдвиг влево-вверх
    await S(() => document.querySelector('.план-стен svg').scrollIntoView({ block: 'center' }));
    await пауза(300);
    const до = (await пом()).контур.map((p) => [...p]);
    const рамка = await (await стр.$('.план-стен [data-угол="2"]')).boundingBox();
    const x0 = рамка.x + рамка.width / 2;
    const y0 = рамка.y + рамка.height / 2;
    await стр.mouse.move(x0, y0);
    await стр.mouse.down();
    for (let i = 1; i <= 8; i++) await стр.mouse.move(x0 - i * 6, y0 - i * 4);
    await стр.mouse.up();
    await пауза(400);
    const после = (await пом()).контур;
    const сдвиг = до.findIndex((p, i) => p[0] !== после[i]?.[0] || p[1] !== после[i]?.[1]);
    проверка('стены: угол тянется мышью, точки ровно на шаге 10 мм', сдвиг >= 0 && после.every((p) => p.every((v) => Math.abs(v - Math.round(v / 10) * 10) < 0.01)), JSON.stringify({ до, после }));
    await S(() => window.__верстакStore.getState().отменить());
    await пауза(300);
    проверка('стены: Ctrl+Z возвращает угол', JSON.stringify((await пом()).контур) === JSON.stringify(до));
    // вырезать угол: стена 4 (левая), 900 вдоль, 700 внутрь — Г-образная кухня
    await S(() => {
      const сел = document.querySelector('select[aria-label="Стена для выступа"]');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(сел, '3');
      сел.dispatchEvent(new Event('change', { bubbles: true }));
      const вписать = (подпись, v) => {
        const п = [...document.querySelectorAll('.план-стен .поле')].find((x) => x.querySelector('span')?.textContent === подпись);
        const вв = п.querySelector('input');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(вв, String(v));
        вв.dispatchEvent(new Event('input', { bubbles: true }));
      };
      вписать('Ширина, мм', 900);
      вписать('Глубина, мм (− наружу)', 700);
    });
    await пауза(200);
    await клик('[data-действие="вырезать-угол"]');
    await пауза(500);
    const г = await пом();
    const обмер = await S(() => document.querySelector('.обмер')?.textContent ?? '');
    проверка('стены: «Вырезать угол» — 6 стен, пол 10,08 − 0,63 = 9,45 м² в обмере', г.контур.length === былоУглов + 2 && обмер.includes('9,45 м²'), `${г.контур.length} углов; ${обмер}`);
    await снять('стены-план');
    // единицы: см
    await клик('[data-единица="см"]');
    await пауза(300);
    const подписи = await S(() => [...document.querySelectorAll('.план-размер')].map((x) => x.textContent));
    проверка('стены: единицы «см» — подписи стен в см', подписи.every((т) => т.endsWith(' см')) && подписи.includes('360 см'), подписи.join(', '));
    await снять('стены-см', 300);
    await клик('[data-единица="мм"]');
    // 3D сверху: Г-образная кухня
    await S(() => window.__верстакStore.getState().переключитьКомнату(false));
    await снятьОтсюда('стены-3d', [0.2, 6.2, 3.6], [0, 0, 0]);

    /* ---------------------------------------------------------------- потолок */
    await S(() => window.__верстакStore.getState().переключитьКомнату(true));
    await пауза(500);
    await клик('[data-действие="натяжной"]');
    await пауза(300);
    const н = (await пом()).натяжной_потолок;
    проверка('потолок: кнопка включает натяжной — мат, белый, опуск 50', н && н.фактура === 'мат' && н.опуск === 50, JSON.stringify(н));
    await клик('[data-действие="сетка-светильников"]');
    await пауза(500);
    const светильники = await S(() => window.__верстакStore.getState().проект2.объекты.filter((о) => о.изделие === 'светильник-точечный-gx53').map((о) => о.позиция));
    проверка('потолок: «Расставить сеткой» — светильники только внутри Г, верх у полотна 2650', светильники.length >= 6 && светильники.every((p) => p[1] === 2650 - 12), `${светильники.length} шт: ${JSON.stringify(светильники.slice(0, 3))}`);
    // опуск 80 — светильники переезжают
    await S(() => {
      const с = window.__верстакStore.getState();
      const п = с.проект2.помещения[0];
      с.задатьНатяжнойПотолок({ ...п.натяжной_потолок, опуск: 80 });
    });
    const y80 = await S(() => window.__верстакStore.getState().проект2.объекты.find((о) => о.изделие === 'светильник-точечный-gx53').позиция[1]);
    проверка('потолок: опуск 80 — светильники опускаются вместе с полотном', y80 === 2620 - 12, String(y80));
    await S(() => {
      const с = window.__верстакStore.getState();
      с.задатьНатяжнойПотолок({ ...с.проект2.помещения[0].натяжной_потолок, опуск: 50 });
    });
    await S(() => document.querySelector('[data-раздел="потолок"]')?.scrollIntoView({ block: 'start' }));
    await снять('потолок-панель', 500);
    await S(() => window.__верстакStore.getState().переключитьКомнату(false));
    // изнутри комнаты: днём, вечером, глянец вечером
    const P = [0.9, 1.45, 1.25];
    const T = [-0.6, 2.2, -1.3];
    await снятьОтсюда('потолок-день', P, T, 1500);
    // вогнутый угол Г изнутри: стены сходятся в точку, без ступеньки и щели (замечание Макара 13.11)
    await снятьОтсюда('угол-вогнутый', [1.3, 1.7, -1.2], [-1.1, 1.2, 0.5]);
    await снятьОтсюда('угол-вогнутый-пол', [0.6, 0.9, -0.6], [-1.1, 0.0, 0.5]);
    const полотно = await S(() => {
      const м = window.__кухня.scene.getObjectByName('потолок-натяжной');
      return м ? { видно: м.visible, y: м.geometry.getAttribute('position').getY(0) } : null;
    });
    проверка('потолок: полотно на сцене на высоте 2,65 м', полотно && полотно.видно && Math.abs(полотно.y - 2.65) < 1e-6, JSON.stringify(полотно));
    await S(() => window.__верстакUI.getState().установитьЧас(21));
    await снятьОтсюда('потолок-вечер', P, T, 1800);
    const прожекторов = await S(() => {
      let n = 0;
      window.__кухня.scene.traverse((о) => {
        if (о.isSpotLight && о.visible && о.intensity > 0) n++;
      });
      return n;
    });
    проверка('потолок: вечером над светильниками прожекторы вниз (до 8)', прожекторов > 0 && прожекторов <= 8, String(прожекторов));
    await S(() => {
      const с = window.__верстакStore.getState();
      с.задатьНатяжнойПотолок({ ...с.проект2.помещения[0].натяжной_потолок, фактура: 'глянец' });
    });
    await снятьОтсюда('потолок-глянец-вечер', P, T, 1500);
    await снятьОтсюда('угол-вогнутый-вечер', [1.3, 1.7, -1.2], [-1.1, 1.2, 0.5]);
    await S(() => window.__верстакUI.getState().установитьЧас(null));
    // сверху полотно не мешает: снимок обзора
    await снятьОтсюда('потолок-сверху', [0.2, 6.2, 3.6], [0, 0, 0]);

    /* ---------------------------------------------------------------- смета */
    await S(() => window.__верстакStore.setState({ выбрано: [window.__верстакStore.getState().проект2.объекты[0].id] }));
    await пауза(700);
    const размеры = await S(() => document.querySelector('[data-единицы]')?.textContent ?? '');
    проверка('смета: под размерами изделия — то же в см и м', /см/.test(размеры) && / м$/.test(размеры.trim()), размеры);
    await S(() => window.__верстакStore.setState({ выбрано: [] }));
    await клик('[data-действие="смета"]');
    await пауза(700);
    const строки = await S(() => [...document.querySelectorAll('.смета-таблица tr[data-ключ]')].map((т) => т.getAttribute('data-ключ')));
    проверка('смета: окно открыто — ЛДСП, кромка, петли, направляющие, светильники, потолок, пол, плинтус', ['лдсп-корпус', 'петли', 'направляющие', 'шт:светильник-точечный-gx53', 'потолок-натяжной', 'пол', 'плинтус'].every((x) => строки.includes(x)), строки.join(', '));
    await S(() => {
      const вв = document.querySelector('.смета-таблица tr[data-ключ="лдсп-корпус"] input');
      вв.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(вв, '4200');
      вв.dispatchEvent(new Event('input', { bubbles: true }));
      вв.blur();
    });
    await пауза(300);
    const итог = await S(() => document.querySelector('.смета-итог')?.textContent ?? '');
    проверка('смета: цена листа ЛДСП 4200 ₽ — итог пересчитан и цена запомнена', /[1-9]/.test(итог.split('·')[0]) && (await S(() => window.__верстакUI.getState().цены['лдсп-корпус'])) === 4200, итог);
    await снять('смета', 600);
    await S(() => window.__верстакUI.getState().открытьОкно(null));

    проверка('ошибок шейдера нет', к.шейдер.length === 0, к.шейдер.slice(0, 2).join(' | '));
    проверка('ошибок консоли нет', к.ошибки.length === 0, к.ошибки.slice(0, 3).join(' | '));
    браузер.disconnect();
  } catch (e) {
    console.error(e);
    проверка('прогон без исключений', false, String(e && e.stack));
  } finally {
    процесс.kill();
    const н = итоги.filter((x) => !x.ок).length;
    console.log(`\nИтого: ${итоги.length - н} из ${итоги.length}`);
    fs.writeFileSync(path.join(корень, 'проверка', 'Д-итог.json'), JSON.stringify(итоги, null, 2));
    process.exit(н ? 1 : 0);
  }
})();
