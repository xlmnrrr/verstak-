import { useEffect, useState } from 'react';
import { useКухня } from './store';
import { Обложка } from './ui/Обложка';
import { Редактор } from './ui/Редактор';
import { Мастер } from './ui/Мастер';
import { ЭкранПроектов, ОкноПоверх, ПервыйЗапуск } from './ui/Экраны';
import { useUI } from './store/интерфейс';
import { АКЦЕНТЫ } from './ui/Экраны';
import { Спрайт } from './ui/design/Иконки';
import { запуститьАвтосохранение } from './store/автосохранение';
import { Интро, вступлениеНужно } from './ui/Интро';

/** Тема интерфейса: «система» следует за Windows, выбор хранится в приложении */
function useТема() {
  const тема = useКухня((s) => s.тема);
  useEffect(() => {
    const применить = () => {
      const светлая = тема === 'калька' || (тема === 'система' && matchMedia('(prefers-color-scheme: light)').matches);
      document.documentElement.dataset.theme = светлая ? 'light' : 'dark';
    };
    применить();
    if (тема !== 'система') return;
    const м = matchMedia('(prefers-color-scheme: light)');
    м.addEventListener('change', применить);
    return () => м.removeEventListener('change', применить);
  }, [тема]);
}

export default function App() {
  const экран = useКухня((s) => s.экран);
  const сообщение = useКухня((s) => s.сообщение);
  const закрытьСообщение = useКухня((s) => s.закрытьСообщение);
  const занято = useКухня((s) => s.занято);
  const [ошибка3D] = useState<string | null>(null);
  const найденоАвто = useКухня((s) => s.найденоАвто);
  const искатьАвто = useКухня((s) => s.искатьАвто);
  const восстановитьАвто = useКухня((s) => s.восстановитьАвто);
  const отброситьАвто = useКухня((s) => s.отброситьАвто);
  useТема();
  const акцент = useUI((u) => u.акцент);
  const тема = useКухня((s) => s.тема);
  useEffect(() => {
    const к = АКЦЕНТЫ[акцент] ?? АКЦЕНТЫ.латунь;
    const стиль = document.documentElement.style;
    // выбор акцента перекрывает токены --латунь и --на-латуни; «латунь» — стандарт без перекрытия
    const применить = () => {
      if (акцент === 'латунь' || !АКЦЕНТЫ[акцент]) {
        стиль.removeProperty('--латунь');
        стиль.removeProperty('--на-латуни');
        return;
      }
      const светлая = document.documentElement.dataset.theme === 'light';
      стиль.setProperty('--латунь', светлая ? к[1] : к[0]);
      стиль.setProperty('--на-латуни', светлая ? к[3] : к[2]);
    };
    применить();
    const н = new MutationObserver(применить);
    н.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => н.disconnect();
  }, [акцент, тема]);
  const вступлениеВкл = useUI((u) => u.вступление);
  // вступление: при запуске (если включено) и по кнопке в «Настройках» (событие кухня:вступление)
  const [вступление, setВступление] = useState(() => вступлениеНужно(useUI.getState().вступление));
  const [послеВступления, setПослеВступления] = useState(false);
  useEffect(() => {
    const показать = () => setВступление(true);
    window.addEventListener('кухня:вступление', показать);
    return () => window.removeEventListener('кухня:вступление', показать);
  }, []);
  void вступлениеВкл;
  const турПройден = useUI((u) => u.туркПройден);
  const закрытьТур = () => useUI.getState().установить({ туркПройден: true });

  // Автосохранение раз в 60 секунд и поиск несохранённой работы после сбоя; пример на обложке
  useEffect(() => {
    useКухня.getState().показатьВОбложке();
    void искатьАвто();
    return запуститьАвтосохранение();
  }, [искатьАвто]);

  // Горячие клавиши
  useEffect(() => {
    const обработчик = (e: KeyboardEvent) => {
      const ц = e.target as HTMLElement;
      // Ctrl+Z / Ctrl+Y в числовом поле панели — это отмена правки проекта, а не текста поля: поле закрепляет значение
      const числовое = ц?.tagName === 'INPUT' && (ц as HTMLInputElement).type === 'number';
      if (числовое && (e.ctrlKey || e.metaKey) && ['KeyZ', 'KeyY'].includes(e.code)) (ц as HTMLInputElement).blur();
      else if (ц && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ц.tagName)) return;
      const с = useКухня.getState();

      if (с.экран === 'меню') {
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyO') {
          e.preventDefault();
          void с.открытьФайл();
        } else if (e.ctrlKey && e.code === 'KeyO') {
          e.preventDefault();
          с.наЭкран('проекты');
        } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyN') {
          с.наЭкран('комната');
        }
        return;
      }
      if (с.экран !== 'редактор') return;

      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyZ') {
          e.preventDefault();
          if (e.shiftKey) с.вернуть();
          else с.отменить();
        } else if (e.code === 'KeyY') {
          e.preventDefault();
          с.вернуть();
        } else if (e.code === 'KeyS') {
          e.preventDefault();
          void с.сохранить();
        } else if (e.code === 'KeyD') {
          e.preventDefault();
          с.копироватьВыбранное();
        }
        return;
      }

      switch (e.code) {
        case 'KeyV':
          с.установитьОбзор(с.обзор === 'сверху' ? 'прогулка' : 'сверху');
          break;
        case 'KeyM': {
          // рулетка: включить или выключить
          const ui = useUI.getState();
          ui.установитьРулетку(!ui.рулетка);
          break;
        }
        case 'KeyO':
          // открыть или закрыть выбранное (в «Прогулке» то, на что указываешь, открывает ЛКМ или F)
          с.переключитьОткрытие();
          break;
        case 'KeyP':
          с.переключитьКаталог();
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
        case 'Backspace': {
          e.preventDefault();
          // при включённой рулетке Backspace убирает последний замер, а не удаляет выбранное
          const р = (window as unknown as { __кухня?: { ядро?: { рулетка: { убратьПоследний: () => void } } } }).__кухня?.ядро?.рулетка;
          if (useUI.getState().рулетка && р) р.убратьПоследний();
          else с.удалитьВыбранное();
          break;
        }
        case 'Escape':
          if (useUI.getState().рулетка) {
            // Esc: снять первую грань, а если её нет — выйти из рулетки
            const р = (window as unknown as { __кухня?: { ядро?: { рулетка: { отмена: () => boolean } } } }).__кухня?.ядро?.рулетка;
            if (!р?.отмена()) useUI.getState().установитьРулетку(false);
          } else if (с.предложениеНиши) с.отклонитьНишу();
          else if (useUI.getState().планОткрыт) useUI.getState().переключитьПлан(false);
          else if (с.каталогОткрыт) с.переключитьКаталог(false);
          else if (с.комнатаОткрыта) с.переключитьКомнату(false);
          else с.выбрать([]);
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
  if (экран === 'меню') содержимое = <Обложка />;
  else if (экран === 'проекты') содержимое = <ЭкранПроектов />;
  else if (экран === 'комната') содержимое = <Мастер />;
  else содержимое = <Редактор ошибка3D={ошибка3D} />;

  if (вступление) {
    return (
      <>
        <Спрайт />
        <Интро
          закончено={() => {
            setВступление(false);
            setПослеВступления(true);
            setTimeout(() => setПослеВступления(false), 1200);
          }}
          большеНеПоказывать={() => useUI.getState().установить({ вступление: false })}
        />
      </>
    );
  }

  return (
    <>
      <Спрайт />
      {послеВступления && <div className="после-интро" aria-hidden="true" />}
      {содержимое}
      <ОкноПоверх />
      {экран === 'меню' && !турПройден && <ПервыйЗапуск закрыть={закрытьТур} />}
      {сообщение && (
        <div className={`сообщение ${сообщение.вид}`} role={сообщение.вид === 'ошибка' ? 'alert' : 'status'}>
          {сообщение.текст}
        </div>
      )}
      {занято && <div className="загрузка полоса-загрузки" role="progressbar" aria-label="Работаю" />}
      {экран === 'меню' && найденоАвто.length > 0 && (
        <div className="восстановление" role="dialog" aria-label="Найдена несохранённая работа">
          <b>Найдена несохранённая работа</b>
          <p>
            «{найденоАвто[0].имя}» от{' '}
            {new Date(найденоАвто[0].изменён).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}. Восстановить?
          </p>
          <div className="кнопки">
            <button className="кн главная" onClick={() => void восстановитьАвто(найденоАвто[0].имя)}>
              Восстановить
            </button>
            <button className="кн тихая" onClick={() => void отброситьАвто(найденоАвто[0].имя)}>
              Не нужно
            </button>
          </div>
        </div>
      )}
    </>
  );
}
