const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('кухня', {
  список: () => ipcRenderer.invoke('проекты:список'),
  сохранить: (имя, текст, превью) => ipcRenderer.invoke('проекты:сохранить', имя, текст, превью),
  открыть: (имя) => ipcRenderer.invoke('проекты:открыть', имя),
  удалить: (имя) => ipcRenderer.invoke('проекты:удалить', имя),
  открытьПапку: () => ipcRenderer.invoke('проекты:папка'),
  выбратьФайл: () => ipcRenderer.invoke('проекты:выбрать-файл'),
  сохранитьВФайл: (имя, текст) => ipcRenderer.invoke('проекты:сохранить-в-файл', имя, текст),
  путьПроектов: () => ipcRenderer.invoke('пути:проекты'),
  авто: {
    записать: (имя, текст) => ipcRenderer.invoke('авто:записать', имя, текст),
    найти: () => ipcRenderer.invoke('авто:найти'),
    прочитать: (имя) => ipcRenderer.invoke('авто:прочитать', имя),
    удалить: (имя) => ipcRenderer.invoke('авто:удалить', имя),
    интервал: () => ipcRenderer.invoke('авто:интервал'),
  },
});
