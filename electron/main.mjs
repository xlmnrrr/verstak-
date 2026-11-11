/**
 * «Верстак»: точка входа Electron (ESM — в Electron 45 модуль 'electron' доступен только через import).
 * Задача файла: окно приложения, портативная папка «Проекты\», атомарная запись, бэкапы, диалоги.
 */
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { очиститьИмя } from './имя-файла.mjs';

const DEV_URL = process.env.КУХНЯ_DEV_URL || '';
const сборка = !DEV_URL;
const здесь = import.meta.dirname; // папка electron/

/** Папка приложения: рядом с .exe (портативно). В разработке — корень проекта. */
function папкаПриложения() {
  // для проверок: VERSTAK_DATA_DIR подменяет папку, где лежат Проекты\ и Бэкапы\ (боевые данные не трогаем)
  if (process.env.VERSTAK_DATA_DIR) return process.env.VERSTAK_DATA_DIR;
  return app.isPackaged ? path.dirname(app.getPath('exe')) : path.join(здесь, '..');
}

function папкаПроектов() {
  const п = path.join(папкаПриложения(), 'Проекты');
  fs.mkdirSync(п, { recursive: true });
  return п;
}

function папкаБэкапов() {
  const п = path.join(папкаПриложения(), 'Бэкапы');
  fs.mkdirSync(п, { recursive: true });
  return п;
}

function папкаКорзины() {
  const п = path.join(папкаПроектов(), '.корзина');
  fs.mkdirSync(п, { recursive: true });
  return п;
}

function папкаАвто() {
  const п = path.join(папкаПроектов(), '.автосохранение');
  fs.mkdirSync(п, { recursive: true });
  return п;
}

/** Путь к файлу проекта внутри папки: имя без путей и «..», иначе ошибка */
function путьВнутри(папка, имя, расширение = '.kitchen') {
  const н = String(имя ?? '');
  if (!н || н !== path.basename(н) || н.includes('..')) throw new Error(`недопустимое имя проекта: «${н}»`);
  const полный = path.join(папка, н + расширение);
  if (!path.resolve(полный).startsWith(path.resolve(папка) + path.sep)) throw new Error('путь выходит за папку проектов');
  return полный;
}

const метка = () => new Date().toISOString().replace(/[:.]/g, '-');

/** Атомарная запись: пишем во временный файл, потом переименовываем */
function записатьАтомарно(путь, текст) {
  const врем = `${путь}.tmp`;
  fs.writeFileSync(врем, текст, 'utf8');
  fs.renameSync(врем, путь);
}

