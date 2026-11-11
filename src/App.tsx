import { useEffect, useState } from 'react';
import { useКухня } from './store';
import { Сцена } from './three/Scene';
import { ГлавноеМеню, ЭкранКомнаты, ЭкранПроектов } from './ui/Screens';
import { НижняяПанель, ПраваяПанель, Шапка } from './ui/Panels';
import { запуститьАвтосохранение } from './store/автосохранение';

function ОшибкаWebGL({ текст }: { текст: string }) {
  return (
    <div className="ошибка-вебгл">
      <h2>Не удалось запустить 3D</h2>
      <p>{текст}</p>
      <p>Проверьте, что видеодрайвер установлен и WebGL включён в браузере.</p>
    </div>
  );
}

export default function App() {
  const экран = useКухня((s) => s.экран);
  const сообщение = useКухня((s) => s.сообщение);
  const закрытьСообщение = useКухня((s) => s.закрытьСообщение);
  const занято = useКухня((s) => s.занято);
  const подсказкаВидна = useКухня((s) => s.подсказкаВидна);
  const панельВидна = useКухня((s) => s.панельВидна);
  const показатьПодсказку = useКухня((s) => s.показатьПодсказку);
  const скрытьПодсказку = useКухня((s) => s.скрытьПодсказку);
  const [ошибка3D, установитьОшибку3D] = useState<string | null>(null);
  const найденоАвто = useКухня((s) => s.найденоАвто);
  const искатьАвто = useКухня((s) => s.искатьАвто);
  const восстановитьАвто = useКухня((s) => s.восстановитьАвто);
  const отброситьАвто = useКухня((s) => s.отброситьАвто);

  // Автосохранение раз в 60 секунд и поиск несохранённой работы после сбоя
  useEffect(() => {
    void искатьАвто();
    return запуститьАвтосохранение();
  }, [искатьАвто]);

  // Окно подсказок само сворачивается через 10 секунд после показа
  useEffect(() => {
    if (экран !== 'редактор' || !подсказкаВидна) return;
    const таймер = setTimeout(скрытьПодсказку, 10000);
    return () => clearTimeout(таймер);
  }, [экран, подсказкаВидна, скрытьПодсказку]);

  // Горячие клавиши
  useEffect(() => {
    const обработчик = (e: KeyboardEvent) => {
      const ц = e.target as HTMLElement;
      if (ц && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ц.tagName)) return;
      const с = useКухня.getState();
      if (с.экран !== 'редактор') return;

      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyZ') {
          e.preventDefault();
          if (e.shiftKey) с.вернуть();
          else с.отменить();
          return;
        }
        if (e.code === 'KeyY') {
          e.preventDefault();
          с.вернуть();
          return;
        }
        if (e.code === 'KeyS') {
          e.preventDefault();
          void с.сохранить();
          return;
        }
        if (e.code === 'KeyD') {
          e.preventDefault();
          с.копироватьВыбранное();
          return;
        }
        return;
      }

      switch (e.code) {
        case 'KeyV':
          с.установитьОбзор(с.обзор === 'сверху' ? 'прогулка' : 'сверху');
          break;
        case 'KeyH':
          с.переключитьПодсказку();
          break;
        case 'KeyP':
          с.переключитьПанель();
          break;
        case 'KeyG':
          с.выбратьИнструмент('двигать');
          break;
        case 'KeyR':
          с.выбратьИнструмент('крутить');
          break;
        case 'KeyT':
          с.выбратьИнструмент('растянуть');
          break;
        case 'Home':
          e.preventDefault();
          window.dispatchEvent(new Event('кухня:показать-всё'));
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          с.удалитьВыбранное();
          break;
        case 'Escape':
          с.выбрать([]);
          break;
      }
    };
    window.addEventListener('keydown', обработчик);
    return () => window.removeEventListener('keydown', обработчик);
  }, []);

  // Автоскрытие сообщения
  useEffect(() => {
    if (!сообщение) return;
    const t = setTimeout(закрытьСообщение, сообщение.вид === 'ошибка' ? 9000 : 4000);
    return () => clearTimeout(t);
  }, [сообщение, закрытьСообщение]);

  let содержимое;
  if (экран === 'меню') содержимое = <ГлавноеМеню />;
  else if (экран === 'проекты') содержимое = <ЭкранПроектов />;
  else if (экран === 'комната') содержимое = <ЭкранКомнаты />;
  else {
    содержимое = (
      <div className={`редактор${панельВидна ? '' : ' без-панели'}`}>
        <Шапка />
        <div className="сцена">
          {ошибка3D ? <ОшибкаWebGL текст={ошибка3D} /> : <СценаОшибкиБезопасно установить={установитьОшибку3D} />}

          {подсказкаВидна ? (
            <div className="подсказка">
              <button className="закрыть" onClick={скрытьПодсказку} title="Скрыть подсказки (H)">
                ×
              </button>
              <b>ЛКМ</b> — выбрать и тащить объект · <b>ПКМ</b> — наклон камеры
              <br />
              <b>колесо</b> — приближение · <b>WASD</b> — лететь · <b>Home</b> — вся комната
              <br />
              <b>V</b> — «Сверху / Прогулка» · <b>G R T</b> — двигать / крутить / растянуть
              <br />
              <b>Ctrl+Z</b> — отменить · <b>Delete</b> — удалить · <b>Shift+клик</b> — несколько
              <br />
              <b>H</b> — подсказки · <b>P</b> — панель
              <br />
              <span style={{ opacity: 0.6 }}>Окно скроется само через 10 секунд</span>
            </div>
          ) : (
            <button className="подсказка-кнопка" onClick={показатьПодсказку} title="Показать подсказки (H)">
              ?
            </button>
          )}
        </div>
        <ПраваяПанель />
        <НижняяПанель />
      </div>
    );
  }

  return (
    <>
      {содержимое}
      {сообщение && <div className={`сообщение ${сообщение.вид}`}>{сообщение.текст}</div>}
      {занято && <div className="загрузка">Работаю…</div>}
      {экран === 'меню' && найденоАвто.length > 0 && (
        <div className="восстановление" role="dialog" aria-label="Найдена несохранённая работа">
          <b>Найдена несохранённая работа</b>
          <p>
            «{найденоАвто[0].имя}» от{' '}
            {new Date(найденоАвто[0].изменён).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}. Восстановить?
          </p>
          <div className="кнопки">
            <button className="главная" onClick={() => void восстановитьАвто(найденоАвто[0].имя)}>
              Восстановить
            </button>
            <button className="тихая" onClick={() => void отброситьАвто(найденоАвто[0].имя)}>
              Не нужно
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Мягкая защита: если 3D не поднялось, показываем понятный текст, а не белый экран */
function СценаОшибкиБезопасно({ установить }: { установить: (т: string) => void }) {
  try {
    return <Сцена />;
  } catch (e) {
    установить((e as Error).message);
    return null;
  }
}
