/**
 * Проход 1 «Реализм»: свой прогон в настоящем окне Electron по правкам прохода. Скриншоты — проверка\v2\Р1-<шаг>-*.png.
 * Шаги (можно перечислить через запятую, по умолчанию все):
 *   A1 — угловая тумба с каруселью: вариант «Угловая» и «П-образная» на кухне 3600 × 2800, створки на 110°;
 *   A2 — нормы проходов по типу помещения: гардеробная кв. 160, три варианта;
 *   A3 — высота мебели по замеру (гардеробная кв. 160 — 2200);
 *   A4 — редактор отметок на стенах в окне «Помещение»: поставить, подвинуть, изменить, удалить; видно в 3D и на плане;
 *   Э  — три эталона (духовка, распашной шкаф, кровать) с 0,5 м, 1 м и 3 м; профили «Быстро», «Стандарт», «Фото».
 * Боевые данные не трогаются: VERSTAK_DATA_DIR. Запуск: node scripts/проверка-Р1.cjs http://127.0.0.1:5274/ A1,A2
 */
const path = require('node:path');
const fs = require('node:fs');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза } = require('./электрон-общее.cjs');

const АДРЕС = process.argv.find((а) => /^https?:\/\//.test(а)) || 'http://127.0.0.1:5274/';
const ШАГИ = (process.argv.find((а) => /^(A\d|Э|ДП)/.test(а)) || 'A1,A2,A3,A4,Э').split(',');
const ВЕРСИЯ = process.argv.find((а) => а.startsWith('--приставка='))?.split('=')[1] ?? '';
const корень = process.cwd();
const снимки = path.join(корень, 'проверка', 'v2');
fs.mkdirSync(снимки, { recursive: true });
const итоги = [];
const проверка = (имя, ок, п = '') => {
  итоги.push({ имя, ок: !!ок, п });
  console.log(`${ок ? 'ОК ' : 'НЕТ'}  ${имя}${п ? ' — ' + п : ''}`);
};

/** yaw и pitch камеры, чтобы смотреть из P в T (метры) */
function взгляд(P, T) {
  const dx = T[0] - P[0];
  const dy = T[1] - P[1];
  const dz = T[2] - P[2];
  return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))];
}