function создатьОкно() {
  const окно = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#14161a',
    title: 'Верстак',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(здесь, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (сборка) {
    окно.loadFile(path.join(здесь, '..', 'dist', 'index.html'));
  } else {
    окно.loadURL(DEV_URL);
  }
  return окно;
}

ipcMain.handle('проекты:список', async () => {
  const п = папкаПроектов();
  const файлы = fs.readdirSync(п).filter((ф) => ф.endsWith('.kitchen'));
  return файлы
    .map((ф) => {
      const полный = path.join(п, ф);
      const ст = fs.statSync(полный);
      let объектов = 0;
      try {
        объектов = (JSON.parse(fs.readFileSync(полный, 'utf8')).объекты ?? []).length;
      } catch {
        /* файл битый — покажем как есть */
      }
      const превьюФайл = path.join(п, ф.replace(/\.kitchen$/, '.jpg'));
      let превью;
      if (fs.existsSync(превьюФайл)) {
        превью = 'data:image/jpeg;base64,' + fs.readFileSync(превьюФайл).toString('base64');
      }
      return {
        имя: ф.replace(/\.kitchen$/, ''),
        изменён: ст.mtime.toISOString(),
        размер: ст.size,
        объектов,
        превью,
      };
    })
    .sort((a, b) => (a.изменён < b.изменён ? 1 : -1));
});

ipcMain.handle('проекты:сохранить', async (_e, имяСырое, текст, превью) => {
  try {
    const имя = очиститьИмя(имяСырое);
    const п = папкаПроектов();
    const файл = путьВнутри(п, имя);
    if (fs.existsSync(файл)) {
      const бэкапы = папкаБэкапов();
      // файл старого формата: до первой записи в v2 сохраняем исходник как есть
      let версия = null;
      try {
        версия = JSON.parse(fs.readFileSync(файл, 'utf8')).schemaVersion;
      } catch {
        /* битый файл — просто копия ниже */
      }
      if (версия === 1) {
        const цель = path.join(бэкапы, `${имя}.v1.kitchen`);
        fs.copyFileSync(файл, fs.existsSync(цель) ? path.join(бэкапы, `${имя}.v1.${метка()}.kitchen`) : цель);
      }
      fs.copyFileSync(файл, path.join(бэкапы, `${имя}.${метка()}.kitchen`));
      const все = fs
        .readdirSync(бэкапы)
        .filter((ф) => ф.startsWith(имя + '.') && !ф.includes('.v1.'))
        .sort();
      while (все.length > 20) fs.unlinkSync(path.join(бэкапы, все.shift()));
    }
    записатьАтомарно(файл, текст);
    if (превью && превью.startsWith('data:image')) {
      const б = превью.split(',')[1];
      fs.writeFileSync(path.join(п, `${имя}.jpg`), Buffer.from(б, 'base64'));
    }
    return { ок: true, путь: файл, имя };
  } catch (e) {
    return { ок: false, ошибка: e.message };
  }
});

ipcMain.handle('проекты:открыть', async (_e, имя) => {
  try {
    const файл = путьВнутри(папкаПроектов(), имя);
    return { ок: true, текст: fs.readFileSync(файл, 'utf8') };
  } catch (e) {
    return { ок: false, ошибка: e.message };
  }
});

/** Удаление = перенос в Проекты\.корзина с отметкой времени; проект можно вернуть руками */
ipcMain.handle('проекты:удалить', async (_e, имя) => {
  try {
    const п = папкаПроектов();
    const корзина = папкаКорзины();
    const м = метка();
    for (const расш of ['.kitchen', '.jpg']) {
      const полный = путьВнутри(п, имя, расш);
      if (fs.existsSync(полный)) fs.renameSync(полный, path.join(корзина, `${имя}.${м}${расш}`));
    }
    // автосохранение удалённого проекта тоже не нужно
    const авто = путьВнутри(папкаАвто(), имя);
    if (fs.existsSync(авто)) fs.unlinkSync(авто);
    return { ок: true };
  } catch (e) {
    return { ок: false, ошибка: e.message };
  }
});

ipcMain.handle('проекты:папка', async () => {
  await shell.openPath(папкаПроектов());
});

ipcMain.handle('проекты:выбрать-файл', async () => {
  const р = await dialog.showOpenDialog({
    title: 'Открыть проект .kitchen',
    filters: [{ name: 'Проект Верстака', extensions: ['kitchen', 'json'] }],
    properties: ['openFile'],
  });
  if (р.canceled || !р.filePaths[0]) return { ок: false, ошибка: 'файл не выбран' };
  try {
    return {
      ок: true,
      текст: fs.readFileSync(р.filePaths[0], 'utf8'),
      имя: path.basename(р.filePaths[0]),
    };
  } catch (e) {
    return { ок: false, ошибка: e.message };
  }
});

ipcMain.handle('проекты:сохранить-в-файл', async (_e, имя, текст) => {
  const р = await dialog.showSaveDialog({
    title: 'Сохранить проект',
    defaultPath: имя,
    filters: [{ name: 'Проект Верстака', extensions: ['kitchen'] }],
  });
  if (р.canceled || !р.filePath) return { ок: false, ошибка: 'отменено' };
  try {
    fs.writeFileSync(р.filePath, текст, 'utf8');
    return { ок: true, путь: р.filePath };
  } catch (e) {
    return { ок: false, ошибка: e.message };
  }
});

/* ------------------------------------------------------------------ автосохранение */
ipcMain.handle('авто:записать', async (_e, имя, текст) => {
  try {
    записатьАтомарно(путьВнутри(папкаАвто(), очиститьИмя(имя)), текст);
    return { ок: true };
  } catch (e) {
    return { ок: false, ошибка: e.message };
  }
});

ipcMain.handle('авто:найти', async () => {
  try {
    const п = папкаПроектов();
    return fs
      .readdirSync(папкаАвто())
      .filter((ф) => ф.endsWith('.kitchen'))
      .map((ф) => {
        const имя = ф.replace(/\.kitchen$/, '');
        const ст = fs.statSync(path.join(папкаАвто(), ф));
        const основной = path.join(п, ф);
        const новее = !fs.existsSync(основной) || ст.mtimeMs > fs.statSync(основной).mtimeMs + 1000;
        return { имя, изменён: ст.mtime.toISOString(), новее };
      })
      .filter((x) => x.новее)
      .sort((a, b) => (a.изменён < b.изменён ? 1 : -1));
  } catch {
    return [];
  }
});

ipcMain.handle('авто:прочитать', async (_e, имя) => {
  try {
    return { ок: true, текст: fs.readFileSync(путьВнутри(папкаАвто(), имя), 'utf8') };
  } catch (e) {
    return { ок: false, ошибка: e.message };
  }
});

ipcMain.handle('авто:удалить', async (_e, имя) => {
  try {
    const файл = путьВнутри(папкаАвто(), имя);
    if (fs.existsSync(файл)) fs.unlinkSync(файл);
    return { ок: true };
  } catch {
    return { ок: false };
  }
});

/** Интервал автосохранения, секунды: 60; для проверки можно задать VERSTAK_AUTOSAVE_SEC */
ipcMain.handle('авто:интервал', async () => {
  const н = Number(process.env.VERSTAK_AUTOSAVE_SEC);
  return Number.isFinite(н) && н >= 1 ? н : 60;
});

ipcMain.handle('пути:проекты', async () => папкаПроектов());

app.whenReady().then(() => {
  создатьОкно();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) создатьОкно();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
