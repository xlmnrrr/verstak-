import { useEffect, useState } from 'react';
import { useКухня } from '../store';
import { пустая_комната, type Room } from '../types';
import { ОБОИ, ПОЛЫ } from '../data/materials';
import { собратьДемо } from '../lib/демо';
import * as хранилище from '../lib/storage';
import type { ЗаписьСписка } from '../lib/storage';

export function ГлавноеМеню() {
  const наЭкран = useКухня((s) => s.наЭкран);
  const открытьФайл = useКухня((s) => s.открытьФайл);
  const загрузить = useКухня((s) => s.загрузить);

  return (
    <div className="экран-центр">
      <div className="логотип">
        <h1>
          Кухня<span>3D</span>
        </h1>
        <p>Собери кухню в объёме: комната, модули, материалы — и всё в миллиметрах</p>
      </div>

      <div className="карточки">
        <div className="карточка" onClick={() => наЭкран('комната')}>
          <div className="значок">📐</div>
          <h2>Проект</h2>
          <p>Создать новый: задать длину, ширину и высоту стен — и собирать кухню с нуля.</p>
        </div>
        <div className="карточка" onClick={() => наЭкран('проекты')}>
          <div className="значок">🗂️</div>
          <h2>Проекты</h2>
          <p>Уже сохранённые: открыть, продолжить, удалить или показать папку с файлами.</p>
        </div>
        <div className="карточка" onClick={() => void открытьФайл()}>
          <div className="значок">📥</div>
          <h2>Открыть файл</h2>
          <p>Взять проект из файла .kitchen — в том числе присланный другим человеком или Claude.</p>
        </div>
        <div className="карточка" onClick={() => загрузить(собратьДемо())}>
          <div className="значок">✨</div>
          <h2>Пример кухни</h2>
          <p>Готовая кухня: нижний ряд, столешница, навесные шкафы, техника, стол со стульями, окно.</p>
        </div>
      </div>

      <p style={{ color: 'var(--текст2)', fontSize: 13 }}>
        Чертежи-образцы: 14 шаблонов модулей KB281 и KB160 уже в каталоге
      </p>
    </div>
  );
}

