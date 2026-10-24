import './styles.css';
import './app.jsx';
import { registerSW } from 'virtual:pwa-register';
import { inGameHash } from './update.js';

// Новая версия скачивается сама, но страница перезагружается только вне партии: перезагрузка посреди игры обрывала бы её.
// Пока идёт игра, раз в 3 секунды проверяем, не вышел ли игрок из неё.
let waiting = 0;
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    const apply = () => { if (inGameHash(window.location.hash)) return false; clearInterval(waiting); updateSW(true); return true; };
    clearInterval(waiting); if (!apply()) waiting = setInterval(apply, 3000);
  }
});
