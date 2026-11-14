/**
 * Обложка (DESIGN.md §7): вся площадь — живая 3D-сцена (пример), слева колонка с названием и четырьмя действиями,
 * снизу полоса последних проектов — листы со штампом. Четыре состояния списка: загрузка, пусто, ошибка, готово.
 */
import { useEffect, useState } from 'react';
import { Холст } from '../render/холст';
import { useКухня, type ТемаИнтерфейса } from '../store';
import { useUI } from '../store/интерфейс';
import { собратьДемо } from '../lib/демо';
import * as хранилище from '../lib/storage';
import type { ЗаписьСписка } from '../lib/storage';
import { Иконка } from './design/Иконки';
import { Знак } from './design/Логотип';
import { КартинкаЛиста } from './ЛистПроекта';

const Линейка = () => {
  const засечки = [];
  for (let x = 0; x <= 260; x += 10) {
    const длинная = x % 50 === 0;
    засечки.push(<line key={x} x1={x + 0.5} y1={14} x2={x + 0.5} y2={длинная ? 3 : 9} />);
  }
  return (
    <svg className="линейка" viewBox="0 0 260 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2">
      <line x1="0" y1="14" x2="260" y2="14" />
      {засечки}
    </svg>
  );
};

export const ТЕМЫ: { ид: ТемаИнтерфейса; имя: string }[] = [
  { ид: 'мастерская', имя: 'Мастерская' },
  { ид: 'калька', имя: 'Калька' },
  { ид: 'система', имя: 'Как в Windows' },
];

export function ПереключательТемы() {
  const тема = useКухня((s) => s.тема);
  const установить = useКухня((s) => s.установитьТему);
  return (
    <div className="сегменты" role="group" aria-label="Тема оформления">
      {ТЕМЫ.map((т) => (
        <button key={т.ид} type="button" aria-pressed={тема === т.ид} onClick={() => установить(т.ид)}>
          {т.имя}
        </button>
      ))}
    </div>
  );
}

function Лист({ п, открыть }: { п: ЗаписьСписка; открыть: () => void }) {
  const дата = new Date(п.изменён).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
  return (
    <button className="лист" type="button" onClick={открыть} title={`Открыть «${п.имя}»`}>
      <span className="лист-рамка" />
      <КартинкаЛиста className="лист-картинка" превью={п.превью} схема={п.схема} />
      <span className="штамп">
        <span className="заг">{п.имя}</span>
        <span>Дата</span>
        <span>{дата}</span>
        <span>Изделий</span>
        <span>{п.объектов ?? 0}</span>
      </span>
    </button>
  );
}

export function Обложка() {
  const наЭкран = useКухня((s) => s.наЭкран);
  const открытьФайл = useКухня((s) => s.открытьФайл);
  const загрузитьV1 = useКухня((s) => s.загрузитьV1);
  const открыть = useКухня((s) => s.открыть);
  const [список, установитьСписок] = useState<ЗаписьСписка[]>([]);
  const [состояние, установитьСостояние] = useState<'загрузка' | 'готово' | 'ошибка'>('загрузка');

  const прочитать = async () => {
    установитьСостояние('загрузка');
    try {
      const л = await хранилище.списокПроектов();
      установитьСписок(л.slice(0, 4));
      установитьСостояние('готово');
    } catch {
      установитьСостояние('ошибка');
    }
  };
  useEffect(() => {
    void прочитать();
  }, []);

  return (
    <div className="обложка">
      <div className="обложка-сцена">
        <Холст режим="обложка" />
      </div>
      <div className="обложка-подпись">
        <i />
        Живая сцена: пример кухни
      </div>

      <div className="обложка-лево">
        <div className="обложка-слово">
          <Знак размер={48} />
          <h1 className="знак-слово">Верстак</h1>
        </div>
        <Линейка />
        <p className="девиз">Мебель по размерам помещения: замер, сборка в 3D, чертёж для цеха.</p>
        <div className="действия">
          <button className="действие главное" type="button" onClick={() => наЭкран('комната')}>
            <Иконка имя="новый" />
            <b>Новый проект</b>
            <span className="кл">N</span>
          </button>
          <button className="действие" type="button" onClick={() => наЭкран('проекты')}>
            <Иконка имя="папка" />
            <b>Мои проекты</b>
            <span className="кл">Ctrl+O</span>
          </button>
          <button className="действие" type="button" onClick={() => void открытьФайл()}>
            <Иконка имя="файл" />
            <b>Открыть файл</b>
            <span className="кл">Ctrl+Shift+O</span>
          </button>
          <button className="действие" type="button" onClick={() => загрузитьV1(собратьДемо())}>
            <Иконка имя="пример" />
            <b>Пример кухни</b>
            <span />
          </button>
          <button className="действие" type="button" onClick={() => useUI.getState().открытьОкно('идеи')}>
            <Иконка имя="звезда" />
            <b>Идеи от Claude</b>
            <span />
          </button>
        </div>
        <div className="обложка-низ-лево">
          <div className="ряд-кнопок">
            <button className="кн" type="button" onClick={() => useUI.getState().открытьОкно('настройки')}>
              <Иконка имя="настройки" размер={18} />
              Настройки
            </button>
            <button className="кн" type="button" onClick={() => useUI.getState().открытьОкно('справка')}>
              <Иконка имя="справка" размер={18} />
              Справка
            </button>
          </div>
          <ПереключательТемы />
          <small>Версия 0.1 · всё работает без интернета</small>
        </div>
      </div>

      <div className="последние" style={{ position: 'relative' }}>
        {состояние === 'загрузка' && <div className="полоса-загрузки" role="progressbar" aria-label="Читаю папку проектов" />}
        <h2>Последние проекты</h2>
        {состояние === 'ошибка' && (
          <div className="блок-ошибка">
            <span>
              <b>Не удалось прочитать папку проектов.</b> Проверьте, что папка «Проекты» рядом с программой доступна для записи.
            </span>
            <button className="кн" type="button" onClick={() => void прочитать()}>
              Что делать: повторить
            </button>
          </div>
        )}
        {состояние === 'готово' && список.length === 0 && (
          <div className="пусто">
            <svg viewBox="0 0 72 56" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M6 10h60v40H6zM6 22h60M24 10v40" />
              <path d="M10 6h52M10 3v6M62 3v6" />
            </svg>
            <div>
              <b>Здесь будут проекты</b>
              <span>Начните с замера помещения: задайте размеры комнаты и собирайте мебель.</span>
            </div>
            <button className="кн главная" type="button" onClick={() => наЭкран('комната')}>
              <Иконка имя="новый" />
              Новый проект
            </button>
          </div>
        )}
        {(состояние === 'готово' && список.length > 0) || состояние === 'загрузка' ? (
          <div className="листы">
            {список.map((п) => (
              <Лист key={п.имя} п={п} открыть={() => void открыть(п.имя)} />
            ))}
            {состояние === 'готово' && (
              <button className="все-проекты" type="button" onClick={() => наЭкран('проекты')}>
                <Иконка имя="папка" />
                Все проекты
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
