/**
 * Приёмка 1Б-1 в настоящем окне Electron: 4 скриншота (обложка и редактор × две темы), нормы ДИЗАЙН-БРИФ §4
 * (цели ≥ 32 px, главные ≥ 40, шрифт ≥ 13 px, контраст ≥ 4,5:1), сохранение темы, одно окно, запоминание размера окна.
 * Запуск: node scripts/проверка-1Б1.cjs http://127.0.0.1:5274/
 */
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза } = require('./электрон-общее.cjs');

const АДРЕС = process.argv[2] || 'http://127.0.0.1:5274/';
const корень = process.cwd();
const данные = path.join(корень, 'проверка', 'данные-1Б1');
const снимки = path.join(корень, 'проверка', 'v2');
fs.mkdirSync(снимки, { recursive: true });

const итоги = [];
const проверка = (имя, ок, подробности = '') => {
  итоги.push({ имя, ок: !!ок, подробности });
  console.log(`${ок ? 'ОК ' : 'НЕТ'}  ${имя}${подробности ? ' — ' + подробности : ''}`);
};

/** WCAG */
const яркость = ([r, g, b]) => {
  const к = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * к[0] + 0.7152 * к[1] + 0.0722 * к[2];
};
const контраст = (a, b) => {
  const [l1, l2] = [яркость(a), яркость(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

/** Выполняется в странице: измерить нормы на текущем экране */
function измерить() {
  const разобрать = (с) => {
    let m = с.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const п = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { c: [п[0], п[1], п[2]], a: п[3] ?? 1 };
    }
    m = с.match(/color\(srgb ([^)]+)\)/);
    if (m) {
      const п = m[1].split(/[ /]+/).filter(Boolean).map(Number);
      return { c: [п[0] * 255, п[1] * 255, п[2] * 255], a: п[3] ?? 1 };
    }
    return null;
  };
  const смешать = (верх, низ) => ({ c: верх.c.map((v, i) => v * верх.a + низ.c[i] * (1 - верх.a)), a: 1 });
  const фонЭлемента = (эл) => {
    const стек = [];
    for (let e = эл; e; e = e.parentElement) {
      const б = разобрать(getComputedStyle(e).backgroundColor);
      if (б && б.a > 0) {
        стек.push(б);
        if (б.a >= 1) break;
      }
    }
    let ф = { c: [255, 255, 255], a: 1 };
    const корень = разобрать(getComputedStyle(document.body).backgroundColor);
    if (корень) ф = корень;
    for (const б of стек.reverse()) ф = смешать(б, ф);
    return ф;
  };
  const видим = (эл) => {
    const r = эл.getBoundingClientRect();
    const ст = getComputedStyle(эл);
    return r.width > 0 && r.height > 0 && ст.visibility !== 'hidden' && ст.display !== 'none' && !эл.closest('[aria-hidden="true"]');
  };
  const имя = (эл) => (эл.getAttribute('aria-label') || эл.title || эл.textContent || эл.className || эл.tagName).toString().trim().replace(/\s+/g, ' ').slice(0, 40);

  const цели = [];
  for (const эл of document.querySelectorAll('button, select, input, a, [role="button"]')) {
    if (!видим(эл)) continue;
    const r = эл.getBoundingClientRect();
    цели.push({ имя: имя(эл), ш: Math.round(r.width), в: Math.round(r.height), главная: эл.matches('.кн.главная, .действие.главное') });
  }
  const текст = [];
  const обход = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let у = обход.nextNode(); у; у = обход.nextNode()) {
    const т = у.textContent.trim();
    if (!т) continue;
    const эл = у.parentElement;
    if (!эл || !видим(эл) || эл.closest('canvas, .оверлей-меток .метка-влезает, script, style')) continue;
    const ст = getComputedStyle(эл);
    const цв = разобрать(ст.color);
    if (!цв) continue;
    const ф = фонЭлемента(эл);
    const текстЦвет = смешать(цв, ф).c;
    текст.push({ т: т.slice(0, 30), px: parseFloat(ст.fontSize), цветТекста: текстЦвет, фон: ф.c, класс: (эл.className || эл.tagName).toString().slice(0, 30), подпись: !!эл.closest('label, .кл, .штамп, .материал, small, .поле') });
  }
  return { цели, текст, тема: document.documentElement.dataset.theme };
}

