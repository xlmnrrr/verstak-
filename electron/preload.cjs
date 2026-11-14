const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('кухня', {
  // автотесты (своя папка данных или отладочный порт): вступление не показывается
  тест: !!(process.env.VERSTAK_DATA_DIR || (process.argv || []).some((а) => String(а).startsWith('--remote-debugging-port'))),
  список: () => ipcRenderer.invoke('проекты:список'),
  сохранить: (имя, текст, превью) => ipcRenderer.invoke('проекты:сохранить', имя, текст, превью),
  открыть: (имя) => ipcRenderer.invoke('проекты:открыть', имя),
  удалить: (имя) => ipcRenderer.invoke('проекты:удалить', имя),
  открытьПапку: () => ipcRenderer.invoke('проекты:папка'),
  выбратьФайл: () => ipcRenderer.invoke('проекты:выбрать-файл'),
  сохранитьВФайл: (имя, текст) => ipcRenderer.invoke('проекты:сохранить-в-файл', имя, текст),
  превью: (имя, картинка) => ipcRenderer.invoke('проекты:превью', имя, картинка),
  автозапуск: (вкл) => ipcRenderer.invoke('система:автозапуск', вкл),
  экспорт: {
    сохранить: (имя, base64, расширение, фильтр) => ipcRenderer.invoke('экспорт:сохранить', имя, base64, расширение, фильтр),
    pdf: (html, имя) => ipcRenderer.invoke('экспорт:pdf', html, имя),
  },
  путьПроектов: () => ipcRenderer.invoke('пути:проекты'),
  авто: {
    записать: (имя, текст) => ipcRenderer.invoke('авто:записать', имя, текст),
    найти: () => ipcRenderer.invoke('авто:найти'),
    прочитать: (имя) => ipcRenderer.invoke('авто:прочитать', имя),
    удалить: (имя) => ipcRenderer.invoke('авто:удалить', имя),
    интервал: () => ipcRenderer.invoke('авто:интервал'),
  },
});