export function ЭкранПроектов() {
  const наЭкран = useКухня((s) => s.наЭкран);
  const открыть = useКухня((s) => s.открыть);
  const удалить = useКухня((s) => s.удалить);
  const показатьПапку = useКухня((s) => s.показатьПапку);
  const открытьФайл = useКухня((s) => s.открытьФайл);
  const сообщить = useКухня((s) => s.сообщить);
  const [список, установитьСписок] = useState<ЗаписьСписка[]>([]);
  const [загрузка, установитьЗагрузку] = useState(true);

  const обновить = async () => {
    установитьЗагрузку(true);
    try {
      установитьСписок(await хранилище.списокПроектов());
    } finally {
      установитьЗагрузку(false);
    }
  };

  useEffect(() => {
    void обновить();
  }, []);

  return (
    <div className="экран-центр" style={{ justifyContent: 'flex-start', paddingTop: 34 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: 'min(880px, 92vw)' }}>
        <h2 style={{ margin: 0, marginRight: 'auto' }}>Проекты</h2>
        <button onClick={() => void открытьФайл()}>Открыть из файла</button>
        <button onClick={() => void показатьПапку()}>Показать папку</button>
        <button className="тихая" onClick={() => наЭкран('меню')}>
          В меню
        </button>
      </div>

      {загрузка && <p style={{ color: 'var(--текст2)' }}>Читаю папку проектов…</p>}

      {!загрузка && список.length === 0 && (
        <p style={{ color: 'var(--текст2)' }}>
          Пока пусто. Нажми «Проект» в меню и собери первую кухню.
        </p>
      )}

      <div className="список-проектов">
        {список.map((п) => (
          <div className="проект-карточка" key={п.имя}>
            <div
              className="превью"
              style={п.превью ? { backgroundImage: `url(${п.превью})` } : undefined}
            >
              {!п.превью && '🏠'}
            </div>
            <div className="тело">
              <div className="имя">{п.имя}</div>
              <div className="мета">
                {new Date(п.изменён).toLocaleString('ru-RU')} · модулей: {п.объектов ?? 0}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="главная" style={{ flex: 1, padding: '6px 10px' }} onClick={() => void открыть(п.имя)}>
                  Открыть
                </button>
                <button
                  className="опасная"
                  onClick={async () => {
                    if (!confirm(`Удалить проект «${п.имя}»?`)) return;
                    await удалить(п.имя);
                    await обновить();
                  }}
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="тихая" onClick={() => void обновить()}>
        Обновить список
      </button>
    </div>
  );
}

const ПРЕСЕТЫ: { название: string; комната: Room }[] = [
  { название: 'Кухня 3,6 × 2,8', комната: пустая_комната(3600, 2800, 2700) },
  { название: 'Кухня-гостиная 5,0 × 4,0', комната: пустая_комната(5000, 4000, 2700) },
  { название: 'Малая 2,4 × 2,2', комната: пустая_комната(2400, 2200, 2600) },
  { название: 'Высокие стены 3,0 м', комната: пустая_комната(3600, 2800, 3000) },
];

export function ЭкранКомнаты() {
  const создать = useКухня((s) => s.создать);
  const наЭкран = useКухня((s) => s.наЭкран);
  const [название, установитьНазвание] = useState('Моя кухня');
  const [комната, установитьКомнату] = useState<Room>(пустая_комната());

  const поле = (подпись: string, ключ: keyof Room, мин: number, макс: number) => (
    <div className="поле">
      <label>{подпись}, мм</label>
      <input
        type="number"
        min={мин}
        max={макс}
        value={комната[ключ] as number}
        onChange={(e) =>
          установитьКомнату({
            ...комната,
            [ключ]: Math.max(мин, Math.min(макс, Number(e.target.value) || мин)),
          })
        }
      />
    </div>
  );

  return (
    <div className="экран-центр">
      <div className="форма">
        <h2>Новый проект</h2>
        <div className="подзаголовок">
          Потолка нет — задаётся только высота стен. Всё потом можно поменять в редакторе.
        </div>

        <div className="поле">
          <label>Название проекта</label>
          <input value={название} onChange={(e) => установитьНазвание(e.target.value)} />
        </div>

        <div className="быстрые">
          {ПРЕСЕТЫ.map((п) => (
            <button key={п.название} onClick={() => установитьКомнату({ ...п.комната })}>
              {п.название}
            </button>
          ))}
        </div>

        <div className="ряд">
          {поле('Длина комнаты (X)', 'длина', 500, 20000)}
          {поле('Ширина комнаты (Z)', 'ширина', 500, 20000)}
        </div>
        <div className="ряд">
          {поле('Высота стен (Y)', 'высота_стен', 1000, 6000)}
          {поле('Толщина стен', 'толщина_стен', 0, 600)}
        </div>

        <div className="поле">
          <label>Форма комнаты</label>
          <select
            value={комната.форма}
            onChange={(e) => установитьКомнату({ ...комната, форма: e.target.value as Room['форма'] })}
          >
            <option value="прямоугольник">Прямоугольник</option>
            <option value="Г">Г-образная (в разработке)</option>
            <option value="П">П-образная (в разработке)</option>
          </select>
        </div>

        <div className="поле">
          <label>Обои</label>
          <div className="палитра">
            {ОБОИ.map((о) => (
              <button
                key={о.id}
                title={о.название}
                className={`цвет ${комната.обои === о.цвет ? 'активна' : ''}`}
                style={{ background: о.цвет }}
                onClick={() => установитьКомнату({ ...комната, обои: о.цвет })}
              />
            ))}
          </div>
        </div>

        <div className="поле">
          <label>Пол</label>
          <div className="палитра">
            {ПОЛЫ.map((о) => (
              <button
                key={о.id}
                title={о.название}
                className={`цвет ${комната.пол === о.цвет ? 'активна' : ''}`}
                style={{ background: о.цвет }}
                onClick={() => установитьКомнату({ ...комната, пол: о.цвет })}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="главная" style={{ flex: 1 }} onClick={() => создать(название.trim() || 'Моя кухня', комната)}>
            Создать и открыть
          </button>
          <button onClick={() => наЭкран('меню')}>Назад</button>
        </div>
      </div>
    </div>
  );
}
