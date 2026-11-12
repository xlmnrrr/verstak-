/**
 * Приёмка добавки B «UV для обоев и пола» в окне Electron: текстуры на стенах и на полу (UV), выбор в окне «Помещение»,
 * сохранение значения в проекте, ошибки шейдера и консоли. Запуск: node scripts/проверка-B.cjs http://127.0.0.1:5274/ ; скриншоты — проверка\v2\B-*.png
 */
const path = require('node:path');
const fs = require('node:fs');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза } = require('./электрон-общее.cjs');
const АДРЕС = process.argv[2] || 'http://127.0.0.1:5274/';
const корень = process.cwd();
const данные = path.join(корень, 'проверка', 'данные-B');
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
  const процесс = запуститьElectron({ адрес: АДРЕС, данные, порт: 9388, доп: { VERSTAK_AUTOSAVE_SEC: '3600' } });
  const t0 = Date.now();
  try {
    const { браузер, стр } = await подключиться(АДРЕС, 9388);
    const к = слушатьКонсоль(стр);
    const S = (fn, ...а) => стр.evaluate(fn, ...а);
    await пауза(2500);
    await S(() => localStorage.setItem('верстак:интерфейс', JSON.stringify({ туркПройден: true })));
    await стр.reload();
    await пауза(2500);
    await S(() => [...document.querySelectorAll('.действие')].find((x) => x.textContent.includes('Пример кухни'))?.click());
    await пауза(3500);
    const отделка = async (обои, пол) => {
      await S((о, п) => window.__верстакStore.getState().обновитьКомнату({ обои: о, пол: п }), обои, пол);
      await пауза(1800);
    };
    const вид = (px, py, pz, yaw, pitch) => S((a, b, c, d, e) => window.__кухня.поставитьКамеру(a, b, c, d, e), px, py, pz, yaw, pitch);

    // 1. штукатурка + паркет
    await отделка('стена-штукатурка-тёплая', 'пол-паркет');
    await вид(0.4, 1.6, 1.4, 0.05, -0.25);
    await пауза(700);
    await стр.screenshot({ path: path.join(снимки, 'B-штукатурка-паркет.png') });
    const пол1 = await S(() => {
      const м = window.__кухня.scene.getObjectByName('пол');
      return { карта: !!(м && m_ok(м.material.map)), нормаль: !!(м && m_ok(м.material.normalMap)), uv: !!(м && м.geometry.getAttribute('uv')), повтор: м ? м.material.map?.repeat.x : 0 };
      function m_ok(x) {
        return !!x;
      }
    });
    проверка('у пола есть UV и текстура с normal-картой', пол1.карта && пол1.нормаль && пол1.uv, `повтор ${пол1.повтор?.toFixed(3)}`);
    // 2. обои под покраску + корзина
    await отделка('стена-обои-серо-голубые', 'пол-паркет-корзина');
    await вид(-0.6, 1.3, 1.5, -0.2, -0.45);
    await пауза(700);
    await стр.screenshot({ path: path.join(снимки, 'B-обои-корзина.png') });
    // 3. акцентная стена из мрамора + бетонный пол
    await отделка('стена-мрамор', 'пол-бетон');
    await вид(0, 2.6, 2.8, 0, -0.62);
    await пауза(700);
    await стр.screenshot({ path: path.join(снимки, 'B-мрамор-бетон.png') });
    // 4. обычный цвет возвращается: текстура снимается
    await отделка('#cbb79a', '#8a6a4b');
    const пол2 = await S(() => {
      const м = window.__кухня.scene.getObjectByName('пол');
      return { карта: !!(м && м.material.map), нормаль: !!(м && м.material.normalMap) };
    });
    проверка('при обычном цвете текстура пола снимается', !пол2.карта && !пол2.нормаль);
    await стр.screenshot({ path: path.join(снимки, 'B-обычный-цвет.png') });

    // 5. значение хранится в проекте и читается обратно
    await отделка('стена-штукатурка-белая', 'пол-дуб');
    const туда = await S(async () => {
      const { записатьПроект, разобратьФайл } = await import('/src/model/файл.ts');
      const п = window.__верстакStore.getState().проект2;
      const р = разобратьФайл(записатьПроект(п));
      return { ок: р.ок, стены: р.проект?.помещения[0].отделка.стены, пол: р.проект?.помещения[0].отделка.пол };
    });
    проверка('текстуры стен и пола сохраняются в .kitchen и читаются обратно', туда.ок && туда.стены === 'стена-штукатурка-белая' && туда.пол === 'пол-дуб', JSON.stringify(туда));

    // 6. окно «Помещение»: списки с фактурой
    await S(() => document.querySelector('button[aria-label="Помещение"]')?.click());
    await пауза(600);
    const ui = await S(() => ({ стены: document.querySelectorAll('[aria-label="Текстуры стен"] .материал').length, пол: document.querySelectorAll('[aria-label="Текстуры пола"] .материал').length }));
    проверка('в окне «Помещение» есть списки текстур стен и пола', ui.стены >= 5 && ui.пол >= 5, JSON.stringify(ui));
    await стр.screenshot({ path: path.join(снимки, 'B-панель-помещения.png') });

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
  const ок = итоги.filter((x) => x.ок).length;
  console.log(`\nИтог: ${ок} из ${итоги.length}, ${((Date.now() - t0) / 1000).toFixed(0)} с`);
  process.exit(ок === итоги.length ? 0 : 1);
})();
