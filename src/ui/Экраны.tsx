/**
 * Экраны 1Б-2: список проектов, первый запуск с туром, окна «Проверки», «Настройки», «Справка», «Экспорт».
 * У каждого экрана четыре состояния: пусто, загрузка, ошибка, готово.
 */
import { useEffect, useMemo, useState } from 'react';
import { useКухня } from '../store';
import { useUI, type Окно } from '../store/интерфейс';
import * as хранилище from '../lib/storage';
import type { ЗаписьСписка } from '../lib/storage';
import { НАЗВАНИЯ_ПРАВИЛ, проверитьПроект, сводка, type Важность } from '../model/валидатор';
import { изменитьНастройки } from '../store/команды';
import { выгрузитьВ, type ФорматВыгрузки } from '../export/запуск';
import { изделиеПоИд } from '../model/каталог';
import { Иконка, type ИмяИконки } from './design/Иконки';
import { ПереключательТемы } from './Обложка';

/* ------------------------------------------------------------------ список проектов */

type Сортировка = 'дата' | 'имя' | 'объектов';

export function ЭкранПроектов() {
  const наЭкран = useКухня((s) => s.наЭкран);
  const открыть = useКухня((s) => s.открыть);
  const удалить = useКухня((s) => s.удалить);
  const показатьПапку = useКухня((s) => s.показатьПапку);
  const открытьФайл = useКухня((s) => s.открытьФайл);
  const [список, установитьСписок] = useState<ЗаписьСписка[]>([]);
  const [состояние, установитьСостояние] = useState<'загрузка' | 'готово' | 'ошибка'>('загрузка');
  const [поиск, установитьПоиск] = useState('');
  const [сортировка, установитьСортировку] = useState<Сортировка>('дата');
  const [удаляемый, установитьУдаляемый] = useState<string | null>(null);

  const обновить = async () => {
    установитьСостояние('загрузка');
    try {
      установитьСписок(await хранилище.списокПроектов());
      установитьСостояние('готово');
    } catch {
      установитьСостояние('ошибка');
    }
  };
  useEffect(() => {
    void обновить();
  }, []);

  const видимые = useMemo(() => {
    const с = поиск.trim().toLowerCase();
    const л = список.filter((п) => !с || п.имя.toLowerCase().includes(с));
    return [...л].sort((a, b) => (сортировка === 'имя' ? a.имя.localeCompare(b.имя, 'ru') : сортировка === 'объектов' ? (b.объектов ?? 0) - (a.объектов ?? 0) : a.изменён < b.изменён ? 1 : -1));
  }, [список, поиск, сортировка]);

  return (
    <div className="экран-прокрутка" style={{ position: 'relative' }}>
      {состояние === 'загрузка' && <div className="полоса-загрузки" role="progressbar" aria-label="Читаю папку проектов" />}
      <div className="проекты">
        <div className="мастер-шапка">
          <h2>Проекты</h2>
          <div className="справа-шапки">
            <button className="кн" type="button" onClick={() => void открытьФайл()}>
              <Иконка имя="файл" размер={18} />
              Открыть файл
            </button>
            <button className="кн" type="button" onClick={() => void показатьПапку()}>
              <Иконка имя="папка" размер={18} />
              Показать папку
            </button>
            <button className="кн тихая" type="button" onClick={() => наЭкран('меню')}>
              На обложку
            </button>
          </div>
        </div>
        <div className="панель-поиска">
          <div className="каталог-поиск" style={{ padding: 0, flex: 1 }}>
            <Иконка имя="поиск" />
            <input placeholder="Поиск по названию" value={поиск} onChange={(e) => установитьПоиск(e.target.value)} aria-label="Поиск проекта" />
          </div>
          <div className="сегменты" role="group" aria-label="Сортировка">
            {(
              [
                ['дата', 'По дате'],
                ['имя', 'По имени'],
                ['объектов', 'По числу изделий'],
              ] as const
            ).map(([ид, имя]) => (
              <button key={ид} type="button" aria-pressed={сортировка === ид} onClick={() => установитьСортировку(ид)}>
                {имя}
              </button>
            ))}
          </div>
        </div>

        {состояние === 'ошибка' && (
          <div className="блок-ошибка" role="alert">
            <span>
              <b>Не удалось прочитать папку проектов.</b> Проверьте, что папка «Проекты» доступна для записи.
            </span>
            <button className="кн" type="button" onClick={() => void обновить()}>
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
              <span>Начните с замера помещения: размеры, контур или квартира по сетке.</span>
            </div>
            <button className="кн главная" type="button" onClick={() => наЭкран('комната')}>
              <Иконка имя="новый" />
              Новый проект
            </button>
          </div>
        )}
        {состояние === 'готово' && список.length > 0 && видимые.length === 0 && <p className="пусто-панель">По запросу «{поиск}» проектов нет.</p>}

        <div className="список-проектов">
          {видимые.map((п) => (
            <div className="проект-карточка" key={п.имя}>
              <div className="превью" style={п.превью ? { backgroundImage: `url(${п.превью})` } : undefined}>
                {!п.превью && <Иконка имя="помещение" размер={40} />}
              </div>
              <div className="тело">
                <div className="имя" title={п.имя}>
                  {п.имя}
                </div>
                <div className="мета">
                  {new Date(п.изменён).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })} · изделий: {п.объектов ?? 0}
                </div>
                <div className="ряд-кнопок">
                  <button className="кн главная" type="button" onClick={() => void открыть(п.имя)}>
                    Открыть
                  </button>
                  <button className="кн опасная" type="button" onClick={() => установитьУдаляемый(п.имя)}>
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {удаляемый && (
        <Подтверждение
          заголовок={`Удалить проект «${удаляемый}»?`}
          текст="Проект уйдёт в корзину внутри папки «Проекты» — его можно вернуть руками."
          кнопка="Удалить"
          опасно
          да={async () => {
            await удалить(удаляемый);
            установитьУдаляемый(null);
            await обновить();
          }}
          нет={() => установитьУдаляемый(null)}
        />
      )}
    </div>
  );
}

export function Подтверждение({ заголовок, текст, кнопка, опасно, да, нет }: { заголовок: string; текст: string; кнопка: string; опасно?: boolean; да: () => void; нет: () => void }) {
  useEffect(() => {
    const к = (e: KeyboardEvent) => e.key === 'Escape' && нет();
    window.addEventListener('keydown', к);
    return () => window.removeEventListener('keydown', к);
  }, [нет]);
  return (
    <div className="затемнение" role="alertdialog" aria-label={заголовок}>
      <div className="модал">
        <h3>{заголовок}</h3>
        <p>{текст}</p>
        <div className="ряд-кнопок">
          <button className={`кн ${опасно ? 'опасная' : 'главная'}`} type="button" autoFocus onClick={да}>
            {кнопка}
          </button>
          <button className="кн" type="button" onClick={нет}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ первый запуск и тур */

const ШАГИ_ТУРА = [
  { икон: 'помещение' as const, заг: 'Начните с замера', текст: 'Задайте размеры комнаты цифрами, нарисуйте контур Г или П или закрасьте квартиру по сетке.' },
  { икон: 'каталог' as const, заг: 'Ставьте мебель', текст: 'Клавиша P открывает каталог. Нажмите на изделие — оно встанет у стены. Размер меняется цифрой в свойствах.' },
  { икон: 'проверки' as const, заг: 'Следите за размерами', текст: 'Красный контур с цифрой показывает, на сколько изделие не влезает. Всё считается в миллиметрах, Ctrl+Z отменяет любое действие.' },
];

export function ПервыйЗапуск({ закрыть, толькоТур = false }: { закрыть: () => void; толькоТур?: boolean }) {
  const [шаг, установитьШаг] = useState(толькоТур ? 1 : 0);
  const последний = шаг === ШАГИ_ТУРА.length;
  const завершить = () => {
    useUI.getState().установить({ туркПройден: true });
    закрыть();
  };
  useEffect(() => {
    const к = (e: KeyboardEvent) => e.key === 'Escape' && завершить();
    window.addEventListener('keydown', к);
    return () => window.removeEventListener('keydown', к);
  });
  return (
    <div className="затемнение" role="dialog" aria-label="Первый запуск">
      <div className="модал широкий">
        {шаг === 0 ? (
          <>
            <h3>Добро пожаловать в «Верстак»</h3>
            <p>Выберите оформление. Его можно сменить в любой момент в настройках.</p>
            <ПереключательТемы />
          </>
        ) : (
          <>
            <div className="тур-значок">
              <Иконка имя={ШАГИ_ТУРА[Math.min(шаг, ШАГИ_ТУРА.length) - 1].икон} размер={32} />
            </div>
            <h3>{ШАГИ_ТУРА[Math.min(шаг, ШАГИ_ТУРА.length) - 1].заг}</h3>
            <p>{ШАГИ_ТУРА[Math.min(шаг, ШАГИ_ТУРА.length) - 1].текст}</p>
          </>
        )}
        <div className="ряд-кнопок">
          <button className="кн главная" type="button" autoFocus onClick={() => (шаг >= ШАГИ_ТУРА.length ? завершить() : установитьШаг(шаг + 1))}>
            {шаг === 0 ? 'Дальше' : последний || шаг === ШАГИ_ТУРА.length ? 'Начать работу' : 'Дальше'}
          </button>
          <button className="кн тихая" type="button" onClick={завершить}>
            Пропустить
          </button>
        </div>
        <div className="точки" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className={i === шаг ? 'акт' : ''} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ окна: проверки, настройки, справка, экспорт */

/** Акценты интерфейса: [тёмная тема, светлая тема, текст на акценте в тёмной, в светлой]; контраст проверен ≥ 5:1 */
export const АКЦЕНТЫ: Record<string, [string, string, string, string]> = {
  латунь: ['#d9ad5f', '#704d0e', '#1e1408', '#ffffff'],
  медь: ['#e8967a', '#8a3a1b', '#1e1408', '#ffffff'],
  бирюза: ['#5fc4b8', '#0f5f57', '#08201e', '#ffffff'],
  лайм: ['#a8cf5f', '#3f5e0e', '#141c05', '#ffffff'],
  сирень: ['#b79ceb', '#5a3a9e', '#160d2a', '#ffffff'],
};

const КЛАВИШИ: [string, string][] = [
  ['P', 'каталог изделий'],
  ['G · T · R', 'двигать · растянуть · крутить'],
  ['V', 'вид «Сверху» / «Прогулка»'],
  ['W A S D, Q E', 'лететь по комнате в «Прогулке»'],
  ['Home', 'показать комнату целиком'],
  ['Ctrl+Z · Ctrl+Y', 'отменить · вернуть'],
  ['Ctrl+D', 'дублировать выбранное'],
  ['Delete', 'удалить выбранное'],
  ['Ctrl+S', 'сохранить'],
  ['Esc', 'закрыть каталог, затем снять выделение'],
  ['Tab · Enter', 'работа с клавиатуры без мыши'],
];

const ФОНЫ = [
  ['Как в теме', '#171a1f'],
  ['Ночь', '#0c0e12'],
  ['Мастерская', '#22262e'],
  ['Бумага', '#d9d5cc'],
  ['Небо', '#2b3a4a'],
  ['Хаки', '#2e3229'],
  ['Бордо', '#2c1f22'],
  ['Белый', '#f2f0ec'],
];

const ЗНАЧОК_ВАЖНОСТИ: Record<Важность, ИмяИконки> = { ошибка: 'предупреждение', предупреждение: 'предупреждение', совет: 'проверки' };
const ГРУППЫ_ВАЖНОСТИ: { ключ: Важность; имя: string; пояснение: string }[] = [
  { ключ: 'ошибка', имя: 'Ошибки', пояснение: 'Так не построить: не влезает, пересечение, закрыт проём' },
  { ключ: 'предупреждение', имя: 'Предупреждения', пояснение: 'Построить можно, но пользоваться неудобно' },
  { ключ: 'совет', имя: 'Советы', пояснение: 'Нормы эргономики, решение за вами' },
];

function Проверки({ закрыть }: { закрыть: () => void }) {
  const п2 = useКухня((s) => s.проект2);
  const замечания = useMemo(() => проверитьПроект(п2), [п2]);
  const итог = useMemo(() => сводка(замечания), [замечания]);
  const [показ, задатьПоказ] = useState<Важность | 'все'>('все');
  const свободная = !!п2.настройки.свободная_сборка;
  const экземпляры = useMemo(() => new Map(п2.объекты.map((о) => [о.id, о])), [п2]);
  const помещения = useMemo(() => new Map(п2.помещения.map((п) => [п.id, п.название])), [п2]);
  const несколько = п2.помещения.length > 1;
  const имяОбъекта = (id: string) => {
    const о = экземпляры.get(id);
    return о?.название ?? (о ? изделиеПоИд(о.изделие)?.название : undefined) ?? id;
  };
  const перейти = (id: string) => {
    const о = экземпляры.get(id);
    const с = useКухня.getState();
    if (о && о.помещение !== с.помещениеАктивное) с.выбратьПомещение(о.помещение);
    useКухня.setState({ выбрано: [id] });
    закрыть();
  };
  const видимые = показ === 'все' ? замечания : замечания.filter((з) => з.важность === показ);
  return (
    <>
      {свободная && (
        <p className="подсказка-мелко свободная-пометка">
          <b>Свободная сборка включена.</b> На сцене красные контуры и предупреждения скрыты, пересечения разрешены. Здесь они всё равно перечислены; в чертёж и спецификацию идёт пометка «есть пересечения».
          <button className="кн" type="button" onClick={() => useКухня.getState().переключитьСвободнуюСборку()}>
            Выключить свободную сборку
          </button>
        </p>
      )}
      {замечания.length === 0 ? (
        <div className="пусто">
          <Иконка имя="проверки" размер={48} />
          <div>
            <b>Всё в порядке</b>
            <span>Всё влезает, проёмы свободны, дверцы открываются, проходы и высоты по нормам.</span>
          </div>
        </div>
      ) : (
        <>
          <div className="фильтры-проверок" role="group" aria-label="Что показывать">
            <button type="button" className="чип-проверок" aria-pressed={показ === 'все'} onClick={() => задатьПоказ('все')}>
              Все <b>{замечания.length}</b>
            </button>
            {ГРУППЫ_ВАЖНОСТИ.map((г) => (
              <button key={г.ключ} type="button" className={`чип-проверок ${г.ключ}`} aria-pressed={показ === г.ключ} disabled={!итог[г.ключ]} title={г.пояснение} onClick={() => задатьПоказ(показ === г.ключ ? 'все' : г.ключ)}>
                {г.имя} <b>{итог[г.ключ]}</b>
              </button>
            ))}
          </div>
          {ГРУППЫ_ВАЖНОСТИ.map((г) => {
            const список = видимые.filter((з) => з.важность === г.ключ);
            if (!список.length) return null;
            return (
              <section key={г.ключ} className="группа-проверок" aria-label={г.имя}>
                <h4>{г.имя}</h4>
                <ul className="список-проверок">
                  {список.map((з) => (
                    <li key={з.ключ} className={`замечание ${з.важность}`}>
                      <button type="button" className="позиция" onClick={() => з.id && перейти(з.id)}>
                        <Иконка имя={ЗНАЧОК_ВАЖНОСТИ[з.важность]} размер={20} />
                        <span>
                          <span className="имя">
                            {НАЗВАНИЯ_ПРАВИЛ[з.правило]}
                            {несколько ? ` · ${помещения.get(з.помещение) ?? ''}` : ''}
                          </span>
                          <br />
                          <span className="размер">{з.текст}</span>
                        </span>
                      </button>
                      {з.с?.[0] && экземпляры.has(з.с[0]) && (
                        <button type="button" className="кн малая к-второму" title={`Перейти к «${имяОбъекта(з.с[0])}»`} onClick={() => перейти(з.с![0])}>
                          К «{имяОбъекта(з.с[0])}»
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}

function Настройки() {
  const проект = useКухня((s) => s.проект2);
  const шаг = useКухня((s) => s.шагСетки);
  const установитьШаг = useКухня((s) => s.установитьШаг);
  const сетка = useКухня((s) => s.сеткаВидна);
  const переключитьСетку = useКухня((s) => s.переключитьСетку);
  const выполнить = useКухня((s) => s.выполнить);
  const автозапуск = useUI((s) => s.автозапуск);
  const акцент = useUI((s) => s.акцент);
  const установить = useUI((s) => s.установить);
  const настр = (п: Parameters<typeof изменитьНастройки>[0], имя: string) => {
    const с = useКухня.getState();
    с.начатьИзменение();
    выполнить(изменитьНастройки(п, имя));
    с.завершитьИзменение();
  };
  return (
    <div className="настройки">
      <section className="группа">
        <h3>Оформление</h3>
        <ПереключательТемы />
      </section>
      <section className="группа">
        <h3>Акцент интерфейса</h3>
        <div className="палитра">
          {Object.entries(АКЦЕНТЫ).map(([имя, [тём]]) => (
            <button key={имя} type="button" className={`цвет ${акцент === имя ? 'активна' : ''}`} style={{ background: тём }} title={имя} aria-label={`Акцент: ${имя}`} onClick={() => установить({ акцент: имя })} />
          ))}
        </div>
      </section>
      <section className="группа">
        <h3>Фон сцены</h3>
        <div className="материалы">
          {ФОНЫ.map(([имя, цвет]) => (
            <button key={цвет} type="button" className="материал" aria-pressed={проект.настройки.фон === цвет} onClick={() => настр({ фон: цвет }, 'Фон сцены')}>
              <i style={{ background: цвет }} />
              <span>{имя}</span>
            </button>
          ))}
        </div>
        <label className="кн цвет-свой" style={{ marginTop: 8 }}>
          Свой цвет фона
          <input type="color" value={проект.настройки.фон.startsWith('#') ? проект.настройки.фон : '#171a1f'} onChange={(e) => настр({ фон: e.target.value }, 'Фон сцены')} aria-label="Свой цвет фона сцены" />
        </label>
      </section>
      <section className="группа">
        <h3>Сетка и плита</h3>
        <div className="поля3">
          <div className="поле">
            <label>Шаг сетки</label>
            <select value={шаг} onChange={(e) => установитьШаг(Number(e.target.value))}>
              {[1, 10, 50, 100, 500].map((ш) => (
                <option key={ш} value={ш}>
                  {ш} мм
                </option>
              ))}
            </select>
          </div>
          <div className="поле">
            <label>Толщина плиты</label>
            <select value={проект.настройки.толщина_плиты} onChange={(e) => настр({ толщина_плиты: Number(e.target.value) as 16 | 18 }, 'Толщина плиты')}>
              <option value={16}>16 мм</option>
              <option value={18}>18 мм</option>
            </select>
          </div>
          <div className="поле">
            <label>Сетка на полу</label>
            <button className="кн" type="button" aria-pressed={сетка} onClick={переключитьСетку}>
              {сетка ? 'Показана' : 'Скрыта'}
            </button>
          </div>
        </div>
      </section>
      <section className="группа">
        <h3>Запуск</h3>
        <label className="флажок">
          <input
            type="checkbox"
            checked={автозапуск}
            onChange={(e) => {
              установить({ автозапуск: e.target.checked });
              void (window as unknown as { кухня?: { автозапуск?: (в: boolean) => void } }).кухня?.автозапуск?.(e.target.checked);
            }}
          />
          Запускать «Верстак» при входе в Windows
        </label>
      </section>
      <section className="группа">
        <h3>Горячие клавиши</h3>
        <dl className="клавиши">
          {КЛАВИШИ.map(([к, д]) => (
            <div key={к}>
              <dt>
                <span className="кл">{к}</span>
              </dt>
              <dd>{д}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function Справка({ закрыть }: { закрыть: () => void }) {
  return (
    <div className="настройки">
      <section className="группа">
        <h3>Как собрать кухню за 15 минут</h3>
        <ol className="шаги-справки">
          <li>«Новый проект» → «Размеры»: длина, ширина и высота стен комнаты (или готовое помещение заказчика).</li>
          <li>Клавиша P: каталог. Найдите «тумба 600», нажмите — тумба встанет у стены. Повторите для нижнего ряда.</li>
          <li>Нажмите на изделие: справа откроются свойства. Ширина цифрой, цвет фасада плиткой, число полок и ящиков.</li>
          <li>Навесные шкафы: категория «Навесные», высоту подвеса меняйте в «Положении».</li>
          <li>Техника и мойка встают из категорий «Техника» и «Мойка и вытяжка», столешница — из «Столешницы».</li>
          <li>Кнопка «Проверки» внизу: красная плашка — что-то не влезает, нажмите, чтобы перейти к изделию.</li>
          <li>«Сохранить» (Ctrl+S). Проект лежит в папке «Проекты» рядом с программой.</li>
        </ol>
      </section>
      <section className="группа">
        <h3>Горячие клавиши</h3>
        <dl className="клавиши">
          {КЛАВИШИ.map(([к, д]) => (
            <div key={к}>
              <dt>
                <span className="кл">{к}</span>
              </dt>
              <dd>{д}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="группа">
        <button
          className="кн"
          type="button"
          onClick={() => {
            закрыть();
            useUI.getState().открытьОкно('тур');
          }}
        >
          <Иконка имя="справка" размер={18} />
          Показать тур заново
        </button>
      </section>
    </div>
  );
}

const ФОРМАТЫ = [
  ['PDF', 'Чертёж на листах A4: план с выносками размеров, спецификация, расход и кромка, деталировка; на каждом листе рамка и штамп «Заказ № · Дата · Клиент · Дизайнер».'],
  ['XLSX', 'Таблица для Excel: три листа — деталировка, спецификация, расход ЛДСП и кромки; можно править руками.'],
  ['CSV', 'Список деталей для программ раскроя: длина, ширина, толщина, количество, материал, кромка (разделитель «;»).'],
  ['glTF', 'Трёхмерная модель (.glb) для просмотрщиков и рендеров: изделия и стены в метрах.'],
  ['.kitchen', 'Файл проекта «Верстака»: открывается в программе, хранит всё.'],
];

function Экспорт({ закрыть }: { закрыть: () => void }) {
  const выгрузить = useКухня((s) => s.выгрузить);
  const { заказ, клиент, дизайнер, установить } = useUI();
  const запустить = (ф: ФорматВыгрузки) => void выгрузитьВ(ф);
  return (
    <div className="настройки">
      <section className="группа">
        <h3>Штамп чертежа</h3>
        <div className="поля3">
          <div className="поле">
            <label>Заказ №</label>
            <input value={заказ} onChange={(e) => установить({ заказ: e.target.value })} />
          </div>
          <div className="поле">
            <label>Клиент</label>
            <input value={клиент} onChange={(e) => установить({ клиент: e.target.value })} />
          </div>
          <div className="поле">
            <label>Дизайнер</label>
            <input value={дизайнер} onChange={(e) => установить({ дизайнер: e.target.value })} />
          </div>
        </div>
        <div className="ряд-кнопок">
          <button className="кн главная" type="button" onClick={() => запустить('pdf')}>
            <Иконка имя="экспорт" размер={18} />
            Чертёж PROSTO (PDF) одним кликом
          </button>
        </div>
      </section>
      <section className="группа">
        <h3>Что можно выгрузить</h3>
        <dl className="форматы">
          {ФОРМАТЫ.map(([н, о]) => (
            <div key={н}>
              <dt>{н}</dt>
              <dd>{о}</dd>
            </div>
          ))}
        </dl>
        <div className="ряд-кнопок">
          <button className="кн" type="button" onClick={() => запустить('xlsx')}>
            XLSX
          </button>
          <button className="кн" type="button" onClick={() => запустить('csv')}>
            CSV
          </button>
          <button className="кн" type="button" onClick={() => запустить('gltf')}>
            glTF
          </button>
          <button
            className="кн"
            type="button"
            onClick={() => {
              void выгрузить();
              закрыть();
            }}
          >
            .kitchen
          </button>
        </div>
      </section>
    </div>
  );
}

const ЗАГОЛОВКИ: Record<Exclude<Окно, null | 'тур'>, string> = { проверки: 'Проверки', настройки: 'Настройки', справка: 'Справка', экспорт: 'Экспорт' };

export function ОкноПоверх() {
  const окно = useUI((s) => s.окно);
  const открыть = useUI((s) => s.открытьОкно);
  useEffect(() => {
    if (!окно || окно === 'тур') return;
    const к = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        открыть(null);
      }
    };
    window.addEventListener('keydown', к, true);
    return () => window.removeEventListener('keydown', к, true);
  }, [окно, открыть]);
  if (окно === 'тур') return <ПервыйЗапуск толькоТур закрыть={() => открыть(null)} />;
  if (!окно) return null;
  const закрыть = () => открыть(null);
  return (
    <div className="затемнение" role="dialog" aria-label={ЗАГОЛОВКИ[окно]} onPointerDown={(e) => e.target === e.currentTarget && закрыть()}>
      <div className="модал окно">
        <div className="выезд-шапка">
          <div>
            <b>{ЗАГОЛОВКИ[окно]}</b>
          </div>
          <button className="кн-и малая" type="button" aria-label="Закрыть" title="Закрыть (Esc)" onClick={закрыть}>
            <Иконка имя="закрыть" />
          </button>
        </div>
        <div className="выезд-тело">
          {окно === 'проверки' && <Проверки закрыть={закрыть} />}
          {окно === 'настройки' && <Настройки />}
          {окно === 'справка' && <Справка закрыть={закрыть} />}
          {окно === 'экспорт' && <Экспорт закрыть={закрыть} />}
        </div>
      </div>
    </div>
  );
}
