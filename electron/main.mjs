/**
 * Точка входа Electron (ESM — в Electron 45 модуль 'electron' доступен только через import).
 * Задача файла: окно приложения, портативная папка «Проекты\», атомарная запись, бэкапы, диалоги.
 */
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const DEV_URL = process.env.КУХНЯ_DEV_URL || '';
const сборка = !DEV_URL;
const здесь = import.meta.dirname; // папка electron/

/** Папка приложения: рядом с .exe (портативно). В разработке — корень проекта. */
function папкаПриложения() {
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
    title: 'Кухня 3D',
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

ipcMain.handle('проекты:сохранить', async (_e, имя, текст, превью) => {
  try {
    const п = папкаПроектов();
    const файл = path.join(п, `${имя}.kitchen`);
    if (fs.existsSync(файл)) {
      const бэкапы = папкаБэкапов();
      const метка = new Date().toISOString().replace(/[:.]/g, '-');
      fs.copyFileSync(файл, path.join(бэкапы, `${имя}.${метка}.kitchen`));
      const все = fs
        .readdirSync(бэкапы)
        .filter((ф) => ф.startsWith(имя + '.'))
        .sort();
      while (все.length > 20) fs.unlinkSync(path.join(бэкапы, все.shift()));
    }
    записатьАтомарно(файл, текст);
    if (превью && превью.startsWith('data:image')) {
      const б = превью.split(',')[1];
      fs.writeFileSync(path.join(п, `${имя}.jpg`), Buffer.from(б, 'base64'));
    }
    return { ок: true, путь: файл };
  } catch (e) {
    return { ок: false, ошибка: e.message };
  }
});

ipcMain.handle('проекты:открыть', async (_e, имя) => {
  try {
    const файл = path.join(папкаПроектов(), `${имя}.kitchen`);
    return { ок: true, текст: fs.readFileSync(файл, 'utf8') };
  } catch (e) {
    return { ок: false, ошибка: e.message };
  }
});

ipcMain.handle('проекты:удалить', async (_e, имя) => {
  try {
    const п = папкаПроектов();
    for (const ф of [`${имя}.kitchen`, `${имя}.jpg`]) {
      const полный = path.join(п, ф);
      if (fs.existsSync(полный)) fs.unlinkSync(полный);
    }
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
    filters: [{ name: 'Проект Кухня 3D', extensions: ['kitchen', 'json'] }],
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
    filters: [{ name: 'Проект Кухня 3D', extensions: ['kitchen'] }],
  });
  if (р.canceled || !р.filePath) return { ок: false, ошибка: 'отменено' };
  try {
    fs.writeFileSync(р.filePath, текст, 'utf8');
    return { ок: true, путь: р.filePath };
  } catch (e) {
    return { ок: false, ошибка: e.message };
  }
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