(async () => {
  const данные = path.join(корень, 'проверка', 'данные-Р1');
  fs.rmSync(данные, { recursive: true, force: true });
  fs.mkdirSync(path.join(данные, 'Проекты'), { recursive: true });
  const процесс = запуститьElectron({ адрес: АДРЕС, данные, порт: 9371, доп: { VERSTAK_AUTOSAVE_SEC: '3600' } });
  try {
    const { браузер, стр } = await подключиться(АДРЕС, 9371);
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
      await стр.screenshot({ path: path.join(снимки, `Р1-${ВЕРСИЯ}${имя}.png`) });
    };
    const камера = async (P, T) => {
      const [yaw, pitch] = взгляд(P, T);
      await S((P, yaw, pitch) => window.__кухня.поставитьКамеру(P[0], P[1], P[2], yaw, pitch), P, yaw, pitch);
    };
    /** загрузить проект, собранный моделью в окне (модули грузятся из исходников dev-сервера) */
    const загрузить = async (код) => {
      const ок = await S(async (код) => {
        const f = new Function('м', `return (async () => { ${код} })()`);
        const м = {
          планировщик: await import('/src/model/планировщик.ts'),
          проект: await import('/src/model/проект.ts'),
          помещение: await import('/src/model/помещение.ts'),
          каталог: await import('/src/model/каталог/index.ts'),
          заказчик: await import('/src/model/каталог/помещения-заказчика.ts'),
          валидатор: await import('/src/model/валидатор.ts'),
        };
        const п = await f(м);
        window.__верстакStore.getState().загрузить(п);
        return п.объекты.length;
      }, код);
      await пауза(1500);
      return ок;
    };
    const замечания = () => S(async () => {
      const в = await import('/src/model/валидатор.ts');
      return в.проверитьПроект(window.__верстакStore.getState().проект2).map((з) => з.текст);
    });

    /* ------------------------------------------------------------ A1 */
    if (ШАГИ.includes('A1')) {
      const n = await загрузить(`
        const п = м.проект.новыйПроектV2('Кухня 3600 × 2800', м.помещение.новоеПомещение('п1', 'кухня', 'Кухня', м.помещение.прямоугольник(3600, 2800)));
        const р = м.планировщик.предложитьПланировки(п);
        window.__вариантыA1 = р.варианты.map((в) => ({ тип: в.тип, чисто: в.чисто, углов: в.проект.объекты.filter((о) => о.изделие.startsWith('тумба-угловая-карусель')).length }));
        return р.варианты.find((в) => в.тип === 'угловая').проект;`);
      const вар = await S(() => window.__вариантыA1);
      проверка('A1: «Угловая» и «П-образная» с тумбой-каруселью в углу, все варианты без замечаний', вар.every((в) => в.чисто) && вар.find((в) => в.тип === 'угловая').углов === 1 && вар.find((в) => в.тип === 'П-образная').углов === 2, JSON.stringify(вар));
      проверка('A1: вариант «Угловая» загружен, валидатор чист', n > 10 && (await замечания()).length === 0);
      await камера([0.1, 1.45, 0.75], [1.3, 0.45, -0.95]);
      await снять('A1-угол-закрыто', 900);
      // открыта только угловая тумба: видно карусель 3/4 и створки на петлях у боковин
      await S(() => {
        const с = window.__верстакStore.getState();
        const ид = с.проект2.объекты.filter((о) => о.изделие.startsWith('тумба-угловая-карусель')).map((о) => о.id);
        с.переключитьОткрытие(ид);
      });
      await камера([0.35, 1.2, 0.15], [1.3, 0.4, -0.9]);
      await снять('A1-угол-открыто', 1200);
      await S(() => window.__верстакStore.getState().открытьВсё(false));
      await загрузить(`
        const п = м.проект.новыйПроектV2('Кухня 3600 × 2800', м.помещение.новоеПомещение('п1', 'кухня', 'Кухня', м.помещение.прямоугольник(3600, 2800)));
        return м.планировщик.предложитьПланировки(п).варианты.find((в) => в.тип === 'П-образная').проект;`);
      await S(() => window.__верстакStore.getState().открытьВсё(true));
      await камера([-1.1, 2.55, 1.25], [1.15, 0.35, -0.1]);
      await снять('A1-П-открыто', 1200);
      await S(() => window.__верстакStore.getState().открытьВсё(false));
    }

    /* ------------------------------------------------------------ A2, A3: гардеробная кв. 160 */
    if (ШАГИ.includes('A2') || ШАГИ.includes('A3')) {
      await загрузить(`return м.проект.новыйПроектV2('Гардеробная кв. 160', м.заказчик.помещенияЗаказчика()[1]);`);
      await S(() => document.querySelector('button[aria-label="Проектировщик"]')?.click());
      await пауза(500);
      await S(() => document.querySelector('[data-действие="предложить"]')?.click());
      await пауза(2500);
      const варианты = await S(() =>
        [...document.querySelectorAll('.вариант')].map((в) => ({
          заголовок: в.querySelector('header b')?.textContent,
          чисто: в.querySelector('.метка-чисто')?.textContent,
          текст: в.textContent,
        })),
      );
      проверка('A2: гардеробная кв. 160 — 3 варианта, все без замечаний', варианты.length === 3 && варианты.every((в) => в.чисто === 'без замечаний'), варианты.map((в) => `${в.заголовок}: ${в.чисто}`).join(' | '));
      проверка('A2: глубина 600 во всех вариантах, норма прохода гардеробной в тексте', варианты.every((в) => /глубина 600/.test(в.текст)) && варианты.some((в) => /норма 700 мм — гардеробная/.test(в.текст)) && варианты.some((в) => /600 мм — гардеробная, перед открытыми полками/.test(в.текст)));
      if (ШАГИ.includes('A3')) проверка('A3: высота мебели 2200 по замеру заказчика, пометка «уточнить»', варианты.every((в) => /высота 2200/.test(в.текст)) && варианты.some((в) => /уточнить/.test(в.текст)), варианты.map((в) => (/высота (\d+)/.exec(в.текст) || [])[1]).join(', '));
      await S(() => document.querySelectorAll('.вариант details.учтено').forEach((d) => (d.open = true)));
      await снять('A2-гардеробная-варианты', 900);
      if (ШАГИ.includes('A3')) {
        // переключатель «До потолка»: варианты пересчитываются на 2650
        await S(() => document.querySelector('[data-высота="до-потолка"]')?.click());
        await пауза(1500);
        const доП = await S(() => [...document.querySelectorAll('.вариант')].map((в) => (/высота (\d+)/.exec(в.textContent) || [])[1]));
        проверка('A3: «До потолка» — варианты на 2650 (потолок минус 50)', доП.length === 3 && доП.every((x) => x === '2650'), доП.join(', '));
        await снять('A3-до-потолка', 700);
        await S(() => document.querySelector('[data-высота="по-замеру"]')?.click());
        await пауза(1200);
      }
      await S(() => window.__верстакUI.getState().открытьОкно(null));
      // П-образный вариант в 3D: глубина 600, штанга внутри
      await загрузить(`
        const р = м.планировщик.предложитьПланировки(м.проект.новыйПроектV2('Гардеробная кв. 160', м.заказчик.помещенияЗаказчика()[1]));
        return р.варианты.find((в) => в.тип === 'П-образная').проект;`);
      await камера([0.95, 1.65, 1.45], [0.95, 1.2, 0.2]);
      await снять('A2-гардеробная-П-в-3D', 1200);
      if (ШАГИ.includes('A3')) {
        await S(() => window.__верстакStore.getState().переключитьКомнату(true));
        await пауза(700);
        const поле = await S(() => [...document.querySelectorAll('.высота-мебели .поле')].map((п) => п.textContent + ' ' + п.querySelector('input')?.value).join(''));
        проверка('A3: в окне «Помещение» поле «Высота мебели по замеру» = 2200', /2200/.test(поле), поле);
        await снять('A3-окно-помещение', 700);
        await S(() => window.__верстакStore.getState().переключитьКомнату(false));
      }
    }

    /* ------------------------------------------------------------ A4: редактор отметок на стенах */
    if (ШАГИ.includes('A4')) {
      await загрузить(`return м.проект.новыйПроектV2('Отметки', м.помещение.новоеПомещение('п1', 'кухня', 'Кухня', м.помещение.прямоугольник(3600, 2800)));`);
      await S(() => window.__верстакStore.getState().переключитьКомнату(true));
      await пауза(600);
      const выбрать = (метка, значение) =>
        S((метка, значение) => {
          const эл = document.querySelector(`select[aria-label="${метка}"]`);
          Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(эл, String(значение));
          эл.dispatchEvent(new Event('change', { bubbles: true }));
        }, метка, значение);
      const вписать = (подпись, значение) =>
        S((подпись, значение) => {
          const поле = [...document.querySelectorAll('.редактор-отметки .поле')].find((п) => п.querySelector('label')?.textContent === подпись);
          const вв = поле.querySelector('input');
          вв.focus();
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(вв, String(значение));
          вв.dispatchEvent(new Event('input', { bubbles: true }));
          вв.blur();
        }, подпись, значение);
      const отметки = () => S(() => window.__верстакStore.getState().проект2.помещения[0].отметки.map((о) => ({ вид: о.вид, стена: о.стена, от_угла: о.от_угла, от_пола: о.от_пола })));
      const поставить = async (вид, стена) => {
        await выбрать('Вид отметки', вид);
        await выбрать('Стена для новой отметки', стена);
        await S(() => document.querySelector('[data-действие="поставить-отметку"]').click());
        await пауза(300);
      };
      await поставить('радиатор', 0);
      let о = await отметки();
      проверка('A4: «Поставить на стену» — радиатор на задней стене, размеры по умолчанию', о.length === 1 && о[0].вид === 'радиатор' && о[0].стена === 0 && о[0].от_пола === 150, JSON.stringify(о));
      await вписать('От угла, мм', 600);
      await пауза(200);
      await S(() => [...document.querySelectorAll('.редактор-отметки button')].find((b) => b.textContent.includes('50 →')).click());
      await пауза(200);
      о = await отметки();
      проверка('A4: изменить цифрой (от угла 600) и подвинуть кнопкой на 50 → 650', о[0].от_угла === 650, JSON.stringify(о[0]));
      await поставить('вода', 1);
      await поставить('розетка', 0);
      await поставить('щиток', 3);
      о = await отметки();
      проверка('A4: четыре отметки на трёх стенах', о.length === 4, о.map((x) => x.вид).join(', '));
      await камера([-1.2, 1.9, 1.3], [0.9, 0.6, -0.7]);
      await пауза(900);
      const подписи = await S(() => [...document.querySelectorAll('.размер-метка.отметка')].filter((э) => э.style.display !== 'none').map((э) => э.textContent));
      проверка('A4: на сцене подписи вида и высоты («Радиатор · 150», «Розетка · 300»…)', подписи.includes('Радиатор · 150') && подписи.includes('Розетка · 300') && подписи.length >= 3, подписи.join(' | '));
      await снять('A4-отметки-в-3D', 600);
      // удалить и вернуть (история)
      // выбрать вторую отметку в списке (последняя поставленная уже выбрана) — щелчком по строке
      const вторая = await S(() => window.__верстакStore.getState().проект2.помещения[0].отметки[1].id);
      await S((id) => document.querySelector(`[data-отметка="${id}"]`).click(), вторая);
      await пауза(200);
      проверка('A4: щелчок по строке списка открывает редактор этой отметки', await S((id) => !!document.querySelector(`[data-редактор-отметки="${id}"]`), вторая));
      await S(() => [...document.querySelectorAll('.редактор-отметки button')].find((b) => b.textContent.includes('Удалить')).click());
      await пауза(200);
      const после = (await отметки()).length;
      await S(() => window.__верстакStore.getState().отменить());
      await пауза(200);
      проверка('A4: «Удалить» убирает отметку, Ctrl+Z возвращает', после === 3 && (await отметки()).length === 4, `${после} → ${(await отметки()).length}`);
      // план квартиры
      await S(() => window.__верстакUI.getState().переключитьПлан(true));
      await пауза(600);
      const наПлане = await S(() => [...document.querySelectorAll('[data-план-отметка] text')].map((т) => т.textContent));
      проверка('A4: на плане — отметки с подписью вида и высоты', наПлане.length === 4 && наПлане.includes('Вода · 500'), наПлане.join(' | '));
      await снять('A4-отметки-на-плане', 500);
      await S(() => window.__верстакUI.getState().переключитьПлан(false));
      // сохранить, открыть заново
      await S(() => window.__верстакStore.getState().сохранить());
      await пауза(800);
      await S(() => window.__верстакStore.getState().открыть('Отметки'));
      await пауза(1500);
      const сФайла = await отметки();
      проверка('A4: отметки сохранены в .kitchen и открываются', сФайла.length === 4 && сФайла[0].от_угла === 650, JSON.stringify(сФайла));
      // «Предложи планировку» учитывает
      await S(() => window.__верстакStore.getState().переключитьКомнату(false));
      await S(() => document.querySelector('button[aria-label="Проектировщик"]')?.click());
      await пауза(400);
      await S(() => document.querySelector('[data-действие="предложить"]')?.click());
      await пауза(2500);
      const учтено = await S(() => [...document.querySelectorAll('.вариант')].map((в) => ({ чисто: в.querySelector('.метка-чисто')?.textContent, радиатор: /Радиатор 800/.test(в.textContent), вода: /Мойка в \d+ мм от точки воды/.test(в.textContent) })));
      проверка('A4: «Предложи планировку» учитывает радиатор и воду, варианты без замечаний', учтено.length > 0 && учтено.every((в) => в.чисто === 'без замечаний' && в.радиатор && в.вода), JSON.stringify(учтено));
      await S(() => window.__верстакUI.getState().открытьОкно(null));
    }

    /* ------------------------------------------------------------ итог */
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
    fs.writeFileSync(path.join(корень, 'проверка', 'Р1-итог.json'), JSON.stringify(итоги, null, 2));
    process.exit(н ? 1 : 0);
  }
})();