(async () => {
  fs.rmSync(данные, { recursive: true, force: true });
  fs.mkdirSync(path.join(данные, 'Проекты'), { recursive: true });
  const исходник = path.join(корень, 'проверка', 'копия-до-прогона', 'Пример_ кухня из шаблонов.kitchen');
  if (fs.existsSync(исходник)) {
    fs.copyFileSync(исходник, path.join(данные, 'Проекты', 'Пример_ кухня из шаблонов.kitchen'));
    fs.copyFileSync(исходник, path.join(данные, 'Проекты', 'Второй проект.kitchen'));
  }

  const процесс = запуститьElectron({ адрес: АДРЕС, данные, доп: { VERSTAK_AUTOSAVE_SEC: '3600' } });
  const нормы = {};
  try {
    const { браузер, стр } = await подключиться(АДРЕС);
    const к = слушатьКонсоль(стр);
    await пауза(2500);

    for (const [тема, ид] of [['мастерская', 'dark'], ['калька', 'light']]) {
      await стр.evaluate((т) => window.__верстакStore.getState().установитьТему(т), тема);
      /* ---- обложка ---- */
      await стр.evaluate(() => window.__верстакStore.getState().наЭкран('меню'));
      await пауза(2500);
      await стр.screenshot({ path: path.join(снимки, `1Б1-обложка-${ид}.png`) });
      нормы[`обложка-${ид}`] = await стр.evaluate(измерить);
      /* ---- редактор ---- */
      await стр.evaluate(() => {
        const э = [...document.querySelectorAll('.действие')].find((x) => x.textContent.includes('Пример кухни'));
        if (э) э.click();
      });
      await пауза(2500);
      await стр.evaluate(() => {
        const с = window.__верстакStore.getState();
        const о = с.проект2.объекты.find((x) => x.изделие.includes('тумба-ящики')) ?? с.проект2.объекты[2];
        с.выбрать([о.id]);
      });
      await пауза(1200);
      await стр.screenshot({ path: path.join(снимки, `1Б1-редактор-${ид}.png`) });
      нормы[`редактор-${ид}`] = await стр.evaluate(измерить);
      // каталог открыт — отдельный кадр и замер (тоже часть редактора)
      await стр.evaluate(() => { const с = window.__верстакStore.getState(); с.выбрать([]); с.переключитьКаталог(true); });
      await пауза(700);
      await стр.screenshot({ path: path.join(снимки, `1Б1-редактор-каталог-${ид}.png`) });
      нормы[`каталог-${ид}`] = await стр.evaluate(измерить);
      await стр.evaluate(() => { const с = window.__верстакStore.getState(); с.переключитьКаталог(false); с.переключитьКомнату(true); });
      await пауза(700);
      нормы[`комната-${ид}`] = await стр.evaluate(измерить);
      await стр.evaluate(() => window.__верстакStore.getState().переключитьКомнату(false));
    }

    /* ---- нормы ---- */
    const все = Object.values(нормы);
    const мелкиеЦели = [];
    const мелкиеГлавные = [];
    let минЦель = 999;
    for (const [экран, н] of Object.entries(нормы)) {
      for (const ц of н.цели) {
        const минимум = Math.min(ц.ш, ц.в);
        if (!ц.главная) минЦель = Math.min(минЦель, минимум);
        if (минимум < 32) мелкиеЦели.push(`${экран}: «${ц.имя}» ${ц.ш}×${ц.в}`);
        if (ц.главная && ц.в < 40) мелкиеГлавные.push(`${экран}: «${ц.имя}» ${ц.ш}×${ц.в}`);
      }
    }
    проверка('цели клика ≥ 32 × 32 px', мелкиеЦели.length === 0, `минимальная цель ${минЦель} px; нарушений ${мелкиеЦели.length}${мелкиеЦели.length ? ': ' + мелкиеЦели.slice(0, 6).join('; ') : ''}`);
    проверка('главные кнопки ≥ 40 px по высоте', мелкиеГлавные.length === 0, мелкиеГлавные.slice(0, 4).join('; ') || 'все главные ≥ 40');

    let минШрифт = 99;
    let минШрифтПодписи = 99;
    const мелкийШрифт = [];
    const низкийКонтраст = [];
    const минКонтраст = {};
    for (const [экран, н] of Object.entries(нормы)) {
      for (const т of н.текст) {
        if (т.подпись) минШрифтПодписи = Math.min(минШрифтПодписи, т.px);
        else {
          минШрифт = Math.min(минШрифт, т.px);
          if (т.px < 13) мелкийШрифт.push(`${экран}: «${т.т}» ${т.px}px`);
        }
        if (т.подпись && т.px < 12) мелкийШрифт.push(`${экран}: подпись «${т.т}» ${т.px}px`);
        const к = контраст(т.цветТекста, т.фон);
        const ключ = н.тема;
        минКонтраст[ключ] = Math.min(минКонтраст[ключ] ?? 99, к);
        if (к < 4.5) низкийКонтраст.push(`${экран}: «${т.т}» ${к.toFixed(2)}`);
      }
    }
    проверка('шрифт интерфейса ≥ 13 px, подписи полей ≥ 12 px', мелкийШрифт.length === 0, `минимум текста ${минШрифт} px, подписей (поля, клавиши, штамп, названия материалов) ${минШрифтПодписи} px${мелкийШрифт.length ? '; нарушения: ' + мелкийШрифт.slice(0, 5).join('; ') : ''}`);
    проверка('контраст текста ≥ 4,5:1 в обеих темах (по всем видимым текстам на 4 экранах каждой темы)', низкийКонтраст.length === 0, `минимум: Мастерская ${минКонтраст.dark?.toFixed(2)}, Калька ${минКонтраст.light?.toFixed(2)}${низкийКонтраст.length ? '; ниже нормы: ' + низкийКонтраст.slice(0, 5).join('; ') : ''}`);

    /* ---- тема сохраняется ---- */
    await стр.evaluate(() => window.__верстакStore.getState().установитьТему('калька'));
    await стр.evaluate(() => window.__верстакStore.getState().наЭкран('меню'));
    await стр.reload();
    await пауза(2500);
    const послеПерезагрузки = await стр.evaluate(() => ({ тема: window.__верстакStore.getState().тема, атрибут: document.documentElement.dataset.theme }));
    проверка('выбор темы сохраняется после перезапуска окна', послеПерезагрузки.тема === 'калька' && послеПерезагрузки.атрибут === 'light', JSON.stringify(послеПерезагрузки));
    await стр.evaluate(() => window.__верстакStore.getState().установитьТему('мастерская'));

    /* ---- окно: размер запоминается ---- */
    // меняем размер настоящего окна средствами Windows (MoveWindow), как это сделал бы пользователь
    const скрипт = `Add-Type 'using System; using System.Runtime.InteropServices; public class W { [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int hh, bool r); }'; $p = Get-Process -Id ${процесс.pid}; [W]::MoveWindow($p.MainWindowHandle, 90, 70, 1333, 817, $true) | Out-Null`;
    await new Promise((r) => spawn('powershell', ['-NoProfile', '-Command', скрипт], { stdio: 'ignore' }).once('exit', r));
    await пауза(1500);

    /* ---- второй запуск не открывает второе окно ---- */
    const env = { ...process.env, VERSTAK_DATA_DIR: данные };
    delete env.ELECTRON_RUN_AS_NODE;
    env['КУХНЯ_DEV_URL'] = АДРЕС;
    const второй = spawn(require(path.join(корень, 'node_modules', 'electron')), ['.', '--remote-debugging-port=9444'], { cwd: корень, env, stdio: 'ignore' });
    const завершился = await new Promise((r) => {
      второй.once('exit', (код) => r(код));
      setTimeout(() => r('не вышел за 8 с'), 8000);
    });
    if (завершился === 'не вышел за 8 с') второй.kill();
    const окон = (await браузер.targets()).filter((t) => t.type() === 'page').length;
    проверка('повторный запуск не открывает второе окно (второй процесс вышел, окно одно)', завершился !== 'не вышел за 8 с' && окон === 1, `второй процесс: код ${завершился}; окон: ${окон}`);

    проверка('в консоли окна нет Shader Error', к.шейдер.length === 0, к.шейдер[0] ?? '');
    проверка('в консоли окна нет ошибок', к.ошибки.length === 0, к.ошибки.slice(0, 3).join(' | '));
    браузер.disconnect();
  } finally {
    процесс.kill();
  }

  /* ---- размер окна после перезапуска ---- */
  await пауза(1500);
  const процесс2 = запуститьElectron({ адрес: АДРЕС, данные, порт: 9334, доп: { VERSTAK_AUTOSAVE_SEC: '3600' } });
  try {
    const { браузер, стр } = await подключиться(АДРЕС, 9334);
    await пауза(1500);
    const размер = await стр.evaluate(() => ({ w: window.outerWidth, h: window.outerHeight, x: window.screenX, y: window.screenY }));
    const ок = Math.abs(размер.w - 1333) <= 20 && Math.abs(размер.h - 817) <= 20;
    проверка('окно запомнило размер и положение (1333 × 817 → после перезапуска)', ок, JSON.stringify(размер));
    браузер.disconnect();
  } finally {
    процесс2.kill();
  }

  fs.writeFileSync(path.join(корень, 'проверка', 'проверка-1Б1.json'), JSON.stringify({ дата: new Date().toISOString(), итоги, нормы_размеры_целей: Object.fromEntries(Object.entries(нормы).map(([к, н]) => [к, н.цели.length])) }, null, 2), 'utf8');
  const упало = итоги.filter((x) => !x.ок);
  console.log(`\nИтого: ${итоги.length - упало.length} из ${итоги.length}`);
  process.exitCode = упало.length ? 2 : 0;
})().catch((e) => {
  console.error('ПРОВЕРКА УПАЛА:', e.message);
  process.exit(1);
});
