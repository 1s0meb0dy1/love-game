import './styles.css';
import './app.jsx';
import { registerSW } from 'virtual:pwa-register';
registerSW({ immediate: true });
