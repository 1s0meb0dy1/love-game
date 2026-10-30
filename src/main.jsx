import './styles.css';
import './app.jsx';
import { registerSW } from 'virtual:pwa-register';
import { inGameHash } from './update.js';

// установлений застосунок (старий iOS «На початковий екран» або оболонка Capacitor): клас is-app прибирає віньєтку фону
try { if (window.navigator.standalone === true || (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) document.documentElement.classList.add('is-app'); } catch (e) {}

// Новая версия скачивается сама, но страница перезагружается только вне партии: перезагрузка посреди игры обрывала бы её.
// Пока идёт игра, раз в 3 секунды проверяем, не вышел ли игрок из неё.
let waiting = 0;
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    const apply = () => { if (inGameHash(window.location.hash)) return false; clearInterval(waiting); updateSW(true); return true; };
    clearInterval(waiting); if (!apply()) waiting = setInterval(apply, 3000);
  },
  // встановлений застосунок часто не перезавантажується (повертаються з фону), тож нову версію шукаємо
  // при кожному поверненні на екран і раз на 30 хв, а не лише при відкритті сторінки
  onRegisteredSW(swUrl, reg) {
    if (!reg) return;
    const check = () => { if (navigator.onLine !== false) reg.update().catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 30 * 60 * 1000);
  }
});
