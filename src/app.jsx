import React from 'react';
import * as ReactDOMAll from 'react-dom';
import { createRoot } from 'react-dom/client';
import qrcode from 'qrcode-generator';
import { ABOUT } from './content/about.js';
import { ABOUT_UK } from './content/about-uk.js';
import { LEGAL } from './content/legal.js';
import { LEGAL_UK } from './content/legal-uk.js';
import { createSessionTasks, createSessionStore, createLiveWriter, mergeTurnHistories } from './session-io.js';
import { t as tr, tf, setLang as i18nSetLang, getLang, catName as catLabel, diffName as diffLabel, audienceLabel, AUDIENCE_LABELS, CATEGORY_UK, DIFFICULTY_UK, SUPPORTED_LANGS, DEFAULT_LANG, LANG_STORAGE_KEY } from './i18n.js';
import { TOD_STARTER } from './content/tod-cards.js';
import { todCleanList, todCleanCard, todCardText } from './tod/model.js';
import { todLoadCards, todSaveCard, todSeedStarter, todActive, todReadCache, todWriteCache } from './tod/cards.js';
import { todMineRead, todMineWrite, todMineAdd, todMineRemove, todIsMine } from './tod/mine.js';
import { TOD_BANTER, TOD_TITLES } from './content/tod-banter.js';
import { todBuildDeck, todNext } from './tod/deck.js';
import { todStart, todApply } from './tod/engine.js';
import { todPickBanter } from './tod/talk.js';
import { todTitles } from './tod/titles.js';
import { TodArchive, TodAdmin, TodLobby, TodGame, TodResults, TodAdultModal } from './tod/screens.jsx';
import { todChannel } from './tod/channel.js';
import { aiAsk } from './ai/client.js';
const ReactDOM = { ...ReactDOMAll, createRoot };

// Рання ініціалізація мови з localStorage (щоб t() працювала ще до монтування React).
const readStoredLang = () => { try { const v = localStorage.getItem(LANG_STORAGE_KEY); return SUPPORTED_LANGS.includes(v) ? v : DEFAULT_LANG; } catch (e) { return DEFAULT_LANG; } };
i18nSetLang(readStoredLang());

        const { useState, useEffect, useRef, useMemo } = React;

        const FIREBASE_BASE_URL = "https://project-x-5e16a-default-rtdb.europe-west1.firebasedatabase.app";
        const PROFILE_STORAGE_KEY = "askme_device_profile_v4";
        const ADMIN_STORAGE_KEY = "askme_admin_unlocked_v4";
        const OFFLINE_DB_CACHE_KEY = "askme_offline_db_cache_v2";
        const sessionTasks = createSessionTasks({ isDeleted: sid => { try { return localStorage.getItem('askme_deleted_' + sid) === '1'; } catch (e) { return false; } } });

        const declOfNum = (number, titles) => {
            const cases = [2, 0, 1, 1, 1, 2];
            return tr(titles[ (number%100>4 && number%100<20)? 2 : cases[(number%10<5)?number%10:5] ]);
        };

        const fetchWithTimeout = async (url, options = {}, ms = 20000) => {
            const ctrl = new AbortController();
            const abort = () => ctrl.abort();
            if (options.signal?.aborted) abort();
            options.signal?.addEventListener('abort', abort, { once: true });
            const timer = setTimeout(() => ctrl.abort(), ms);
            try {
                const parsed = new URL(url);
                if (parsed.origin === FIREBASE_BASE_URL) {
                    if (!parsed.searchParams.has('auth')) {
                        if (ctrl.signal.aborted) throw new DOMException('Запрос отменён', 'AbortError');
                        const token = await new Promise((resolve, reject) => {
                            const cancelled = () => reject(new DOMException('Запрос отменён', 'AbortError'));
                            ctrl.signal.addEventListener('abort', cancelled, { once: true });
                            Auth.token().then(value => { ctrl.signal.removeEventListener('abort', cancelled); resolve(value); }, error => { ctrl.signal.removeEventListener('abort', cancelled); reject(error); });
                        });
                        if (token) parsed.searchParams.set('auth', token);
                    }
                    url = parsed.toString();
                }
                if (ctrl.signal.aborted) throw new DOMException('Запрос отменён', 'AbortError');
                const response = await fetch(url, { ...options, signal: ctrl.signal });
                if (!response.text) return response;
                const body = await response.text();
                return { ok: response.ok, status: response.status, headers: response.headers, text: async () => body, json: async () => JSON.parse(body) };
            } finally {
                clearTimeout(timer);
                options.signal?.removeEventListener('abort', abort);
            }
        };

        const FIREBASE_API_KEY = "AIzaSyDBE1-ZGgrHOVVUzl0Pcnkua-heJyRyoqg"; 
        const AUTH_STORAGE_KEY = "askme_auth_v2";
        const AUTH_BASE = "https://identitytoolkit.googleapis.com/v1/accounts";
        
        const Auth = {
            store: (() => { try { return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)) || {}; } catch (e) { return {}; } })(),
            anonPending: null,
            refreshPending: {},
            listeners: new Set(),
            persist() { try { localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.store)); } catch (e) {} this.listeners.forEach(listener => listener()); },
            pack(d) { const ttl = Number(d.expiresIn || d.expires_in || 3600); return { idToken: d.idToken || d.id_token, refreshToken: d.refreshToken || d.refresh_token, uid: d.localId || d.user_id || '', expiresAt: Date.now() + (ttl - 60) * 1000 }; },
            async post(url, body, form) {
                const r = await fetchWithTimeout(url, { method: "POST", headers: { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" }, body: form ? new URLSearchParams(body).toString() : JSON.stringify(body) }, 15000);
                const d = await r.json(); if (!r.ok) throw new Error((d && d.error && d.error.message) || "AUTH_ERROR"); return d;
            },
            async fresh(kind) {
                const rec = this.store[kind]; if (!rec) return null; if (rec.expiresAt > Date.now()) return rec.idToken;
                if (!this.refreshPending[kind]) this.refreshPending[kind] = (async () => {
                    try {
                        const d = await this.post(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, { grant_type: "refresh_token", refresh_token: rec.refreshToken }, true);
                        if (this.store[kind] !== rec) return null;
                        this.store[kind] = this.pack(d); this.persist(); return this.store[kind].idToken;
                    } catch (e) {
                        if (/^(INVALID_REFRESH_TOKEN|TOKEN_EXPIRED|USER_DISABLED|USER_NOT_FOUND)$/.test(e.message)) {
                            if (this.store[kind] === rec) { delete this.store[kind]; this.persist(); }
                            return null;
                        }
                        throw e; // временная ошибка не стирает refresh token и не меняет пользователя
                    } finally { delete this.refreshPending[kind]; }
                })();
                return this.refreshPending[kind];
            },
            async token() {
                if (!FIREBASE_API_KEY) return null; const owner = await this.fresh("owner"); if (owner) return owner; const anon = await this.fresh("anon"); if (anon) return anon;
                if (!this.anonPending) { this.anonPending = this.post(`${AUTH_BASE}:signUp?key=${FIREBASE_API_KEY}`, { returnSecureToken: true }).then(d => { this.store.anon = this.pack(d); this.persist(); return this.store.anon.idToken; }).catch(() => null).finally(() => { this.anonPending = null; }); }
                return this.anonPending;
            },
            hasOwner() { return !!this.store.owner; },
            async uid() {
                const token = await this.token(); if (!token) throw new Error('AUTH_REQUIRED');
                const rec = this.store.owner?.idToken === token ? this.store.owner : this.store.anon;
                if (!rec) throw new Error('AUTH_REQUIRED');
                if (!rec.uid) {
                    const data = await this.post(`${AUTH_BASE}:lookup?key=${FIREBASE_API_KEY}`, { idToken: token });
                    rec.uid = data.users?.[0]?.localId || ''; this.persist();
                }
                if (!rec.uid) throw new Error('AUTH_REQUIRED');
                return rec.uid;
            },
            ownerLogout() { delete this.store.owner; this.persist(); }
        };

        const verifyAdminSecret = async (email, password) => {
            try {
                if (!FIREBASE_API_KEY || !email) return false;
                const d = await Auth.post(`${AUTH_BASE}:signInWithPassword?key=${FIREBASE_API_KEY}`, { email: email, password: String(password || ""), returnSecureToken: true });
                // Разрешение на запись публичного контента выдаёт серверный UID-rule.
                const check = await fetchWithTimeout(`${FIREBASE_BASE_URL}/analytics/anon.json?shallow=true&auth=${encodeURIComponent(d.idToken)}`);
                if (!check.ok) return false;
                Auth.store.owner = Auth.pack(d); Auth.persist(); return true;
            } catch (e) { return false; }
        };

        const SESSION_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
        const generateSessionId = () => { // ID открывает сессию (вход по ID), поэтому берём криптографический генератор; 256 делится на 32 без остатка — перекоса нет
            const r = crypto.getRandomValues(new Uint8Array(8)); let id = ""; for (let i = 0; i < 8; i++) id += SESSION_ALPHABET[r[i] >> 3]; // старші 5 бітів байта = індекс 0..31, без ділення з остачею
            return id;
        };
        const isValidSessionIdFormat = (rawId) => /^[A-Z0-9]{8}$/.test(String(rawId || "").trim().toUpperCase());
        const hashSessionIdForDb = (sessionId) => {
            const clean = String(sessionId || "").trim().toUpperCase(); let h1 = 0x811c9dc5; let h2 = 0x1b873593; const s1 = "askme_vault_k1_" + clean + "_2026"; const s2 = "askme_vault_k2_" + clean + "_secure";
            for (let i = 0; i < s1.length; i++) { h1 ^= s1.charCodeAt(i); h1 = Math.imul(h1, 0x01000193); }
            for (let i = 0; i < s2.length; i++) { h2 ^= s2.charCodeAt(i); h2 = Math.imul(h2, 0x85ebca6b); }
            return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
        };
        const decryptSessionPayload = (encStr, pwd) => {
            try {
                const raw = atob(encStr); let res = "";
                for (let i = 0; i < raw.length; i++) res += String.fromCharCode(raw.charCodeAt(i) ^ pwd.charCodeAt(i % pwd.length));
                return JSON.parse(decodeURIComponent(res));
            } catch (e) { return null; }
        };

        const copyTextToClipboard = async (text) => {
            try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (e) {}
            try { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); return true; } catch (e) { return false; }
        };
        // облачная копия расшифровывается ключом, который знают все, у кого есть ссылка или ID, — типы полей проверяем, прежде чем класть их в состояние
        const cleanPlayers = (v) => Array.isArray(v) ? v.filter(p => p && typeof p === 'object' && (typeof p.id === 'string' || typeof p.id === 'number')).slice(0, MAX_PLAYERS).map(p => ({ id: String(p.id).slice(0, 40), name: String(p.name || '').slice(0, 25), gender: p.gender === 'girl' ? 'girl' : 'guy' })) : [];
        const cleanSavedGame = (g) => {
            if (!g || typeof g !== 'object' || !Array.isArray(g.questionIds)) return null;
            const questionIds = cleanIdList(g.questionIds); if (!questionIds.length) return null;
            const index = value => Math.max(0, Math.min(questionIds.length - 1, Math.floor(Number(value) || 0)));
            return { questionIds, currentIndex: index(g.currentIndex), maxReachedIndex: Math.max(index(g.currentIndex), index(g.maxReachedIndex)), turnHistory: cleanTurnHistory(g.turnHistory, questionIds.length) };
        };
        const cleanTurnHistory = (value, count = 5000) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
            const out = {};
            for (const [key, raw] of Object.entries(value)) {
                if (!/^\d+$/.test(key) || Number(key) >= count) continue;
                const entry = normTurn(raw); if (!entry || (entry.cur !== null && typeof entry.cur !== 'string')) continue;
                const ids = list => list.filter(id => typeof id === 'string' && id.length <= 40).slice(0, MAX_PLAYERS);
                out[key] = { cur: entry.cur, answered: ids(entry.answered), skippedBy: ids(entry.skippedBy), skippedAll: !!entry.skippedAll, ...(typeof raw?.dev === 'string' ? { dev: raw.dev.slice(0, 40) } : {}) };
            }
            return out;
        };
        const cleanIdList = (v, max = 5000) => Array.isArray(v) ? v.filter(x => typeof x === 'string' || typeof x === 'number').slice(0, max) : [];

        let lastSyncToastAt = 0;
        const bufToB64Url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const b64UrlToBuf = (str) => { const b64 = str.replace(/-/g, "+").replace(/_/g, "/"); const bin = atob(b64 + "=".repeat((4 - b64.length % 4) % 4)); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
        const generateAESKey = async () => bufToB64Url(await crypto.subtle.exportKey("raw", await crypto.subtle.generateKey({ name: "AES-GCM", length: 128 }, true, ["encrypt", "decrypt"])));
        const importAESKey = (keyStr, usage) => crypto.subtle.importKey("raw", b64UrlToBuf(keyStr), { name: "AES-GCM" }, false, [usage]);
        const isValidAESKey = (k) => typeof k === "string" && /^[A-Za-z0-9_-]{22}$/.test(k);
        const encryptSessionAES = async (obj, keyStr) => {
            try { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await importAESKey(keyStr, "encrypt"), new TextEncoder().encode(JSON.stringify(obj)))); const out = new Uint8Array(12 + ct.length); out.set(iv, 0); out.set(ct, 12); return bufToB64Url(out); } catch (e) { return null; }
        };
        const decryptSessionAES = async (cipher, keyStr) => {
            try { const all = b64UrlToBuf(cipher); const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.slice(0, 12) }, await importAESKey(keyStr, "decrypt"), all.slice(12)); return JSON.parse(new TextDecoder().decode(pt)); } catch (e) { return null; }
        };
        const sessionDbKey = async (keyStr) => {
            const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("askme-session-v1:" + keyStr)));
            return "s_" + Array.from(h).map(b => b.toString(16).padStart(2, "0")).join("");
        };
        const questionAudienceKey = async (key) => {
            const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('askme-question-audience-v1:' + key));
            return 'aud_' + Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        };
        const questionTarget = async (input, profile, savedTarget = '') => {
            const sid = String(input || '').trim().toUpperCase();
            if (!sid) return savedTarget;
            if (!isValidSessionIdFormat(sid)) throw new Error(tr("Введите 8-значный ID сессии"));
            const key = profile?.sessionId === sid && isValidAESKey(profile.sessionKey) ? profile.sessionKey : await lookupJoinCode(sid);
            if (!key) throw new Error(tr("Сессия не найдена или недоступна. Откройте её на устройстве игрока и повторите"));
            return questionAudienceKey(key);
        };
        const CYR_TO_LAT = { "А": "A", "В": "B", "С": "C", "Е": "E", "Н": "H", "К": "K", "М": "M", "Р": "P", "Т": "T", "Х": "X", "У": "Y" };
        const parseRestoreInput = (raw) => {
            const text = String(raw || "").trim(); let sid = "", key = ""; const mSid = text.match(/sid=([A-Za-z0-9]{8})/i), mKey = text.match(/key=([A-Za-z0-9_-]{22})/);
            if (mSid || mKey) { sid = mSid ? mSid[1] : ""; key = mKey ? mKey[1] : ""; } else if (text.includes("|")) { [sid, key] = text.split("|").map(x => x.trim()); } else { sid = text.replace(/[\s-]+/g, ""); } // голый ID: пробелы и дефисы (если ID вставили по частям) не мешают
            return { sid: sid.toUpperCase().replace(/[АВСЕНКМРТХУ]/g, c => CYR_TO_LAT[c]), key: isValidAESKey(key) ? key : "" }; // на украинской раскладке «А», «В», «К» … выглядят как латинские — это те же буквы ID
        };

        // ---- вход по 8-значному ID ----
        // Настоящий ключ сессии (128 бит) есть только на устройствах и в ссылке-приглашении, а ID — это всего 40 бит. Чтобы по одному ID можно было войти на новом устройстве,
        // устройство кладёт в облако «замок»: ключ сессии, зашифрованный ключом, который выводится из ID медленной функцией PBKDF2. Из того же вывода берётся и адрес замка (j_…),
        // поэтому ID по адресу не найти, а каждая попытка подбора стоит полного прогона PBKDF2. Это защита уровня «код комнаты»: знающий ID может войти (см. политику конфиденциальности).
        const JOIN_ITERATIONS = 300000, JOIN_REFRESH_MS = 7 * 24 * 3600 * 1000;
        const joinCodeParts = async (sid) => {
            const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(sid || "").trim().toUpperCase()), "PBKDF2", false, ["deriveBits"]);
            const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode("askme-join-v1"), iterations: JOIN_ITERATIONS }, base, 384));
            return { path: "j_" + Array.from(bits.slice(0, 32)).map(b => b.toString(16).padStart(2, "0")).join(""), lockKey: bufToB64Url(bits.slice(32, 48)) };
        };
        const joinCodeUrl = (path) => `${FIREBASE_BASE_URL}/sessions/${path}.json`;
        const publishJoinCode = async (sid, key) => {
            try {
                if (!isValidSessionIdFormat(sid) || !isValidAESKey(key)) return false;
                const { path, lockKey } = await joinCodeParts(sid); const payload = await encryptSessionAES({ k: key }, lockKey); if (!payload) return false;
                const previous = await fetchWithTimeout(joinCodeUrl(path), { headers: { 'X-Firebase-ETag': 'true' } });
                if (!previous.ok && previous.status !== 404) return false;
                const existing = previous.ok ? await previous.json() : null;
                if (existing?.deleted) return false;
                if (existing?.payload) { const decoded = await decryptSessionAES(existing.payload, lockKey); if (decoded?.k !== key) return false; }
                const r = await fetchWithTimeout(joinCodeUrl(path), { method: "PUT", headers: { "Content-Type": "application/json", 'If-Match': previous.headers?.get('ETag') || 'null_etag' }, body: JSON.stringify({ payload, updatedAt: Date.now() }) }); return r.ok;
            } catch (e) { return false; }
        };
        const lookupJoinCode = async (sid) => { // ключ сессии по ID; "" — замка нет / не открылся; null — облако не ответило (сеть, отказ базы)
            try {
                if (!isValidSessionIdFormat(sid)) return "";
                const { path, lockKey } = await joinCodeParts(sid); const r = await fetchWithTimeout(joinCodeUrl(path) + "?t=" + Date.now()); if (!r.ok) return null; const data = await r.json();
                const dec = data && typeof data.payload === "string" ? await decryptSessionAES(data.payload, lockKey) : null; return dec && isValidAESKey(dec.k) ? dec.k : "";
            } catch (e) { return null; }
        };
        const retireSessionUrl = async (url) => (await fetchWithTimeout(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: '', updatedAt: Date.now(), deleted: true }) }, 10000)).ok;
        const removeJoinCode = async (sid) => { try { if (!isValidSessionIdFormat(sid)) return true; const { path } = await joinCodeParts(sid); return await retireSessionUrl(joinCodeUrl(path)); } catch (e) { return false; } };

        const sanitizeInput = (str, maxLength = 600) => String(str||"").replace(/[<>]/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maxLength);
        const sanitizeName = (str) => sanitizeInput(str, 20).replace(/\d/g, ''); 

        const ActionGuard = { lastActionTime: 0, canProceed(cooldownMs = 650) { const now = Date.now(); if (now - this.lastActionTime < cooldownMs) return false; this.lastActionTime = now; return true; } };

        const CATEGORIES = [
            { id: "family", name: "Семья", icon: "👨‍👩‍👧‍👦" }, { id: "intimacy", name: "Интим", icon: "🔞" },
            { id: "future", name: "Будущее", icon: "🎯" }, { id: "secrets", name: "Секреты", icon: "🤫" },
            { id: "romance", name: "Романтика", icon: "❤️" }, { id: "past", name: "Прошлое", icon: "⏳" },
            { id: "values", name: "Ценности", icon: "⚖️" }, { id: "fears", name: "Страхи", icon: "👻" },
            { id: "money", name: "Деньги", icon: "💰" }, { id: "life", name: "Быт", icon: "🏠" },
            { id: "trust", name: "Доверие", icon: "🤝" }, { id: "talk", name: "Общение и конфликты", icon: "💬" },
            { id: "fun", name: "Юмор и игра", icon: "😄" }, { id: "body", name: "Тело и забота", icon: "🌿" }
        ];
        // базові теми, додані 29.10.2026: у гравців зі збереженим вибором тем вмикаються один раз автоматично (як нові власні теми)
        const NEW_BASE_TOPICS = ['trust', 'talk', 'fun', 'body'];

        const DIFFICULTIES = [
            { id: "Простые", name: "Легкие", classText: "diff-text-1", classBg: "diff-pill-1" },
            { id: "Средние", name: "Средние", classText: "diff-text-2", classBg: "diff-pill-2" },
            { id: "Глубокие", name: "Глубокие", classText: "diff-text-3", classBg: "diff-pill-3" }
        ];

        const SCREEN_TO_HASH = { onboarding: '#/welcome', session_created: '#/session-ready', menu: '#/', app_menu: '#/more', game_setup: '#/setup', topics_admin: '#/topics/manage', punish_admin: '#/punishments/manage', tod_admin: '#/tod/manage', tod_lobby: '#/tod', tod_play: '#/tod/play', tod_results: '#/tod/results', analytics: '#/analytics', analytics_sessions: '#/analytics/sessions', hidden_q: '#/questions/hidden', profile_page: '#/profile', admin_login: '#/admin', mode_select: '#/mode', game: '#/play', ai_response: '#/ai', summary: '#/summary', cat_list: '#/topics', q_list: '#/questions', archive_page: '#/archive', add_q: '#/add', edit_q: '#/edit', invite: '#/invite', join: '#/join', about: '#/about', privacy: '#/privacy', terms: '#/terms', cookies: '#/cookies', age: '#/age', copyright: '#/copyright' };
        const HASH_TO_SCREEN = { '#/welcome': 'onboarding', '#/session-ready': 'session_created', '#/': 'menu', '#/menu': 'menu', '#/profile': 'profile_page', '#/more': 'app_menu', '#/setup': 'game_setup', '#/topics/manage': 'topics_admin', '#/punishments/manage': 'punish_admin', '#/tod/manage': 'tod_admin', '#/tod': 'tod_lobby', '#/tod/play': 'tod_play', '#/tod/results': 'tod_results', '#/analytics': 'analytics', '#/analytics/sessions': 'analytics_sessions', '#/questions/hidden': 'hidden_q', '#/admin': 'admin_login', '#/mode': 'mode_select', '#/play': 'game', '#/ai': 'ai_response', '#/summary': 'summary', '#/topics': 'cat_list', '#/questions': 'q_list', '#/archive': 'archive_page', '#/add': 'add_q', '#/edit': 'edit_q', '#/invite': 'invite', '#/join': 'join', '#/about': 'about', '#/privacy': 'privacy', '#/terms': 'terms', '#/cookies': 'cookies', '#/age': 'age', '#/copyright': 'copyright' };
        // страницы, которые открываются без сессии (по общей ссылке): «Об игре», юридические, быстрое подключение
        const PUBLIC_SCREENS = ['about', 'privacy', 'terms', 'cookies', 'age', 'copyright', 'join'];
        // экраны, которые после перезагрузки страницы нечем наполнить (итоги и разбор опираются на данные партии в памяти): открываем меню
        const RELOAD_TO_MENU = ['ai_response', 'summary'];
        const hashPath = (h) => String(h || '').split('?')[0];
        const hasInviteParams = (h) => /sid=/.test(String(h || '')) && /key=/.test(String(h || ''));

        const SoundFX = {
            ctx: null, filter: null, muted: false, unlocked: false,
            triggerHaptic(pattern = 12) {
                if (this.muted) return; const nowTs = Date.now(); if (nowTs - (this.lastHaptic || 0) < 25) return; this.lastHaptic = nowTs;
                try { if (navigator.vibrate) { navigator.vibrate(pattern); return; } const iosLabel = document.getElementById('ios-taptic-label'); if (iosLabel) iosLabel.click(); } catch (e) {}
            },
            init() {
                try {
                    const AudioCtx = window.AudioContext || window.webkitAudioContext; if (!AudioCtx) return;
                    if (!this.ctx) { this.ctx = new AudioCtx(); this.filter = this.ctx.createBiquadFilter(); this.filter.type = "lowpass"; this.filter.frequency.value = 1650; this.filter.connect(this.ctx.destination); }
                    if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') { try { this.ctx.resume(); } catch (e) {} }
                    if (!this.unlocked && this.ctx) { const b = this.ctx.createBuffer(1, 1, 22050); const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.ctx.destination); if (s.start) s.start(0); this.unlocked = true; }
                } catch (e) {}
            },
            playAcousticNote(freq, duration = 0.12, vol = 0.24, endFreq = null) {
                if (this.muted) return; try {
                    this.init(); if (!this.ctx || !this.filter) return; const now = this.ctx.currentTime;
                    const osc = this.ctx.createOscillator(); const subOsc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
                    osc.type = 'sine'; subOsc.type = 'triangle'; osc.frequency.setValueAtTime(freq, now); subOsc.frequency.setValueAtTime(freq * 0.5, now);
                    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
                    gain.gain.setValueAtTime(0.001, now); gain.gain.linearRampToValueAtTime(vol, now + 0.014); gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
                    osc.connect(gain); subOsc.connect(gain); gain.connect(this.filter); osc.start(now); subOsc.start(now); osc.stop(now + duration + 0.015); subOsc.stop(now + duration + 0.015);
                } catch (e) {}
            },
            click() { if (this.muted) return; this.triggerHaptic(8); this.playAcousticNote(780, 0.055, 0.12, 540); this.playAcousticNote(1170, 0.04, 0.035, 820); },
            getNoise() {
                if (!this.noiseBuf && this.ctx) {
                    const len = Math.floor(this.ctx.sampleRate * 0.4); const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = b.getChannelData(0);
                    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
                    this.noiseBuf = b;
                }
                return this.noiseBuf;
            },
            flip(dir = 'right') {
                if (this.muted) return;
                if (this.skipNextFlip) { this.skipNextFlip = false; return; }
                this.triggerHaptic(8);
                try {
                    this.init(); if (!this.ctx) return;
                    const now = this.ctx.currentTime, buf = this.getNoise(); if (!buf) return;
                    const src = this.ctx.createBufferSource(); src.buffer = buf;
                    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
                    const up = dir === 'right';
                    bp.frequency.setValueAtTime(up ? 700 : 2200, now); bp.frequency.exponentialRampToValueAtTime(up ? 2200 : 700, now + 0.16);
                    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.11, now + 0.045); g.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);
                    src.connect(bp); bp.connect(g); g.connect(this.ctx.destination); src.start(now); src.stop(now + 0.2);
                    setTimeout(() => this.playAcousticNote(190, 0.07, 0.1, 150), 120);
                } catch (e) {}
            },
            toggle(active = true) { if (this.muted) return; this.triggerHaptic(14); if (active) { this.playAcousticNote(440, 0.08, 0.2); setTimeout(() => this.playAcousticNote(587.33, 0.1, 0.22), 55); } else { this.playAcousticNote(523.25, 0.08, 0.18); setTimeout(() => this.playAcousticNote(392.00, 0.1, 0.18), 55); } },
            rouletteTick() { if (this.muted) return; this.triggerHaptic(8); this.playAcousticNote(310, 0.045, 0.18, 220); },
            rouletteWin() { if (this.muted) return; this.triggerHaptic([18, 45, 30]); this.init(); const chord = [523.25, 659.25, 783.99, 987.77]; chord.forEach((f, idx) => setTimeout(() => this.playAcousticNote(f, 0.28, 0.22), idx * 85)); },
            romanticFinale() { if (this.muted) return; this.triggerHaptic([25, 60, 25, 60, 45]); this.init(); const notes = [{ f: 440, d: 0.45, t: 0 }, { f: 554.37, d: 0.45, t: 130 }, { f: 659.25, d: 0.50, t: 260 }, { f: 830.61, d: 0.55, t: 390 }, { f: 987.77, d: 0.85, t: 530 }]; notes.forEach(n => setTimeout(() => this.playAcousticNote(n.f, n.d, 0.26), n.t)); },
            magic() { if (this.muted) return; this.triggerHaptic([12, 35, 18]); this.init(); this.playAcousticNote(493.88, 0.14, 0.2, 659.25); setTimeout(() => this.playAcousticNote(783.99, 0.22, 0.22), 90); },
            success() { if (this.muted) return; this.triggerHaptic([14, 30, 20]); this.init(); this.playAcousticNote(523.25, 0.12, 0.22); setTimeout(() => this.playAcousticNote(783.99, 0.26, 0.26), 95); },
            warn() { if (this.muted) return; this.triggerHaptic([25, 40, 25]); this.playAcousticNote(280, 0.15, 0.22, 190); }
        };

        if (typeof window !== 'undefined') { const unlockHandler = () => SoundFX.init(); window.addEventListener('touchstart', unlockHandler, { passive: true, once: true }); window.addEventListener('click', unlockHandler, { passive: true, once: true }); }

        const Icons = {
            Play: () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v14l11-7-11-7z" /></svg>, Menu: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>, Back: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>, Next: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>, Sparkles: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>, List: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>, Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>, Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>, Bulb: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>, Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>, Resume: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992M2.985 14.652l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /><path d="M10.4 9.1v5.8l4.7-2.9z" fill="currentColor" stroke="none" /></svg>, Trash: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, Restore: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>, Archive: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>, SoundOn: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>, SoundOff: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>, User: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>, Lock: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>, Copy: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>, Share: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>, IosShare: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>, Eye: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>, EyeOff: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>, ChevronDown: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>, DownloadApp: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>, Close: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" /></svg>, Logout: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            , Skip: () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 5.5l9.5 6.5L5 18.5v-13z" /><path d="M19 5v14" /></svg>
        };

        const PopupModal = ({ isOpen, onClose, children }) => {
            const box = useRef(null), closeRef = useRef(onClose); closeRef.current = onClose;
            useEffect(() => {
                if (!isOpen) return;
                const previous = document.activeElement, root = document.getElementById('root');
                const oldInert = root?.inert; if (root) root.inert = true;
                const controls = () => [...(box.current?.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]') || [])];
                const title = box.current?.querySelector('h1,h2,h3');
                if (title) box.current.setAttribute('aria-label', title.textContent);
                (controls()[0] || box.current)?.focus();
                const keydown = event => {
                    if (event.key === 'Escape' && closeRef.current) { event.preventDefault(); closeRef.current(); }
                    if (event.key !== 'Tab') return;
                    const list = controls(), first = list[0], last = list[list.length - 1];
                    if (!first) { event.preventDefault(); box.current?.focus(); }
                    else if (event.shiftKey && (document.activeElement === first || !box.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
                    else if (!event.shiftKey && (document.activeElement === last || !box.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
                };
                document.addEventListener('keydown', keydown);
                return () => { document.removeEventListener('keydown', keydown); if (root) root.inert = oldInert; if (previous?.isConnected) previous.focus(); };
            }, [isOpen]);
            if (!isOpen) return null;
            return ReactDOM.createPortal(<div className="viewport-popup-overlay fade-in" onClick={() => { if (onClose) { SoundFX.click(); onClose(); } }}><div ref={box} tabIndex={-1} className="viewport-popup-box slide-up" role="dialog" aria-label={tr("Диалог")} aria-modal="true" onClick={e => e.stopPropagation()}>{onClose && <button type="button" onClick={() => { SoundFX.click(); onClose(); }} aria-label={tr("Закрыть")} className="btn-icon absolute top-3 right-3"><Icons.Close /></button>}{children}</div></div>, document.body);
        };

        // ---- Всплывающие уведомления ----
        // Свой корень поверх приложения: уведомление не пересоздаётся при перерисовке экрана и не зависит от того, где показано.
        // Виды: ok — сделано, turn — ход перешёл, info — к сведению, warn — не получилось (читается скринридером сразу).
        const TOAST_ICONS = { ok: () => <Icons.Check />, turn: () => <Icons.User />, info: () => <b>i</b>, warn: () => <b>!</b> };
        const toastBus = { push: null, seq: 0 };
        const showToast = (msg, ms = 2800, kind = 'ok') => { if (toastBus.push) toastBus.push({ msg: tr(String(msg)), ms, kind: Object.prototype.hasOwnProperty.call(TOAST_ICONS, kind) ? kind : 'ok', id: ++toastBus.seq }); };
        const ToastHost = () => {
            const [t, setT] = useState(null);
            useEffect(() => { toastBus.push = setT; return () => { toastBus.push = null; }; }, []);
            useEffect(() => { if (!t) return undefined; const id = setTimeout(() => setT(null), t.ms); return () => clearTimeout(id); }, [t]);
            const Icon = t ? TOAST_ICONS[t.kind] : null;
            return (<div className="toast-layer" aria-live="polite">{t && <div key={t.id} role={t.kind === 'warn' ? 'alert' : 'status'} className={`toast toast-${t.kind}`} style={{ '--toast-ms': t.ms + 'ms' }}><span className="toast-ico" aria-hidden="true"><Icon /></span><span className="toast-text">{t.msg}</span></div>}</div>);
        };

        const CustomSelect = ({ value, onChange, options, placeholder }) => { placeholder = placeholder || tr("Выберите...");
            const [open, setOpen] = useState(false); const containerRef = useRef(null);
            useEffect(() => { const handleOutsideClick = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", handleOutsideClick); document.addEventListener("touchstart", handleOutsideClick); return () => { document.removeEventListener("mousedown", handleOutsideClick); document.removeEventListener("touchstart", handleOutsideClick); }; }, []);
            const selectedOpt = options.find(o => o.value === value) || options[0];
            return ( <div ref={containerRef} className="relative w-full select-none"> <button type="button" onClick={() => { SoundFX.click(); setOpen(prev => !prev); }} className={`field-btn ${ open ? 'is-open' : '' }`} > <div className="flex items-center gap-2.5 truncate"> {selectedOpt?.icon && <span className="text-base leading-none">{selectedOpt.icon}</span>} <span className="text-sm font-medium text-white truncate"> {selectedOpt ? selectedOpt.label : placeholder} </span> </div> <span className={`text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180 text-rose-400' : ''}`}> <Icons.ChevronDown /> </span> </button> {open && ( <div className="menu-pop left-0 right-0 fade-in"> {options.map(opt => { const isSelected = opt.value === value; return ( <button key={opt.value} type="button" onClick={() => { SoundFX.toggle(true); onChange(opt.value); setOpen(false); }} className={`menu-opt mb-0.5 last:mb-0 ${ isSelected ? 'is-on' : '' }`} > <div className="flex items-center gap-2.5 truncate"> {opt.icon && <span className="text-base leading-none">{opt.icon}</span>} <span className="truncate">{opt.label}</span> </div> {isSelected && ( <span className="text-rose-400 flex-shrink-0"> <Icons.Check /> </span> )} </button> ); })} </div> )} </div> );
        };

        // Вибір мови: кнопка розміру «назад» (btn-icon) у правому куті шапки, список мов — спливне меню menu-pop.
        const LANG_NAMES = { uk: 'Українська', ru: 'Русский' };
        const LANG_CODES = { uk: 'UA', ru: 'RU' };
        const LangMenu = ({ lang, onChange }) => {
            const [open, setOpen] = useState(false); const ref = useRef(null);
            useEffect(() => {
                if (!open) return;
                const out = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
                const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
                document.addEventListener('mousedown', out); document.addEventListener('touchstart', out); document.addEventListener('keydown', esc);
                return () => { document.removeEventListener('mousedown', out); document.removeEventListener('touchstart', out); document.removeEventListener('keydown', esc); };
            }, [open]);
            return (
                <div ref={ref} className="relative flex-shrink-0">
                    <button type="button" onClick={() => { SoundFX.click(); setOpen(o => !o); }} aria-haspopup="true" aria-expanded={open} aria-label={tr('Язык') + ': ' + LANG_NAMES[lang]} className={`btn-secondary btn-sm lang-btn ${open ? 'is-on' : ''}`}><span>{LANG_CODES[lang]}</span><span aria-hidden="true" className={`lang-chev ${open ? 'is-open' : ''}`}><Icons.ChevronDown /></span></button>
                    {open && (
                        <div className="menu-pop right-0 w-44 fade-in" role="menu">
                            {SUPPORTED_LANGS.map(l => (
                                <button key={l} type="button" role="menuitemradio" aria-checked={l === lang} lang={l} onClick={() => { if (l !== lang) { SoundFX.toggle(true); onChange(l); } setOpen(false); }} className={`menu-opt ${l === lang ? 'is-on' : ''}`}><span>{LANG_NAMES[l]}</span><span className="text-xs font-bold text-zinc-500">{LANG_CODES[l]}</span></button>
                            ))}
                            <button type="button" role="menuitemradio" aria-checked="false" aria-disabled="true" disabled lang="en" className="menu-opt"><span>English</span><span className="text-xs font-bold text-zinc-500">{tr("Скоро")}</span></button>
                        </div>
                    )}
                </div>
            );
        };
        const SETTINGS_KEY = "askme_game_settings_v1";
        const DEFAULT_PUNISHMENTS = [
            { id: 'd1', text: 'Сделай искренний комплимент каждому игроку', level: 'any', icon: '💌' },
            { id: 'd2', text: 'Станцуй 15 секунд без музыки', level: 'any', icon: '💃' },
            { id: 'd3', text: 'Изобрази животное — остальные угадывают', level: 'any', icon: '🐒' },
            { id: 'd4', text: 'Выпей стакан воды залпом', level: 'Простые', icon: '💧' },
            { id: 'd5', text: 'Расскажи смешную историю из своей жизни', level: 'Простые', icon: '😄' },
            { id: 'd6', text: 'Расскажи неловкий секрет из детства', level: 'Средние', icon: '🤫' },
            { id: 'd7', text: 'Прочитай вслух последнее сообщение в телефоне, которое можно показать', level: 'Средние', icon: '📱' },
            { id: 'd8', text: 'Скажи, за что ты по-настоящему благодарен(на) партнёру', level: 'Глубокие', icon: '🫶' }
        ];
        const LEVEL_OPTIONS = [['any', 'Любая сложность'], ['Простые', 'Лёгкие'], ['Средние', 'Средние'], ['Глубокие', 'Глубокие']];
        // время на ответ в усложнённом режиме: в настройках — от 30 секунд до 7 минут. Значения короче 30 с (от прошлых версий) при чтении сохранения не трогаем: нижняя граница там 5 с
        const TIMER_MIN = 30, TIMER_MAX = 420, TIMER_STORED_MIN = 5;
        const loadGameSettings = () => {
            const base = { timerOn: false, timerSec: 30, punishOn: false, punishments: [], hiddenTemplates: [] };
            try {
                const p = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
                if (p && typeof p === 'object') {
                    const own = Array.isArray(p.punishments) ? p.punishments.filter(x => x && x.custom === true && typeof x.text === 'string' && x.text.trim()).slice(0, 60).map(x => ({ id: String(x.id || Math.random()), text: x.text.slice(0, 80), level: LEVEL_OPTIONS.some(o => o[0] === x.level) ? x.level : 'any', icon: x.icon || '🎭', custom: true })) : [];
                    const hidden = Array.isArray(p.hiddenTemplates) ? p.hiddenTemplates.filter(x => typeof x === 'string').slice(0, 200) : [];
                    return { timerOn: !!p.timerOn, timerSec: Math.max(TIMER_STORED_MIN, Math.min(TIMER_MAX, Number(p.timerSec) || 30)), punishOn: !!p.punishOn, punishments: own, hiddenTemplates: hidden };
                }
            } catch (e) {}
            return base;
        };
        const PUNISH_CACHE_KEY = "askme_punish_templates_v1";
        const PUNISH_LEVELS = ['any', 'Простые', 'Средние', 'Глубокие'];
        const sanitizeTemplates = (arr) => (Array.isArray(arr) ? arr : []).filter(x => x && typeof x.id === 'string' && typeof x.text === 'string' && x.text.trim() && PUNISH_LEVELS.includes(x.level)).slice(0, 100).map(x => ({ id: x.id, text: x.text.slice(0, 80), level: x.level, icon: String(x.icon || '🎭').slice(0, 16), n: Number(x.n) || 0 }));
        const templatesFromDb = (data) => sanitizeTemplates(data && typeof data === 'object' ? Object.values(data) : []).sort((a, b) => a.n - b.n);
        const readPunishCache = () => { try { const l = sanitizeTemplates(JSON.parse(localStorage.getItem(PUNISH_CACHE_KEY) || 'null')); return l.length ? l : DEFAULT_PUNISHMENTS; } catch (e) { return DEFAULT_PUNISHMENTS; } };
        const PUNISH_EMOJIS = ['🎤', '💃', '🐒', '💧', '😄', '🤫', '📱', '🫶', '🍋', '🎭', '🧘', '🤸'];
        const pickPunishment = (list, level, rnd = Math.random) => {
            const pool = (list || []).filter(p => p.level === 'any' || p.level === level);
            return pool.length ? pool[Math.floor(rnd() * pool.length)] : null;
        };
        const SettingSwitch = ({ on, onChange, label }) => (
            <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} className={`switch ${on ? 'is-on' : ''}`}>
                <span className="switch-knob"></span>
            </button>
        );
        // Блок «Таймер на ответ» усложнённого режима: крупное значение, шаг ±5 с, ползунок и пять быстрых значений
        const TIMER_PRESETS = [30, 45, 60, 90, 120];
        const timerCaption = (s) => s <= 30 ? tr("Живой темп: отвечать нужно сразу") : s <= 60 ? tr("Есть время подумать") : s <= 120 ? tr("Для глубоких вопросов") : s <= 240 ? tr("Без спешки") : tr("Для долгих разговоров");
        const fmtSec = (s) => s >= 60 ? tf("{v0} мин{v1}", { v0: Math.floor(s / 60), v1: s % 60 ? ' ' + (s % 60) + ' с' : '' }) : tf("{v0} с", { v0: s });
        const clampTimer = (n) => Math.max(TIMER_MIN, Math.min(TIMER_MAX, Math.round(Number(n) || 0)));
        const FxTimerCard = ({ on, sec, onToggle, onSec }) => {
            const [draft, setDraft] = useState(null); // пока человек печатает своё число, не навязываем границы
            const commit = () => { if (draft !== null) { if (draft !== '' && isFinite(Number(draft))) onSec(clampTimer(draft)); setDraft(null); } };
            const step = (d) => { SoundFX.click(); setDraft(null); onSec(clampTimer(sec + d)); };
            const pct = ((Math.max(TIMER_MIN, Math.min(TIMER_MAX, sec)) - TIMER_MIN) / (TIMER_MAX - TIMER_MIN)) * 100;
            return (
                <section className={`fx-card ${on ? 'is-on' : ''}`}>
                    <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="fx-ico">⏱</span>
                        <div className="flex-1 min-w-0"><div className="text-sm font-bold text-white">{tr("Таймер на ответ")}</div><div className="text-xs text-zinc-400 leading-snug">{tr("Не успел — наказание, и ход переходит дальше")}</div></div>
                        <SettingSwitch on={on} onChange={onToggle} label={tr("Таймер на ответ")} />
                    </div>
                    {on && (
                        <div className="fx-body fade-in">
                            <div className="timer-stepper">
                                <button type="button" className="btn-icon timer-step" aria-label={tr("Меньше на 5 секунд")} disabled={sec <= TIMER_MIN} onClick={() => step(-5)}>−</button>
                                <div className="timer-readout">
                                    <input type="number" inputMode="numeric" min={TIMER_MIN} max={TIMER_MAX} aria-label={tr("Секунд на ответ")} value={draft !== null ? draft : sec} style={{ width: `${Math.max(1, String(draft !== null ? draft : sec).length) + 0.5}ch` }} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); e.target.blur(); } }} className="timer-num font-display" />
                                    <span className="timer-unit">{tr("сек")}</span>
                                </div>
                                <button type="button" className="btn-icon timer-step" aria-label={tr("Больше на 5 секунд")} disabled={sec >= TIMER_MAX} onClick={() => step(5)}>+</button>
                            </div>
                            <div className="text-xs text-zinc-400 text-center -mt-1">{timerCaption(sec)}{sec >= 60 ? ` · ${fmtSec(sec)}` : ''}</div>
                            <input type="range" min={TIMER_MIN} max={TIMER_MAX} step="5" value={sec} onChange={e => { setDraft(null); onSec(clampTimer(e.target.value)); }} aria-label={tr("Время на ответ, секунд")} className="timer-range" style={{ '--p': pct + '%' }} />
                            <div className="timer-presets" role="group" aria-label={tr("Быстрый выбор времени")}>
                                {TIMER_PRESETS.map(p => ( <button key={p} type="button" aria-pressed={sec === p} onClick={() => { SoundFX.click(); setDraft(null); onSec(p); }} className={`chip ${sec === p ? 'is-on' : ''}`}>{p} {tr("с")}</button> ))}
                            </div>
                        </div>
                    )}
                </section>
            );
        };
        const BASE_CATEGORIES = CATEGORIES.slice();
        const TOPICS_CACHE_KEY = "askme_topics_cache_v1";
        const readTopicsCache = () => {
            try {
                const p = JSON.parse(localStorage.getItem(TOPICS_CACHE_KEY) || 'null');
                if (p && typeof p === 'object') return { custom: (p.custom && typeof p.custom === 'object') ? p.custom : {}, order: Array.isArray(p.order) ? p.order : Object.values(p.order || {}) };
            } catch (e) {}
            return { custom: {}, order: [] };
        };
        const applyTopics = (data) => {
            const custom = data && data.custom && typeof data.custom === 'object'
                ? Object.values(data.custom).filter(c => c && typeof c.id === 'string' && typeof c.name === 'string' && c.name.trim()).map(c => ({ id: c.id, name: String(c.name).slice(0, 30), icon: String(c.icon || '✨').slice(0, 16), custom: true }))
                : [];
            const all = [...BASE_CATEGORIES, ...custom.filter(c => !BASE_CATEGORIES.some(b => b.id === c.id))];
            const baseIdx = new Map(all.map((c, i) => [c.id, i]));
            const orderArr = data && data.order ? (Array.isArray(data.order) ? data.order : Object.values(data.order)) : [];
            const rank = new Map(); orderArr.forEach((id, i) => { if (typeof id === 'string' && !rank.has(id)) rank.set(id, i); });
            all.sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 1000 + baseIdx.get(a.id)) - (rank.has(b.id) ? rank.get(b.id) : 1000 + baseIdx.get(b.id)));
            CATEGORIES.splice(0, CATEGORIES.length, ...all);
        };
        applyTopics(readTopicsCache());
        const TopicReorderList = ({ items, onChange }) => {
            const [dragId, setDragId] = React.useState(null);
            const listRef = React.useRef(null);
            const move = (from, to) => {
                if (to < 0 || to >= items.length || from === to) return;
                const next = items.slice(); const [it] = next.splice(from, 1); next.splice(to, 0, it); onChange(next);
            };
            const onDown = (e, id) => { e.preventDefault(); try { listRef.current.setPointerCapture(e.pointerId); } catch (err) {} setDragId(id); };
            const onMove = (e) => {
                if (!dragId || !listRef.current) return;
                const rows = [...listRef.current.querySelectorAll('[data-topic-id]')].filter(r => r.dataset.topicId !== dragId);
                let target = 0; rows.forEach(r => { const b = r.getBoundingClientRect(); if (e.clientY > b.top + b.height / 2) target++; });
                const from = items.findIndex(c => c.id === dragId);
                if (from >= 0 && target !== from) move(from, target);
            };
            const onUp = () => setDragId(null);
            return (
                <ul ref={listRef} className="flex flex-col gap-1.5" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                    {items.map((c, i) => (
                        <li key={c.id} data-topic-id={c.id} className={`flex items-center gap-1.5 rounded-xl border px-1.5 py-1 transition-colors ${dragId === c.id ? 'border-rose-500/60 bg-rose-500/10' : 'border-white/10 bg-white/[0.04]'}`}>
                            <button type="button" aria-label={tf("Перетащить тему «{v0}»", { v0: catLabel(c.id, c.name) })} onPointerDown={e => onDown(e, c.id)} style={{ touchAction: 'none' }} className="btn-icon plain cursor-grab">⠿</button>
                            <span aria-hidden="true" className="text-lg">{c.icon}</span>
                            <span className="flex-1 min-w-0 text-sm font-semibold text-white truncate">{catLabel(c.id, c.name)}</span>
                            <button type="button" aria-label={tr("Поднять выше")} disabled={i === 0} onClick={() => move(i, i - 1)} className="btn-icon plain">▲</button>
                            <button type="button" aria-label={tr("Опустить ниже")} disabled={i === items.length - 1} onClick={() => move(i, i + 1)} className="btn-icon plain">▼</button>
                        </li>
                    ))}
                </ul>
            );
        };
        const EMOJI_SETS = [
            ['Смайлы', '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😛 😜 🤪 🤔 🤫 🤭 😏 😒 🙄 😬 😌 😔 😴 🥱 😷 🥵 🥶 😵 🤯 🥳 😎 🤓 😕 😮 😲 😳 🥺 😢 😭 😱 😖 😤 😡 🤬 😈 👿 💀 👻 🤡 🫣 🫶'],
            ['Люди', '👋 ✋ 👌 🤌 ✌️ 🤞 🤟 🤘 👍 👎 👏 🙌 🙏 💪 👀 👅 👄 🧠 👶 🧒 👩 👨 🧑 👫 👭 👬 💏 💑 👪 💃 🕺 🧘 🏃 🙋 🤷 🤦'],
            ['Природа', '🌍 🌎 🌙 ⭐ ✨ 🔥 💧 🌈 ☀️ ⛅ ❄️ 🌸 🌹 🌻 🌿 🍀 🌴 🌵 🍄 🐶 🐱 🦊 🐻 🐼 🦁 🐯 🐸 🐵 🦄 🐝 🦋 🐢 🐙 🐬 🦈'],
            ['Еда и дом', '🍷 🍸 🍺 🥂 ☕ 🍕 🍔 🍟 🌮 🍣 🍰 🍫 🍎 🍓 🍒 🥑 🏠 🛏️ 🛁 🔑 🚪 🕯️ 🛋️ 🎁 🎈 🎉 🎂 💍 💐'],
            ['Занятия', '🎬 🎤 🎧 🎮 🎲 🎯 🧩 🎭 🎨 📚 ✈️ 🚗 🏖️ ⛺ 🏔️ ⚽ 🏀 🎾 🏋️ 💼 💰 💎 📱 💻 📷 🔮 🧿'],
            ['Символы', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ❣️ 💕 💞 💘 💝 💬 💭 ❓ ❗ ✅ ⚡ 🔞 ♾️ ⚖️ ⏳ 🔒 🕊️ 🚩']
        ];
        const SummaryRing = ({ frac, children }) => {
            const [ready, setReady] = React.useState(false);
            React.useEffect(() => { const t = setTimeout(() => setReady(true), 140); return () => clearTimeout(t); }, []);
            const C = 339.29;
            return (
                <div className="relative w-[176px] h-[176px]">
                    <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden="true">
                        <defs><linearGradient id="sumGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fb7185"></stop><stop offset="100%" stopColor="#f43f5e"></stop></linearGradient></defs>
                        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7"></circle>
                        <circle cx="60" cy="60" r="54" fill="none" stroke="url(#sumGrad)" strokeWidth="7" strokeLinecap="round" transform="rotate(-90 60 60)" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - (ready ? frac : 0)), transition: 'stroke-dashoffset 1.3s cubic-bezier(0.22, 1, 0.36, 1)', filter: 'drop-shadow(0 0 6px rgba(244,63,94,0.55))' }}></circle>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
                </div>
            );
        };
        const SummaryBars = ({ rows, total }) => {
            const [ready, setReady] = React.useState(false);
            React.useEffect(() => { const t = setTimeout(() => setReady(true), 220); return () => clearTimeout(t); }, []);
            return (
                <div className="flex flex-col gap-4">
                    {rows.map(r => (
                        <div key={r.label}>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className={`font-bold text-xs ${r.cls}`}>{r.label}</span>
                                <span className="font-display text-xl font-bold text-white"><AnimatedCounter target={r.count} /></span>
                            </div>
                            <div className="h-2 rounded-full bg-white/[0.07] overflow-hidden">
                                <div className={`h-full rounded-full ${r.bar}`} style={{ width: ready ? `${Math.round((r.count / Math.max(1, total)) * 100)}%` : '0%', transition: 'width 1s cubic-bezier(0.22, 1, 0.36, 1)' }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            );
        };
        const SummaryConfetti = () => {
            const items = React.useMemo(() => Array.from({ length: 26 }, (_, i) => {
                const r = (n) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
                return { left: Math.round(r(1) * 100), dx: Math.round((r(2) - 0.5) * 120), dur: (3.6 + r(3) * 3).toFixed(2), delay: (r(4) * 1.4).toFixed(2), size: 14 + Math.round(r(5) * 10), glyph: ['❤️', '✨', '🎉', '💬', '🔥', '🫶'][i % 6] };
            }), []);
            return (
                <div className="confetti-layer absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
                    {items.map((c, i) => ( <span key={i} className="confetti-piece" style={{ left: c.left + '%', fontSize: c.size, '--dx': c.dx + 'px', '--dur': c.dur + 's', '--delay': c.delay + 's' }}>{c.glyph}</span> ))}
                </div>
            );
        };
        const fmtDur = (sec) => { sec = Math.round(sec || 0); if (sec < 60) return sec + ' ' + tr('с'); const m = Math.floor(sec / 60); return m + ' ' + tr('мин') + (sec % 60 ? ' ' + (sec % 60) + ' ' + tr('с') : ''); };
        const fmtDate = (ts) => { try { return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
        const gamesOf = (rec) => Object.values((rec && rec.games) || {}).filter(g => g && typeof g === 'object').sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
        // Порог аналитики: в сводку идут игры, где отвечено не меньше AN_MIN вопросов, и все полностью пройденные колоды. Задаёт владелец.
        const SESSION_PAYLOAD_MAX = 59000; // правило базы для sessions/$sid/payload: короче 60000 знаков (копия правила: tests/fixtures/sessions-rules.json). Поднимаете правило — поднимите и это число (на 1000 меньше)
        const sessionStore = createSessionStore({ request: fetchWithTimeout,
            urlFor: async key => `${FIREBASE_BASE_URL}/sessions/${await sessionDbKey(key)}.json`,
            encrypt: encryptSessionAES, decrypt: decryptSessionAES, maxPayload: SESSION_PAYLOAD_MAX });
        const AN_MIN_KEY = 'askme_an_min_v1', AN_MIN_DEFAULT = 50, AN_FLOOR = 10, AN_MIN_CHOICES = [0, 10, 20, 30, 50, 100];
        const readAnMin = () => { try { const raw = localStorage.getItem(AN_MIN_KEY); const n = raw === null ? NaN : Number(raw); return Number.isFinite(n) && n >= 0 ? Math.min(1000, Math.round(n)) : AN_MIN_DEFAULT; } catch (e) { return AN_MIN_DEFAULT; } };
        const gameCounts = (g, min) => !!g && typeof g === 'object' && (g.complete === 1 || g.complete === true || (Number(g.answered) || 0) >= min);
        const filterAnalytics = (data, min) => { const out = {}; Object.entries(data || {}).forEach(([aid, rec]) => { if (!rec || typeof rec !== 'object') return; const games = {}; Object.entries(rec.games || {}).forEach(([gid, g]) => { if (gameCounts(g, min)) games[gid] = g; }); if (Object.keys(games).length) out[aid] = { ...rec, games }; }); return out; };
        const countAnalyticsGames = (data) => Object.values(data || {}).reduce((a, r) => a + Object.values((r && r.games) || {}).filter(g => g && typeof g === 'object').length, 0);
        const buildGameReports = ({ log, players, questions, history, total, customs, now, complete, partial }) => {
            const answeredIds = [], skippedIds = [], byCat = {}, byLevel = {};
            const per = (players || []).map(p => ({ id: p.id, name: String(p.name || '').slice(0, 25), answered: 0, skipped: 0 }));
            let answered = 0, skipped = 0;
            (questions || []).slice(0, total).forEach((q, i) => {
                const e = normTurn(history[i]); const qid = String(q.id || q.dbKey || i);
                if (!e || e.cur || !(players || []).length || !players.every(p => e.answered.includes(p.id))) return;
                if (e && isTurnSkipped(e, players)) { skipped++; if (skippedIds.length < 400) skippedIds.push(qid); }
                else { answered++; if (answeredIds.length < 400) answeredIds.push(qid); byCat[q.categoryId] = (byCat[q.categoryId] || 0) + 1; byLevel[q.level] = (byLevel[q.level] || 0) + 1; }
                if (e) e.answered.forEach(id => { const r = per.find(x => x.id === id); if (!r) return; if (e.skippedBy.includes(id)) r.skipped++; else r.answered++; });
            });
            const d = log.durations || [];
            const anonGame = { startedAt: log.startedAt, endedAt: now, durationSec: Math.max(0, Math.round((now - log.startedAt) / 1000)), mode: log.mode, timerSec: log.timerSec || 0, punishOn: !!log.punishOn, players: per.length, answered, skipped, avgAnswerSec: d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : 0, byCat, byLevel, answeredIds, skippedIds, punishCount: (log.punishments || []).length, punishTpl: (log.punishments || []).filter(p => p.tpl).map(p => p.t).slice(0, 50), ...(complete ? { complete: 1 } : {}), ...(partial ? { partial: 1 } : {}) };
            const fullGame = { ...anonGame, perPlayer: per.map(r => ({ name: r.name, answered: r.answered, skipped: r.skipped })), punishAll: (log.punishments || []).map(p => p.t).slice(0, 50), customPunishments: (customs || []).slice(0, 60) };
            return { anonGame, fullGame };
        };
        const aggregateAnalytics = (anon) => {
            const recs = Object.values(anon || {}).filter(r => r && typeof r === 'object'); const games = recs.flatMap(r => gamesOf(r));
            const sum = (f) => games.reduce((a, g) => a + (Number(f(g)) || 0), 0); const n = games.length || 1;
            const cat = {}, lvl = {}, skip = {}, pun = {};
            games.forEach(g => { Object.entries(g.byCat || {}).forEach(([k, v]) => { cat[k] = (cat[k] || 0) + v; }); Object.entries(g.byLevel || {}).forEach(([k, v]) => { lvl[k] = (lvl[k] || 0) + v; }); (g.skippedIds || []).forEach(id => { skip[id] = (skip[id] || 0) + 1; }); (g.punishTpl || []).forEach(t => { pun[t] = (pun[t] || 0) + 1; }); });
            const top = (o, k = 6) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k);
            const withAnswerTime = games.filter(g => g.avgAnswerSec > 0);
            const answered = sum(g => g.answered), skipped = sum(g => g.skipped);
            return { sessions: recs.length, games: games.length, avgPlayers: games.length ? sum(g => g.players) / n : 0, avgAnswered: games.length ? answered / n : 0, avgDuration: games.length ? sum(g => g.durationSec) / n : 0, avgAnswerSec: withAnswerTime.length ? withAnswerTime.reduce((a, g) => a + g.avgAnswerSec, 0) / withAnswerTime.length : 0, skipRate: (answered + skipped) ? skipped / (answered + skipped) : 0, hardShare: games.length ? games.filter(g => g.mode === 'hard').length / n : 0, timerShare: games.length ? games.filter(g => g.timerSec > 0).length / n : 0, avgTimer: games.filter(g => g.timerSec > 0).length ? games.filter(g => g.timerSec > 0).reduce((a, g) => a + g.timerSec, 0) / games.filter(g => g.timerSec > 0).length : 0, topCats: top(cat), levels: lvl, topSkipped: top(skip, 5), topPunish: top(pun, 5), punishShown: sum(g => g.punishCount) };
        };
        const DECK_ARC = 24;
        const SHARP_CATS = ['intimacy'];
        const deckWeight = (q, t) => {
            const bell = Math.exp(-Math.pow((t - 0.5) / 0.2, 2));
            const lv = q.level === 'Глубокие' ? 0.25 + 1.75 * bell : q.level === 'Средние' ? 1 + 0.3 * bell : 1.6 - 1.0 * bell;
            return lv * (SHARP_CATS.includes(q.categoryId) ? 0.6 + 0.8 * bell : 1);
        };
        const buildDeck = (pool, rnd = Math.random) => {
            const buckets = new Map();
            pool.forEach(q => { const k = q.categoryId + '|' + q.level; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(q); });
            buckets.forEach(arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } });
            const keys = [...buckets.keys()], deck = [], left = {};
            pool.forEach(q => { left[q.categoryId] = (left[q.categoryId] || 0) + 1; });
            for (let i = 0; i < pool.length; i++) {
                const t = (i % DECK_ARC) / (DECK_ARC - 1);
                const last = deck[i - 1], prev = deck[i - 2];
                const blocked = last && prev && last.categoryId === prev.categoryId ? last.categoryId : null;
                let cands = keys.filter(k => buckets.get(k).length > 0 && buckets.get(k)[0].categoryId !== blocked);
                // хвост колоды: если одна тема заняла больше 2/3 оставшихся вопросов, без «тройки» подряд уже не расставить — берём её сразу
                const n = pool.length - i; let urgent = null; for (const c in left) if (left[c] * 3 + 6 > 2 * n && left[c] > 1) urgent = c;
                if (urgent && urgent !== blocked) { const forced = keys.filter(k => buckets.get(k).length > 0 && buckets.get(k)[0].categoryId === urgent); if (forced.length) cands = forced; }
                if (cands.length === 0) cands = keys.filter(k => buckets.get(k).length > 0);
                let sum = 0; const w = cands.map(k => { const arr = buckets.get(k); const x = arr.length * deckWeight(arr[0], t); sum += x; return x; });
                let r = rnd() * sum, pick = cands[cands.length - 1];
                for (let c = 0; c < cands.length; c++) { r -= w[c]; if (r <= 0) { pick = cands[c]; break; } }
                const picked = buckets.get(pick).pop(); left[picked.categoryId]--; deck.push(picked);
            }
            return deck;
        };
        const SCREEN_TITLES = { hidden_q: 'Скрытые вопросы — ASK ME', analytics: 'Аналитика — ASK ME', analytics_sessions: 'Сессии — Аналитика — ASK ME', app_menu: 'Меню — ASK ME', game_setup: 'Усложнённый режим — ASK ME', topics_admin: 'Управление темами — ASK ME', punish_admin: 'Шаблоны наказаний — ASK ME', tod_admin: 'Карточки — Правда или действие — ASK ME', tod_lobby: 'Правда или действие — ASK ME', tod_play: 'Игра — Правда или действие — ASK ME', tod_results: 'Итоги — Правда или действие — ASK ME', onboarding: 'ASK ME — начните игру', session_created: 'Сессия создана — ASK ME', menu: 'ASK ME — откровенные разговоры для двоих и компании', profile_page: 'Игроки и сессия — ASK ME', admin_login: 'Вход для владельца — ASK ME', mode_select: 'Режим игры — ASK ME', game: 'Игра — ASK ME', ai_response: 'Совет и ситуация — ASK ME', summary: 'Итоги игры — ASK ME', cat_list: 'Все темы — ASK ME', q_list: 'Вопросы — ASK ME', archive_page: 'Архив вопросов — ASK ME', add_q: 'Новый вопрос — ASK ME', edit_q: 'Редактирование вопроса — ASK ME', invite: 'Пригласить игроков — ASK ME', join: 'Присоединиться к игре — ASK ME', about: 'Об игре — ASK ME', privacy: 'Политика конфиденциальности — ASK ME', terms: 'Пользовательское соглашение — ASK ME', cookies: 'Cookies и локальное хранилище — ASK ME', age: 'Возраст и откровенный контент — ASK ME', copyright: 'Авторские права — ASK ME' };
        const GROUP_EMOJIS = ['😈', '🤫', '😋', '🤔', '🤪', '😏', '😱', '🫣'];
        const MAX_PLAYERS = 10;
        const LIVE_POLL_MS = 1000, LIVE_INVITE_MS = 3000, LIVE_BEAT_MS = 8000, LIVE_ALIVE_MS = 30000, LIVE_STALE_MS = 120000, LIVE_TAKEOVER_S = 6, LIVE_TAKEOVER_STEP_S = 4, LIVE_TAP_GUARD_MS = 500, LIVE_SOLO_MS = 2000, LIVE_JOIN_WAIT_MS = 15000, LIVE_MAX_DEVICES = MAX_PLAYERS;
        // в одной партии устройств не больше, чем игроков в сессии (но не больше LIVE_MAX_DEVICES): каждое подключившееся устройство — это игрок
        // snap — снимок комнаты: у присоединяющегося копия сессии может отставать от хозяйской, поэтому берём большее из своих игроков и игроков в комнате
        const deviceCap = (prof, snap) => { let n = ((prof && prof.players) || []).length; try { const pl = snap && typeof snap.pl === 'string' ? JSON.parse(snap.pl) : null; if (Array.isArray(pl)) n = Math.max(n, pl.length); } catch (e) {} return Math.min(LIVE_MAX_DEVICES, Math.max(2, n)); };
        const clampIdx = (v, n) => Math.max(0, Math.min(n - 1, Math.floor(Number(v) || 0))); // индекс вопроса из комнаты — только внутри колоды
        const liveHash = (idx, max, hist) => idx + '|' + max + '|' + hist;
        // короткий «отпечаток» колоды: по нему устройства узнают, что у них одна и та же партия, не скачивая всю колоду
        const liveDeckKey = (idsStr) => { let h = 2166136261; for (let i = 0; i < idsStr.length; i++) { h ^= idsStr.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return idsStr.split(',').length + '-' + h.toString(36); };
        // дробная часть помогает упорядочить устройства; атомарность обеспечивает серверный ETag/If-Match
        const liveFrac = (id) => { let h = 0; String(id).split('').forEach(ch => { h = (h * 31 + ch.charCodeAt(0)) % 999983; }); return (h + 1) / 1000000; };
        const liveVerNext = (prev, id) => Math.floor(Number(prev) || 0) + 1 + liveFrac(id);
        // версия первой записи новой партии отсчитывается от времени (десятые доли секунды): так она заведомо не совпадёт с версиями прошлых партий в этой комнате,
        // и устройства, ещё сидящие в старой партии, заметят, что в комнате что-то поменялось
        const liveVerStart = (id, now = Date.now()) => liveVerNext(Math.floor(now / 100), id);
        // кто сейчас в игре: отметки присутствия {устройство: время}; «живое» — отметка моложе 30 с, мусор старше 2 мин убирается
        const liveAlive = (p, now, selfId) => {
            const alive = [], stale = [];
            Object.entries(p && typeof p === 'object' ? p : {}).forEach(([id, ts]) => { const t = Number(ts); if (!isFinite(t)) { stale.push(id); return; } const age = now - t; if (age <= LIVE_ALIVE_MS) alive.push(id); else if (age > LIVE_STALE_MS) stale.push(id); });
            return { alive, others: alive.filter(id => id !== selfId), stale };
        };
        // история ходов в базе ограничена по размеру: если не влезает, отбрасываем самые старые записи
        const liveHistStr = (hist) => {
            const h = { ...(hist || {}) }; let str = JSON.stringify(h);
            if (str.length <= 28000) return str;
            Object.keys(h).map(Number).sort((a, b) => a - b).some(k => { delete h[k]; str = JSON.stringify(h); return str.length <= 28000; });
            return str;
        };
        const liveRoomKey = async (key) => { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('askme-live-v1:' + key))); return 'l_' + Array.from(h).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40); };
        // короткий випадковий ID з криптографічного генератора (ID пристрою й ходу видно іншим гравцям кімнати)
        const randId = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => (b % 36).toString(36)).join('');
        const makeDeviceId = () => { const rnd = () => randId(8); try { let v = sessionStorage.getItem('askme_dev_v1'); if (!v) { v = rnd(); sessionStorage.setItem('askme_dev_v1', v); } return v; } catch (e) { return rnd(); } };
        const normTurn = (e) => {
            if (!e) return null;
            if (typeof e === 'string') return { cur: e, answered: [], skippedBy: [], skippedAll: false };
            if (Array.isArray(e)) return { cur: null, answered: e.map(p => p && p.id).filter(Boolean), skippedBy: [], skippedAll: false };
            return { cur: e.cur || null, answered: Array.isArray(e.answered) ? e.answered : [], skippedBy: Array.isArray(e.skippedBy) ? e.skippedBy : [], skippedAll: !!e.skippedAll };
        };
        const isTurnSkipped = (e, players) => !!e && !e.cur && (e.skippedAll || (players.length > 0 && players.every(p => e.skippedBy.includes(p.id))));
        const nextTurnStep = (rawEntry, players) => {
            const e = normTurn(rawEntry);
            if (!e || !e.cur) return null;
            const answered = [...e.answered, e.cur];
            const remaining = players.filter(p => !answered.includes(p.id));
            if (remaining.length === 0) return { type: 'done', entry: { cur: null, answered, skippedBy: e.skippedBy, skippedAll: false } };
            if (remaining.length === 1) return { type: 'auto', entry: { cur: remaining[0].id, answered, skippedBy: e.skippedBy, skippedAll: false }, player: remaining[0] };
            return { type: 'spin', answered, skippedBy: e.skippedBy, candidates: remaining };
        };
        const REEL = { CARD: 84, GAP: 8, TARGET: 30, TRAVEL: 22 };
        const reelTarget = (k, winnerIdx) => REEL.TARGET + ((winnerIdx - (REEL.TARGET % k)) % k + k) % k;
        const reelGeometry = (w, tIndex, jit = 0) => {
            const stride = REEL.CARD + REEL.GAP;
            const final = w / 2 - (tIndex * stride + REEL.CARD / 2) + jit;
            return { t: tIndex, final, start: final - REEL.TRAVEL * stride };
        };
        const TurnReel = ({ players, winnerId, spinning }) => {
            const k = Math.max(1, players.length);
            const t = reelTarget(k, Math.max(0, players.findIndex(p => p.id === winnerId)));
            const wrapRef = React.useRef(null);
            const [pos, setPos] = React.useState({ x: 0, anim: false, ready: false });
            React.useLayoutEffect(() => {
                const w = wrapRef.current ? wrapRef.current.getBoundingClientRect().width : 300;
                const g = reelGeometry(w, t, (Math.random() - 0.5) * REEL.CARD * 0.5);
                const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                if (reduce) { setPos({ x: g.final, anim: false, ready: true }); return; }
                setPos({ x: g.start, anim: false, ready: true });
                let r2;
                const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setPos({ x: g.final, anim: true, ready: true })); });
                return () => { cancelAnimationFrame(r1); if (r2) cancelAnimationFrame(r2); };
            }, []);
            return (
                <div ref={wrapRef} className="relative w-full h-[112px] overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04]">
                    <div className="absolute top-0 bottom-0 left-0 flex items-center" style={{ gap: REEL.GAP, transform: `translate3d(${pos.x}px,0,0)`, transition: pos.anim ? 'transform 2.2s cubic-bezier(0.08,0.6,0.12,1)' : 'none', willChange: 'transform', opacity: pos.ready ? 1 : 0 }}>
                        {Array.from({ length: t + 8 }, (_, i) => {
                            const p = players[i % k];
                            const win = !spinning && i === t;
                            return (
                                <div key={i} style={{ width: REEL.CARD, flex: '0 0 auto' }} className={`h-[92px] rounded-xl border flex flex-col items-center justify-center gap-1 transition-all duration-300 ${win ? 'bg-rose-500/15 border-rose-500 scale-105' : 'bg-white/[0.04] border-white/10'} ${(!spinning && !win) ? 'opacity-35' : ''}`}>
                                    <span className="text-2xl">{p.gender === 'guy' ? '👨' : '👩'}</span>
                                    <span className="text-xs font-bold text-white truncate max-w-[72px]">{p.name}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black/60 to-transparent" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black/60 to-transparent" />
                    <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.9)]" />
                </div>
            );
        };

        const SessionIdBadge = ({ sessionId, sessionKey, onCopy, size = "sm" }) => {
            const [copied, setCopied] = useState(false); if (!sessionId) return null;
            const handleCopyClick = async (e) => { e.stopPropagation(); SoundFX.success(); await copyTextToClipboard(sessionKey ? `${window.location.origin}${window.location.pathname}#/welcome?sid=${sessionId}&key=${sessionKey}` : sessionId); setCopied(true); if (onCopy) onCopy("Ссылка для входа скопирована!"); setTimeout(() => setCopied(false), 2000); };
            if (size === "lg") {
                return (
                    <div className="w-full p-5 rounded-[20px] bg-[#13111a] border border-white/10 flex items-center gap-4 shadow-lg">
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <span className="text-xs font-bold text-zinc-500">{tr("ID вашей сессии")}</span>
                            <span className="font-display text-[26px] leading-tight font-bold text-white tracking-[0.06em] break-all">{sessionId}</span>
                            <span className="text-xs text-zinc-400">{tr("Для восстановления прогресса при выходе")}</span>
                        </div>
                        <button type="button" onClick={handleCopyClick} aria-label={tr("Скопировать")} className={`btn-icon flex-shrink-0 ${copied ? 'is-on' : ''}`}>{copied ? <Icons.Check /> : <Icons.Copy />}</button>
                    </div>
                );
            }
            return (
                <button type="button" onClick={handleCopyClick} title={tr("Копировать ID")} className={`btn-sm ${ copied ? 'btn-accent' : 'btn-secondary' }`} > <span className="text-zinc-500 font-semibold">ID:</span> <span className="text-rose-300">{sessionId}</span> <span className="text-zinc-400">{copied ? <Icons.Check /> : <Icons.Copy />}</span> </button>
            );
        };

        const AskMeLogo = ({ size = "lg", onClick = null }) => {
            if (size === "xs") return ( <div onClick={onClick} className={`inline-flex items-center gap-1.5 select-none ${onClick ? 'cursor-pointer' : ''}`}> <span className="w-2 h-2 rounded-full bg-rose-600"></span> <span className="font-display text-sm font-extrabold uppercase tracking-[0.14em] text-white"> ASK<span className="text-rose-500 ml-0.5">ME</span> </span> </div> );
            if (size === "md") return ( <div onClick={onClick} className={`inline-flex items-center gap-2.5 select-none ${onClick ? 'cursor-pointer' : ''}`}> <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center"> <svg className="w-4 h-4 text-rose-500" viewBox="0 0 24 24" fill="currentColor"> <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/> </svg> </div> <span className="font-display text-3xl font-extrabold uppercase tracking-[0.1em] text-white"> ASK<span className="text-rose-500 ml-1">ME</span> </span> </div> );
            return ( <div onClick={onClick} className={`inline-flex flex-col items-center select-none ${onClick ? 'cursor-pointer' : ''}`}> <div className="flex items-center gap-3.5"> <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-[0_8px_28px_rgba(225,29,72,0.4)] pulse-soft"> <svg className="w-5 h-5 md:w-6 md:h-6 text-white" viewBox="0 0 24 24" fill="currentColor"> <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/> </svg> </div> <div className="font-display text-[32px] md:text-5xl font-extrabold tracking-[0.05em] text-white leading-none flex items-center"> <span>ASK</span> <span className="text-rose-500 ml-2">ME</span> </div> </div> </div> );
        };

        // ---- Десктопная версия (от 1024 px): верхняя панель, расширенный подвал и «живые» эффекты; на телефоне и в тестах ничего этого нет ----
        const DESK_MQ = '(min-width: 1024px)';
        const useIsDesktop = () => {
            const read = () => { try { return !!(window.matchMedia && window.matchMedia(DESK_MQ).matches); } catch (e) { return false; } };
            const [on, setOn] = useState(read);
            useEffect(() => {
                let mq = null; try { mq = window.matchMedia(DESK_MQ); } catch (e) { return undefined; }
                if (!mq || typeof mq.addEventListener !== 'function') return undefined;
                const h = () => setOn(!!mq.matches); h(); mq.addEventListener('change', h);
                return () => mq.removeEventListener('change', h);
            }, []);
            return on;
        };
        // верхняя панель живёт в отдельном корне (#desk-root), поэтому состояние приложения передаётся ей через маленькое хранилище: приложение кладёт значения, панель подписана
        const deskStore = { s: { screen: '', hasProfile: false, sessionId: '', sessionKey: '', players: [], muted: false, lang: 'uk' }, subs: new Set(), api: {} };
        deskStore.set = (patch) => {
            if (Object.keys(patch).every(k => Object.is(deskStore.s[k], patch[k]))) return;
            deskStore.s = { ...deskStore.s, ...patch }; deskStore.subs.forEach(f => f());
        };
        const useDeskState = () => { const [, bump] = useState(0); useEffect(() => { const f = () => bump(n => n + 1); deskStore.subs.add(f); return () => { deskStore.subs.delete(f); }; }, []); return deskStore.s; };
        const DESK_HIDE = ['game', 'ai_response', 'summary', 'tod_play', 'tod_results']; // экраны партии: панели нет, чтобы не уйти из игры случайным нажатием
        const DESK_GROUPS = { home: ['menu', 'profile_page'], play: ['mode_select', 'game_setup', 'tod_lobby'], questions: ['cat_list', 'q_list', 'archive_page', 'add_q', 'edit_q', 'hidden_q'], about: ['about'] };
        const DesktopNav = () => {
            const desk = useIsDesktop(); const st = useDeskState();
            const show = desk && !!st.screen && !DESK_HIDE.includes(st.screen);
            useEffect(() => { const root = document.documentElement; if (show) root.dataset.nav = '1'; else delete root.dataset.nav; return () => { delete root.dataset.nav; }; }, [show]);
            if (!show) return null;
            const api = deskStore.api; const go = (id) => { SoundFX.click(); if (api.navigate) api.navigate(id); };
            const on = (g) => DESK_GROUPS[g].includes(st.screen);
            const link = (g, id, label) => <li key={g}><button type="button" onClick={() => go(id)} aria-current={on(g) ? 'page' : undefined} className={`desk-link ${on(g) ? 'is-on' : ''}`}>{label}</button></li>;
            return (
                <nav className="desk-nav" aria-label={tr("Основная навигация")}>
                    <div className="desk-nav-in">
                        <AskMeLogo size="md" onClick={() => go(st.hasProfile ? 'menu' : 'about')} />
                        <ul className="desk-links">
                            {st.hasProfile && link('home', 'menu', tr("Главная"))}
                            {st.hasProfile && link('play', 'mode_select', tr("Играть"))}
                            {st.hasProfile && link('questions', 'cat_list', tr("Вопросы"))}
                            {link('about', 'about', tr("Об игре"))}
                        </ul>
                        <div className="desk-nav-right">
                            {st.hasProfile && st.players.length > 0 && <span className="desk-players" title={st.players.map(p => p.name).join(', ')}>{st.players.map(p => p.name).join(' · ')}</span>}
                            {st.hasProfile && <SessionIdBadge sessionId={st.sessionId} sessionKey={st.sessionKey} onCopy={api.showToast} />}
                            <button type="button" onClick={() => api.toggleMute && api.toggleMute()} aria-label={st.muted ? tr("Включить звук") : tr("Выключить звук")} title={st.muted ? tr("Включить звук") : tr("Выключить звук")} className="btn-icon">{st.muted ? <Icons.SoundOff /> : <Icons.SoundOn />}</button>
                            <LangMenu lang={st.lang} onChange={(l) => api.changeLang && api.changeLang(l)} />
                            {st.hasProfile && <button type="button" onClick={() => go('app_menu')} className="btn-secondary btn-sm"><span>{tr("Меню")}</span><Icons.Menu /></button>}
                        </div>
                    </div>
                </nav>
            );
        };
        // эффекты мыши только на компьютере с точным указателем: мягкий прожектор света за курсором, лёгкий параллакс узоров фона, наклон карточек выбора
        const DesktopFx = () => {
            const desk = useIsDesktop();
            useEffect(() => {
                if (!desk) return undefined;
                let fine = false; try { fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}
                const reduce = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
                if (!fine || reduce) return undefined;
                const root = document.documentElement; root.dataset.fx = '1';
                const bg = document.querySelector('.bg-room'); let raf = 0, mx = 0, my = 0, tiltEl = null;
                const paint = () => { raf = 0; if (!bg) return; bg.style.setProperty('--mx', mx + 'px'); bg.style.setProperty('--my', my + 'px'); bg.style.setProperty('--px', (mx / window.innerWidth - 0.5).toFixed(3)); bg.style.setProperty('--py', (my / window.innerHeight - 0.5).toFixed(3)); };
                const reset = (el) => { if (!el) return; ['--rx', '--ry', '--gx', '--gy'].forEach(k => el.style.removeProperty(k)); };
                const move = (e) => {
                    mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(paint);
                    const t = e.target && e.target.closest ? e.target.closest('.opt-card:not(:disabled)') : null;
                    if (t !== tiltEl) { reset(tiltEl); tiltEl = t; }
                    if (t) { const r = t.getBoundingClientRect(); const px = (e.clientX - r.left) / Math.max(r.width, 1), py = (e.clientY - r.top) / Math.max(r.height, 1); t.style.setProperty('--ry', ((px - 0.5) * 7).toFixed(2) + 'deg'); t.style.setProperty('--rx', ((0.5 - py) * 5).toFixed(2) + 'deg'); t.style.setProperty('--gx', (px * 100).toFixed(1) + '%'); t.style.setProperty('--gy', (py * 100).toFixed(1) + '%'); }
                };
                const leave = () => { reset(tiltEl); tiltEl = null; };
                document.addEventListener('pointermove', move, { passive: true }); document.documentElement.addEventListener('pointerleave', leave);
                return () => { document.removeEventListener('pointermove', move); document.documentElement.removeEventListener('pointerleave', leave); cancelAnimationFrame(raf); reset(tiltEl); delete root.dataset.fx; };
            }, [desk]);
            return null;
        };

        // divider: тонкая линия над подвалом (на «Меню» и экранах начала игры не нужна); wide — под широкую вёрстку главной на компьютере
        const AppFooter = ({ noLinks = false, divider = true, wide = false }) => {
            const desk = useIsDesktop();
            if (desk) return (
                <footer className="desk-footer select-none z-10">
                    <div className="desk-footer-in">
                        <div className="desk-fcol desk-fbrand">
                            <AskMeLogo size="md" />
                            <p>{tr("Откровенные разговоры для двоих и компании. Играйте по взаимному согласию и берегите чужие границы.")}</p>
                            <span className="tag tag-rose">18+</span>
                        </div>
                        <nav className="desk-fcol" aria-label={tr("Игра")}><h2>{tr("Игра")}</h2><a href="#/">{tr("Главная")}</a><a href="#/topics">{tr("Все вопросы")}</a><a href="#/archive">{tr("Архив")}</a><a href="#/about">{tr("Об игре")}</a></nav>
                        <nav className="desk-fcol" aria-label={tr("Режимы")}><h2>{tr("Режимы")}</h2><a href="#/mode">{tr("Выберите режим")}</a><a href="#/setup">{tr("Усложнённый режим")}</a><a href="#/tod">{tr("Правда или действие")}</a><a href="#/invite">{tr("Пригласить игроков")}</a></nav>
                        <nav className="desk-fcol" aria-label={tr("Документы")}><h2>{tr("Документы")}</h2><a href="#/privacy">{tr("Конфиденциальность")}</a><a href="#/terms">{tr("Соглашение")}</a><a href="#/cookies">{tr("Cookies")}</a><a href="#/age">{tr("Возраст 18+")}</a><a href="#/copyright">{tr("© Авторские права")}</a></nav>
                    </div>
                    <div className="desk-footer-bar"><span>by <b>yedvinn</b></span><span>{tr("Подсказка: листать вопросы можно стрелками ← → на клавиатуре")}</span></div>
                </footer>
            );
            return (
            <footer className="w-full py-6 flex flex-col items-center justify-center gap-3 select-none z-10">
                {divider && <div aria-hidden="true" className={`footer-rule mb-3 ${wide ? 'is-wide' : ''}`}></div>}
                <div className="flex items-center justify-center gap-3 opacity-60 hover:opacity-100 transition-opacity"> <AskMeLogo size="xs" /> <span className="text-white/20 text-xs">•</span> <span className="text-xs text-zinc-400 font-semibold"> by <span className="text-rose-400">yedvinn</span> </span> </div>
                {!noLinks && <nav aria-label={tr("Информация")} className="footer-links"><a href="#/about">{tr("Об игре")}</a><a href="#/privacy">{tr("Конфиденциальность")}</a><a href="#/terms">{tr("Соглашение")}</a><a href="#/copyright">{tr("© Авторские права")}</a></nav>}
            </footer>
            );
        };

        // Состав сессии: имена игроков и устройства в комнате (первое — это устройство, остальные подключены). Спокойный блок, заметно тише кнопки «Поделиться»:
        // имена устройств в базе не хранятся, поэтому показываем игроков сессии и число устройств
        const RoomStrip = ({ players, devices }) => {
            const list = Array.isArray(players) ? players : []; const n = Math.max(1, Math.min(Number(devices) || 1, MAX_PLAYERS));
            return (
                <div className="room-strip" role="group" aria-label={tr("Состав сессии")}>
                    <ul className="room-strip-names">{list.map((p, i) => <li key={(p && p.id) || i}><span>{p && p.name}</span></li>)}</ul>
                    <div className="room-strip-dev">
                        <span className="room-pips" aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} className={i === 0 ? 'me' : 'on'}></i>)}</span>
                        <span>{n === 1 ? tr("Пока только это устройство") : tf("В игре {v0} {v1}", { v0: n, v1: declOfNum(n, ['устройство', 'устройства', 'устройств']) })}</span>
                    </div>
                </div>
            );
        };

        // Визначити, чи текст українською (за специфічними літерами).
        const looksUkrainian = (s) => /[іїєґІЇЄҐ]|ʼ/.test(String(s || ''));
        // Автопереклад короткого тексту (через src/ai/client.js: проксі → Pollinations). target: 'uk' | 'ru'. Повертає переклад або "".
        const translateText = async (text, target) => {
            const clean = String(text || '').replace(/^№\s*\d+\.\s*/, '').trim();
            if (!clean) return '';
            const { text: out } = await aiAsk({ type: 'translate', text: clean, to: target, lang: target });
            return out ? out.replace(/^\s*\d+[\.\)]\s*/, '').replace(/^["'«»\s]+|["'«»\s]+$/g, '').trim() : '';
        };
        // Побудувати пару {ru, uk} з уведеного адміном тексту (мова визначається автоматично).
        const buildBilingual = async (typed) => {
            const clean = String(typed || '').replace(/^№\s*\d+\.\s*/, '').trim();
            if (looksUkrainian(clean)) { const ru = await translateText(clean, 'ru'); return { ru: ru || clean, uk: clean }; }
            const uk = await translateText(clean, 'uk'); return { ru: clean, uk: uk || '' };
        };

        // «Ситуація» / «Порада»: питання й тема — мовою інтерфейсу, імена гравців не передаються (лише кількість); onChunk — текст потоком
        const fetchFromAI = async (promptType, questionText, catId, playersCount, signal, onChunk) => {
            const cleanQuestion = String(questionText || '').replace(/^№\s*\d+\.\s*/, '').trim(); const catObj = CATEGORIES.find(c => c.id === catId);
            const { text } = await aiAsk({ type: promptType === 'situation' ? 'situation' : 'advice', lang: getLang(), question: cleanQuestion, category: catObj ? catLabel(catObj.id, catObj.name) : '', players: playersCount }, { signal, onChunk });
            return text;
        };

        // нове питання для адмінки: текст мовою інтерфейсу, без повторів наявних
        const generateUniqueQuestionAI = async (targetCat, targetDiff, allExistingQuestions) => {
            const existingSet = new Set(allExistingQuestions.flatMap(q => [q.cleanText, q.cleanTextUk]).filter(Boolean).map(x => x.toLowerCase().trim()));
            for (let i = 0; i < 2; i++) {
                const { text } = await aiAsk({ type: 'question', lang: getLang(), category: catLabel(targetCat.id, targetCat.name), text: diffLabel(targetDiff.id, targetDiff.name) });
                const cleaned = String(text || '').replace(/^["«№\d\.\-\s]+|["»]+$/g, '').trim();
                if (cleaned.length > 10 && !existingSet.has(cleaned.toLowerCase())) return cleaned;
            }
            return '';
        };

        const reindexSequential = (items) => { return items.map((item, idx) => { const seqNum = idx + 1; const clean = item.cleanText || String(item.text || '').replace(/^№\s*\d+\.\s*/, '').trim(); return { ...item, num: seqNum, cleanText: clean, text: `№ ${seqNum}. ${clean}` }; }); };

        const AnimatedCounter = ({ target }) => { const [count, setCount] = useState(0); useEffect(() => { if (!target || target === 0) { setCount(0); return; } let current = 0; const stepTime = Math.max(5, Math.floor(900 / target)); const timer = setInterval(() => { current += 1; setCount(current); if (current >= target) clearInterval(timer); }, stepTime); return () => clearInterval(timer); }, [target]); return <span>{count}</span>; };

        // ============ Страницы: «Об игре», юридические документы, приглашение и быстрое подключение ============
        // Текст «Об игре» и документов лежит в src/content/*.js. Подстановки: {questions}, {topics#форма1,форма2,форма3}, {players}, {devices}.
        // текст «Об игре» за поточною мовою (uk — about-uk.js, ru — about.js)
        const aboutDoc = () => (getLang() === 'uk' ? ABOUT_UK : ABOUT);
        const aboutFill = (str, nums) => String(str).replace(/\{(\w+)(?:#([^}]+))?\}/g, (m, k, forms) => {
            if (nums[k] === undefined) return m; const v = String(nums[k]);
            if (!forms) return v; const f = forms.split(',').map(x => x.trim());
            return /^\d+$/.test(v) ? v + ' ' + declOfNum(Number(v), f) : v + ' ' + (f[2] || f[0]);
        });
        const siteUrl = (hash) => `${window.location.origin}${window.location.pathname}${hash}`;
        const inviteUrlFor = (prof) => (prof && isValidSessionIdFormat(prof.sessionId) && isValidAESKey(prof.sessionKey)) ? siteUrl(`#/join?sid=${prof.sessionId}&key=${prof.sessionKey}`) : '';
        // системное окно «Поделиться», а если его нет (компьютер, старый браузер) — копирование ссылки
        const shareOrCopy = async ({ title, text, url }, doneMsg, toast) => {
            if (navigator.share) { try { await navigator.share({ title, text, url }); return true; } catch (e) { if (e && e.name === 'AbortError') return false; } }
            await copyTextToClipboard(url); if (toast) toast(doneMsg); return true;
        };

        const PageHeader = ({ title, onBack, right = null }) => (
            <header className="w-full max-w-md flex items-center gap-3 pt-2">
                <button type="button" onClick={() => { SoundFX.click(); onBack(); }} aria-label={tr("Назад")} className="btn-icon flex-shrink-0"><Icons.Back /></button>
                <h1 className="flex-1 text-center text-lg font-bold text-white">{title}</h1>
                {right || <div className="w-11 flex-shrink-0" aria-hidden="true"></div>}
            </header>
        );

        // QR-код рисуется прямо в разметке (векторно), чтобы не зависеть от внешних сервисов и не отправлять ссылку-ключ в интернет
        const QrSvg = ({ text, label }) => {
            const model = useMemo(() => { try { const qr = qrcode(0, 'M'); qr.addData(text); qr.make(); const n = qr.getModuleCount(); let d = ''; for (let r = 0; r < n; r++) { let c = 0; while (c < n) { if (!qr.isDark(r, c)) { c++; continue; } let e = c; while (e < n && qr.isDark(r, e)) e++; d += `M${c + 4} ${r + 4}h${e - c}v1h-${e - c}z`; c = e; } } return { n, d }; } catch (e) { return null; } }, [text]);
            if (!model) return <p className="ui-error text-center">{tr("Не получилось построить QR-код — отправьте ссылку.")}</p>;
            const size = model.n + 8;
            return (<svg className="qr-svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges" data-qr-modules={model.n}><rect width={size} height={size} rx="3" fill="#fff" /><path d={model.d} fill="#0a0710" /></svg>);
        };

        // ---- юридические страницы ----
        const legalDoc = () => (getLang() === 'uk' ? LEGAL_UK : LEGAL);
        const LegalRich = ({ text }) => { const L = legalDoc(); return String(text).split(/(\{contact\}|\{operator\})/).map((part, i) => part === '{contact}'
            ? <a key={i} className="legal-link" href={L.contact.url} target="_blank" rel="noopener noreferrer">{L.contact.label}</a>
            : part === '{operator}' ? L.operator : part); };
        const LegalPage = ({ docId, onBack }) => {
            const LEGAL = legalDoc(); const doc = LEGAL.docs[docId]; if (!doc) return null;
            return (<>
                <PageHeader title={doc.title} onBack={onBack} />
                <main className="w-full max-w-md flex flex-col gap-5 pt-5 pb-4 legal-doc">
                    <p className="text-[15px] text-zinc-200 leading-relaxed">{doc.lead}</p>
                    <p className="text-[13px] text-zinc-500">{tr("Обновлено:")} {LEGAL.updatedHuman}</p>
                    {doc.sections.map((sec, i) => (
                        <section key={i} className="legal-sec">
                            <h2>{sec.h.replace(/\s*\*$/, '')}</h2>
                            {(sec.p || []).map((t, j) => <p key={j}><LegalRich text={t} /></p>)}
                            {sec.list && <ul>{sec.list.map((t, j) => <li key={j}><LegalRich text={t} /></li>)}</ul>}
                            {sec.table && <div className="legal-table" role="table">{sec.table.map((r, j) => (<div key={j} role="row" className="legal-trow"><span role="cell" className="legal-key">{r[0]}</span><span role="cell">{r[1]}</span><span role="cell" className="legal-ttl">{r[2]}</span></div>))}</div>}
                            {sec.after && <p><LegalRich text={sec.after} /></p>}
                        </section>
                    ))}
                    <p className="text-[13px] text-zinc-500 leading-relaxed">{LEGAL.contactNote}</p>
                    <nav aria-label={tr("Другие документы")} className="legal-others">
                        {LEGAL.order.filter(id => id !== docId).map(id => <a key={id} href={SCREEN_TO_HASH[id]}>{LEGAL.docs[id].menu}</a>)}
                    </nav>
                </main>
            </>);
        };

        // ---- «Об игре» ----
        const AboutPage = ({ profileDb, topicCount, hasProfile, onBack, onStart, onShare }) => {
            const [lvl, setLvl] = useState(DIFFICULTIES[0].id); const [step, setStep] = useState(0);
            const [group, setGroup] = useState('all'); const [openF, setOpenF] = useState(null); const [openQ, setOpenQ] = useState(null);
            const visible = useMemo(() => (profileDb || []).filter(q => q && !q.hidden), [profileDb]);
            const nums = { questions: visible.length ? String(visible.length) : aboutDoc().fallbackNumbers.questions, topics: String(topicCount || CATEGORIES.length), players: String(MAX_PLAYERS), devices: String(MAX_PLAYERS) };
            const F = (t) => aboutFill(t, nums);
            // «Попробуйте»: по три примера на глубину из файла содержимого (настоящие вопросы игры, без темы «Интим»); «Следующий пример» листает их по кругу
            const list = aboutDoc().demo.examples[lvl] || []; const question = list.length ? list[step % list.length] : '';
            const feats = aboutDoc().features.filter(f => group === 'all' || f.group === group);
            const levelOf = (id) => DIFFICULTIES.findIndex(d => d.id === id) + 1;
            return (<>
                <PageHeader title={tr("Об игре")} onBack={onBack} right={<button type="button" onClick={() => { SoundFX.click(); onShare(); }} aria-label={tr("Поделиться страницей")} className="btn-icon flex-shrink-0"><Icons.Share /></button>} />
                <main className="w-full max-w-md flex flex-col gap-8 pt-6 pb-4 about-page">
                    <section className="about-hero">
                        <AskMeLogo size="md" />
                        <h2 className="about-title">{aboutDoc().hero.title}</h2>
                        <p className="about-lead">{aboutDoc().hero.lead}</p>
                        <button type="button" onClick={() => { SoundFX.click(); onStart(); }} className="btn-primary w-full">{hasProfile ? aboutDoc().hero.ctaHave : aboutDoc().hero.cta}</button>
                    </section>

                    <section aria-labelledby="about-demo" className="flex flex-col gap-3">
                        <h2 id="about-demo" className="about-h2">{aboutDoc().demo.title}</h2>
                        <p className="text-sm text-zinc-400 leading-snug">{F(aboutDoc().demo.hint)}</p>
                        <div className="seg w-full" role="tablist" aria-label={tr("Глубина вопроса")}>
                            {DIFFICULTIES.map(d => (<button key={d.id} type="button" role="tab" aria-selected={lvl === d.id} onClick={() => { SoundFX.click(); setLvl(d.id); setStep(0); }} className={`seg-btn ${lvl === d.id ? 'is-active' : ''}`}>{diffLabel(d.id, d.name)}</button>))}
                        </div>
                        <div key={lvl + ':' + step} className={`about-q lvl-${levelOf(lvl)} fade-in`} aria-live="polite"><p>{question}</p></div>
                        <p className="text-[13px] text-zinc-500 text-center" aria-hidden="true">{`${step % list.length + 1} / ${list.length}`}</p>
                        <button type="button" onClick={() => { SoundFX.click(); setStep(n => (n + 1) % list.length); }} className="btn-secondary w-full">{aboutDoc().demo.next}</button>
                    </section>

                    <section aria-label={tr("Игра в цифрах")} className="about-numbers">
                        {aboutDoc().numbers.map((n, i) => (<div key={i} className="about-num"><span className="about-num-v">{F(n.value)}</span><span className="about-num-l">{F(n.label)}</span></div>))}
                    </section>

                    <section aria-labelledby="about-steps" className="flex flex-col gap-3">
                        <h2 id="about-steps" className="about-h2">{aboutDoc().stepsTitle}</h2>
                        <ol className="about-steps">
                            {aboutDoc().steps.map((st, i) => (<li key={i}><span className="about-step-n" aria-hidden="true">{i + 1}</span><div><h3>{F(st.title)}</h3><p>{F(st.text)}</p></div></li>))}
                        </ol>
                    </section>

                    <section aria-labelledby="about-feat" className="flex flex-col gap-3">
                        <h2 id="about-feat" className="about-h2">{aboutDoc().featuresTitle}</h2>
                        <div className="about-chips" role="tablist" aria-label={tr("Категории возможностей")}>
                            {aboutDoc().featureGroups.map(g => (<button key={g.id} type="button" role="tab" aria-selected={group === g.id} onClick={() => { SoundFX.click(); setGroup(g.id); setOpenF(null); }} className={`chip flex-shrink-0 ${group === g.id ? 'is-on' : ''}`}>{g.label}</button>))}
                        </div>
                        <div className="about-acc">
                            {feats.map(f => (<div key={f.id} className="about-acc-item">
                                <button type="button" className="row" aria-expanded={openF === f.id} onClick={() => { SoundFX.click(); setOpenF(openF === f.id ? null : f.id); }}>
                                    <span aria-hidden="true" className="w-10 h-10 rounded-full bg-white/[0.07] flex items-center justify-center text-lg flex-shrink-0">{f.icon}</span>
                                    <span className="flex-1 min-w-0 flex flex-col"><span className="text-sm font-semibold text-white">{F(f.title)}</span><span className="text-[13px] text-zinc-400">{F(f.short)}</span></span>
                                    <span aria-hidden="true" className={`about-chev ${openF === f.id ? 'is-open' : ''}`}>›</span>
                                </button>
                                {openF === f.id && <p className="about-more fade-in">{F(f.more)}</p>}
                            </div>))}
                        </div>
                    </section>

                    <section aria-labelledby="about-uniq" className="flex flex-col gap-3">
                        <h2 id="about-uniq" className="about-h2">{aboutDoc().unique.title}</h2>
                        <div className="flex flex-col gap-2.5">
                            {aboutDoc().unique.items.map((u, i) => (<div key={i} className="about-card has-ico"><span className="about-card-ico" aria-hidden="true">{u.icon}</span><div><h3>{F(u.title)}</h3><p>{F(u.text)}</p></div></div>))}
                        </div>
                    </section>

                    <section aria-labelledby="about-faq" className="flex flex-col gap-3">
                        <h2 id="about-faq" className="about-h2">{aboutDoc().faqTitle}</h2>
                        <div className="about-acc">
                            {aboutDoc().faq.map((it, i) => (<div key={i} className="about-acc-item">
                                <button type="button" className="row" aria-expanded={openQ === i} onClick={() => { SoundFX.click(); setOpenQ(openQ === i ? null : i); }}>
                                    <span className="flex-1 text-sm font-semibold text-white">{F(it.q)}</span>
                                    <span aria-hidden="true" className={`about-chev ${openQ === i ? 'is-open' : ''}`}>›</span>
                                </button>
                                {openQ === i && <p className="about-more fade-in">{F(it.a)}</p>}
                            </div>))}
                        </div>
                    </section>

                    <section className="about-cta">
                        <h2>{aboutDoc().cta.title}</h2>
                        <p>{aboutDoc().cta.text}</p>
                        <button type="button" onClick={() => { SoundFX.click(); onStart(); }} className="btn-primary w-full">{hasProfile ? aboutDoc().hero.ctaHave : aboutDoc().hero.cta}</button>
                        <button type="button" onClick={() => { SoundFX.click(); onShare(); }} className="btn-ghost w-full flex items-center justify-center gap-2"><Icons.Share /> {tr("Поделиться страницей")}</button>
                    </section>
                    <p className="text-[13px] text-zinc-500 text-center">{tr("Версия страницы")} {aboutDoc().version} {tr("· обновлена")} {aboutDoc().updated}</p>
                </main>
            </>);
        };

        // ---- приглашение ----
        const InvitePage = ({ profile, onBack, showToast }) => {
            const url = inviteUrlFor(profile); const [copied, setCopied] = useState(false);
            const doCopy = async () => { SoundFX.success(); await copyTextToClipboard(url); setCopied(true); showToast(tr('Ссылка-приглашение скопирована')); setTimeout(() => setCopied(false), 2000); };
            const doShare = async () => { SoundFX.click(); await shareOrCopy({ title: tr('Играем в ASK ME'), text: tr('Присоединяйся к нашей игре в ASK ME'), url }, 'Ссылка-приглашение скопирована', showToast); };
            return (<>
                <PageHeader title={tr("Пригласить игроков")} onBack={onBack} />
                <main className="w-full max-w-md flex flex-col gap-6 pt-6 pb-4 invite-page">
                    <p className="text-[15px] text-zinc-200 leading-relaxed">{tr("Отправьте ссылку или покажите код — второй телефон сразу окажется в вашей сессии, и вы сможете играть одну партию вместе.")}</p>
                    {url ? (<>
                        <section className="qr-card" aria-label={tr("QR-код приглашения")}>
                            <QrSvg text={url} label={tr("QR-код приглашения в сессию")} />
                            <p>{tr("Наведите камеру телефона на код")}</p>
                        </section>
                        <section className="flex flex-col gap-3">
                            <div className="invite-link" aria-label={tr("Ссылка-приглашение")}><span className="invite-link-t">{tr("Ссылка-приглашение")}</span><span className="invite-link-v">{siteUrl('#/join?sid=' + profile.sessionId + '&key=')}••••••••</span></div>
                            <button type="button" onClick={doShare} className="btn-primary w-full flex items-center justify-center gap-2"><Icons.Share /> {tr("Поделиться ссылкой")}</button>
                            <button type="button" onClick={doCopy} className="btn-secondary w-full">{copied ? tr("Скопировано") : tr("Скопировать ссылку")}</button>
                        </section>
                    </>) : (
                        <p className="ui-error text-center">{tr("Ссылка для этой сессии ещё готовится. Закройте и откройте страницу снова через несколько секунд.")}</p>
                    )}
                    <section aria-labelledby="inv-how" className="flex flex-col gap-3">
                        <h2 id="inv-how" className="about-h2">{tr("Как подключиться")}</h2>
                        <ol className="about-steps">
                            <li><span className="about-step-n" aria-hidden="true">1</span><div><p>{tr("Откройте ссылку или отсканируйте код на втором телефоне.")}</p></div></li>
                            <li><span className="about-step-n" aria-hidden="true">2</span><div><p>{tr("Нажмите «Присоединиться» — регистрироваться не нужно.")}</p></div></li>
                            <li><span className="about-step-n" aria-hidden="true">3</span><div><p>{tr("Играйте вместе: до")} {deviceCap(profile)} {tr("устройств — столько же, сколько игроков в сессии. Вопросы, очередь и таймер у всех одинаковые.")}</p></div></li>
                        </ol>
                    </section>
                    <div className="invite-warn" role="note"><b>{tr("Берегите ссылку.")}</b> {tr("Она открывает всю сессию: имена игроков и прогресс. Отправляйте её только тем, кому доверяете.")}</div>
                    <p className="text-[13px] text-zinc-500 text-center">{tr("ID сессии:")} <span className="font-display tracking-[0.06em] text-zinc-300">{profile.sessionId}</span></p>
                </main>
            </>);
        };

        // ---- быстрое подключение по приглашению ----
        const JoinPage = ({ invite, profile, busy, error, onJoin, onStay, onManual, onAbout }) => {
            const valid = !!(invite && isValidAESKey(invite.key)); const same = !!(valid && profile && profile.sessionKey === invite.key);
            const other = !!(valid && profile && !same); let body;
            if (!valid) body = (<>
                <h1 className="join-h">{tr("Ссылка не подошла")}</h1>
                <p className="join-p">{tr("Похоже, ссылка обрезалась при пересылке. Попросите отправить её ещё раз или введите ID сессии вручную.")}</p>
                <button type="button" onClick={onManual} className="btn-primary w-full">{tr("Ввести вручную")}</button>
                <button type="button" onClick={onAbout} className="btn-ghost w-full">{tr("Что это за игра")}</button>
            </>); else if (same) body = (<>
                <h1 className="join-h">{tr("Вы уже в этой сессии")}</h1>
                <p className="join-p">{tr("Эта ссылка открывает ту же сессию, что и на этом устройстве. Можно играть.")}</p>
                <button type="button" onClick={onStay} className="btn-primary w-full">{tr("К игре")}</button>
            </>); else body = (<>
                <h1 className="join-h">{other ? tr("Перейти в другую сессию?") : tr("Вас пригласили в ASK ME")}</h1>
                <p className="join-p">{other ? tr("На этом устройстве сейчас открыта своя сессия. Если присоединиться, здесь откроется приглашённая. Прежняя останется в облаке: вернуться в неё можно по её ссылке (она есть в меню) — сохраните её заранее.") : tr("Присоединитесь к сессии — и будете играть вместе с остальными: общие вопросы, очередь и таймер. Регистрироваться не нужно.")}</p>
                {isValidSessionIdFormat(invite.sid) && <span className="join-chip">{tr("Сессия")} {invite.sid}</span>}
                {error && <p className="inline-error" role="alert">{error}</p>}
                <button type="button" disabled={busy} onClick={onJoin} className="btn-primary w-full">{busy ? tr("Подключаемся…") : tr("Присоединиться")}</button>
                {other ? <button type="button" disabled={busy} onClick={onStay} className="btn-ghost w-full">{tr("Остаться в своей сессии")}</button> : <button type="button" disabled={busy} onClick={onAbout} className="btn-ghost w-full">{tr("Что это за игра")}</button>}
            </>);
            return (<main className="w-full max-w-sm flex flex-col items-center gap-4 text-center my-auto py-8 join-page"><AskMeLogo size="lg" />{body}</main>);
        };

        const PwaInstallModal = ({ showPwaModal, setShowPwaModal, isInAppWebView, pwaPlatformTab, setPwaPlatformTab, triggerIosNativeShareMenu }) => ( <PopupModal isOpen={showPwaModal} onClose={() => setShowPwaModal(false)}> <div className="flex flex-col gap-4 pt-1"> <div className="pr-8"><AskMeLogo size="xs" /></div> <div className="space-y-1 text-left"> <h3 className="text-xl font-bold text-white">{tr("Скачать на устройство")}</h3> <p className="text-xs text-zinc-400 leading-relaxed"> {tr("Установите")} <b className="text-white">ASK ME</b> {tr("на домашний экран.")} </p> </div> {isInAppWebView && ( <div className="p-3.5 rounded-[20px] bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 leading-relaxed text-left"> {tr("⚠️ Вы открыли сайт во встроенном браузере. Нажмите на иконку")} <b>{tr("Safari/Браузера")}</b>{tr(", чтобы появилась установка.")} </div> )} <div className="seg"> <button type="button" onClick={() => { SoundFX.click(); setPwaPlatformTab('ios'); }} className={`seg-btn ${ pwaPlatformTab === 'ios' ? 'is-active' : '' }`} >  iPhone </button> <button type="button" onClick={() => { SoundFX.click(); setPwaPlatformTab('android'); }} className={`seg-btn ${ pwaPlatformTab === 'android' ? 'is-active' : '' }`} > 🤖 Android </button> </div> {pwaPlatformTab === 'ios' ? ( <div className="flex flex-col gap-3 text-left text-xs text-zinc-200 bg-white/[0.04] p-4 rounded-[20px] border border-white/10"> <div className="flex items-start gap-3"> <span className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold flex items-center justify-center flex-shrink-0">1</span> <p className="leading-relaxed"> {tr("Нажмите кнопку")} <b className="text-white">{tr("«Поделиться»")}</b> {tr("в браузере Safari.")} </p> </div> <div className="hairline-divider"></div> <div className="flex items-start gap-3"> <span className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold flex items-center justify-center flex-shrink-0">2</span> <p className="leading-relaxed"> {tr("Нажмите")} <b className="text-white">{tr("«На экран \"Домой\"»")}</b>. </p> </div> <button type="button" onClick={triggerIosNativeShareMenu} className="btn-accent w-full mt-1 flex items-center justify-center gap-2" > <Icons.IosShare /> {tr("Открыть меню iOS")} </button> </div> ) : ( <div className="flex flex-col gap-3 text-left text-xs text-zinc-200 bg-white/[0.04] p-4 rounded-[20px] border border-white/10"> <div className="flex items-start gap-3"> <span className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold flex items-center justify-center flex-shrink-0">1</span> <p className="leading-relaxed"> {tr("Нажмите на меню браузера")} <b className="text-white">«⋮»</b>. </p> </div> <div className="hairline-divider"></div> <div className="flex items-start gap-3"> <span className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold flex items-center justify-center flex-shrink-0">2</span> <p className="leading-relaxed"> {tr("Выберите")} <b className="text-white">{tr("«Установить приложение»")}</b>. </p> </div> </div> )} <button type="button" onClick={() => { SoundFX.click(); setShowPwaModal(false); }} className="btn-primary w-full" > {tr("Понятно")} </button> </div> </PopupModal> );
        // Режим «Правда или действие»: всё, что нужно модулю карточек (src/tod/cards.js) от приложения — адрес базы, запрос с токеном входа, хранилище и стартовый набор
        const todCardsEnv = { baseUrl: FIREBASE_BASE_URL, fetch: fetchWithTimeout, storage: (() => { try { return localStorage; } catch (e) { return null; } })(), starter: TOD_STARTER };

        function App() {
            const [loadError, setLoadError] = useState(''); const [dbLoadAttempt, setDbLoadAttempt] = useState(0);
            const [db, setDb] = useState([]); const [dbSubPath, setDbSubPath] = useState("/questions"); const [isLoading, setIsLoading] = useState(true);
            const [lang, setLangState] = useState(() => getLang());
            // Перемикання мови: оновлюємо модуль-дзеркало (для t()), стан (для ререндера), localStorage та <html lang>.
            const changeLang = (next) => { const l = SUPPORTED_LANGS.includes(next) ? next : DEFAULT_LANG; i18nSetLang(l); setLangState(l); try { localStorage.setItem(LANG_STORAGE_KEY, l); } catch (e) {} try { document.documentElement.lang = l; } catch (e) {} };
            useEffect(() => { try { document.documentElement.lang = lang; } catch (e) {} }, [lang]);
            // Показ тексту питання за поточною мовою: укр — cleanTextUk з м'яким фолбеком на рос.
            const qDisplay = (q) => { if (!q) return ''; const ru = q.cleanText || String(q.text || '').replace(/^№\s*\d+\.\s*/, ''); if (lang === 'uk') return (q.cleanTextUk && q.cleanTextUk.trim()) ? q.cleanTextUk : ru; return ru; };

            const [isStandalonePWA, setIsStandalonePWA] = useState(() => { try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) { return false; } });
            const [deferredPwaPrompt, setDeferredPwaPrompt] = useState(null); const [showPwaModal, setShowPwaModal] = useState(false); const [pwaPlatformTab, setPwaPlatformTab] = useState(() => { const ua = navigator.userAgent || ""; return /iPad|iPhone|iPod/i.test(ua) ? 'ios' : 'android'; });
            const isInAppWebView = useMemo(() => /Telegram|Instagram|FBAN|FBAV|TikTok|BytedanceWebview|Viber/i.test(navigator.userAgent || ""), []);

            useEffect(() => { const handleBeforeInstallPrompt = (e) => { e.preventDefault(); setDeferredPwaPrompt(e); }; const handleAppInstalled = () => { setIsStandalonePWA(true); setDeferredPwaPrompt(null); setShowPwaModal(false); showToast(tr("Приложение ASK ME установлено!")); }; window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt); window.addEventListener('appinstalled', handleAppInstalled); return () => { window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt); window.removeEventListener('appinstalled', handleAppInstalled); }; }, []);

            const handleInstallPwaClick = async () => { SoundFX.click(); if (deferredPwaPrompt) { deferredPwaPrompt.prompt(); const { outcome } = await deferredPwaPrompt.userChoice; if (outcome === 'accepted') setDeferredPwaPrompt(null); return; } setShowPwaModal(true); };
            const triggerIosNativeShareMenu = async () => { SoundFX.click(); const cleanAppUrl = `${window.location.origin}${window.location.pathname}`; if (navigator.share) { try { await navigator.share({ title: "Ask Me", url: cleanAppUrl }); return; } catch (e) {} } showToast(tr("Нажмите на кнопку «Поделиться» [↑] на панели самого браузера Safari"), 4500, 'info'); };
            const showErrorPopup = (title, msg) => { SoundFX.warn(); setResultModal({ ok: false, title, msg }); };

            const [profile, setProfile] = useState(() => {
                try {
                    const saved = localStorage.getItem(PROFILE_STORAGE_KEY) || localStorage.getItem("askme_device_profile_v3");
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        if (parsed && (parsed.players || (parsed.guyName && parsed.girlName))) {
                            let pts = parsed.players;
                            if(!pts) { pts = [ { id: 'p1', name: sanitizeName(parsed.guyName || ''), gender: 'guy' }, { id: 'p2', name: sanitizeName(parsed.girlName || ''), gender: 'girl' } ]; }
                            const sid = (parsed.sessionId && isValidSessionIdFormat(parsed.sessionId)) ? parsed.sessionId.toUpperCase() : generateSessionId();
                            if (sessionTasks.blocked(sid)) return null;
                            return { sessionId: sid, sessionKey: isValidAESKey(parsed.sessionKey) ? parsed.sessionKey : undefined, players: cleanPlayers(pts), archivedIds: cleanIdList(parsed.archivedIds), disabledIds: cleanIdList(parsed.disabledIds), savedGame: cleanSavedGame(parsed.savedGame), syncConflict: parsed.syncConflict === true, legacyPath: typeof parsed.legacyPath === 'string' && /^sess_[a-f0-9]{16}$/.test(parsed.legacyPath) ? parsed.legacyPath : undefined, joinAt: Math.min(Number(parsed.joinAt) || 0, Date.now()), updatedAt: parsed.updatedAt || Date.now() };
                        }
                    }
                } catch (e) {} return null;
            });

            const [isPreviewMode, setIsPreviewMode] = useState(false);
            // Дефолт аудиторії за кількістю гравців: 2 — пара, 3+ — компанія (гравець може перемкнути вручну).
            useEffect(() => { const n = profile?.players?.length || 0; if (n >= 3) setAudienceMode('group'); else if (n === 2) setAudienceMode('couple'); }, [profile?.players?.length]);
            const [isAdmin, setIsAdmin] = useState(() => { try { return Auth.hasOwner(); } catch (e) { return false; } });
            useEffect(() => { const refreshRole = () => setIsAdmin(Auth.hasOwner()); Auth.listeners.add(refreshRole); return () => Auth.listeners.delete(refreshRole); }, []);
            const [authTab, setAuthTab] = useState('create');
            const [showExitConfirm, setShowExitConfirm] = useState(false);
            const [playersError, setPlayersError] = useState('');
            const [showSkipPopup, setShowSkipPopup] = useState(false);
            const [topicsVersion, setTopicsVersion] = useState(0);
            const [topicDraft, setTopicDraft] = useState([]);
            const [newTopicIcon, setNewTopicIcon] = useState(''); const [newTopicName, setNewTopicName] = useState('');
            const [topicErr, setTopicErr] = useState(''); const [topicBusy, setTopicBusy] = useState(false); const [emojiTab, setEmojiTab] = useState(0); const [qFormError, setQFormError] = useState('');
            const topicsDataRef = useRef(readTopicsCache());
            const [settings, setSettings] = useState(loadGameSettings);
            const [newPunish, setNewPunish] = useState(''); const [newPunishLevel, setNewPunishLevel] = useState('any'); const [punishErr, setPunishErr] = useState('');
            const [tm, setTm] = useState({ key: '', left: 0 });
            const [timerDismissKey, setTimerDismissKey] = useState('');
            const [hardMode, setHardMode] = useState(() => { try { return localStorage.getItem('askme_hard_mode_v1') === '1'; } catch (e) { return false; } });
            useEffect(() => { try { localStorage.setItem('askme_hard_mode_v1', hardMode ? '1' : '0'); } catch (e) {} }, [hardMode]);
            const [liveFx, setLiveFx] = useState(null);
            const fx = liveFx || (hardMode ? settings : { ...settings, timerOn: false, punishOn: false });
            const [showAddPunish, setShowAddPunish] = useState(false);
            const [punishTemplates, setPunishTemplates] = useState(readPunishCache);
            const allPunishments = useMemo(() => [...punishTemplates.filter(t => !(settings.hiddenTemplates || []).includes(t.id)), ...settings.punishments], [punishTemplates, settings.hiddenTemplates, settings.punishments]);
            // карточки режима «Правда или действие»: сначала кэш устройства (или стартовый набор), затем эффект ниже подменяет их данными из базы; source — откуда сейчас список: 'db' | 'cache' | 'starter'
            const [todBoot] = useState(() => { const cached = todReadCache(todCardsEnv.storage); return cached.length ? { list: cached, source: 'cache' } : { list: todCleanList(TOD_STARTER), source: 'starter' }; });
            const [todCards, setTodCards] = useState(todBoot.list); const [todSource, setTodSource] = useState(todBoot.source);
            const todCardsRef = useRef(todBoot.list); // всегда последний список: обработчики записи не должны работать с устаревшим
            const [todMine, setTodMineState] = useState(() => todMineRead(todCardsEnv.storage)); const todMineRef = useRef(todMine); todMineRef.current = todMine; // свои карточки: только на этом устройстве
            const [todEditId, setTodEditId] = useState(''); // карточка, форму которой открыть в админке (кнопка «Изменить» в архиве)
            const [todTab, setTodTab] = useState('classic'); // вкладка «Все вопросы»: classic | truth | dare
            const [todBackTo, setTodBackTo] = useState('app_menu'); // откуда открыта админка карточек (туда ведёт «Назад»)
            // партия «Правда или действие» на этом устройстве: настройки лобби, состояние игры st (движок src/tod/engine.js) и колода; локально не сохраняется
            const [todCfg, setTodCfg] = useState({ hard: false, tone: 1, mine: false }); const [todGame, setTodGameState] = useState(null); const [todDeck, setTodDeck] = useState(null);
            const todGameRef = useRef(null); const todTapRef = useRef(0); const todDeckRef = useRef(null); todDeckRef.current = todDeck;
            const setTodGame = (st) => { todGameRef.current = st; setTodGameState(st); };
            // синхронизация партии между устройствами: комната канала ('' — партия только на этом устройстве), последняя известная ver, наибольшая записанная ver,
            // «принять состояние из базы как есть» (после неудачной отправки), число отправок в пути
            const todRoomRef = useRef(''); const todVerRef = useRef(null); const todSentRef = useRef(0); const todForceRef = useRef(false); const todPendingRef = useRef(0);
            const [todInvite, setTodInvite] = useState(null); const [todPeers, setTodPeers] = useState(0); const [todJoining, setTodJoining] = useState(false); const [todJoinWarn, setTodJoinWarn] = useState(null);
            // карточки, которых нет в списке устройства, но которые выпали в общей партии: точечный запрос tod/<id>; { <id>: карточка | null (нет в базе) }
            const [todExtra, setTodExtra] = useState({}); const todExtraRef = useRef({}); const todAskedRef = useRef({});
            const [ptEdit, setPtEdit] = useState(null); const [ptText, setPtText] = useState(''); const [ptIcon, setPtIcon] = useState(''); const [ptLevel, setPtLevel] = useState('any');
            const [ptErr, setPtErr] = useState(''); const [ptBusy, setPtBusy] = useState(false); const [ptConfirmId, setPtConfirmId] = useState('');
            const [analyticsOn, setAnalyticsOn] = useState(() => { try { return localStorage.getItem('askme_analytics_v1') !== '0'; } catch (e) { return true; } });
            useEffect(() => { try { localStorage.setItem('askme_analytics_v1', analyticsOn ? '1' : '0'); } catch (e) {} }, [analyticsOn]);
            const [anMin, setAnMinState] = useState(readAnMin); const [anData, setAnData] = useState(null); const [anLoading, setAnLoading] = useState(false); const [anErr, setAnErr] = useState('');
            const [anView, setAnView] = useState('full'); const [anSel, setAnSel] = useState(null); const [anConfirm, setAnConfirm] = useState(''); const [anBusy, setAnBusy] = useState(false); const [hqBusy, setHqBusy] = useState(''); const [hqConfirmAll, setHqConfirmAll] = useState(false);
            const gameLogRef = useRef(null);
            const [punish, setPunish] = useState({ open: false, text: '', player: '', icon: '⏰' });
            
            const [playersForm, setPlayersForm] = useState(profile?.players || [ { id: 'p1', name: '', gender: 'guy' }, { id: 'p2', name: '', gender: 'girl' } ]);
            
            const [restoreIdInput, setRestoreIdInput] = useState('');
            useEffect(() => { try { const h = window.location.hash || ""; if (/key=/.test(h) && /sid=/.test(h)) { setAuthTab('restore'); setRestoreIdInput(window.location.href); window.history.replaceState(null, "", window.location.pathname + window.location.search + "#/welcome"); } } catch (e) {} }, []);
            const [restoreError, setRestoreError] = useState(''); const [isRestoringSession, setIsRestoringSession] = useState(false);
            
            const [adminForm, setAdminForm] = useState({ email: '', pass: '' });
            const [adminPinError, setAdminPinError] = useState('');
            const [logoTapCount, setLogoTapCount] = useState(0);

            // приглашение из ссылки (#/join?sid=…&key=…; старые ссылки #/welcome?sid=…&key=… тоже): читаем один раз и сразу убираем секрет из адресной строки
            const readInviteFromHash = () => { try { const h = window.location.hash || ''; const hp = hashPath(h); if ((hp !== '#/join' && hp !== '#/welcome') || !hasInviteParams(h)) return null; const r = parseRestoreInput(h); return r.key ? r : null; } catch (e) { return null; } };
            const [joinInvite, setJoinInvite] = useState(readInviteFromHash); const [joinBusy, setJoinBusy] = useState(false); const [joinError, setJoinError] = useState(''); const joinAutoRef = useRef(0);
            const [screen, setScreenState] = useState(() => { const h = window.location.hash, hp = hashPath(h); if (hp === '#/admin') return 'admin_login'; if (hp === '#/join') return 'join'; if (hp === '#/welcome') return (profile && hasInviteParams(h)) ? 'join' : 'onboarding'; const pub = HASH_TO_SCREEN[hp]; if (PUBLIC_SCREENS.includes(pub)) return pub; if (!profile && !isPreviewMode) return 'onboarding'; if (pub && RELOAD_TO_MENU.includes(pub)) { try { window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/'); } catch (e) {} return 'menu'; } return pub || 'menu'; });
            const navigate = (nextScreen) => { setScreenState(nextScreen); const targetHash = SCREEN_TO_HASH[nextScreen] || '#/'; if (window.location.hash !== targetHash) { window.history.pushState(null, '', targetHash); } window.scrollTo(0, 0); };
            useEffect(() => { if (joinInvite && (screen === 'join')) { try { window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/join'); } catch (e) {} } }, []);
            useEffect(() => { const onHashChange = () => { const h = window.location.hash || '#/', hp = hashPath(h); if (hp === '#/admin') { setScreenState('admin_login'); return; } if (hp === '#/join' || (hp === '#/welcome' && profile && hasInviteParams(h))) { const inv = readInviteFromHash(); if (inv) { setJoinInvite(inv); setJoinError(''); try { window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/join'); } catch (e) {} } setScreenState('join'); return; } if (hp === '#/welcome') { setScreenState('onboarding'); return; } const mapped = HASH_TO_SCREEN[hp]; if (PUBLIC_SCREENS.includes(mapped)) { setScreenState(mapped); return; } if (!profile && !isPreviewMode) { setScreenState('onboarding'); return; } if (mapped) setScreenState(mapped); }; window.addEventListener('hashchange', onHashChange); window.addEventListener('popstate', onHashChange); return () => { window.removeEventListener('hashchange', onHashChange); window.removeEventListener('popstate', onHashChange); }; }, [profile, isPreviewMode]);

            const [selectedCats, setSelectedCats] = useState(CATEGORIES.map(c => c.id)); const [selectedDiffs, setSelectedDiffs] = useState(DIFFICULTIES.map(d => d.id)); const [isMuted, setIsMuted] = useState(false);
            // Аудиторія колоди: 'couple' = пара (couple + both), 'group' = компанія (лише both). Гравець обирає сам.
            const [audienceMode, setAudienceMode] = useState('couple');
            const audienceAllows = (q) => audienceMode === 'group' ? (q.audience !== 'couple') : true;
            const [gameMode, setGameMode] = useState('normal'); const [gameQuestions, setGameQuestions] = useState([]); const [currentIndex, setCurrentIndex] = useState(0); const [maxReachedIndex, setMaxReachedIndex] = useState(0); const [turnHistory, setTurnHistory] = useState({}); const [answeredCount, setAnsweredCount] = useState(0); const [completedAllFlag, setCompletedAllFlag] = useState(false); const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
            const [turnPopup, setTurnPopup] = useState({ open: false, spinning: false, highlight: 'guy', winner: null, candidates: [] }); const rouletteTimeoutsRef = useRef([]);
            const [aiType, setAiType] = useState('situation'); const [aiContent, setAiContent] = useState(''); const [isAiTyping, setIsAiTyping] = useState(false); const typingIntervalRef = useRef(null); const aiRequestRef = useRef({ id: 0, controller: null });
            const [viewCategory, setViewCategory] = useState(null); const [qLevel, setQLevel] = useState('all'); const [startErrTick, setStartErrTick] = useState(0); const [newGameConfirm, setNewGameConfirm] = useState(false); const [visibleLimit, setVisibleLimit] = useState(60);
            // страница «Пригласить игроков» открывается из меню и с экранов начала игры: «Назад» возвращает туда, откуда пришли
            const [inviteFrom, setInviteFrom] = useState('app_menu');
            const openInvite = (from) => { SoundFX.click(); setInviteFrom(from); navigate('invite'); };
            // экраны партии без самой партии (перезагрузка, прямой адрес) -> главная
            // после перезагрузки на #/tod/play или #/tod/results партию сначала ищем в канале сессии (эффект возврата ниже), и только потом уводим на главную
            const [todResuming, setTodResuming] = useState(() => /^#\/tod\/(?:play|results)(?:[/?]|$)/.test(window.location.hash || ''));
            const [todClassicBusy, setTodClassicBusy] = useState(false); // в сессии идёт классическая живая игра: новую партию «Правды или действия» не начинаем
            useEffect(() => { if ((screen === 'tod_play' || screen === 'tod_results') && !todGame && !todResuming) { try { window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/'); } catch (e) {} setScreenState('menu'); } }, [screen, todGame, todResuming]);
            const [addForm, setAddForm] = useState({ text: '', cat: 'family', diff: 'Простые', targetId: '', aud: 'both' }); const [addStatus, setAddStatus] = useState(null); const [isSaving, setIsSaving] = useState(false); const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
            const [editingQuestion, setEditingQuestion] = useState(null); const [editForm, setEditForm] = useState({ text: '', cat: 'family', diff: 'Простые', targetId: '', aud: 'both' }); const [returnScreen, setReturnScreen] = useState('menu'); const [confirmModal, setConfirmModal] = useState(null); const [resultModal, setResultModal] = useState(null);

            const hydratedKeyRef = useRef('');
            const [hydrationTick, setHydrationTick] = useState(0);
            const [hydrationAttempt, setHydrationAttempt] = useState(0);
            const profileRef = useRef(profile); profileRef.current = profile;
            const syncSessionToCloud = async (profData) => {
                if (!profData?.sessionId || sessionTasks.blocked(profData.sessionId)) return false;
                try {
                    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profData));
                    localStorage.setItem(`askme_sess_${profData.sessionId}`, JSON.stringify(profData));
                } catch (e) { showToast(tr("Хранилище устройства заполнено — сохранение может быть недоступно"), 5000, 'warn'); }
                if (!isValidAESKey(profData.sessionKey)) return false;
                return sessionTasks.run(profData.sessionId, async () => {
                    try {
                        const cloud = await sessionStore.hydrate(profData);
                        if (Number(cloud?.updatedAt) > Number(profData.updatedAt)) throw new Error('cloud-conflict');
                        if (sessionTasks.blocked(profData.sessionId)) return false;
                        await sessionStore.save(profData);
                        if (profData.legacyPath && !sessionTasks.blocked(profData.sessionId)) {
                            if (!await publishJoinCode(profData.sessionId, profData.sessionKey)) return false;
                            const removed = await fetchWithTimeout(`${FIREBASE_BASE_URL}/sessions/${profData.legacyPath}.json`, { method: 'DELETE' });
                            if (!removed.ok) return false;
                            try { if (JSON.parse(localStorage.getItem('askme_device_profile_v3') || 'null')?.sessionId === profData.sessionId) localStorage.removeItem('askme_device_profile_v3'); } catch (e) {}
                            setProfile(p => p?.sessionKey === profData.sessionKey ? { ...p, legacyPath: undefined, joinAt: Date.now() } : p);
                        }
                        return true;
                    } catch (e) {
                        if (e.message === 'cloud-conflict') setProfile(p => p?.sessionKey === profData.sessionKey && !p.syncConflict ? { ...p, syncConflict: true } : p);
                        if (Date.now() - lastSyncToastAt > 60000) {
                            lastSyncToastAt = Date.now();
                            const messages = { 'too-big': 'Сессия стала слишком большой для облака — прогресс сохранён только на этом устройстве', 'cloud-conflict': 'Сессия изменена на другом устройстве. Локальный прогресс сохранён; откройте «Игроки и сессия» для выбора облачной копии', 'session-deleted': 'Эта сессия удалена. Создайте новую сессию' };
                            showToast(messages[e.message] || tr("Нет связи с облаком — прогресс сохранён на устройстве"), 6000, 'warn');
                        }
                        return false;
                    }
                });
            };
            useEffect(() => {
                const retry = () => { if (profileRef.current?.sessionKey) sessionStore.forget(profileRef.current.sessionKey); hydratedKeyRef.current = ''; setHydrationAttempt(t => t + 1); };
                window.addEventListener('online', retry);
                return () => window.removeEventListener('online', retry);
            }, []);
            useEffect(() => {
                if (!isValidAESKey(profile?.sessionKey) || isLoading || sessionTasks.blocked(profile.sessionId)) return;
                let active = true; const started = profile;
                hydratedKeyRef.current = '';
                sessionStore.hydrate(started).then(cloud => {
                    if (!active || sessionTasks.blocked(started.sessionId)) return;
                    const players = cleanPlayers(cloud?.players);
                    const canAdoptCloud = players.length && Number(cloud.updatedAt) > Number(started.updatedAt) && profileRef.current?.updatedAt === started.updatedAt;
                    if (started.syncConflict || (sessionStore.requiresResolution(started.sessionKey) && !canAdoptCloud)) {
                        showToast(tr("Версии сессии различаются. Откройте «Игроки и сессия», чтобы выбрать облачную копию. Локальный прогресс сохранён"), 6500, 'warn');
                        setProfile(p => p?.sessionKey === started.sessionKey && !p.syncConflict ? { ...p, syncConflict: true } : p);
                        return; // store также запрещает обход этого конфликта прямым save.
                    }
                    setProfile(current => {
                        if (current?.sessionKey !== started.sessionKey) return current;
                        if (players.length && Number(cloud.updatedAt) > Number(started.updatedAt)) {
                            return { ...current, players, archivedIds: cleanIdList(cloud.archivedIds), disabledIds: cleanIdList(cloud.disabledIds), savedGame: cleanSavedGame(cloud.savedGame), updatedAt: Number(cloud.updatedAt) };
                        }
                        return current;
                    });
                    sessionStore.acceptHydration(started.sessionKey);
                    hydratedKeyRef.current = started.sessionKey;
                    setHydrationTick(t => t + 1);
                }).catch(error => {
                    if (!active) return;
                    if (error.message === 'session-deleted') {
                        sessionTasks.stop(started.sessionId).catch(() => {});
                        try {
                            localStorage.setItem('askme_deleted_' + started.sessionId, '1');
                            for (const key of [PROFILE_STORAGE_KEY, 'askme_device_profile_v3', 'askme_sess_' + started.sessionId]) {
                                const saved = JSON.parse(localStorage.getItem(key) || 'null');
                                if (saved?.sessionId === started.sessionId) localStorage.removeItem(key);
                            }
                        } catch (e) {}
                        setProfile(null); setPlayersForm([{ id: 'p1', name: '', gender: 'guy' }, { id: 'p2', name: '', gender: 'girl' }]);
                        navigate('onboarding'); showToast(tr("Эта сессия удалена на другом устройстве"), 5000, 'warn');
                    } else showToast(tr("Облачная копия недоступна — игра и прогресс остаются на устройстве"), 5000, 'warn');
                });
                return () => { active = false; };
            }, [isLoading, profile?.sessionKey, hydrationAttempt]);
            useEffect(() => {
                if (!profile || isLoading || sessionTasks.blocked(profile.sessionId)) return;
                try { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile)); } catch (e) {}
                if (hydratedKeyRef.current !== profile.sessionKey) return;
                const timer = setTimeout(() => { syncSessionToCloud(profile); }, 350);
                return () => clearTimeout(timer);
            }, [profile, isLoading, hydrationTick]);
            // «замок» для входа по ID (см. publishJoinCode): кладём в облако при первом запуске сессии на устройстве и обновляем раз в неделю, чтобы он не устарел
            useEffect(() => {
                if (!profile || sessionTasks.blocked(profile.sessionId) || isLoading || !isValidAESKey(profile.sessionKey) || !isValidSessionIdFormat(profile.sessionId) || Date.now() - (profile.joinAt || 0) < JOIN_REFRESH_MS) return;
                let on = true; const sid = profile.sessionId, key = profile.sessionKey;
                sessionTasks.run(sid, () => publishJoinCode(sid, key)).then(ok => { if (ok && on) setProfile(p => (p && p.sessionId === sid && p.sessionKey === key) ? { ...p, joinAt: Date.now() } : p); });
                return () => { on = false; };
            }, [isLoading, profile && profile.sessionId, profile && profile.sessionKey, profile && profile.joinAt]);
            useEffect(() => {
                if (!profile || profile.sessionKey || isLoading || sessionTasks.blocked(profile.sessionId)) return;
                let active = true; const sid = profile.sessionId;
                generateAESKey().then(key => {
                    if (active && profileRef.current?.sessionId === sid && !sessionTasks.blocked(sid)) setProfile(current => current?.sessionId === sid && !current.sessionKey ? { ...current, sessionKey: key, legacyPath: 'sess_' + hashSessionIdForDb(sid), updatedAt: Date.now() } : current);
                }).catch(() => { if (active) showToast(tr("Не удалось подготовить защищённое сохранение"), 4000, 'warn'); });
                return () => { active = false; };
            }, [profile, isLoading]);

            const cleanupOldSessions = async (token) => {
                try {
                    const res = await fetch(`${FIREBASE_BASE_URL}/sessions.json?auth=${token}&shallow=true`);
                    const keys = await res.json(); if(!keys) return;
                    const now = Date.now(); const checks = Object.keys(keys).slice(0, 30);
                    for(let k of checks) {
                        const r = await fetch(`${FIREBASE_BASE_URL}/sessions/${k}.json?auth=${token}`);
                        const data = await r.json(); if(data && data.updatedAt && (now - data.updatedAt > 32 * 24 * 60 * 60 * 1000)) { await fetch(`${FIREBASE_BASE_URL}/sessions/${k}.json?auth=${token}`, {method:'DELETE'}); }
                    }
                } catch(e){}
            };

            // открыть сессию по ID/ключу (форма «Восстановить», страница быстрого подключения); setErr — куда писать ошибку; возвращает true при успехе
            const runRestore = async (sid, key, setErr) => {
                let okRestore = false;
                setIsRestoringSession(true); setErr("");
                const toProfile = (dec, sessionId, sessionKey) => {
                    let pts = cleanPlayers(dec.players); if (!pts.length && dec.guyName && dec.girlName) pts = [{id:'p1', name:String(dec.guyName).slice(0, 25), gender:'guy'}, {id:'p2', name:String(dec.girlName).slice(0, 25), gender:'girl'}];
                    if (!pts.length) return null;
                    return { sessionId, sessionKey, players: pts, archivedIds: cleanIdList(dec.archivedIds), disabledIds: cleanIdList(dec.disabledIds), savedGame: cleanSavedGame(dec.savedGame), updatedAt: Date.now() };
                };
                try {
                    let restored = null, legacyPath = null, offline = false;
                    try { const found = key || await lookupJoinCode(sid); if (found === null) offline = true; const useKey = found || ""; if (useKey) { const res = await fetchWithTimeout(`${FIREBASE_BASE_URL}/sessions/${await sessionDbKey(useKey)}.json?t=${Date.now()}`); const data = res.ok ? await res.json() : null; const dec = data && data.payload ? await decryptSessionAES(data.payload, useKey) : null; if (dec && (dec.players || dec.guyName)) restored = toProfile(dec, isValidSessionIdFormat(sid) ? sid : generateSessionId(), useKey); } if (!restored && !key) { const lp = "sess_" + hashSessionIdForDb(sid); const res = await fetchWithTimeout(`${FIREBASE_BASE_URL}/sessions/${lp}.json?t=${Date.now()}`); const data = res.ok ? await res.json() : null; const dec = data && data.payload ? decryptSessionPayload(data.payload, sid) : null; if (dec && (dec.players || dec.guyName)) { restored = toProfile(dec, sid, await generateAESKey()); legacyPath = lp; } } } catch (err) { offline = true; }
                    if (restored) { if (sessionTasks.blocked(restored.sessionId)) throw new Error("session-deleted"); if (legacyPath) restored.legacyPath = legacyPath; SoundFX.success(); try { window.history.replaceState(null, "", window.location.pathname + window.location.search + "#/welcome"); } catch (err) {} setProfile(restored); setPlayersForm(restored.players); setRestoreIdInput(""); setIsPreviewMode(false); showToast(tf("Сессия {v0} успешно восстановлена!", { v0: restored.sessionId })); okRestore = true; navigate('menu'); } else { SoundFX.warn(); setErr(offline ? tr("Нет связи с облаком. Проверьте интернет и попробуйте ещё раз.") : key ? tr("Сессия не найдена. Ссылка устарела или сессию удалили.") : tr("Сессия с таким ID не найдена. Проверьте ID. Если сессия создана давно — один раз откройте игру на старом устройстве: вход по ID включится сам.")); }
                } catch (err) { SoundFX.warn(); setErr(tr("Ошибка соединения.")); } finally { setIsRestoringSession(false); }
                return okRestore;
            };
            const handleRestoreBySessionId = async (e) => {
                e.preventDefault(); const { sid, key } = parseRestoreInput(restoreIdInput); if (!key && !isValidSessionIdFormat(sid)) { SoundFX.warn(); setRestoreError(tr("Вставьте ссылку на сессию или 8-значный ID")); return; }
                await runRestore(sid, key, setRestoreError);
            };

            // ---- быстрое подключение по приглашению (#/join) ----
            const handleJoinInvite = async () => {
                if (!joinInvite || joinBusy) return; SoundFX.click(); setJoinBusy(true); setJoinError('');
                const okJ = await runRestore(joinInvite.sid, joinInvite.key, setJoinError);
                setJoinBusy(false); if (okJ) { joinAutoRef.current = Date.now(); setJoinInvite(null); }
            };
            const joinContinue = () => { SoundFX.click(); joinAutoRef.current = Date.now(); setJoinInvite(null); navigate(profile ? 'menu' : 'onboarding'); };
            const joinDecline = () => { SoundFX.click(); joinAutoRef.current = 0; setJoinInvite(null); navigate(profile ? 'menu' : 'onboarding'); };
            const joinManual = () => { SoundFX.click(); setJoinInvite(null); if (profile) { setPlayersForm(profile.players); navigate('profile_page'); } else { setAuthTab('restore'); setRestoreError(''); navigate('onboarding'); } };
            const sharePage = async () => { await shareOrCopy({ title: aboutDoc().share.title, text: aboutDoc().share.text, url: siteUrl('#/about') }, aboutDoc().share.done, showToast); };

            // ---- удаление всех данных пользователя: облако (сессия, общая комната, записи статистики этого устройства) и локальное хранилище ----
            const [delDataOpen, setDelDataOpen] = useState(false); const [delDataBusy, setDelDataBusy] = useState(false);
            const handleDeleteMyData = async () => {
                if (!profile || delDataBusy) return;
                setDelDataBusy(true);
                const sid = profile.sessionId, key = profile.sessionKey;
                await sessionTasks.stop(sid);
                hydratedKeyRef.current = '';
                let aid = null; try { aid = localStorage.getItem('askme_aid_' + sid); } catch (e) {}
                const del = url => fetchWithTimeout(url, { method: 'DELETE' }, 10000).then(r => r.ok).catch(() => false);
                try {
                    const retire = url => retireSessionUrl(url).catch(() => false);
                    const jobs = [isValidAESKey(key) ? sessionDbKey(key).then(k => retire(`${FIREBASE_BASE_URL}/sessions/${k}.json`)) : Promise.resolve(true)];
                    jobs.push(retire(`${FIREBASE_BASE_URL}/sessions/sess_${hashSessionIdForDb(sid)}.json`));
                    jobs.push(removeJoinCode(sid));
                    const room = liveRoomIdRef.current;
                    if (room) {
                        const marker = { ver: liveVerStart(deviceIdRef.current), by: deviceIdRef.current, t: Date.now(), status: 'ended', deleted: true };
                        for (const id of [room, room + '_d', room + '_t']) jobs.push(fetchWithTimeout(roomUrl(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(marker) }, 10000).then(r => r.ok).catch(() => false));
                    }
                    if (aid) {
                        const ownerUid = await Auth.uid();
                        const sessionRef = isValidAESKey(key) ? await sessionDbKey(key) : undefined;
                        for (const kind of ['anon', 'full']) jobs.push(fetchWithTimeout(`${FIREBASE_BASE_URL}/analytics/${kind}/${aid}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ownerUid, sessionRef, updatedAt: Date.now(), deleted: true, ...(kind === 'full' ? { sid: '', names: '' } : {}) }) }, 10000).then(r => r.ok).catch(() => false));
                    }
                    const results = await Promise.all(jobs);
                    if (results.some(ok => !ok)) {
                        showToast(tr('Не удалось удалить данные из облака полностью. Часть данных могла быть удалена; повторите попытку. Локальная копия сохранена'), 6500, 'warn');
                        return;
                    }
                    for (const storageKey of [PROFILE_STORAGE_KEY, 'askme_device_profile_v3']) {
                        const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
                        if (value?.sessionId === sid) localStorage.removeItem(storageKey);
                    }
                    localStorage.removeItem('askme_sess_' + sid);
                    localStorage.removeItem('askme_aid_' + sid);
                    localStorage.setItem('askme_deleted_' + sid, '1');
                    if (key) sessionStore.forget(key);
                    liveLeave();
                    setDelDataOpen(false); setProfile(null); setIsPreviewMode(false);
                    setPlayersForm([{ id: 'p1', name: '', gender: 'guy' }, { id: 'p2', name: '', gender: 'girl' }]);
                    setPlayersError(''); setRestoreIdInput(''); setRestoreError('');
                    SoundFX.success(); navigate('onboarding'); showToast(tr('Данные этой сессии удалены'), 4000);
                } catch (error) { showToast(tr('Не удалось завершить удаление. Повторите попытку'), 5000, 'warn'); }
                finally { setDelDataBusy(false); }
            };

            useEffect(() => {
                const onStorage = event => {
                    const current = profileRef.current;
                    if (!current || event.key !== 'askme_deleted_' + current.sessionId || event.newValue !== '1') return;
                    sessionTasks.stop(current.sessionId).catch(() => {}); liveLeave();
                    setProfile(null); setIsPreviewMode(false); setPlayersForm([{ id: 'p1', name: '', gender: 'guy' }, { id: 'p2', name: '', gender: 'girl' }]); setRestoreIdInput(''); navigate('onboarding');
                    showToast(tr('Эта сессия удалена в другой вкладке'), 5000, 'warn');
                };
                window.addEventListener('storage', onStorage);
                return () => window.removeEventListener('storage', onStorage);
            }, []);

            const handleShareGame = async () => { SoundFX.click(); const shareUrl = `${window.location.origin}${window.location.pathname}#/welcome`; if (navigator.share) { try { await navigator.share({ title: tr("ASK ME — Игра"), text: tr("Откровенные разговоры ❤️"), url: shareUrl }); return; } catch (e) { if (e.name === 'AbortError') return; } } await copyTextToClipboard(shareUrl); showToast(tr("Ссылка на игру скопирована!")); };
            const toggleMute = () => { const nextState = !isMuted; setIsMuted(nextState); SoundFX.muted = nextState; if (!nextState) SoundFX.click(); };
            const desk = useIsDesktop(); // компьютер (от 1024 px): другая вёрстка экранов, верхняя панель и расширенный подвал
            useEffect(() => {
                Object.assign(deskStore.api, { navigate, toggleMute, changeLang, showToast });
                deskStore.set({ screen, hasProfile: !!profile, sessionId: profile ? profile.sessionId : '', sessionKey: profile ? profile.sessionKey : '', players: profile ? profile.players : [], muted: isMuted, lang });
            });
            const handleLogoSecretTap = () => { const nextCount = logoTapCount + 1; setLogoTapCount(nextCount); if (nextCount >= 5) { SoundFX.magic(); setLogoTapCount(0); setAdminPinError(''); navigate('admin_login'); } };

            const useCloudProfile = async () => {
                const current = profileRef.current; if (!current?.sessionKey || isRestoringSession) return;
                setIsRestoringSession(true);
                try {
                    sessionStore.forget(current.sessionKey);
                    const cloud = await sessionStore.hydrate(current), players = cleanPlayers(cloud?.players);
                    if (!players.length || profileRef.current?.sessionKey !== current.sessionKey || sessionTasks.blocked(current.sessionId)) throw new Error('cloud-unavailable');
                    sessionStore.acceptHydration(current.sessionKey); hydratedKeyRef.current = current.sessionKey;
                    const updated = { ...current, players, archivedIds: cleanIdList(cloud.archivedIds), disabledIds: cleanIdList(cloud.disabledIds), savedGame: cleanSavedGame(cloud.savedGame), updatedAt: Number(cloud.updatedAt) || Date.now(), syncConflict: false };
                    setProfile(updated); setPlayersForm(players); showToast(tr("Загружена облачная копия сессии"));
                } catch (error) { showToast(tr("Облачная копия недоступна. Локальный прогресс сохранён"), 5000, 'warn'); }
                finally { setIsRestoringSession(false); }
            };

            const handleSaveProfileNames = async (e) => {
                e.preventDefault(); const validPlayers = playersForm.filter(p => p.name.trim().length > 0);
                if (validPlayers.length < 2) { SoundFX.warn(); setPlayersError(tr("Введите минимум два имени, чтобы начать игру")); return; }
                SoundFX.success(); setPlayersError('');
                const isNewSession = (!profile?.sessionId || isPreviewMode); const newSid = isNewSession ? generateSessionId() : profile.sessionId; const newKey = (!isNewSession && isValidAESKey(profile?.sessionKey)) ? profile.sessionKey : await generateAESKey();
                const updatedProfile = { sessionId: newSid, sessionKey: newKey, players: validPlayers, archivedIds: isNewSession ? [] : (profile?.archivedIds || []), disabledIds: isNewSession ? [] : (profile?.disabledIds || []), savedGame: isNewSession ? null : (profile?.savedGame || null), syncConflict: !isNewSession && !!profile?.syncConflict, joinAt: isNewSession ? 0 : (profile?.joinAt || 0), updatedAt: Date.now() };
                setProfile(updatedProfile); setIsPreviewMode(false); if (isNewSession) navigate('session_created'); else { showToast(tr("Имена сохранены")); navigate('menu'); }
            };
            const handleExitSession = () => {
                try { localStorage.removeItem(PROFILE_STORAGE_KEY); } catch (e) {}
                setShowExitConfirm(false); setProfile(null);
                setPlayersForm([{ id: 'p1', name: '', gender: 'guy' }, { id: 'p2', name: '', gender: 'girl' }]);
                setPlayersError(''); SoundFX.click(); navigate('onboarding');
            };
            const exitConfirmPopup = (
                <PopupModal isOpen={showExitConfirm && !!profile} onClose={() => setShowExitConfirm(false)}>
                    <div className="text-center flex flex-col items-center gap-4 pt-1">
                        <h3 className="text-lg font-bold text-white">{tr("Выйти из сессии?")}</h3>
                        <p className="text-sm text-zinc-400 leading-snug">{tr("Прогресс сохранён. Чтобы вернуться, понадобится ID сессии — скопируйте его, пока он перед глазами.")}</p>
                        {profile && <SessionIdBadge sessionKey={profile.sessionKey} sessionId={profile.sessionId} onCopy={showToast} size="lg" />}
                        <div className="w-full grid grid-cols-2 gap-3 pt-1">
                            <button type="button" onClick={() => setShowExitConfirm(false)} className="btn-secondary">{tr("Остаться")}</button>
                            <button type="button" onClick={handleExitSession} className="btn-danger">{tr("Выйти")}</button>
                        </div>
                    </div>
                </PopupModal>
            );
            const addPlayerField = () => { if(playersForm.length >= MAX_PLAYERS) return; SoundFX.click(); setPlayersForm([...playersForm, { id: 'p'+Date.now(), name: '', gender: 'guy' }]); };

            const handleUnlockAdmin = async (e) => {
                e.preventDefault(); if (await verifyAdminSecret(adminForm.email, adminForm.pass)) { const t = await Auth.token(); SoundFX.success(); setIsAdmin(true); localStorage.setItem(ADMIN_STORAGE_KEY, "true"); setAdminForm({email:'', pass:''}); setAdminPinError(''); if(t) cleanupOldSessions(t); } else { SoundFX.warn(); setAdminPinError(tr('Неверный Email или Пароль')); }
            };
            const handleLockAdmin = () => { SoundFX.click(); setIsAdmin(false); localStorage.removeItem(ADMIN_STORAGE_KEY); Auth.ownerLogout(); };
            const [syncBusy, setSyncBusy] = useState(false);
            // Дозаповнення українських перекладів для всіх наявних питань (переклад у браузері — Pollinations тут стабільний).
            const handleTranslateAll = async () => {
                if (!isAdmin || syncBusy) return; if (!Auth.hasOwner()) { SoundFX.warn(); showToast(tr('Увійдіть як власник'), 2600, 'warn'); return; }
                const pending = db.filter(q => !(q.cleanTextUk && q.cleanTextUk.trim()));
                if (!pending.length) { showToast(tr('Усі питання вже перекладені')); return; }
                SoundFX.click(); setSyncBusy(true); let okN = 0;
                try {
                    for (let i = 0; i < pending.length; i++) {
                        const q = pending[i]; const uk = await translateText(q.cleanText, 'uk');
                        if (uk) { await fetchWithTimeout(`${FIREBASE_BASE_URL}${dbSubPath}/${q.dbKey}.json`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text_uk: uk }) }).catch(() => {}); setDb(prev => prev.map(x => x.dbKey === q.dbKey ? { ...x, cleanTextUk: uk } : x)); okN++; }
                        if ((i + 1) % 15 === 0) showToast(`${tr('Перекладаю')} ${i + 1}/${pending.length}`, 1500);
                    }
                    SoundFX.success(); showToast(`${tr('Перекладено')}: ${okN}/${pending.length}`, 3000);
                } catch (e) { SoundFX.warn(); showToast(`${tr('Перервано')}: ${okN}/${pending.length}`, 3000, 'warn'); } finally { setSyncBusy(false); }
            };

            const parseDatabaseObject = (rawObj) => {
                const entries = Object.entries(rawObj); const parsed = [];
                for (let i = 0; i < entries.length; i++) { const [dbKey, item] = entries[i]; if (!item || typeof item !== 'object' || !item.text) continue; if (item.categoryId === "_session" || String(dbKey).startsWith("sess_")) continue; const matchNum = String(item.text).match(/^№\s*(\d+)\.\s*(.*)/s); const cleanText = matchNum ? matchNum[2].trim() : String(item.text).trim(); parsed.push({ dbKey: String(dbKey), id: item.id || `q_${i + 1}`, origNum: item.num ? Number(item.num) : (matchNum ? Number(matchNum[1]) : i + 1), categoryId: item.categoryId || "family", level: item.level || "Простые", cleanText: cleanText, cleanTextUk: (item.text_uk ? String(item.text_uk).replace(/^№\s*\d+\.\s*/, '').trim() : ""), audience: (item.audience === 'couple' || item.audience === 'group') ? item.audience : 'both', targetId: item.targetId || "", hidden: item.hidden === true }); }
                parsed.sort((a, b) => a.origNum - b.origNum); return reindexSequential(parsed);
            };

            useEffect(() => {
                let active = true;
                const initDatabase = async () => {
                    setLoadError('');
                    try {
                        const cached = JSON.parse(localStorage.getItem(OFFLINE_DB_CACHE_KEY) || 'null');
                        if (active && Array.isArray(cached) && cached.length) { setDb(cached); setIsLoading(false); }
                    } catch (e) {}
                    try {
                        const response = await fetchWithTimeout(`${FIREBASE_BASE_URL}/questions.json?t=${Date.now()}`);
                        if (!response.ok) throw new Error('HTTP ' + response.status);
                        const parsed = parseDatabaseObject((await response.json()) || {});
                        if (!active) return;
                        setDb(parsed); setDbSubPath('/questions');
                        if (!parsed.length) setLoadError(tr("В базе пока нет вопросов"));
                        try { localStorage.setItem(OFFLINE_DB_CACHE_KEY, JSON.stringify(parsed)); } catch (e) {}
                    } catch (error) { if (active) setLoadError(tr("Не удалось загрузить вопросы. Проверьте интернет")); }
                    finally { if (active) setIsLoading(false); }
                };
                initDatabase();
                return () => { active = false; };
            }, [dbLoadAttempt]);

            const [questionAudience, setQuestionAudience] = useState('');
            useEffect(() => {
                let active = true; setQuestionAudience('');
                if (isValidAESKey(profile?.sessionKey)) questionAudienceKey(profile.sessionKey).then(value => { if (active) setQuestionAudience(value); }).catch(() => {});
                return () => { active = false; };
            }, [profile?.sessionKey]);
            const profileDb = useMemo(() => {
                const archSet = new Set(profile?.archivedIds || []); const disSet = new Set(profile?.disabledIds || []); const mySid = profile?.sessionId;
                return db.filter(q => (!q.hidden || isAdmin) && (!q.targetId || String(q.targetId).trim() === '' || q.targetId === mySid || q.targetId === questionAudience)).map(q => ({ ...q, archived: archSet.has(q.id) || archSet.has(q.dbKey), disabled: disSet.has(q.id) || disSet.has(q.dbKey) }));
            }, [db, profile, isAdmin, questionAudience]);

            const stats = useMemo(() => {
                const activeByCat = {}; const totalByCat = {}; const archivedByCat = {}; CATEGORIES.forEach(c => { activeByCat[c.id] = 0; totalByCat[c.id] = 0; archivedByCat[c.id] = 0; });
                let availableActive = 0, availableTotal = 0, disabledCount = 0, hiddenCount = 0; const archivedList = [];
                for (let i = 0; i < profileDb.length; i++) { const q = profileDb[i]; if (q.hidden) { hiddenCount++; continue; } if (totalByCat[q.categoryId] !== undefined) totalByCat[q.categoryId]++; const matchesDiff = selectedDiffs.includes(q.level); const matchesCat = selectedCats.includes(q.categoryId); if (q.disabled) disabledCount++; if (q.archived) { archivedList.push(q); if (archivedByCat[q.categoryId] !== undefined) archivedByCat[q.categoryId]++; } else if (!q.disabled) { if (activeByCat[q.categoryId] !== undefined) activeByCat[q.categoryId]++; if (matchesCat && matchesDiff) availableActive++; } if (matchesCat && matchesDiff) availableTotal++; }
                return { activeByCat, totalByCat, archivedByCat, availableActive, availableTotal, disabledCount, archivedList, hiddenCount };
            }, [profileDb, selectedCats, selectedDiffs, topicsVersion]);

            const toggleCategory = (catId) => { if (stats.activeByCat[catId] === 0 && stats.totalByCat[catId] === 0) return; const willBeSelected = !selectedCats.includes(catId); SoundFX.toggle(willBeSelected); setSelectedCats(prev => willBeSelected ? [...prev, catId] : prev.filter(id => id !== catId)); };
            const toggleDiff = (diffId) => { const willBeSelected = !selectedDiffs.includes(diffId); SoundFX.toggle(willBeSelected); setSelectedDiffs(prev => willBeSelected ? [...prev, diffId] : prev.filter(id => id !== diffId)); };
            
            const updateSavedGameProgress = (questionsArr, cIdx, mIdx, tHist, extraArchivedKey = null) => {
                setProfile(prev => { if (!prev) return prev; const qIds = questionsArr.map(q => q.id || q.dbKey); const nextArchived = extraArchivedKey ? Array.from(new Set([...(prev.archivedIds || []), extraArchivedKey])) : (prev.archivedIds || []); return { ...prev, archivedIds: nextArchived, savedGame: { questionIds: qIds, currentIndex: cIdx, maxReachedIndex: mIdx, turnHistory: tHist }, updatedAt: Date.now() }; });
            };

            const pendingTurnRef = useRef(null); const turnHistoryRef = useRef(turnHistory); turnHistoryRef.current = turnHistory;
            const commitTurn = (idx, entry, q) => {
                if (entry && entry.cur && gameLogRef.current) gameLogRef.current.turnStart = Date.now();
                const stamped = (entry && liveRoomRef.current) ? { ...entry, dev: deviceIdRef.current } : entry;
                const next = { ...turnHistoryRef.current, [idx]: stamped }; turnHistoryRef.current = next;
                setTurnHistory(next); updateSavedGameProgress(q, idx, Math.max(maxReachedIndex, idx), next);
            };
            const startSpin = (idx, candidates, answered, q, skippedBy = []) => {
                rouletteTimeoutsRef.current.forEach(t => clearTimeout(t)); rouletteTimeoutsRef.current = [];
                const winner = candidates[Math.floor(Math.random() * candidates.length)].id;
                pendingTurnRef.current = { idx, entry: { cur: winner, answered, skippedBy }, q };
                liveSpin(idx, candidates, winner);
                setTurnPopup({ open: true, spinning: true, winner, spinId: Date.now(), candidates: candidates.map(p => ({ id: p.id, name: p.name, gender: p.gender })) });
                const delays = [140, 155, 170, 190, 210, 235, 260, 290, 320, 350]; let acc = 0;
                delays.forEach((d, i) => {
                    acc += d;
                    const tid = setTimeout(() => {
                        if (i < delays.length - 1) { SoundFX.rouletteTick(); return; }
                        SoundFX.rouletteWin();
                        const p = pendingTurnRef.current; pendingTurnRef.current = null;
                        if (p) commitTurn(p.idx, p.entry, p.q);
                        setTurnPopup(st => ({ ...st, spinning: false }));
                    }, acc);
                    rouletteTimeoutsRef.current.push(tid);
                });
            };
            const triggerRouletteForIndex = (targetIdx, currentHistory, questionsForSave = gameQuestions) => {
                if (currentHistory[targetIdx] || !profile?.players?.length) return;
                if (profile.players.length === 1) { commitTurn(targetIdx, { cur: profile.players[0].id, answered: [] }, questionsForSave); return; }
                startSpin(targetIdx, profile.players, [], questionsForSave);
            };
            const applyTurnStep = (step) => {
                if (step.type === 'done') { SoundFX.success(); commitTurn(currentIndex, step.entry, gameQuestions); }
                else if (step.type === 'auto') { SoundFX.rouletteWin(); commitTurn(currentIndex, step.entry, gameQuestions); showToast(tf("Теперь отвечает {v0}", { v0: step.player.name }), 2800, 'turn'); }
                else startSpin(currentIndex, step.candidates, step.answered, gameQuestions, step.skippedBy);
            };
            const advanceTurn = () => {
                if (gameMode !== 'normal' || !profile?.players) return false;
                const step = nextTurnStep(turnHistory[currentIndex], profile.players);
                if (!step) return false;
                logTurnEnd('answer'); applyTurnStep(step);
                return true;
            };
            const performPlayerSkip = () => {
                const e = normTurn(turnHistory[currentIndex]);
                if (gameMode !== 'normal' || !profile?.players || !e || !e.cur) return;
                const step = nextTurnStep({ ...e, skippedBy: [...e.skippedBy, e.cur] }, profile.players);
                if (step) { logTurnEnd('skip'); SoundFX.click(); applyTurnStep(step); }
            };
            const skipForPlayer = () => {
                setShowSkipPopup(false);
                const e = normTurn(turnHistory[currentIndex]);
                if (gameMode !== 'normal' || !profile?.players || !e || !e.cur) return;
                const qNow = gameQuestions[currentIndex];
                const pun = fx.punishOn ? pickPunishment(allPunishments, qNow && qNow.level) : null;
                if (pun) { const who = profile.players.find(p => p.id === e.cur); logPunish(pun.text); SoundFX.warn(); const pn = { reason: 'skip', player: who ? who.name : '', text: pun.text, icon: pun.icon || '🎭' }; setPunDoneKey(timerKey); setPunish({ open: true, ...pn }); livePun({ ...pn, key: timerKey }); return; }
                performPlayerSkip();
            };
            const skipForAll = () => {
                setShowSkipPopup(false);
                if (gameMode !== 'normal' || !profile?.players) return;
                const ids = profile.players.map(p => p.id);
                logTurnEnd('skip'); SoundFX.warn();
                commitTurn(currentIndex, { cur: null, answered: ids, skippedBy: ids, skippedAll: true }, gameQuestions);
            };
            const GROUP_EMOJIS_SHUFFLED = useMemo(() => { const a = [...GROUP_EMOJIS]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }, [profile?.sessionId]);
            useEffect(() => { document.title = tr(SCREEN_TITLES[screen] || 'ASK ME — игра для пар и компаний'); }, [screen, lang]);
            // «Жар» комнаты: свет фона теплеет вместе со сложностью текущего вопроса (только на экране игры)
            useEffect(() => {
                const root = document.documentElement; const q = screen === 'game' ? gameQuestions[currentIndex] : null;
                root.dataset.screen = screen; root.dataset.heat = q ? (q.level === 'Глубокие' ? 'deep' : q.level === 'Средние' ? 'mid' : 'easy') : 'idle';
            }, [screen, currentIndex, gameQuestions]);
            // Экономный режим фона: слабые устройства, «экономия трафика», скрытая вкладка
            useEffect(() => {
                const root = document.documentElement; const nav = navigator; const conn = nav.connection || {};
                const weak = (nav.deviceMemory && nav.deviceMemory <= 2) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) || conn.saveData === true;
                root.classList.toggle('fx-lite', !!weak);
                const onVis = () => root.classList.toggle('fx-paused', document.hidden);
                document.addEventListener('visibilitychange', onVis); onVis();
                return () => document.removeEventListener('visibilitychange', onVis);
            }, []);
            const cardRef = useRef(null);
            const peekNextRef = useRef(null);
            const peekPrevRef = useRef(null);
            const swipeRef = useRef({ id: null, x0: 0, y0: 0, locked: null, lx: 0, lt: 0, vx: 0 });
            const swipeTimerRef = useRef(null);
            const [swipeHint, setSwipeHint] = useState('');
            useEffect(() => () => clearTimeout(swipeTimerRef.current), []);
            const SWIPE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
            // карточка под основной (следующая или предыдущая): проявляется и «поднимается» по мере того, как основную уводят в сторону; только opacity и transform
            const applyPeek = (dx, mode) => {
                const p = Math.min(1, Math.abs(dx) / 110);
                const tr = mode === 'out' ? 'opacity 260ms ease-out, transform 300ms cubic-bezier(0.22, 1, 0.36, 1)' : mode === 'spring' ? 'opacity 240ms ease-out, transform 380ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
                [[peekNextRef.current, dx > 0], [peekPrevRef.current, dx < 0]].forEach(([el, on]) => {
                    if (!el) return;
                    const q = on ? (mode === 'out' ? 1 : p) : 0;
                    el.style.transition = tr; el.style.opacity = String(q); el.style.transform = `translate3d(0,${((1 - q) * 14).toFixed(1)}px,0) scale(${(0.92 + 0.08 * q).toFixed(3)})`;
                });
            };
            // світіння краю картки під час перетягування: сторона — напрям, колір — можна (rose) чи ні (amber); відблиск їде слідом за пальцем
            const glowRef = useRef(null);
            const applyGlow = (dx, mode) => {
                const g = glowRef.current; if (!g) return;
                const p = Math.min(1, Math.abs(dx) / 140); const dir = dx > 0 ? 'right' : 'left';
                g.dataset.side = dir; g.dataset.ok = dx !== 0 && !swipeAllowed(dir) ? 'no' : 'yes';
                g.style.transition = mode === 'none' ? 'none' : 'opacity 260ms ease-out';
                g.style.opacity = String(p);
                const shine = g.firstChild; if (shine) { shine.style.transition = g.style.transition; shine.style.transform = `translate3d(${-dx * 0.6}px,0,0)`; }
            };
            const applySwipe = (dx, mode, scale = 1) => {
                const el = cardRef.current; if (!el) return;
                // уход: ускоряется (как брошенная карточка), прозрачность гаснет чуть позже старта; возврат — мягкая пружина без сильного «перелёта»
                el.style.transition = mode === 'out' ? 'transform 300ms cubic-bezier(0.45, 0, 0.9, 0.6), opacity 220ms ease-in 70ms' : mode === 'spring' ? 'transform 420ms cubic-bezier(0.22, 1.25, 0.36, 1), opacity 200ms ease-out' : mode === 'enter' ? `transform 380ms ${SWIPE_EASE}, opacity 300ms ease-out` : 'none';
                el.style.transformOrigin = '50% 115%';
                el.style.transform = `translate3d(${dx}px,0,0) rotate(${(dx * 0.045).toFixed(2)}deg) scale(${scale})`;
                el.style.opacity = String(mode === 'out' ? 0 : 1);
                applyPeek(mode === 'enter' ? 0 : dx, mode === 'enter' ? 'none' : mode);
                applyGlow(mode === 'enter' || mode === 'spring' ? 0 : dx, mode);
            };
            const swipeBusy = () => turnPopup.open || showSkipPopup || showEndGameConfirm || punish.open || (timerKey !== '' && tm.key === timerKey && timerDismissKey !== timerKey);
            const swipeAllowed = (dir) => {
                if (screen !== 'game' || !gameQuestions.length) return false;
                const last = currentIndex === gameQuestions.length - 1;
                if (dir === 'left') return currentIndex > 0;
                if (gameMode === 'test') return !last;
                const e = normTurn(turnHistory[currentIndex]);
                if (!e) return false;
                const done = !e.cur && (profile?.players || []).every(p => e.answered.includes(p.id));
                return !(done && last);
            };
            const performSwipe = (dir) => { if (dir === 'left') handlePrevQuestion(); else handleNextQuestion(); };
            const swipeLabel = (dir) => !swipeAllowed(dir) ? (dir === 'left' && currentIndex === 0 ? tr("Это первый вопрос") : tr("Здесь нельзя")) : (dir === 'left' ? tr("← Назад") : tr("Далее →"));
            const onSwipeStart = (e) => {
                if (swipeBusy() || (e.target.closest && e.target.closest('button,a,input,textarea,select'))) return;
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                swipeRef.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, locked: null, lx: e.clientX, lt: performance.now(), vx: 0 };
            };
            const onSwipeMove = (e) => {
                const s = swipeRef.current; if (s.id !== e.pointerId) return;
                const raw = e.clientX - s.x0, dy = e.clientY - s.y0;
                if (s.locked === null) {
                    if (Math.abs(raw) < 8 && Math.abs(dy) < 8) return;
                    s.locked = Math.abs(raw) > Math.abs(dy) ? 'x' : 'y';
                    if (s.locked === 'x') { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} }
                }
                if (s.locked !== 'x') return;
                const now = performance.now(), dt = now - s.lt;
                if (dt >= 8) { s.vx = 0.7 * s.vx + 0.3 * ((e.clientX - s.lx) / dt); s.lx = e.clientX; s.lt = now; }
                const a = Math.abs(raw);
                const damped = (a < 110 ? a : 110 + (a - 110) * 0.4) * Math.sign(raw);
                applySwipe(Math.max(-230, Math.min(230, damped)), 'none');
                setSwipeHint(a > 28 ? swipeLabel(raw > 0 ? 'right' : 'left') : '');
            };
            const onSwipeEnd = (e) => {
                const s = swipeRef.current; if (s.id !== e.pointerId) return;
                swipeRef.current = { id: null, x0: 0, y0: 0, locked: null, lx: 0, lt: 0, vx: 0 };
                setSwipeHint('');
                if (s.locked !== 'x') return;
                const dx = e.clientX - s.x0, w = e.currentTarget.getBoundingClientRect().width;
                const dir = dx > 0 ? 'right' : 'left';
                const far = Math.abs(dx) >= Math.min(110, w * 0.25) || (Math.abs(s.vx) > 0.5 && Math.abs(dx) > 36);
                if (!far || !swipeAllowed(dir)) { if (far) SoundFX.warn(); applySwipe(0, 'spring'); return; }
                commitSwipe(dir);
            };
            // уход карточки и смена вопроса: карточка улетает (300 мс), потом меняется вопрос, а новая карточка проявляется уже на месте.
            // Смену вопроса замечает layout-эффект ниже (до отрисовки кадра), поэтому между «улетела» и «появилась» нет вспышки старой карточки
            const swipePendingRef = useRef('');
            const commitSwipe = (dir) => {
                SoundFX.flip(dir); SoundFX.skipNextFlip = true;
                swipePendingRef.current = dir;
                applySwipe(dir === 'right' ? 520 : -520, 'out', 0.94);
                clearTimeout(swipeTimerRef.current);
                swipeTimerRef.current = setTimeout(() => {
                    performSwipe(dir); SoundFX.skipNextFlip = false;
                    // вопрос не сменился (например, ход перешёл к следующему игроку на той же карточке): карточка возвращается на место сама
                    swipeTimerRef.current = setTimeout(() => {
                        if (!swipePendingRef.current) return;
                        swipePendingRef.current = '';
                        applySwipe(dir === 'right' ? -40 : 40, 'none', 0.96); if (cardRef.current) cardRef.current.style.opacity = '0';
                        requestAnimationFrame(() => requestAnimationFrame(() => applySwipe(0, 'enter', 1)));
                    }, 120);
                }, 300);
            };
            // смена вопроса (свайп, клавиши, кнопки или другое устройство): направление остаётся на слое до следующей смены, чтобы анимация не запускалась повторно
            const prevIdxRef = useRef(currentIndex);
            React.useLayoutEffect(() => {
                const prev = prevIdxRef.current; prevIdxRef.current = currentIndex; if (prev === currentIndex) return;
                const el = cardRef.current; const pend = swipePendingRef.current; const dir = pend || (currentIndex > prev ? 'right' : 'left');
                if (pend) {
                    swipePendingRef.current = ''; clearTimeout(swipeTimerRef.current);
                    applySwipe(0, 'none', 1); // новая карточка уже в DOM: основной слой на месте, без перехода
                    [peekNextRef.current, peekPrevRef.current].forEach(pe => { if (pe) { pe.style.transition = 'opacity 260ms ease-out'; pe.style.opacity = '0'; } });
                }
                if (el) el.dataset.enter = dir; // CSS (.game-card) проявляет новую карточку
            }, [currentIndex]);
            const onSwipeCancel = (e) => { if (swipeRef.current.id === e.pointerId) { swipeRef.current = { id: null, x0: 0, y0: 0, locked: null, lx: 0, lt: 0, vx: 0 }; setSwipeHint(''); applySwipe(0, 'spring'); } };
            useEffect(() => {
                if (screen !== 'game') return;
                const onKey = (e) => {
                    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
                    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                    const wantNext = e.key === 'ArrowRight';
                                        if (swipeBusy()) return;
                    const dir = wantNext ? 'right' : 'left';
                    if (swipeAllowed(dir)) commitSwipe(dir);
                };
                window.addEventListener('keydown', onKey);
                return () => window.removeEventListener('keydown', onKey);
            });
            useEffect(() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {} }, [settings]);
            const turnE = normTurn(turnHistory[currentIndex]);
            const [punDoneKey, setPunDoneKey] = useState('');
            const rawTimerKey = (fx.timerOn && screen === 'game' && gameMode === 'normal' && turnE && turnE.cur) ? `${currentIndex}:${turnE.cur}:${turnE.answered.length}` : '';
            const timerKey = rawTimerKey !== punDoneKey ? rawTimerKey : '';
            const timerPaused = turnPopup.open || showSkipPopup || showEndGameConfirm || punish.open;
            useEffect(() => { if (timerKey) setTm({ key: timerKey, left: fx.timerSec }); }, [timerKey, fx.timerSec]);
            useEffect(() => {
                if (!timerKey || timerPaused) return;
                const id = setInterval(() => setTm(t => (t.key === timerKey ? { ...t, left: t.left - 1 } : t)), 1000);
                return () => clearInterval(id);
            }, [timerKey, timerPaused]);
            useEffect(() => {
                if (!timerKey || timerPaused || tm.key !== timerKey) return;
                if (tm.left > 0 && tm.left <= 3) SoundFX.rouletteTick();
                const rawTurn = turnHistory[currentIndex], owner = !liveRoomRef.current || !rawTurn || !rawTurn.dev || rawTurn.dev === deviceIdRef.current;
                // если хозяин хода пропал, наказание выдаёт один из остальных: по очереди, чтобы не выдали сразу несколько устройств
                const queue = liveIdsRef.current.filter(id => id !== (rawTurn && rawTurn.dev)).sort(), at = queue.indexOf(deviceIdRef.current), rank = at >= 0 ? at : queue.length;
                if (tm.left <= (owner ? 0 : -(LIVE_TAKEOVER_S + rank * LIVE_TAKEOVER_STEP_S))) {
                    const who = profile?.players?.find(p => p.id === turnE.cur);
                    const qNow = gameQuestions[currentIndex];
                    const pun = fx.punishOn ? pickPunishment(allPunishments, qNow && qNow.level) : null;
                    logPunish(pun ? pun.text : ''); SoundFX.warn();
                    const pn = { reason: 'timer', player: who ? who.name : '', text: pun ? pun.text : '', icon: pun ? (pun.icon || '🎭') : '⏰' };
                    setPunDoneKey(timerKey); setPunish({ open: true, ...pn }); livePun({ ...pn, key: timerKey });
                }
            }, [tm.left, tm.key, timerKey, timerPaused]);
            const closePunish = () => { const remote = !!punish.remote; setPunish(p => ({ ...p, open: false })); if (!remote) performPlayerSkip(); };
            const startFromPregame = () => { if (!(settings.timerOn || settings.punishOn)) { SoundFX.warn(); return; } setHardMode(true); startWithMode('normal', { hard: true }); };
            const patchSettings = (patch) => setSettings(st => ({ ...st, ...patch }));
            const addPunishment = () => {
                const t = sanitizeInput(newPunish, 80);
                if (t.length < 3) { SoundFX.warn(); setPunishErr(tr("Опишите наказание хотя бы парой слов")); return; }
                if (allPunishments.length >= 60) { SoundFX.warn(); setPunishErr(tr("Максимум 60 наказаний")); return; }
                SoundFX.click();
                setSettings(st => ({ ...st, punishments: [...st.punishments, { id: 'c' + Date.now(), text: t, level: newPunishLevel, icon: '🎭', custom: true }] }));
                setNewPunish(''); setPunishErr(''); setShowAddPunish(false);
            };
            const chip = "px-3 py-1.5 rounded-full border border-white/12 bg-white/[0.04] text-zinc-200";
            const pregameContent = (
                <div className="flex flex-col gap-5 text-left">
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-white">{tr("Усложнённый режим")}</h3>
                            <p className="text-sm text-zinc-400 mt-1 leading-snug">{tr("Добавьте азарта: включите хотя бы одно усложнение — таймер на ответ или наказания.")}</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2 text-xs font-bold ">
                            <span className={chip}>⏱ {settings.timerOn ? tf("{v0} с на ответ", { v0: settings.timerSec }) : tr("без таймера")}</span>
                            <span className={chip}>🎭 {settings.punishOn ? tr("наказания включены") : tr("без наказаний")}</span>
                        </div>
                        {(
                            <div className="flex flex-col gap-5 fade-in">
                                <FxTimerCard on={settings.timerOn} sec={settings.timerSec} onToggle={() => { SoundFX.click(); patchSettings({ timerOn: !settings.timerOn }); }} onSec={(n) => patchSettings({ timerSec: n })} />
                                <section className={`fx-card ${settings.punishOn ? 'is-on' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        <span aria-hidden="true" className="fx-ico">🎭</span>
                                        <div className="flex-1 min-w-0"><div className="text-sm font-bold text-white">{tr("Наказания")}</div><div className="text-xs text-zinc-400 leading-snug">{tr("Случайное задание, если время вышло. Можно привязать к сложности вопроса.")}</div></div>
                                        <SettingSwitch on={settings.punishOn} onChange={() => { SoundFX.click(); patchSettings({ punishOn: !settings.punishOn }); }} label={tr("Наказания")} />
                                    </div>
                                    {settings.punishOn && (
                                        <div className="fx-body flex flex-col gap-2 fade-in">
                                            <div className="flex flex-col gap-5">
                                                {LEVEL_OPTIONS.map(([lv, label]) => {
                                                    const items = allPunishments.filter(p => p.level === lv);
                                                    if (!items.length) return null;
                                                    return (
                                                        <div key={lv} className="flex flex-col gap-2">
                                                            <h3 className="text-xs font-bold text-zinc-500">{tr(label)}</h3>
                                                            {items.map(p => (
                                                                <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
                                                                    <span aria-hidden="true" className="w-10 h-10 rounded-full bg-white/[0.07] flex items-center justify-center text-lg flex-shrink-0">{p.icon || '🎭'}</span>
                                                                    <span className="flex-1 min-w-0 text-sm text-zinc-100 leading-snug">{tr(p.text)}</span>
                                                                    <button type="button" aria-label={p.custom ? tr("Удалить наказание") : tr("Скрыть наказание")} title={p.custom ? tr("Удалить") : tr("Скрыть у меня")} onClick={() => { SoundFX.click(); setSettings(st => p.custom ? ({ ...st, punishments: st.punishments.filter(x => x.id !== p.id) }) : ({ ...st, hiddenTemplates: [...(st.hiddenTemplates || []), p.id] })); }} className="btn-icon plain flex-shrink-0">✕</button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })}
                                                {(settings.hiddenTemplates || []).length > 0 && ( <button type="button" onClick={() => { SoundFX.click(); setSettings(st => ({ ...st, hiddenTemplates: [] })); }} className="btn-text muted underline underline-offset-4 self-start">{tr("Вернуть скрытые (")}{(settings.hiddenTemplates || []).length})</button> )}
                                            </div>
                                            {!showAddPunish ? (
                                                <button type="button" onClick={() => { SoundFX.click(); setShowAddPunish(true); }} className="btn-secondary w-full">{tr("+ Добавить наказание")}</button>
                                            ) : (
                                                <div className="flex flex-col gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-4 fade-in">
                                                    <h3 className="text-sm font-bold text-white">{tr("Новое наказание")}</h3>
                                                    <input type="text" maxLength={80} value={newPunish} onChange={e => { setNewPunish(e.target.value); setPunishErr(''); }} placeholder={tr("Например: спой припев любимой песни")} aria-label={tr("Текст наказания")} className="px-4 text-sm" />
                                                    {punishErr && <span className="ui-error">{punishErr}</span>}
                                                    <select value={newPunishLevel} onChange={e => setNewPunishLevel(e.target.value)} aria-label={tr("Для какой сложности вопроса")} className="px-4 text-sm text-white">
                                                        {LEVEL_OPTIONS.map(o => <option key={o[0]} value={o[0]} className="bg-[#0a0710]">{tr(o[1])}</option>)}
                                                    </select>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <button type="button" onClick={() => { SoundFX.click(); setShowAddPunish(false); setNewPunish(''); setPunishErr(''); }} className="btn-secondary">{tr("Отмена")}</button>
                                                        <button type="button" onClick={addPunishment} className="btn-primary">{tr("Добавить")}</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}
                        <div className="flex flex-col gap-2">
                            <button type="button" disabled={!(settings.timerOn || settings.punishOn)} onClick={startFromPregame} className="btn-primary w-full">{tr("Начать игру")}</button>
                            {!(settings.timerOn || settings.punishOn) && <p role="alert" className="inline-error"><span aria-hidden="true" className="inline-error-i">!</span><span>{tr("Включите хотя бы одно усложнение: таймер или наказания.")}</span></p>}
                        </div>
                    </div>
            );
            const syncNewTopics = () => {
                try {
                    const seen = JSON.parse(localStorage.getItem('askme_seen_topics_v1') || '[]');
                    const fresh = CATEGORIES.filter(c => (c.custom || NEW_BASE_TOPICS.includes(c.id)) && !seen.includes(c.id)).map(c => c.id);
                    if (fresh.length) { setSelectedCats(prev => [...prev, ...fresh.filter(id => !prev.includes(id))]); localStorage.setItem('askme_seen_topics_v1', JSON.stringify([...seen, ...fresh])); }
                } catch (e) {}
            };
            useEffect(() => {
                let off = false;
                (async () => {
                    try {
                        const res = await fetchWithTimeout(`${FIREBASE_BASE_URL}/topics.json?t=${Date.now()}`);
                        if (!res.ok) return;
                        const data = await res.json();
                        if (off) return;
                        if (!data) { syncNewTopics(); return; }
                        topicsDataRef.current = { custom: (data.custom && typeof data.custom === 'object') ? data.custom : {}, order: Array.isArray(data.order) ? data.order : Object.values(data.order || {}) };
                        applyTopics(topicsDataRef.current);
                        try { localStorage.setItem(TOPICS_CACHE_KEY, JSON.stringify(topicsDataRef.current)); } catch (e) {}
                        syncNewTopics(); setTopicsVersion(v => v + 1);
                    } catch (e) {}
                })();
                return () => { off = true; };
            }, []);
            const writeTopics = async (data) => {
                const res = await fetchWithTimeout(`${FIREBASE_BASE_URL}/topics.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ custom: data.custom, order: data.order }) });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                topicsDataRef.current = data; applyTopics(data);
                try { localStorage.setItem(TOPICS_CACHE_KEY, JSON.stringify(data)); } catch (e) {}
                syncNewTopics(); setTopicsVersion(v => v + 1);
            };
            const addTopic = async () => {
                const name = sanitizeInput(newTopicName, 30).trim();
                const icon = (newTopicIcon || '').trim().slice(0, 16) || '✨';
                if (!/\p{Extended_Pictographic}/u.test(icon)) { SoundFX.warn(); setTopicErr(tr('Введите эмодзи, например 🌍')); return; }
                if (name.length < 2) { SoundFX.warn(); setTopicErr(tr('Назовите тему хотя бы двумя буквами')); return; }
                if (CATEGORIES.some(c => c.name.toLowerCase() === name.toLowerCase())) { SoundFX.warn(); setTopicErr(tr('Тема с таким названием уже есть')); return; }
                if (CATEGORIES.length >= 30) { SoundFX.warn(); setTopicErr(tr('Максимум — 30 тем')); return; }
                setTopicBusy(true);
                try {
                    const id = 'c' + Date.now().toString(36);
                    const order = CATEGORIES.map(c => c.id).concat(id);
                    await writeTopics({ custom: { ...topicsDataRef.current.custom, [id]: { id, name, icon } }, order });
                    setTopicDraft(order); setNewTopicName(''); setNewTopicIcon(''); setTopicErr('');
                    SoundFX.success(); showToast(tr('Тема добавлена'));
                } catch (e) { showErrorPopup(tr('Тема не сохранилась'), tr("Проверьте интернет и вход владельца, затем попробуйте ещё раз.")); }
                setTopicBusy(false);
            };
            const saveTopicOrder = async () => {
                setTopicBusy(true);
                try { await writeTopics({ custom: topicsDataRef.current.custom, order: topicDraft }); SoundFX.success(); showToast(tr('Порядок тем сохранён')); }
                catch (e) { showErrorPopup(tr('Порядок не сохранился'), tr("Проверьте интернет и вход владельца, затем попробуйте ещё раз.")); }
                setTopicBusy(false);
            };
            useEffect(() => {
                let off = false;
                (async () => {
                    try {
                        const res = await fetchWithTimeout(`${FIREBASE_BASE_URL}/punishments.json?t=${Date.now()}`);
                        if (!res.ok) return;
                        const list = templatesFromDb(await res.json());
                        if (off || !list.length) return;
                        setPunishTemplates(list);
                        try { localStorage.setItem(PUNISH_CACHE_KEY, JSON.stringify(list)); } catch (e) {}
                    } catch (e) {}
                })();
                return () => { off = true; };
            }, []);
            useEffect(() => {
                let off = false;
                todLoadCards(todCardsEnv).then(r => { if (!off) { todCardsRef.current = r.list; setTodCards(r.list); setTodSource(r.source); } }).catch(() => {});
                return () => { off = true; };
            }, []);
            const writePunishTemplates = async (list) => {
                const obj = {}; list.forEach((t, i) => { obj[t.id] = { id: t.id, text: t.text, level: t.level, icon: t.icon || '🎭', n: i }; });
                const res = await fetchWithTimeout(`${FIREBASE_BASE_URL}/punishments.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                setPunishTemplates(list);
                try { localStorage.setItem(PUNISH_CACHE_KEY, JSON.stringify(list)); } catch (e) {}
            };
            const startPtEdit = (t) => { SoundFX.click(); setPtEdit(t ? t.id : 'new'); setPtText(t ? t.text : ''); setPtIcon(t ? t.icon : ''); setPtLevel(t ? t.level : 'any'); setPtErr(''); setPtConfirmId(''); };
            const savePt = async () => {
                const text = sanitizeInput(ptText, 80).trim(); const icon = (ptIcon || '').trim().slice(0, 16) || '🎭';
                if (text.length < 3) { SoundFX.warn(); setPtErr(tr('Опишите наказание хотя бы парой слов')); return; }
                if (!/\p{Extended_Pictographic}/u.test(icon)) { SoundFX.warn(); setPtErr(tr('Введите эмодзи, например 🎤')); return; }
                if (ptEdit === 'new' && punishTemplates.length >= 100) { SoundFX.warn(); setPtErr(tr('Максимум — 100 шаблонов')); return; }
                setPtBusy(true);
                try {
                    const next = ptEdit === 'new' ? [...punishTemplates, { id: 't' + Date.now().toString(36), text, level: ptLevel, icon }] : punishTemplates.map(t => t.id === ptEdit ? { ...t, text, level: ptLevel, icon } : t);
                    await writePunishTemplates(next); SoundFX.success(); showToast(tr('Шаблон сохранён')); setPtEdit(null); setPtErr('');
                } catch (e) { showErrorPopup(tr('Шаблон не сохранился'), tr("Проверьте интернет и вход владельца, затем попробуйте ещё раз.")); }
                setPtBusy(false);
            };
            const deletePt = async (id) => {
                if (ptConfirmId !== id) { SoundFX.warn(); setPtConfirmId(id); setPtErr(''); return; }
                if (punishTemplates.length <= 1) { SoundFX.warn(); setPtErr(tr('Нужен хотя бы один шаблон')); setPtConfirmId(''); return; }
                setPtBusy(true);
                try { await writePunishTemplates(punishTemplates.filter(t => t.id !== id)); SoundFX.success(); showToast(tr('Шаблон удалён')); }
                catch (e) { showErrorPopup(tr('Шаблон не удалился'), tr("Проверьте интернет и вход владельца, затем попробуйте ещё раз.")); }
                setPtConfirmId(''); setPtBusy(false);
            };
            // ---- режим «Правда или действие»: запись карточек из админки ----
            const todSetList = (list, source, writeCache) => { todCardsRef.current = list; setTodCards(list); setTodSource(source); if (writeCache) todWriteCache(todCardsEnv.storage, list); };
            const todUi = { Icons, SoundFX, AppFooter, showToast, showError: showErrorPopup, navigate, SettingSwitch, PopupModal, RoomStrip, tr };
            // ---- режим «Правда или действие»: партия на одном устройстве ----
            const todCardOf = (id) => todCardsRef.current.find(x => x.id === id) || (todIsMine(id) ? todMineRef.current.find(x => x.id === id) : undefined) || todExtraRef.current[id]; // null в todExtra — карточки нет в базе
            const todLevelOf = (id) => { const c = todCardOf(id); return c ? c.difficulty : null; };
            // текст карточки: строка; undefined — ещё запрашиваем; null — карточки нет
            const todTextOf = (id) => { const c = todCardOf(id); if (c) return todCardText(c, lang); return todIsMine(id) ? tr('Карточка другого игрока: её прочитает автор') : c; };
            // карточки партии: база плюс (по переключателю в лобби) свои карточки этого устройства
            const todPool = () => (todCfg.mine ? [...todCards, ...todMine] : todCards);
            const todCheckDeck = todBuildDeck(todPool(), { hard: todCfg.hard, seed: 'check' });
            const todDeckInfo = { truth: todCheckDeck.pools.truth.length, dare: ['dare.easy', 'dare.medium', 'dare.hard'].reduce((n, k) => n + todCheckDeck.pools[k].length, 0) };
            const todPickIdx = (n) => { const a = new Uint32Array(1); try { crypto.getRandomValues(a); } catch (e) { a[0] = Date.now(); } return a[0] % Math.max(n, 1); };
            // пример текста для оборота карточек в лобби: случайная включённая карточка из базы (жёсткие — только при включённых «Жёстких 18+»)
            const todPeek = (type) => { const pool = todCards.filter(c => c.type === type && c.isActive === true && (todCfg.hard || c.difficulty !== 'hard')); return pool.length ? todCardText(pool[todPickIdx(pool.length)], lang) : ''; };
            const todMineAddCard = (draft) => {
                const r = todMineAdd(todMineRef.current, draft);
                if (!r.ok) return r.reason === 'full' ? tr('Слишком много своих карточек: удалите ненужные') : r.reason === 'dup' ? tr('Такая карточка у вас уже есть') : tr('Введите текст карточки');
                todMineRef.current = r.list; setTodMineState(r.list); todMineWrite(todCardsEnv.storage, r.list); setTodCfg(c => ({ ...c, mine: true })); return '';
            };
            const todMineDelCard = (id) => { const list = todMineRemove(todMineRef.current, id); todMineRef.current = list; setTodMineState(list); todMineWrite(todCardsEnv.storage, list); if (!list.length) setTodCfg(c => ({ ...c, mine: false })); };
            // почему нельзя начать (текст под кнопкой); проверка по той же колоде, что соберёт todBegin
            const todBlock = (() => {
                const n = profile && Array.isArray(profile.players) ? profile.players.length : 0;
                if (n < 2) return tr('Нужно минимум два игрока: добавьте игроков в сессии.');
                if (todClassicBusy) return tr('В сессии идёт классическая игра — завершите её');
                const d = todCheckDeck;
                if (!d.pools.truth.length) return tr('Нет карточек «Правда»: без них игру не начать.');
                if (!['dare.easy', 'dare.medium', 'dare.hard'].some(k => d.pools[k].length)) return tr('Нет карточек «Действие»: без них игру не начать.');
                return '';
            })();
            const todRandom = (n) => { const a = new Uint32Array(n); try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 4294967296); } return Array.from(a, x => x.toString(36)).join(''); };
            const todBegin = async () => {
                if (todBlock) return;
                const deck = todBuildDeck(todPool(), { hard: todCfg.hard, seed: todRandom(2).slice(0, 20) });
                const gid = ('t' + Date.now().toString(36) + todRandom(1)).slice(0, 24);
                const st = todStart({ players: profile.players, opts: todCfg, gid });
                todRoomRef.current = ''; todVerRef.current = null; todSentRef.current = 0; todForceRef.current = false;
                // партия открывается в канале сессии: остальные устройства увидят приглашение; без сети играем на этом устройстве
                if (liveRoomId) {
                    try { const r = await todChannelApi().start(liveRoomId, { deck, state: st }); todRoomRef.current = liveRoomId; todVerRef.current = r.ver; todSentRef.current = r.ver; }
                    catch (e) { showToast(tr('Другие устройства не подключатся: нет связи с базой. Играем на этом устройстве'), 4000, 'warn'); }
                }
                setTodDeck(deck); setTodGame(st); todTapRef.current = 0;
                navigate('tod_play');
            };
            // нажатие кнопки хода: повтор раньше LIVE_TAP_GUARD_MS после принятого гасится; seq берётся из текущего состояния
            const todDispatch = (action) => {
                const st = todGameRef.current; if (!st) return false;
                const now = Date.now(); if (now - todTapRef.current < LIVE_TAP_GUARD_MS) return false;
                const r = todApply(st, { ...action, seq: st.seq }, { deck: todDeck, level: todLevelOf });
                if (!r.ok) { if (r.reason === 'empty') showToast(tr('В этой колоде карточки закончились'), 3000, 'warn'); return false; }
                todTapRef.current = now; setTodGame(r.state); todPush(r.state, action.t === 'end'); return true;
            };
            // отправка принятого хода в канал; ver берётся больше всех известных и записанных, чтобы две отправки подряд не совпали
            const todPush = async (st, end) => {
                const room = todRoomRef.current; if (!room) return;
                const prev = Math.max(todVerRef.current || 0, todSentRef.current || 0); todPendingRef.current++;
                try {
                    const r = await (end ? todChannelApi().end(room, st, prev) : todChannelApi().send(room, st, prev));
                    if (!r.ok) throw new Error('TOD_SEND');
                    todSentRef.current = Math.max(todSentRef.current, r.ver);
                    if (todGameRef.current === st) todVerRef.current = r.ver;
                } catch (e) { if (todRoomRef.current === room) { showToast(tr('Не удалось отправить ход'), 3000, 'warn'); todForceRef.current = true; } }
                finally { todPendingRef.current--; }
            };
            // уйти из партии на этом устройстве: своя отметка убирается, остальные продолжают
            const todLeave = () => {
                const room = todRoomRef.current; todRoomRef.current = ''; todVerRef.current = null;
                if (room) todChannelApi().leave(room).catch(() => {});
            };
            // одна карточка (новая, правка, скрыть/показать): список в памяти и кэш устройства обновляются сразу
            // typed: текст набран в форме админки на любом из языков — вторую версию дописываем переводом (если текст не менялся — берём прежнюю)
            const todBilingual = async (card) => {
                const typed = sanitizeInput(card.text, 300); const prev = todCardsRef.current.find(c => c.id === card.id);
                if (prev && (prev.text === typed || prev.text_uk === typed)) return { text: prev.text, text_uk: prev.text_uk || '' };
                const pair = await buildBilingual(typed); return { text: pair.ru || typed, text_uk: pair.uk || '' };
            };
            const todSave = async (card) => {
                const { typed, ...rest } = card || {};
                const texts = typed ? await todBilingual(rest) : { text: sanitizeInput(rest.text, 300), text_uk: rest.text_uk ? sanitizeInput(rest.text_uk, 300) : '' };
                const saved = await todSaveCard(todCardsEnv, { ...rest, ...texts });
                const merged = todCleanList([...todCardsRef.current.filter(c => c.id !== saved.id), saved]);
                if (todSource === 'db') { todSetList(merged, 'db', true); return saved; }
                // список был не из базы (встроенный набор или копия): после записи правду знает только база, поэтому читаем её заново
                const fresh = await todLoadCards(todCardsEnv);
                if (fresh.source === 'db') todSetList(fresh.list, 'db', false); // кэш при чтении из базы записан самой загрузкой
                else todSetList(merged, todSource, false);
                return saved;
            };
            // разовая загрузка стартового набора. Список в памяти не берём на веру: запись карточки целиком заменяет её в базе, и устаревший список
            // затёр бы правки владельца и вернул скрытые карточки. Поэтому перед записью база читается заново, а пропускаются все id, которые в ней есть.
            const todSeed = async () => {
                const readFail = () => Object.assign(new Error('TOD_READ'), { todRead: true });
                let ids;
                try {
                    const r = await fetchWithTimeout(`${FIREBASE_BASE_URL}/tod.json?t=${Date.now()}`, {}, 10000);
                    if (!r || !r.ok) throw readFail();
                    const data = await r.json();
                    if (data !== null && typeof data !== 'object') throw readFail();
                    ids = !data ? [] : Array.isArray(data) ? todCleanList(data).map(c => c.id) : Object.keys(data);
                } catch (e) { throw readFail(); } // ничего не записано
                let result = null, failure = null;
                try { result = await todSeedStarter(todCardsEnv, ids); } catch (e) { failure = e; }
                // что бы ни случилось при записи, список в памяти приводим в соответствие с базой
                const fresh = await todLoadCards(todCardsEnv);
                if (fresh.source === 'db') todSetList(fresh.list, 'db', false);
                else if (!failure) todSetList(todCleanList([...todCardsRef.current, ...TOD_STARTER.filter(c => !ids.includes(c.id))]), todSource, false);
                if (failure) throw failure;
                return result;
            };
            const logTurnEnd = (kind) => { const g = gameLogRef.current; if (!g || !g.turnStart) return; if (kind === 'answer' && g.durations.length < 500) g.durations.push(Math.round((Date.now() - g.turnStart) / 1000)); g.turnStart = 0; };
            const logPunish = (text) => { const g = gameLogRef.current; if (!g || !text || g.punishments.length >= 50) return; g.punishments.push({ t: String(text).slice(0, 80), tpl: punishTemplates.some(t => t.text === text) }); };
            // partial — игра ещё идёт (промежуточная запись, журнал не закрываем); иначе это итог игры. complete — пройдена вся колода.
            const reportGame = (total, opts = {}) => {
                try {
                    const g = gameLogRef.current; if (!opts.partial) gameLogRef.current = null;
                    if (!g || !analyticsOn || isAdmin || !profile || liveRoleRef.current === 'guest') return;
                    if (opts.partial && total < AN_FLOOR) return;
                    const { anonGame, fullGame } = buildGameReports({ log: g, players: profile.players, questions: gameQuestions, history: turnHistory, total, customs: settings.punishments.map(p => p.text), now: Date.now(), complete: !!opts.complete, partial: !!opts.partial });
                    const key = 'askme_aid_' + profile.sessionId; let aid = localStorage.getItem(key); let fresh = false;
                    if (!aid) { aid = 'a' + Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem(key, aid); fresh = true; }
                    const gid = 'g' + g.startedAt.toString(36), now = Date.now(); const base = { updatedAt: now }; if (fresh) base.createdAt = now;
                    const send = (kind, body) => sessionTasks.run(profile.sessionId, async () => {
                        const ownerUid = await Auth.uid();
                        if (!isValidAESKey(profile.sessionKey)) return false;
                        const sessionRef = await sessionDbKey(profile.sessionKey);
                        if (sessionTasks.blocked(profile.sessionId)) return false;
                        return fetchWithTimeout(`${FIREBASE_BASE_URL}/analytics/${kind}/${aid}.json`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, ownerUid, sessionRef }) });
                    }).catch(() => {});
                    send('anon', { ...base, ['games/' + gid]: anonGame });
                    // правило базы analytics/full требует поле sid (строка ≤16), поэтому вместо ID шлём пустую строку: она же затирает ID, записанный прежними версиями (копия правила: tests/fixtures/analytics-rules.json)
                    send('full', { ...base, sid: '', names: profile.players.map(p => String(p.name).slice(0, 25)), ['games/' + gid]: fullGame });
                } catch (e) {}
            };
            const loadAnalytics = async () => {
                setAnLoading(true); setAnErr('');
                try {
                    const [a, f] = await Promise.all([fetchWithTimeout(`${FIREBASE_BASE_URL}/analytics/anon.json?t=${Date.now()}`), fetchWithTimeout(`${FIREBASE_BASE_URL}/analytics/full.json?t=${Date.now()}`)]);
                    if (!a.ok || !f.ok) throw new Error('HTTP');
                    setAnData({ anon: (await a.json()) || {}, full: (await f.json()) || {} });
                } catch (e) { setAnErr(tr("Не удалось загрузить данные. Проверьте интернет и вход владельца.")); }
                setAnLoading(false);
            };
            useEffect(() => { if (isAdmin && (screen === 'analytics' || screen === 'analytics_sessions') && !anData && !anLoading && !anErr) loadAnalytics(); }, [screen, isAdmin, anData, anErr]);
            // Игра, которую бросили на середине, тоже попадает в аналитику: промежуточная запись после 10 пройденных вопросов, затем каждые 5 и при сворачивании приложения
            const lastProgressRef = useRef('');
            useEffect(() => {
                if (screen !== 'game' || gameMode !== 'normal') return;
                const completed = gameQuestions.filter((q, index) => { const entry = normTurn(turnHistory[index]); return entry && !entry.cur && profile?.players?.length && profile.players.every(p => entry.answered.includes(p.id)); }).length;
                const log = gameLogRef.current, tag = log ? log.startedAt + ':' + completed : '';
                if (log && completed >= AN_FLOOR && completed % 5 === 0 && lastProgressRef.current !== tag) { lastProgressRef.current = tag; reportGame(maxReachedIndex + 1, { partial: true }); }
                const onHide = () => { if (document.visibilityState === 'hidden' && completed >= AN_FLOOR) reportGame(maxReachedIndex + 1, { partial: true }); };
                document.addEventListener('visibilitychange', onHide);
                return () => document.removeEventListener('visibilitychange', onHide);
            }, [screen, gameMode, maxReachedIndex, turnHistory]);
            const setAnMin = (n) => { SoundFX.click(); setAnMinState(n); try { localStorage.setItem(AN_MIN_KEY, String(n)); } catch (e) {} };
            const anFiltered = useMemo(() => anData ? { anon: filterAnalytics(anData.anon, anMin), full: filterAnalytics(anData.full, anMin) } : null, [anData, anMin]);
            const anHiddenGames = anData && anFiltered ? Math.max(0, countAnalyticsGames(anData.anon) - countAnalyticsGames(anFiltered.anon)) : 0;
            const anMinControl = (
                <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4 flex flex-col gap-3">
                    <div><div className="text-sm font-bold text-white">{tr("В аналитику идут игры от")}</div><div className="text-xs text-zinc-500 leading-snug mt-0.5">{tr("Число отвеченных вопросов в игре. Полностью пройденные колоды учитываются всегда.")}</div></div>
                    <div className="flex flex-wrap gap-2" role="group" aria-label={tr("Минимум отвеченных вопросов")}>
                        {AN_MIN_CHOICES.map(n => ( <button key={n} type="button" aria-pressed={anMin === n} onClick={() => setAnMin(n)} className={`chip ${anMin === n ? 'is-on' : ''}`}>{n === 0 ? tr("Любых") : n}</button> ))}
                    </div>
                    {anData && anHiddenGames > 0 && <p className="text-xs text-zinc-500">{tr("Не вошло в сводку коротких игр:")} {anHiddenGames}{tr(". Уменьшите число, чтобы увидеть их.")}</p>}
                </section>
            );
            const deleteAnSession = async (aid) => {
                if (anConfirm !== aid) { SoundFX.warn(); setAnConfirm(aid); return; }
                setAnBusy(true);
                try {
                    const ownerUid = anData?.full?.[aid]?.ownerUid || anData?.anon?.[aid]?.ownerUid || await Auth.uid();
                    const rs = await Promise.all(['anon', 'full'].map(k => fetchWithTimeout(`${FIREBASE_BASE_URL}/analytics/${k}/${aid}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ownerUid, updatedAt: Date.now(), deleted: true, ...(k === 'full' ? { sid: '', names: '' } : {}) }) })));
                    if (rs.some(r => !r.ok)) throw new Error('HTTP');
                    setAnData(d => { const n = { anon: { ...d.anon }, full: { ...d.full } }; delete n.anon[aid]; delete n.full[aid]; return n; });
                    setAnSel(null); SoundFX.success(); showToast(tr('Сессия удалена'));
                } catch (e) { showErrorPopup(tr('Сессия не удалена'), tr("Проверьте интернет и вход владельца, затем попробуйте ещё раз.")); }
                setAnConfirm(''); setAnBusy(false);
            };
            useEffect(() => {
                if (screen === 'game') {
                    if (!gameLogRef.current && gameMode === 'normal') gameLogRef.current = { startedAt: Date.now(), mode: hardMode ? 'hard' : 'normal', timerSec: fx.timerOn ? fx.timerSec : 0, punishOn: !!fx.punishOn, durations: [], punishments: [], turnStart: 0 };
                } else if (screen !== 'ai_response' && screen !== 'summary') { gameLogRef.current = null; }
            }, [screen]);
            const setQuestionHidden = async (q, hide) => {
                if (!isAdmin || hqBusy) return;
                setHqBusy(q.dbKey);
                try {
                    const res = await fetchWithTimeout(`${FIREBASE_BASE_URL}${dbSubPath}/${q.dbKey}.json`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(hide ? { hidden: true, hiddenAt: Date.now() } : { hidden: null, hiddenAt: null }) });
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    setDb(prev => { const next = prev.map(x => x.dbKey === q.dbKey ? { ...x, hidden: !!hide } : x); try { localStorage.setItem(OFFLINE_DB_CACHE_KEY, JSON.stringify(next)); } catch (e) {} return next; });
                    SoundFX.success(); showToast(hide ? tr("Вопрос скрыт для всех") : tr("Вопрос снова доступен"));
                } catch (e) { showErrorPopup(tr('Не удалось изменить вопрос'), tr("Проверьте интернет и вход владельца, затем попробуйте ещё раз.")); }
                setHqBusy('');
            };
            const restoreAllHidden = async () => {
                if (!isAdmin || hqBusy) return;
                if (!hqConfirmAll) { SoundFX.warn(); setHqConfirmAll(true); return; }
                const keys = db.filter(q => q.hidden).map(q => q.dbKey); if (!keys.length) { setHqConfirmAll(false); return; }
                setHqBusy('all');
                try {
                    const body = {}; keys.forEach(k => { body[k + '/hidden'] = null; body[k + '/hiddenAt'] = null; });
                    const res = await fetchWithTimeout(`${FIREBASE_BASE_URL}${dbSubPath}.json`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    setDb(prev => { const next = prev.map(x => x.hidden ? { ...x, hidden: false } : x); try { localStorage.setItem(OFFLINE_DB_CACHE_KEY, JSON.stringify(next)); } catch (e) {} return next; });
                    SoundFX.success(); showToast(tr('Все вопросы возвращены'));
                } catch (e) { showErrorPopup(tr('Не удалось вернуть вопросы'), tr("Проверьте интернет и вход владельца, затем попробуйте ещё раз.")); }
                setHqConfirmAll(false); setHqBusy('');
            };
            const [live, setLive] = useState({ room: '', role: '', sync: false }); const [liveJoining, setLiveJoining] = useState(false); const [liveInvite, setLiveInvite] = useState(null); const [liveEnded, setLiveEnded] = useState(false); const [liveCount, setLiveCount] = useState(0); const [liveRoomId, setLiveRoomId] = useState('');
            const deviceIdRef = useRef(null); if (!deviceIdRef.current) deviceIdRef.current = makeDeviceId();
            const liveIdsRef = useRef([]); const liveSyncRef = useRef(false); const liveDeckRef = useRef(''); const liveEnteringRef = useRef(''); const liveJoiningRef = useRef(false); const liveRoomRef = useRef(''); const liveRoleRef = useRef(''); const liveRoomIdRef = useRef(''); liveRoomIdRef.current = liveRoomId;
            const liveRef = useRef({ ver: 0, t: 0, gid: '', hash: '', spinId: 0, punId: 0, endedSent: false, appliedAt: 0, reassertAt: 0 }); const liveChainRef = useRef(Promise.resolve()); const livePendingRef = useRef(0);
            const liveStateRef = useRef({ idx: 0, max: 0, hist: {} }); liveStateRef.current = { idx: currentIndex, max: maxReachedIndex, hist: turnHistory };
            const livePunRef = useRef({ key: '', punish: null }); livePunRef.current = { key: punDoneKey, punish };
            const roomUrl = (room, sub = '') => `${FIREBASE_BASE_URL}/live/${room}${sub}.json`;
            const liveWriterRef = useRef(null);
            if (!liveWriterRef.current) liveWriterRef.current = createLiveWriter({ request: fetchWithTimeout, mergeHistory: (left, right) => liveHistStr(mergeTurnHistories(cleanTurnHistory(JSON.parse(left)), cleanTurnHistory(JSON.parse(right)))) });
            // общая «комната» сессии: её имя — хеш секретного ключа сессии, поэтому зайти могут только участники
            useEffect(() => { let on = true; if (profile && isValidAESKey(profile.sessionKey)) liveRoomKey(profile.sessionKey).then(r => { if (on) setLiveRoomId(r); }); else setLiveRoomId(''); return () => { on = false; }; }, [profile && profile.sessionKey]);
            const liveSend = (method, body, sub = '', suffix = '') => {
                const room = liveRoomRef.current; if (!room) return Promise.resolve(false);
                livePendingRef.current++;
                const sid = profileRef.current?.sessionId, previous = liveChainRef.current;
                const context = { gid: liveRef.current.gid };
                const p = sessionTasks.run(sid, () => previous.then(async () => {
                    if (sessionTasks.blocked(sid)) return false;
                    try {
                        const result = await liveWriterRef.current(roomUrl(room + suffix, sub), method, body, context);
                        if (result.snapshot && liveRoomRef.current === room && !sessionTasks.blocked(sid)) applyLiveRef.current({ ...result.snapshot, by: 'merged-state' });
                        if (!result.ok && method !== 'DELETE') showToast(tr("Не удалось синхронизировать ход — проверьте соединение"), 4000, 'warn');
                        return result.ok;
                    } catch (error) { return false; }
                })).then(ok => { livePendingRef.current--; return ok; });
                liveChainRef.current = p; return p;
            };
            // пока в игре одно устройство, состояние в базу не отправляется (force — только для итога игры)
            const livePublish = (extra, force = false) => { if (!liveRoomRef.current || (!liveSyncRef.current && !force)) return; const lr = liveRef.current; const ver = liveVerNext(lr.ver, deviceIdRef.current), t = Date.now(); lr.ver = ver; lr.t = t; liveSend('PATCH', { ver, by: deviceIdRef.current, t, ...extra }); };
            const livePlayersStr = () => JSON.stringify(((profile && profile.players) || []).slice(0, MAX_PLAYERS).map(p => ({ id: p.id, name: p.name, gender: p.gender })));
            // запуск игры: этот телефон становится «хозяином» новой партии. Пока он один, в базе только «маячок» (кто, сколько вопросов, режим):
            // сами вопросы и ход игры отправляются, когда к сессии подключится ещё одно устройство (см. liveGoSync)
            const liveStart = (deck, st) => {
                const room = liveRoomIdRef.current; if (!room || !profile) return false;
                const me = deviceIdRef.current, t = Date.now(), ver = liveVerStart(me, t), gid = 'g' + t.toString(36) + randId(3), hs = liveHistStr(st.hist);
                const idsStr = deck.map(q => String(q.id || q.dbKey)).join(',');
                liveRoomRef.current = room; liveRoleRef.current = 'host'; liveSyncRef.current = false; liveDeckRef.current = idsStr; liveJoiningRef.current = false;
                liveRef.current = { ver, t, gid, hash: liveHash(st.idx, st.max, hs), spinId: 0, punId: 0, endedSent: false, appliedAt: 0, reassertAt: 0 };
                setLive({ room, role: 'host', sync: false }); setLiveFx(null); setLiveEnded(false); setLiveInvite(null); setLiveCount(1);
                liveSend('PATCH', { ver, by: me, t, gid, status: 'active', solo: 1, n: deck.length, dk: liveDeckKey(idsStr), ids: null, idx: null, max: null, hist: null, hard: st.hard ? 1 : 0, fx: st.fx, pl: null, spin: null, pun: null });
                return true;
            };
            // к хозяину подключилось ещё одно устройство: отправляем колоду (отдельным узлом — она может быть длиннее лимита одной записи) и текущий ход, дальше игра синхронна
            const liveGoSync = () => {
                if (liveSyncRef.current || !liveRoomRef.current || liveRoleRef.current !== 'host') return;
                liveSyncRef.current = true;
                const lr = liveRef.current, me = deviceIdRef.current, t = Date.now();
                setLive(l => ({ ...l, sync: true }));
                liveSend('PUT', { ver: 1, by: me, t, g: lr.gid, d: liveDeckRef.current }, '', '_d').then(ok => {
                    if (liveRef.current !== lr || !liveRoomRef.current) return;
                    if (!ok) { liveSyncRef.current = false; setLive(l => ({ ...l, sync: false })); if (Date.now() - (lr.deckFailAt || 0) > 20000) { lr.deckFailAt = Date.now(); showToast(tr('Не удалось передать вопросы второму устройству — пробуем ещё раз'), 4000, 'warn'); } return; }
                    const st = liveStateRef.current, hs = liveHistStr(st.hist), ver = liveVerNext(lr.ver, me); lr.ver = ver; lr.t = Date.now(); lr.hash = liveHash(st.idx, st.max, hs);
                    // если у хозяина уже выпало наказание за этот ход, гости должны знать об этом: иначе по своему таймеру выдадут второе
                    const pr = livePunRef.current, pn = pr.punish || {}; let pun = null;
                    if (pr.key) { pun = { id: Date.now(), reason: pn.reason || '', player: pn.player || '', text: pn.text || '', icon: pn.icon || '', key: pr.key }; lr.punId = pun.id; }
                    liveSend('PATCH', { ver, by: me, t: lr.t, solo: null, pl: livePlayersStr(), idx: st.idx, max: st.max, hist: hs, ...(pun ? { pun } : {}) });
                });
            };
            const liveSpin = (idx, cands, winner) => { if (!liveRoomRef.current) return; const id = Date.now(); liveRef.current.spinId = id; livePublish({ spin: { id, idx, winner, cands: cands.map(p => ({ id: p.id, name: p.name, gender: p.gender })) } }); };
            const livePun = (pn) => { if (!liveRoomRef.current) return; const id = Date.now(); liveRef.current.punId = id; livePublish({ pun: { id, reason: pn.reason, player: pn.player || '', text: pn.text || '', icon: pn.icon || '', key: pn.key || '' } }); };
            // итог партии: статус «закончена»; имена игроков и список вопросов из общей комнаты убираем — они больше не нужны
            const liveSendEnd = () => { if (!liveRoomRef.current || liveRef.current.endedSent) return; liveRef.current.endedSent = true; livePublish({ status: 'ended', pl: null }, true); liveSend('DELETE', undefined, '', '_d'); };
            const liveShowSpin = (spin) => {
                if (!cleanPlayers(spin?.cands).length || typeof spin.winner !== 'string') return;
                rouletteTimeoutsRef.current.forEach(t => clearTimeout(t)); rouletteTimeoutsRef.current = []; pendingTurnRef.current = null;
                setTurnPopup({ open: true, spinning: true, winner: spin.winner, spinId: spin.id, candidates: cleanPlayers(spin.cands) });
                const delays = [140, 155, 170, 190, 210, 235, 260, 290, 320, 350]; let acc = 0;
                delays.forEach((d, i) => { acc += d; rouletteTimeoutsRef.current.push(setTimeout(() => { if (i < delays.length - 1) { SoundFX.rouletteTick(); return; } SoundFX.rouletteWin(); setTurnPopup(st => ({ ...st, spinning: false })); }, acc)); });
                // у остальных устройств окно рулетки закрывается само: имя отвечающего уже видно на карточке
                rouletteTimeoutsRef.current.push(setTimeout(() => setTurnPopup(st => (st.spinId === spin.id && !st.spinning ? { ...st, open: false } : st)), acc + 2800));
            };
            const liveShowPun = (pn) => { if (!pn || typeof pn.text !== 'string' || (pn.player != null && typeof pn.player !== 'string') || (pn.icon != null && typeof pn.icon !== 'string')) return; SoundFX.warn(); if (pn.key) setPunDoneKey(pn.key); setPunish({ open: true, remote: true, reason: pn.reason, player: pn.player || '', text: pn.text || '', icon: pn.icon || '🎭' }); };
            // колода партии лежит отдельным узлом рядом с комнатой (её длина не ограничена лимитом одной записи)
            const liveFetchDeck = async (room, snap) => {
                for (let i = 0; i < 3; i++) {
                    try {
                        const r = await fetchWithTimeout(roomUrl(room + '_d') + '?t=' + Date.now(), {}, 10000); const d = r.ok ? await r.json() : null;
                        if (d && d.g === snap.gid && typeof d.d === 'string' && d.d) { const ids = d.d.split(',').filter(Boolean); if (!snap.n || ids.length === snap.n) return ids; }
                    } catch (e) {}
                    await new Promise(res => setTimeout(res, 400));
                }
                return null;
            };
            // вход в уже идущую игру (приглашение, переход на новую партию, возврат в начатую)
            const enterLive = async (snap, role) => {
                const room = liveRoomIdRef.current; if (!room || !profile) return false;
                const ids = await liveFetchDeck(room, snap); const map = new Map(profileDb.map(q => [String(q.id || q.dbKey), q])); const deck = ids ? ids.map(id => map.get(id)).filter(Boolean) : [];
                if (!ids || !ids.length) { showToast(tr('Не удалось получить вопросы игры. Проверьте интернет и попробуйте ещё раз'), 5000, 'warn'); return false; }
                if (deck.length !== ids.length) { showToast(tr('Не удалось присоединиться: не все вопросы загружены. Обновите страницу и попробуйте снова'), 5000, 'warn'); return false; }
                let hist = {}; try { hist = cleanTurnHistory(JSON.parse(snap.hist || '{}')); } catch (e) {}
                let pl = null; try { pl = cleanPlayers(JSON.parse(snap.pl || 'null')); } catch (e) {}
                if (Array.isArray(pl) && pl.length) { const key = (a) => a.map(p => p.id + '|' + p.name + '|' + p.gender).join(','); if (key(pl) !== key(profile.players || [])) setProfile(prev => prev ? { ...prev, players: pl.slice(0, MAX_PLAYERS).map(p => ({ id: String(p.id), name: String(p.name || '').slice(0, 25), gender: p.gender === 'girl' ? 'girl' : 'guy' })), updatedAt: Date.now() } : prev); }
                const idx = clampIdx(snap.idx, deck.length), max = Math.max(idx, clampIdx(snap.max, deck.length));
                liveRoomRef.current = room; liveRoleRef.current = role; liveSyncRef.current = true; rouletteTimeoutsRef.current.forEach(t => clearTimeout(t)); rouletteTimeoutsRef.current = []; pendingTurnRef.current = null;
                liveRef.current = { ver: snap.ver, t: snap.t || 0, gid: snap.gid || '', hash: liveHash(idx, max, liveHistStr(hist)), spinId: snap.spin ? snap.spin.id : 0, punId: snap.pun ? snap.pun.id : 0, endedSent: false, appliedAt: Date.now(), reassertAt: 0 };
                setLive({ room, role, sync: true }); setLiveEnded(false); setLiveInvite(null); setLiveCount(c => Math.max(c, 1));
                const f = snap.fx || {}; setLiveFx({ ...settings, timerOn: !!f.timerOn, timerSec: Math.max(TIMER_STORED_MIN, Math.min(TIMER_MAX, Math.round(Number(f.timerSec)) || settings.timerSec)), punishOn: !!f.punishOn }); // время от хозяина — только число в допустимых пределах
                setHardMode(!!snap.hard); setPunDoneKey(snap.pun && snap.pun.key ? String(snap.pun.key) : ''); setGameMode('normal'); setGameQuestions(deck); setCurrentIndex(idx); setMaxReachedIndex(max); setTurnHistory(hist);
                setTurnPopup({ open: false, spinning: false, highlight: 'guy', winner: null, candidates: [] }); setPunish({ open: false, text: '', player: '', icon: '⏰' }); setShowSkipPopup(false); setTimerDismissKey('');
                setAnsweredCount(0); setCompletedAllFlag(false); setShowEndGameConfirm(false); SoundFX.success(); navigate('game');
                return true;
            };
            // моя запись в общей комнате оказалась «старше» моей же — её перебила чужая с более ранней версией: повторяем актуальное состояние
            const liveReassert = (seen) => {
                const lr = liveRef.current, now = Date.now(); if (livePendingRef.current > 0 || now - (lr.reassertAt || 0) < 5000) return;
                lr.reassertAt = now; lr.ver = Math.max(lr.ver, seen); const st = liveStateRef.current, hs = liveHistStr(st.hist);
                lr.hash = liveHash(st.idx, st.max, hs); livePublish({ idx: st.idx, max: st.max, hist: hs });
            };
            const applyLiveSnapshot = (snap) => {
                if (!snap || typeof snap.ver !== 'number') return;
                const lr = liveRef.current, me = deviceIdRef.current;
                if (snap.gid && lr.gid && snap.gid !== lr.gid) {
                    // новая партия другого устройства: пока там «маячок» без вопросов (solo), ждём — хозяин отправит их, увидев наше присутствие
                    if (snap.by !== me && snap.status === 'active' && !snap.solo && liveEnteringRef.current !== snap.gid) { liveEnteringRef.current = snap.gid; showToast(tr('Запущена новая игра'), 2800, 'info'); enterLive(snap, 'guest').finally(() => { liveEnteringRef.current = ''; }); }
                    return;
                }
                if (snap.ver < lr.ver) { liveReassert(snap.ver); return; }
                if (snap.ver === lr.ver) return;
                lr.ver = snap.ver; lr.t = snap.t || 0;
                if (snap.by === me) return;
                let hist = {}; try { hist = cleanTurnHistory(JSON.parse(snap.hist || '{}')); } catch (e) {}
                const idx = clampIdx(snap.idx, gameQuestions.length), max = Math.max(idx, clampIdx(snap.max, gameQuestions.length));
                lr.hash = liveHash(idx, max, liveHistStr(hist)); lr.appliedAt = Date.now();
                setCurrentIndex(idx); setMaxReachedIndex(max); setTurnHistory(hist);
                setPunish(p => (p.remote ? { ...p, open: false } : p));
                if (snap.spin && snap.spin.id && snap.spin.id !== lr.spinId) { lr.spinId = snap.spin.id; liveShowSpin(snap.spin); }
                if (snap.pun && snap.pun.id && snap.pun.id !== lr.punId) { lr.punId = snap.pun.id; liveShowPun(snap.pun); }
                if (snap.status === 'ended' && !lr.endedSent) { lr.endedSent = true; setLiveEnded(true); }
            };
            const applyLiveRef = useRef(null); applyLiveRef.current = applyLiveSnapshot;
            useEffect(() => {
                if (!live.room || !live.sync || !['game', 'ai_response'].includes(screen)) return;
                let stop = false, busy = false;
                const tick = async () => {
                    if (busy || document.hidden) return; busy = true;
                    try {
                        const vr = await fetchWithTimeout(roomUrl(live.room, '/ver') + '?t=' + Date.now(), {}, 6000); const v = vr.ok ? await vr.json() : null;
                        if (!stop && typeof v === 'number' && v !== liveRef.current.ver) { const r = await fetchWithTimeout(roomUrl(live.room) + '?t=' + Date.now(), {}, 8000); if (r.ok) { const snap = await r.json(); if (snap && !stop) applyLiveRef.current(snap); } }
                    } catch (e) {}
                    busy = false;
                };
                const id = setInterval(tick, LIVE_POLL_MS); const vis = () => { if (!document.hidden) tick(); }; document.addEventListener('visibilitychange', vis);
                return () => { stop = true; clearInterval(id); document.removeEventListener('visibilitychange', vis); };
            }, [live.room, live.sync, screen]);
            // пока хозяин один, ему нечего синхронизировать: раз в пару секунд смотрим только, не появилось ли второе устройство
            useEffect(() => {
                if (!live.room || live.sync || live.role !== 'host' || !['game', 'ai_response'].includes(screen)) return;
                let stop = false, busy = false;
                const tick = async () => {
                    if (busy || stop || document.hidden) return; busy = true;
                    try { const r = await fetchWithTimeout(roomUrl(live.room, '/p') + '?t=' + Date.now(), {}, 5000); const p = r.ok ? await r.json() : null; if (!stop && liveAlive(p, Date.now(), deviceIdRef.current).others.length > 0) liveGoSync(); } catch (e) {}
                    busy = false;
                };
                const id = setInterval(tick, LIVE_SOLO_MS); const vis = () => { if (!document.hidden) tick(); }; document.addEventListener('visibilitychange', vis);
                return () => { stop = true; clearInterval(id); document.removeEventListener('visibilitychange', vis); };
            }, [live.room, live.sync, live.role, screen]);
            // «я здесь»: раз в 8 с отмечаемся в комнате и узнаём, сколько устройств сейчас в игре
            useEffect(() => {
                if (!live.room || !['game', 'ai_response'].includes(screen)) return;
                let stop = false, busy = false;
                const beat = async () => {
                    if (busy || stop || document.hidden) return; busy = true; const me = deviceIdRef.current;
                    try {
                        await liveSend('PATCH', { [me]: Date.now() }, '/p');
                        const r = await fetchWithTimeout(roomUrl(live.room, '/p') + '?t=' + Date.now(), {}, 6000); const p = r.ok ? await r.json() : null;
                        const { alive, stale } = liveAlive(p, Date.now(), me);
                        if (!stop) { liveIdsRef.current = alive; setLiveCount(Math.max(1, alive.length)); }
                        if (!stop && stale.length) liveSend('PATCH', Object.fromEntries(stale.map(id => [id, null])), '/p');
                    } catch (e) {} finally { busy = false; }
                };
                beat(); const id = setInterval(beat, LIVE_BEAT_MS); const vis = () => { if (!document.hidden) beat(); }; document.addEventListener('visibilitychange', vis);
                return () => { stop = true; clearInterval(id); document.removeEventListener('visibilitychange', vis); };
            }, [live.room, screen]);
            useEffect(() => {
                if (!live.room || !live.sync || screen !== 'game') return;
                const hs = liveHistStr(turnHistory), h = liveHash(currentIndex, maxReachedIndex, hs);
                if (h === liveRef.current.hash) return;
                liveRef.current.hash = h; livePublish({ idx: currentIndex, max: maxReachedIndex, hist: hs });
            }, [live.room, live.sync, screen, currentIndex, maxReachedIndex, turnHistory]);
            // приглашение: на главной и экранах выбора режима смотрим, идёт ли в сессии игра, в которой уже есть другие устройства
            useEffect(() => {
                if (!['menu', 'mode_select', 'game_setup'].includes(screen) || !liveRoomId || live.room) { setLiveInvite(null); return; }
                let stop = false, busy = false;
                const check = async () => {
                    if (busy || stop || document.hidden) return; busy = true;
                    try {
                        const sr = await fetchWithTimeout(roomUrl(liveRoomId, '/status') + '?t=' + Date.now(), {}, 6000); const status = sr.ok ? await sr.json() : null;
                        if (stop) return; if (status !== 'active') { setLiveInvite(null); return; }
                        const pr = await fetchWithTimeout(roomUrl(liveRoomId, '/p') + '?t=' + Date.now(), {}, 6000); const p = pr.ok ? await pr.json() : null;
                        const n = liveAlive(p, Date.now(), deviceIdRef.current).others.length;
                        if (!stop) setLiveInvite(n > 0 ? (cur => (cur && cur.count === n ? cur : { count: n })) : null);
                    } catch (e) {} finally { busy = false; }
                };
                check(); const id = setInterval(check, LIVE_INVITE_MS); return () => { stop = true; clearInterval(id); };
            }, [screen, liveRoomId, live.room]);
            // ---- режим «Правда или действие»: партия на нескольких устройствах (канал live/<комната>_t, src/tod/channel.js) ----
            const todChanRef = useRef(null);
            const todChannelApi = () => todChanRef.current || (todChanRef.current = todChannel({ baseUrl: FIREBASE_BASE_URL, fetch: fetchWithTimeout, deviceId: deviceIdRef.current, now: () => Date.now(), verNext: liveVerNext, verStart: liveVerStart, alive: liveAlive }));
            const TOD_SCREENS = ['tod_lobby', 'tod_play', 'tod_results'];
            // опрос: раз в LIVE_POLL_MS читаем ver; при новой — состояние. Принимаем только свою партию (тот же gid): с большим seq, а при равном — то, что в базе
            // (последняя запись побеждает). Если в базе ход старше нашего (другое устройство нажало по устаревшему экрану), отправляем своё заново
            useEffect(() => {
                if (!TOD_SCREENS.includes(screen)) return;
                let stop = false, busy = false;
                const tick = async () => {
                    const room = todRoomRef.current;
                    if (busy || stop || !room || !todGameRef.current || document.hidden) return; busy = true;
                    try {
                        const ch = todChannelApi(); const v = await ch.readVer(room);
                        if (stop || v === null || (v === todVerRef.current && !todForceRef.current)) return;
                        const r = await ch.read(room, { knownDeck: todDeckRef.current });
                        const own = todGameRef.current;
                        if (stop || room !== todRoomRef.current || !r || !r.state || !own || r.state.gid !== own.gid) return;
                        const force = todForceRef.current;
                        if (force || r.state.seq > own.seq || (r.state.seq === own.seq && r.ver !== todVerRef.current)) {
                            todForceRef.current = false; todVerRef.current = r.ver; if (r.state.seq !== own.seq || JSON.stringify(r.state) !== JSON.stringify(own)) setTodGame(r.state);
                            if (r.state.phase === 'ended' && screen === 'tod_play') { showToast(tr('Игра завершена на другом устройстве'), 2800, 'info'); navigate('tod_results'); }
                        } else if (r.state.seq < own.seq && !todPendingRef.current) todPush(own, own.phase === 'ended');
                    } catch (e) {} finally { busy = false; }
                };
                tick(); const id = setInterval(tick, LIVE_POLL_MS); return () => { stop = true; clearInterval(id); };
            }, [screen]);
            // присутствие: пока открыт экран игры, раз в LIVE_BEAT_MS обновляем свою отметку; при закрытии страницы — убираем
            useEffect(() => {
                if (screen !== 'tod_play') return;
                const beat = () => { const room = todRoomRef.current; if (room && !document.hidden) todChannelApi().beat(room).catch(() => {}); };
                beat(); const id = setInterval(beat, LIVE_BEAT_MS); const vis = () => { if (!document.hidden) beat(); }; document.addEventListener('visibilitychange', vis);
                return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); };
            }, [screen]);
            useEffect(() => { const h = () => { if (todRoomRef.current) todChannelApi().leave(todRoomRef.current).catch(() => {}); }; window.addEventListener('pagehide', h); return () => window.removeEventListener('pagehide', h); }, []);
            // приглашение: на главной, экране режимов, в лобби и итогах смотрим, идёт ли в сессии партия, в которой уже есть другие устройства
            useEffect(() => {
                if (!['menu', 'mode_select', 'tod_lobby', 'tod_results'].includes(screen) || !liveRoomId) { setTodInvite(null); return; }
                let stop = false, busy = false;
                const check = async () => {
                    if (busy || stop || document.hidden) return; busy = true;
                    try {
                        const pk = await todChannelApi().peek(liveRoomId); if (stop) return;
                        const mine = !!(todRoomRef.current && todGameRef.current && todGameRef.current.phase !== 'ended');
                        setTodPeers(pk.others);
                        setTodInvite(pk.status === 'active' && pk.others > 0 && !mine ? (cur => (cur && cur.count === pk.others ? cur : { count: pk.others })) : null);
                    } catch (e) {} finally { busy = false; }
                };
                check(); const id = setInterval(check, LIVE_INVITE_MS); return () => { stop = true; clearInterval(id); };
            }, [screen, liveRoomId]);
            // вход в идущую партию: колода и состояние из канала, проверка числа устройств, при 18+ — предупреждение, затем экран игры
            const todJoin = async () => {
                const room = liveRoomIdRef.current; if (!room || !profile || todJoining) return;
                setTodJoining(true);
                try {
                    const ch = todChannelApi(); const r = await ch.read(room, { deck: true });
                    if (!r || r.status !== 'active' || !r.deck || !r.state) { setTodInvite(null); showToast(tr('Эта игра уже закончилась'), 3000, 'info'); return; }
                    const cap = deviceCap(profile, { pl: JSON.stringify(r.state.pl) }); const pk = await ch.peek(room);
                    if (pk.others >= cap) { showToast(tr('В игре уже ') + cap + ' ' + declOfNum(cap, ['устройство', 'устройства', 'устройств']) + ' — по числу игроков в сессии. Дождитесь, пока кто-нибудь выйдет, или добавьте игроков в «Игроки и сессия»', 6000, 'warn'); return; }
                    const go = () => {
                        todRoomRef.current = room; todVerRef.current = r.ver; todSentRef.current = 0; todForceRef.current = true; // при входе сразу перечитываем: состояние могло уйти вперёд
                        setTodDeck(r.deck); todDeckRef.current = r.deck; setTodGame(r.state); todTapRef.current = Date.now(); setTodInvite(null);
                        ch.beat(room).catch(() => {}); navigate('tod_play');
                    };
                    if (r.state.opts.hard || r.state.opts.tone === 2) setTodJoinWarn(() => go); else go();
                } catch (e) { showToast(tr('Не удалось подключиться к игре. Проверьте интернет'), 3500, 'warn'); }
                finally { setTodJoining(false); }
            };
            // точечная подгрузка карточки, которой нет у этого устройства
            useEffect(() => {
                const c = todGame && todGame.card; if (!c || screen !== 'tod_play') return;
                const id = c.id; if (todIsMine(id) || todCardsRef.current.some(x => x.id === id) || todExtraRef.current[id] !== undefined || todAskedRef.current[id]) return;
                todAskedRef.current[id] = true;
                (async () => {
                    let card = null;
                    try { const r = await fetchWithTimeout(`${FIREBASE_BASE_URL}/tod/${encodeURIComponent(id)}.json`, {}, 10000); if (r.ok) card = todCleanCard(await r.json()); } catch (e) {}
                    if (card && card.id !== id) card = null;
                    todExtraRef.current = { ...todExtraRef.current, [id]: card }; setTodExtra(todExtraRef.current);
                })();
            }, [screen, todCards, todGame && todGame.card && todGame.card.id]);
            // возврат после перезагрузки: ждём профиль и комнату сессии, читаем канал с колодой. active — снова в игре (без повторного 18+), ended — итоги,
            // пусто или испорчено — главная с заменой адреса на #/
            useEffect(() => {
                if (!todResuming) return;
                if (!profile || !isValidAESKey(profile.sessionKey)) { setTodResuming(false); return; }
                if (!liveRoomId) return;
                let on = true;
                (async () => {
                    let r = null; try { r = await todChannelApi().read(liveRoomId, { deck: true }); } catch (e) {}
                    if (!on) return;
                    const ok = r && r.deck && r.state && (r.status === 'active' || r.status === 'ended');
                    if (ok) {
                        todRoomRef.current = r.status === 'active' ? liveRoomId : ''; todVerRef.current = r.ver; todSentRef.current = 0; todForceRef.current = false;
                        setTodDeck(r.deck); todDeckRef.current = r.deck; setTodGame(r.state); todTapRef.current = Date.now();
                        const want = r.status === 'active' && r.state.phase !== 'ended' ? 'tod_play' : 'tod_results';
                        if (want === 'tod_play') todChannelApi().beat(liveRoomId).catch(() => {});
                        if (screen !== want) { try { window.history.replaceState(null, '', window.location.pathname + window.location.search + SCREEN_TO_HASH[want]); } catch (e) {} setScreenState(want); }
                    } else { try { window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/'); } catch (e) {} setScreenState('menu'); }
                    setTodResuming(false);
                })();
                return () => { on = false; };
            }, [todResuming, profile, liveRoomId]);
            // в лобби смотрим классическую комнату сессии: пока в ней идёт живая игра, старт заблокирован
            useEffect(() => {
                if (screen !== 'tod_lobby' || !liveRoomId) { setTodClassicBusy(false); return; }
                let stop = false, busy = false;
                const check = async () => {
                    if (busy || stop || document.hidden) return; busy = true;
                    try {
                        const sr = await fetchWithTimeout(roomUrl(liveRoomId, '/status') + '?t=' + Date.now(), {}, 6000); const status = sr.ok ? await sr.json() : null;
                        let on = false;
                        if (status === 'active') { const pr = await fetchWithTimeout(roomUrl(liveRoomId, '/p') + '?t=' + Date.now(), {}, 6000); const p = pr.ok ? await pr.json() : null; on = liveAlive(p, Date.now(), deviceIdRef.current).alive.length > 0; }
                        if (!stop) setTodClassicBusy(on);
                    } catch (e) {} finally { busy = false; }
                };
                check(); const id = setInterval(check, LIVE_INVITE_MS); return () => { stop = true; clearInterval(id); };
            }, [screen, liveRoomId]);
            // выход из игры одного устройства не завершает её для остальных: просто убираем свою отметку
            const liveLeave = () => {
                const room = liveRoomRef.current, me = deviceIdRef.current;
                if (room) fetchWithTimeout(roomUrl(room, '/p/' + me), { method: 'DELETE', keepalive: true }, 6000).catch(() => {});
                liveRoomRef.current = ''; liveRoleRef.current = ''; liveSyncRef.current = false; setLive({ room: '', role: '', sync: false }); setLiveFx(null); setLiveCount(0);
            };
            useEffect(() => { if (live.room && !['game', 'ai_response', 'summary'].includes(screen)) liveLeave(); }, [screen]);
            useEffect(() => { const h = () => { if (liveRoomRef.current) liveLeave(); }; window.addEventListener('pagehide', h); return () => window.removeEventListener('pagehide', h); }, []);
            useEffect(() => { if (liveEnded) { setLiveEnded(false); showToast(tr('Игра завершена на другом устройстве'), 2800, 'info'); handleFinishGame(false); } }, [liveEnded]);
            // присоединение к идущей игре. Если хозяин пока один, он пришлёт вопросы, только увидев нас, — поэтому сначала отмечаемся в комнате и ждём
            const liveJoinFlow = async (snap0, quiet = false) => {
                const room = liveRoomIdRef.current, me = deviceIdRef.current; if (!room || !profile || liveJoiningRef.current) return false;
                liveJoiningRef.current = true; setLiveJoining(true);
                let ok = false, announced = false;
                try {
                    let snap = snap0;
                    if (snap.solo) {
                        announced = true;
                        await sessionTasks.run(profile.sessionId, () => fetchWithTimeout(roomUrl(room, '/p'), { method: 'PATCH', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [me]: Date.now() }) }, 6000)).catch(() => {});
                        if (!quiet) showToast(tr('Подключаемся к игре…'), 4000, 'info');
                        const t0 = Date.now(); snap = null;
                        while (Date.now() - t0 < LIVE_JOIN_WAIT_MS) {
                            await new Promise(res => setTimeout(res, 700));
                            try { const r = await fetchWithTimeout(roomUrl(room) + '?t=' + Date.now(), {}, 6000); const s2 = r.ok ? await r.json() : null; if (s2 && s2.status !== 'active') break; if (s2 && !s2.solo && s2.n > 0) { snap = s2; break; } } catch (e) {}
                        }
                        if (!snap) { if (!quiet) showToast(tr('Не удалось подключиться: игра не открыта на устройстве хозяина. Откройте её там и попробуйте снова'), 6000, 'warn'); }
                    }
                    ok = snap ? await enterLive(snap, 'guest') : false;
                } finally {
                    if (!ok && announced) fetchWithTimeout(roomUrl(room, '/p/' + me), { method: 'DELETE' }, 6000).catch(() => {});
                    liveJoiningRef.current = false; setLiveJoining(false);
                }
                return ok;
            };
            const joinLive = async () => {
                if (!profile || !liveRoomIdRef.current || liveJoiningRef.current) return;
                let snap = null; try { const r = await fetchWithTimeout(roomUrl(liveRoomIdRef.current) + '?t=' + Date.now(), {}, 8000); snap = r.ok ? await r.json() : null; } catch (e) {}
                if (!snap || snap.status !== 'active' || !(snap.n > 0)) { setLiveInvite(null); showToast(tr('Игра уже закончилась. Начните новую партию — приглашение появится здесь'), 5000, 'info'); return; }
                const cap = deviceCap(profile, snap); if (liveAlive(snap.p, Date.now(), deviceIdRef.current).others.length >= cap) { showToast(tr('В игре уже ') + cap + ' ' + declOfNum(cap, ['устройство', 'устройства', 'устройств']) + ' — по числу игроков в сессии. Дождитесь, пока кто-нибудь выйдет, или добавьте игроков в «Игроки и сессия»', 6000, 'warn'); return; }
                await liveJoinFlow(snap);
            };
            // после быстрого подключения по приглашению: если в сессии уже идёт игра, входим в неё сами (когда появится приглашение; ждём не дольше 20 секунд)
            useEffect(() => {
                if (!liveInvite || !joinAutoRef.current || screen !== 'menu') return;
                const age = Date.now() - joinAutoRef.current; joinAutoRef.current = 0; if (age > 20000) return; joinLive();
            }, [liveInvite, screen]);
            const handleCloseRoulettePopup = () => {
                rouletteTimeoutsRef.current.forEach(t => clearTimeout(t)); rouletteTimeoutsRef.current = [];
                const p = pendingTurnRef.current; pendingTurnRef.current = null;
                if (p) commitTurn(p.idx, p.entry, p.q);
                setTurnPopup(prev => ({ ...prev, open: false, spinning: false }));
            };

            const handleResumeSavedGame = async (silent = false) => { // true — партия открыта (на этом устройстве или присоединением к идущей)
                if (!profile?.savedGame || !profile.savedGame.questionIds?.length) return false; if (!silent) SoundFX.click();
                const qMap = new Map(); profileDb.forEach(q => { qMap.set(q.id, q); qMap.set(q.dbKey, q); });
                let restoredDeck = profile.savedGame.questionIds.map(id => qMap.get(id)).filter(Boolean);
                if (restoredDeck.length === 0) { setProfile(prev => ({ ...prev, savedGame: null, updatedAt: Date.now() })); return false; }
                const canLive = !!liveRoomIdRef.current; let busyElsewhere = false;
                const cIdx = Math.min(profile.savedGame.currentIndex || 0, restoredDeck.length - 1); const mIdx = Math.min(profile.savedGame.maxReachedIndex || cIdx, restoredDeck.length - 1); const tHist = profile.savedGame.turnHistory || {};
                // если эта же партия ещё идёт на других устройствах — возвращаемся в неё, а не затираем её своим старым состоянием
                if (canLive) {
                    try {
                        const r = await fetchWithTimeout(roomUrl(liveRoomIdRef.current) + '?t=' + Date.now(), {}, 6000); const snap = r.ok ? await r.json() : null;
                        const n = snap ? liveAlive(snap.p, Date.now(), deviceIdRef.current).others.length : 0;
                        const sameDeck = !!snap && snap.status === 'active' && snap.dk === liveDeckKey(restoredDeck.map(q => String(q.id || q.dbKey)).join(','));
                        if (sameDeck && n < deviceCap(profile, snap)) {
                            // другие устройства сейчас в игре — присоединяемся к ним; никого нет — берём состояние из комнаты, если оно не отстаёт от моего сохранения (там самый свежий ход)
                            if (n > 0) { if (await liveJoinFlow(snap, true)) return true; }
                            else if (!snap.solo && (Number(snap.max) || 0) >= mIdx && await enterLive(snap, 'guest')) return true;
                        }
                        busyElsewhere = !!snap && snap.status === 'active' && n > 0; // к идущей игре подключиться не вышло (другая колода, нет места, хозяин не ответил)
                    } catch (e) {}
                }
                // чужую идущую игру нельзя затирать своим старым сохранением: liveStart заставил бы всех её участников перейти в мою колоду
                if (busyElsewhere) { if (!silent) showToast(tr('В сессии уже идёт игра на другом устройстве, и подключиться к ней не удалось. Попробуйте ещё раз или завершите её там'), 6000, 'warn'); return false; }
                setPunDoneKey(''); setGameMode('normal'); setGameQuestions(restoredDeck); setCurrentIndex(cIdx); setMaxReachedIndex(mIdx); setTurnHistory(tHist); setAnsweredCount(0); setCompletedAllFlag(false); setShowEndGameConfirm(false); setTurnPopup({ open: false, spinning: false, highlight: 'guy', winner: null }); navigate('game');
                if (canLive) liveStart(restoredDeck, { idx: cIdx, max: mIdx, hist: tHist, hard: hardMode, fx: { timerOn: hardMode && !!settings.timerOn, timerSec: settings.timerSec, punishOn: hardMode && !!settings.punishOn } });
                if (!tHist[cIdx]) triggerRouletteForIndex(cIdx, tHist, restoredDeck);
                return true;
            };
            // страница перезагрузилась на экране игры (вышла новая версия, телефон выгрузил вкладку): колоды в памяти нет — возвращаем игрока в начатую партию из сохранения.
            // В меню уходим, только если сохранённой партии нет или она не открылась
            const resumeGuardRef = useRef(false);
            useEffect(() => {
                if (isLoading || screen !== 'game' || gameQuestions[currentIndex]) { resumeGuardRef.current = false; return; }
                if (resumeGuardRef.current) return;
                if (profile && isValidAESKey(profile.sessionKey) && !liveRoomId) return; // имя общей комнаты ещё считается: без него вернулись бы в партию в одиночку
                resumeGuardRef.current = true;
                (async () => {
                    let ok = false; try { ok = await handleResumeSavedGame(true); } catch (e) {}
                    if (!ok) { try { window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/'); } catch (e) {} setScreenState('menu'); window.scrollTo(0, 0); } // заменяем запись #/play, чтобы «Назад» не возвращал на неё
                })();
            }, [isLoading, screen, gameQuestions, currentIndex, liveRoomId]);

            const handlePressStartButton = () => { SoundFX.click(); if(!profile) return; navigate('mode_select'); };
            const startWithMode = (mode, opts = {}) => {
                SoundFX.click(); let pool = [];
                if (mode === 'normal') { pool = profileDb.filter(q => !q.hidden && !q.archived && !q.disabled && selectedCats.includes(q.categoryId) && selectedDiffs.includes(q.level) && audienceAllows(q)); if (pool.length === 0) { showToast(tr("Нет подходящих вопросов — измените темы или сложность"), 2800, 'warn'); return; } } else { const catsToUse = selectedCats.length > 0 ? selectedCats : CATEGORIES.map(c => c.id); const diffsToUse = selectedDiffs.length > 0 ? selectedDiffs : DIFFICULTIES.map(d => d.id); pool = profileDb.filter(q => catsToUse.includes(q.categoryId) && diffsToUse.includes(q.level) && audienceAllows(q)); if (pool.length === 0) { showToast(tr("В базе нет подходящих вопросов"), 2800, 'warn'); return; } }
                let shuffled = [...pool]; if (mode === 'normal') { shuffled = buildDeck(pool); } else { for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; } }
                const isHard = opts.hard !== undefined ? !!opts.hard : hardMode, canLive = mode === 'normal' && !!liveRoomIdRef.current;
                setPunDoneKey(''); setGameMode(mode); setGameQuestions(shuffled); setCurrentIndex(0); setMaxReachedIndex(0); setTurnHistory({}); setAnsweredCount(0); setCompletedAllFlag(false); setShowEndGameConfirm(false); navigate('game');
                if (mode === 'normal') {
                    updateSavedGameProgress(shuffled, 0, 0, {});
                    if (canLive) liveStart(shuffled, { idx: 0, max: 0, hist: {}, hard: isHard, fx: { timerOn: isHard && !!settings.timerOn, timerSec: settings.timerSec, punishOn: isHard && !!settings.punishOn } });
                    triggerRouletteForIndex(0, {}, shuffled);
                }
            };

            const handleNextQuestion = () => { if (turnPopup.open || punish.open || showEndGameConfirm) return; if (gameMode === 'normal' && !turnHistory[currentIndex]) { triggerRouletteForIndex(currentIndex, turnHistory); return; } if (liveRoomRef.current && Date.now() - liveRef.current.appliedAt < LIVE_TAP_GUARD_MS) return; if (advanceTurn()) return; if (currentIndex < gameQuestions.length - 1) { const currentQ = gameQuestions[currentIndex]; const currentQKey = currentQ ? (currentQ.id || currentQ.dbKey) : null; const nextIdx = currentIndex + 1; const nextMax = Math.max(maxReachedIndex, nextIdx); SoundFX.flip('right'); setCurrentIndex(nextIdx); setMaxReachedIndex(nextMax); if (gameMode === 'normal') { updateSavedGameProgress(gameQuestions, nextIdx, nextMax, turnHistory, currentQKey); if (!turnHistory[nextIdx]) triggerRouletteForIndex(nextIdx, turnHistory, gameQuestions); } } else { SoundFX.click(); handleFinishGame(true); } };
            const handlePrevQuestion = () => { if (turnPopup.open || punish.open || showEndGameConfirm) return; if (currentIndex <= 0) return; if (liveRoomRef.current && Date.now() - liveRef.current.appliedAt < LIVE_TAP_GUARD_MS) return; SoundFX.flip('left'); const prevIdx = currentIndex - 1; setCurrentIndex(prevIdx); if (gameMode === 'normal') { updateSavedGameProgress(gameQuestions, prevIdx, maxReachedIndex, turnHistory); } };
            const archiveAnsweredQuestions = (questionsToArchive) => { if (!questionsToArchive || questionsToArchive.length === 0 || !profile) return; const newArchKeys = questionsToArchive.map(q => q.id || q.dbKey); setProfile(prev => { const merged = Array.from(new Set([...(prev.archivedIds || []), ...newArchKeys])); return { ...prev, archivedIds: merged, savedGame: null, updatedAt: Date.now() }; }); };
            const handleRestoreSingleFromArchive = (qObj) => { SoundFX.success(); setProfile(prev => ({ ...prev, archivedIds: (prev.archivedIds || []).filter(k => k !== qObj.id && k !== qObj.dbKey), updatedAt: Date.now() })); };
            const handleRestoreBatchFromArchive = (listToRestore) => { if (!listToRestore || listToRestore.length === 0) return; SoundFX.success(); const keysToRemove = new Set(); listToRestore.forEach(q => { keysToRemove.add(q.id); keysToRemove.add(q.dbKey); }); setProfile(prev => ({ ...prev, archivedIds: (prev.archivedIds || []).filter(k => !keysToRemove.has(k)), updatedAt: Date.now() })); };
            const handleFinishGame = (reachedVeryEnd = false) => {
                rouletteTimeoutsRef.current.forEach(clearTimeout); rouletteTimeoutsRef.current = []; pendingTurnRef.current = null;
                SoundFX.click(); liveSendEnd(); setShowEndGameConfirm(false);
                if (gameMode === 'test') { navigate('menu'); return; }
                const completed = gameQuestions.filter((q, index) => {
                    const entry = normTurn(turnHistory[index]);
                    return entry && !entry.cur && profile?.players?.length && profile.players.every(p => entry.answered.includes(p.id));
                });
                const isAllCleared = gameQuestions.length > 0 && completed.length === gameQuestions.length;
                setAnsweredCount(completed.length); setCompletedAllFlag(isAllCleared);
                if (isAllCleared) SoundFX.romanticFinale(); else SoundFX.success();
                archiveAnsweredQuestions(completed);
                if (!completed.length) setProfile(p => p ? { ...p, savedGame: null, updatedAt: Date.now() } : p);
                reportGame(maxReachedIndex + 1, { complete: isAllCleared }); navigate('summary');
            };

            useEffect(() => {
                if (screen !== 'ai_response') {
                    aiRequestRef.current.id++; aiRequestRef.current.controller?.abort();
                    clearInterval(typingIntervalRef.current); setIsAiTyping(false);
                    return;
                }
                return () => { aiRequestRef.current.id++; aiRequestRef.current.controller?.abort(); clearInterval(typingIntervalRef.current); };
            }, [screen]);
            const triggerAI = async (type) => {
                if (!ActionGuard.canProceed(600)) return;
                const q = gameQuestions[currentIndex]; if (!q) return;
                aiRequestRef.current.controller?.abort(); clearInterval(typingIntervalRef.current);
                const controller = new AbortController(), id = ++aiRequestRef.current.id;
                aiRequestRef.current.controller = controller;
                SoundFX.magic(); setAiType(type); setAiContent(tr('Готовлю подсказку…')); setIsAiTyping(true); navigate('ai_response');
                // Начало эффекта нового экрана не меняет id; cleanup старого экрана отменяет только свою работу.
                try {
                    const qText = (lang === 'uk' && q.cleanTextUk) ? q.cleanTextUk : (q.cleanText || q.text);
                    const onChunk = (t) => { if (!controller.signal.aborted && aiRequestRef.current.id === id && t) setAiContent(String(t).slice(0, 12000)); };
                    const response = await fetchFromAI(type, qText, q.categoryId, (profile?.players || []).length, controller.signal, onChunk);
                    if (controller.signal.aborted || aiRequestRef.current.id !== id) return;
                    setAiContent(String(response).slice(0, 12000));
                } catch (error) { if (!controller.signal.aborted && aiRequestRef.current.id === id) setAiContent(tr('Подсказка недоступна. Попробуйте ещё раз')); }
                finally { if (aiRequestRef.current.id === id) setIsAiTyping(false); }
            };

            const handleGenerateQuestionAI = async () => { if (!isAdmin || isGeneratingQuestion || !ActionGuard.canProceed(800)) return; SoundFX.magic(); setIsGeneratingQuestion(true); try { const randomCat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]; const randomDiff = DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)]; const generatedText = await generateUniqueQuestionAI(randomCat, randomDiff, db); if (generatedText) { SoundFX.success(); setAddForm({ text: generatedText, cat: randomCat.id, diff: randomDiff.id, targetId: '', aud: 'both' }); } } catch (err) {} finally { setIsGeneratingQuestion(false); } };
            const openEditScreen = (questionObj, fromScreen) => { if (!isAdmin) return; SoundFX.click(); setEditingQuestion(questionObj); setEditForm({ text: (lang === 'uk' && questionObj.cleanTextUk) ? questionObj.cleanTextUk : (questionObj.cleanText || questionObj.text.replace(/^№\s*\d+\.\s*/, '')), cat: questionObj.categoryId, diff: questionObj.level, targetId: String(questionObj.targetId || '').startsWith('aud_') ? '' : questionObj.targetId || '', savedTarget: String(questionObj.targetId || '').startsWith('aud_') ? questionObj.targetId : '', aud: questionObj.audience || 'both' }); setReturnScreen(fromScreen); setConfirmModal(null); setResultModal(null); navigate('edit_q'); };

            // Фоновий автопереклад: не блокує збереження. Рахує пару ru/uk і дописує text_uk у Firebase + локально.
            const bgTranslateQuestion = (dbKey, typed) => {
                (async () => {
                    try {
                        const bi = await buildBilingual(typed);
                        if (!bi || (!bi.ru && !bi.uk)) return;
                        await fetchWithTimeout(`${FIREBASE_BASE_URL}${dbSubPath}/${dbKey}.json`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: bi.ru, text_uk: bi.uk }) }).catch(() => {});
                        const apply = (q) => q.dbKey === dbKey ? { ...q, cleanText: bi.ru, cleanTextUk: bi.uk, text: `№ ${q.num}. ${bi.ru}` } : q;
                        setDb(prev => { const next = prev.map(apply); try { localStorage.setItem(OFFLINE_DB_CACHE_KEY, JSON.stringify(next)); } catch (e) {} return next; });
                        setGameQuestions(prev => prev.map(apply));
                    } catch (e) {}
                })();
            };
            const handleAddQuestion = async (e) => {
                e.preventDefault(); if (!isAdmin || isSaving) return; if (addForm.text.trim().length < 3) { SoundFX.warn(); setQFormError(tr('Введите текст вопроса — минимум 3 символа')); return; } setQFormError(''); if (!ActionGuard.canProceed(1000)) return; SoundFX.click(); setIsSaving(true);
                try {
                    const cleanInput = sanitizeInput(addForm.text.replace(/^№\s*\d+\.\s*/, ''), 500); if (!cleanInput) throw new Error(tr("Пустой текст")); const nextNum = db.length + 1; const numericKeys = db.map(item => Number(item.dbKey)).filter(n => !isNaN(n)); const nextDbKey = "q_" + Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join(""); const newId = `v_db_${nextNum}_${Math.random().toString(36).substring(2, 6)}`;
                    // Зберігаємо одразу (не чекаємо на переклад), українську версію допише фоновий автопереклад.
                    const typedUk = looksUkrainian(cleanInput);
                    const aud = (addForm.aud === 'couple' || addForm.aud === 'group') ? addForm.aud : 'both';
                    const payload = { id: newId, num: nextNum, categoryId: addForm.cat, level: addForm.diff, text: cleanInput, text_uk: typedUk ? cleanInput : '', audience: aud, targetId: await questionTarget(addForm.targetId, profile) };
                    const res = await fetchWithTimeout(`${FIREBASE_BASE_URL}${dbSubPath}/${nextDbKey}.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                    if (!res.ok) throw new Error(tf("Код: {v0}", { v0: res.status }));
                    const createdQuestion = { ...payload, dbKey: nextDbKey, cleanText: cleanInput, cleanTextUk: typedUk ? cleanInput : '', audience: aud, text: `№ ${nextNum}. ${cleanInput}` };
                    SoundFX.success(); setDb(prev => { const nextDb = reindexSequential([...prev, createdQuestion]); try { localStorage.setItem(OFFLINE_DB_CACHE_KEY, JSON.stringify(nextDb)); } catch (e) {} return nextDb; });
                    setAddStatus({ ok: true, msg: tf("Вопрос сохранен!", {  }), id: newId });
                    bgTranslateQuestion(nextDbKey, cleanInput);
                } catch (err) { SoundFX.warn(); setAddStatus({ ok: false, msg: tf("Ошибка: {v0}", { v0: err.message }) }); } finally { setIsSaving(false); }
            };
            const executeSaveEdit = async () => {
                if (!isAdmin || !editingQuestion || isSaving) return; SoundFX.click(); setIsSaving(true); setConfirmModal(null);
                const cleanUpdatedText = sanitizeInput(editForm.text.replace(/^№\s*\d+\.\s*/, ''), 500);
                // Зберігаємо текст як ввели; протилежну мовну версію перерахує фоновий автопереклад.
                const typedUkE = looksUkrainian(cleanUpdatedText);
                const audE = (editForm.aud === 'couple' || editForm.aud === 'group') ? editForm.aud : 'both';
                try {
                    const updatedPayload = { id: editingQuestion.id, num: editingQuestion.num, categoryId: editForm.cat, level: editForm.diff, text: cleanUpdatedText, text_uk: typedUkE ? cleanUpdatedText : '', audience: audE, targetId: await questionTarget(editForm.targetId, profile, editForm.savedTarget) };
                    const res = await fetchWithTimeout(`${FIREBASE_BASE_URL}${dbSubPath}/${editingQuestion.dbKey}.json`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedPayload) });
                    if (!res.ok) throw new Error(tf("Код {v0}", { v0: res.status }));
                    const updatedObj = { ...editingQuestion, categoryId: editForm.cat, level: editForm.diff, cleanText: cleanUpdatedText, cleanTextUk: typedUkE ? cleanUpdatedText : '', audience: audE, text: `№ ${editingQuestion.num}. ${cleanUpdatedText}`, targetId: updatedPayload.targetId };
                    bgTranslateQuestion(editingQuestion.dbKey, cleanUpdatedText);
                    SoundFX.success(); setDb(prev => { const nextDb = prev.map(q => q.dbKey === editingQuestion.dbKey ? updatedObj : q); try { localStorage.setItem(OFFLINE_DB_CACHE_KEY, JSON.stringify(nextDb)); } catch (e) {} return nextDb; }); setGameQuestions(prev => prev.map(q => q.dbKey === editingQuestion.dbKey ? updatedObj : q)); setEditingQuestion(updatedObj); setResultModal({ ok: true, msg: tf("Успешно обновлен!", {  }), afterCloseScreen: returnScreen });
                } catch (err) { SoundFX.warn(); setResultModal({ ok: false, msg: tf("Не удалось: {v0}", { v0: err.message }) }); } finally { setIsSaving(false); }
            };
            const executeDeleteQuestion = async () => {
                if (!isAdmin || !editingQuestion || isSaving) return; SoundFX.click(); setIsSaving(true); setConfirmModal(null);
                try {
                    const res = await fetchWithTimeout(`${FIREBASE_BASE_URL}${dbSubPath}/${editingQuestion.dbKey}.json`, { method: "DELETE" });
                    if (!res.ok) throw new Error(tf("Код {v0}", { v0: res.status }));
                    SoundFX.success(); setDb(prev => { const filtered = prev.filter(q => q.dbKey !== editingQuestion.dbKey); const nextDb = reindexSequential(filtered); try { localStorage.setItem(OFFLINE_DB_CACHE_KEY, JSON.stringify(nextDb)); } catch (e) {} return nextDb; }); setGameQuestions(prev => { const nextList = prev.filter(q => q.dbKey !== editingQuestion.dbKey); if (currentIndex >= nextList.length && nextList.length > 0) setCurrentIndex(nextList.length - 1); return nextList; }); setResultModal({ ok: true, msg: tf("Удален!", {  }), afterCloseScreen: returnScreen });
                } catch (err) { SoundFX.warn(); setResultModal({ ok: false, msg: tf("Ошибка: {v0}", { v0: err.message }) }); } finally { setIsSaving(false); }
            };

            const conflictNotice = profile?.syncConflict && <section role="alert" className="rounded-xl border border-amber-500/40 p-4 flex flex-col gap-3 text-sm"><p>{tr("Версии сессии различаются. Облачные записи приостановлены, ваш локальный прогресс сохранён. Кнопка ниже заменит локальные имена и прогресс облачной копией.")}</p><button type="button" className="btn-secondary" disabled={isRestoringSession} onClick={useCloudProfile}>{tr("Использовать облачную копию")}</button></section>;
            const pwaModalProps = { showPwaModal, setShowPwaModal, isInAppWebView, pwaPlatformTab, setPwaPlatformTab, triggerIosNativeShareMenu };

            // страницы без сессии: «Об игре», документы, быстрое подключение. Показываем сразу, не дожидаясь загрузки вопросов
            const pageBack = () => navigate(profile ? 'app_menu' : 'onboarding');
            if (PUBLIC_SCREENS.includes(screen)) {
                const shell = (children, links = true) => (<div className="safe-screen w-full flex flex-col items-center slide-up relative z-10">{children}<AppFooter noLinks={!links} /></div>);
                if (screen === 'about') return shell(<AboutPage profileDb={profileDb} topicCount={CATEGORIES.length} hasProfile={!!profile} onBack={pageBack} onStart={() => navigate(profile ? 'menu' : 'onboarding')} onShare={sharePage} />);
                if (screen === 'join') {
                    const sameSession = !!(joinInvite && profile && profile.sessionKey === joinInvite.key);
                    return shell(<JoinPage invite={joinInvite} profile={profile} busy={joinBusy} error={joinError} onJoin={handleJoinInvite} onStay={sameSession ? joinContinue : joinDecline} onManual={joinManual} onAbout={() => navigate('about')} />, false);
                }
                return shell(<LegalPage docId={screen} onBack={pageBack} />, false);
            }
            if (screen === 'invite' && profile) {
                return (
                    <div className="safe-screen w-full flex flex-col items-center slide-up relative z-10">
                        <InvitePage profile={profile} onBack={() => navigate(inviteFrom)} showToast={showToast} />
                        <AppFooter />
                    </div>
                );
            }

            if (!isLoading && loadError && !db.length) return <main className="safe-screen flex flex-col items-center justify-center gap-5"><AskMeLogo size="lg" /><p role="alert">{loadError}</p><button className="btn-primary" onClick={() => { setIsLoading(true); setDbLoadAttempt(n => n + 1); }}>{tr("Повторить загрузку")}</button></main>;

            if (isLoading) return <div className="safe-screen w-full flex flex-col items-center justify-center fade-in relative z-10"><AskMeLogo size="lg" /><p className="text-zinc-500 font-semibold text-xs mt-5">{tr("Синхронизация...")}</p></div>;

            if (screen === 'admin_login') {
                return (
                    <div className="safe-screen w-full flex flex-col items-center justify-between slide-up relative z-10">
                        <header className="w-full max-w-md flex items-center justify-between pt-2">
                            <button aria-label={tr("Назад")} onClick={() => { SoundFX.click(); navigate(profile ? 'menu' : 'onboarding'); }} className="btn-icon flex-shrink-0"><Icons.Back /></button>
                            <AskMeLogo size="xs" />
                            <div className="w-12"></div>
                        </header>
                        <main className="w-full max-w-sm flex flex-col items-center text-center gap-6 my-auto py-8">
                            <div className="w-14 h-14 rounded-xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center text-rose-400"><Icons.Lock /></div>
                            <div className="space-y-1.5"><h1 className="text-2xl font-bold text-white">{tr("Доступ владельца")}</h1></div>
                            {isAdmin ? (
                                <div className="w-full flex flex-col gap-4 pt-2">
                                    <div className="py-3 px-4 rounded-[20px] border border-rose-500/35 bg-rose-500/10 text-xs font-bold text-rose-300">{tr("👑 Права владельца активны")}</div>
                                    <button onClick={() => { SoundFX.click(); navigate('menu'); }} className="btn-primary w-full">{tr("Перейти в меню")}</button>
                                    <button onClick={handleLockAdmin} className="btn-secondary w-full">{tr("Отключить режим владельца")}</button>
                                </div>
                            ) : (
                                <form onSubmit={handleUnlockAdmin} className="w-full flex flex-col gap-4 pt-2">
                                    <input type="email" required value={adminForm.email} onChange={e => setAdminForm({...adminForm, email: e.target.value})} placeholder="Email (Firebase Auth)" className="w-full h-[54px] px-5 rounded-2xl bg-white/[0.04] border border-white/[0.16] text-center text-base text-white outline-none focus:border-rose-500" />
                                    <input type="password" required value={adminForm.pass} onChange={e => setAdminForm({...adminForm, pass: e.target.value})} placeholder={tr("Пароль")} className="w-full h-[54px] px-5 rounded-2xl bg-white/[0.04] border border-white/[0.16] text-center text-base text-white outline-none focus:border-rose-500" />
                                    {adminPinError && <span className="ui-error font-medium">{adminPinError}</span>}
                                    <button type="submit" className="btn-primary w-full">{tr("Войти")}</button>
                                </form>
                            )}
                        </main>
                        <AppFooter />
                    </div>
                );
            }

            if (screen === 'session_created' && profile) {
                return (
                    <div className="safe-screen w-full flex flex-col items-center justify-between slide-up relative z-10">
                        <PwaInstallModal {...pwaModalProps} />
                        <div className="flex-1 flex items-center justify-center w-full py-6">
                            <div className="w-full max-w-sm flex flex-col items-center text-center gap-6">
                                <AskMeLogo size="md" />
                                <div className="space-y-2"><h1 className="font-display text-2xl font-bold text-white">{tr("Сессия готова!")}</h1><p className="text-xs text-zinc-400 leading-relaxed">{tr("Сохраните ID сессии: по нему можно вернуться в игру с любого устройства.")}</p></div>
                                <SessionIdBadge sessionKey={profile?.sessionKey} sessionId={profile.sessionId} onCopy={showToast} size="lg" />
                                <button onClick={() => { SoundFX.click(); navigate('menu'); }} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">{tr("Перейти к игре")} <Icons.Next /></button>
                            </div>
                        </div>
                        <AppFooter />
                    </div>
                );
            }

            if (screen === 'onboarding' || (!profile && isPreviewMode === false)) {
                return (
                    <div className="safe-screen w-full flex flex-col items-center justify-between slide-up relative z-10">
                        <PwaInstallModal {...pwaModalProps} />
                        <button onClick={()=>{ SoundFX.click(); setIsPreviewMode(true); navigate('menu'); }} className="btn-icon absolute top-4 right-4"><Icons.Close /></button>
                        <div className="flex-1 flex items-center justify-center w-full py-6">
                            <div className="w-full max-w-sm flex flex-col items-center text-center gap-7">
                                <AskMeLogo size="lg" onClick={handleLogoSecretTap} />
                                <div className="space-y-1.5"><h1 className="font-display text-2xl md:text-3xl font-bold text-white tracking-tight">{tr("Добро пожаловать")}</h1><p className="text-xs text-zinc-400 leading-relaxed">{tr("Создайте новую сессию или введите 8-значный ID, чтобы продолжить сохранённую игру.")}</p></div>
                                <div className="seg w-full"> <button type="button" onClick={() => { SoundFX.click(); setAuthTab('create'); setRestoreError(''); }} className={`seg-btn ${ authTab === 'create' ? 'is-active' : '' }`} > {tr("Новая игра")} </button> <button type="button" onClick={() => { SoundFX.click(); setAuthTab('restore'); setRestoreError(''); }} className={`seg-btn ${ authTab === 'restore' ? 'is-active' : '' }`} > {tr("Войти по ID")} </button> </div>
                                {authTab === 'create' ? (
                                    <form noValidate onSubmit={handleSaveProfileNames} className="w-full flex flex-col gap-3 text-left fade-in">{conflictNotice}
                                        {playersForm.map((p, idx) => (
                                            <div key={p.id} className="flex gap-2 relative">
                                                <input type="text" placeholder={tf("Игрок {v0}", { v0: idx+1 })} required value={p.name} onChange={e => { const v = sanitizeName(e.target.value); setPlayersForm(playersForm.map((pl, i) => i === idx ? {...pl, name: v} : pl)); setPlayersError(''); }} className="flex-1 h-[54px] px-5 rounded-2xl bg-white/[0.04] border border-white/[0.16] text-white outline-none focus:border-rose-500" />
                                                <button type="button" onClick={() => { setPlayersForm(playersForm.map((pl, i) => i === idx ? {...pl, gender: pl.gender === 'guy' ? 'girl' : 'guy'} : pl)); SoundFX.click(); }} className="btn-icon lg"> {p.gender === 'guy' ? '👨' : '👩'} </button>
                                                {idx > 1 && <button type="button" onClick={() => setPlayersForm(playersForm.filter((_, i) => i !== idx))} className="btn-badge absolute -left-2 -top-2"><Icons.Close /></button>}
                                            </div>
                                        ))}
                                        {playersForm.length >= MAX_PLAYERS && ( <span className="text-xs text-zinc-500 text-center">{tr("Максимум —")} {MAX_PLAYERS} {tr("игроков")}</span> )}
                                {playersForm.length < MAX_PLAYERS && (
                                            <button type="button" onClick={addPlayerField} className="btn-dashed w-full"> <Icons.Plus /> {tr("Добавить игрока")} </button>
                                        )}
                                        {playersError && <p className="ui-error text-center">{playersError}</p>}
                                <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 mt-2"> {tr("Создать сессию")} <Icons.Next /> </button>
                                    </form>
                                ) : (
                                    <form onSubmit={handleRestoreBySessionId} className="w-full flex flex-col gap-4 text-left fade-in">
                                        <input type="text" required maxLength={400} value={restoreIdInput} onChange={e => setRestoreIdInput(e.target.value.slice(0, 400))} placeholder={tr("Ссылка из игры или ID")} className="w-full h-[54px] px-5 rounded-2xl bg-white/[0.04] border border-white/[0.16] text-center text-sm text-white placeholder-zinc-600 outline-none focus:border-rose-500" />
                                        {restoreError && <p className="ui-error text-center font-medium">{restoreError}</p>}
                                        <button type="submit" disabled={isRestoringSession || !restoreIdInput.trim()} className="btn-primary w-full flex items-center justify-center gap-2 mt-2"> {isRestoringSession ? tr("Поиск...") : tr("Восстановить прогресс")} <Icons.Next /> </button>
                                    </form>
                                )}
                                {!isStandalonePWA && ( <button type="button" onClick={handleInstallPwaClick} className="btn-accent btn-sm"> <Icons.DownloadApp /> {tr("Скачать на устройство")} </button> )}
                                {profile && ( <button type="button" onClick={() => { SoundFX.click(); navigate('menu'); }} className="btn-text muted underline underline-offset-4"> {tr("Вернуться в текущую сессию")} </button> )}
                            </div>
                        </div>
                        <AppFooter />
                    </div>
                );
            }

if (screen === 'app_menu') {
                const menuSections = [
                    { title: tr('Разделы'), items: [
                        { id: 'players', icon: '👥', title: tr('Игроки и сессия'), desc: tr('Имена, состав и восстановление'), onClick: () => { if (profile) { setPlayersForm(profile.players); navigate('profile_page'); } } },
                        { id: 'questions', icon: '📚', title: tr('Все вопросы'), desc: tr('Темы и список вопросов'), onClick: () => navigate('cat_list') },
                        { id: 'archive', icon: '🗂️', title: tr('Архив'), desc: `${tr('Пройдено вопросов:')} ${stats.archivedList.length}`, onClick: () => navigate('archive_page') },
                        { id: 'about', icon: '✨', title: tr('Об игре'), desc: tr('Что умеет ASK ME и как играть'), onClick: () => navigate('about') },
                    ] },
                    { title: tr('Настройки'), items: [
                        { id: 'sound', icon: isMuted ? '🔇' : '🔊', title: tr('Звук и вибрация'), desc: isMuted ? tr('Выключены') : tr('Включены'), right: <SettingSwitch on={!isMuted} onChange={toggleMute} label={tr("Звук и вибрация")} /> },
                        { id: 'stats', icon: '📈', title: tr('Статистика игры'), desc: analyticsOn ? tr('Включена: помогает улучшать игру') : tr('Отключена'), right: <SettingSwitch on={analyticsOn} onChange={() => { SoundFX.click(); setAnalyticsOn(v => !v); }} label={tr("Статистика игры")} /> },
                        ...(!isStandalonePWA ? [{ id: 'install', icon: '📲', title: tr('Скачать на устройство'), desc: tr('Добавить на главный экран'), onClick: handleInstallPwaClick }] : [])
                    ] }
                ];
                // Пункты владельца: отдельная зона, которую видит только он. Обычный игрок не видит ни самой зоны, ни намёка на неё.
                const ownerItems = isAdmin ? [
                    { id: 'topics', icon: '⚙️', title: tr('Управление темами'), desc: tr('Добавление тем и порядок'), onClick: () => { setTopicDraft(CATEGORIES.map(c => c.id)); setTopicErr(''); navigate('topics_admin'); } },
                    { id: 'punish', icon: '🎭', title: tr('Шаблоны наказаний'), desc: tr('Список для всех игроков'), onClick: () => { setPtEdit(null); setPtErr(''); setPtConfirmId(''); navigate('punish_admin'); } },
                    { id: 'tod', icon: '🎲', title: tr('Правда или действие'), desc: tr('Карточки: добавить, изменить, скрыть'), onClick: () => { setTodBackTo('app_menu'); setTodEditId(''); navigate('tod_admin'); } },
                    { id: 'analytics', icon: '📊', title: tr('Аналитика'), desc: tr('Сессии, вопросы, наказания'), onClick: () => { setAnSel(null); setAnConfirm(''); navigate('analytics'); } },
                    { id: 'hidden', icon: '🙈', title: tr('Скрытые вопросы'), desc: `${tr('Сейчас скрыто:')} ${stats.hiddenCount}`, onClick: () => { setHqConfirmAll(false); navigate('hidden_q'); } },
                    { id: 'translateall', icon: '🌐', title: tr('Перекласти всі питання'), desc: tr('Дозаповнити українські версії'), onClick: handleTranslateAll },
                    { id: 'owner', icon: '🔓', title: tr('Режим владельца'), desc: tr('Выйти из режима владельца'), onClick: handleLockAdmin }
                ] : [];
                const renderMenuItems = (items) => items.map(it => {
                    const body = (<>
                        <span aria-hidden="true" className="w-10 h-10 rounded-full bg-white/[0.07] flex items-center justify-center text-lg flex-shrink-0">{it.icon}</span>
                        <span className="flex-1 min-w-0 flex flex-col"><span className="text-sm font-semibold text-white truncate">{it.title}</span><span className="text-xs text-zinc-500 truncate">{it.desc}</span></span>
                    </>);
                    return it.right ? (
                        <div key={it.id} className="min-h-[64px] px-4 flex items-center gap-3.5">{body}{it.right}</div>
                    ) : (
                        <button key={it.id} type="button" onClick={() => { SoundFX.click(); it.onClick(); }} className="row">{body}<span aria-hidden="true" className="text-zinc-500 text-xl leading-none">›</span></button>
                    );
                });
                return (
                    <div className="safe-screen w-full flex flex-col items-center slide-up relative z-10">
                        <PwaInstallModal {...pwaModalProps} /> {exitConfirmPopup}
                        <header className="w-full max-w-md lg:max-w-5xl flex items-center gap-3 pt-2">
                            <button type="button" onClick={() => { SoundFX.click(); navigate('menu'); }} aria-label={tr("Назад")} className="btn-icon flex-shrink-0"><Icons.Back /></button>
                            <h1 className="flex-1 text-center text-lg font-bold text-white">{tr('Меню')}</h1>
                            {desk ? <span aria-hidden="true" className="w-11 flex-shrink-0"></span> : <LangMenu lang={lang} onChange={changeLang} />}
                        </header>
                        <main className="w-full max-w-md lg:max-w-5xl flex flex-col gap-6 pt-6 pb-6 desk-cols">
                            {profile && (
                                <section className="flex flex-col gap-2.5">
                                    <SessionIdBadge sessionKey={profile.sessionKey} sessionId={profile.sessionId} onCopy={showToast} size="lg" />
                                    <button type="button" onClick={() => openInvite('app_menu')} className="btn-secondary w-full flex items-center justify-center gap-2"><Icons.Share /> {tr('Пригласить игроков')}</button>
                                </section>
                            )}
                            {menuSections.map(sec => (
                                <section key={sec.title} className="flex flex-col gap-2.5">
                                    <h2 className="px-1 text-xs font-bold text-zinc-500">{sec.title}</h2>
                                    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] divide-y divide-white/[0.06] overflow-hidden">{renderMenuItems(sec.items)}</div>
                                </section>
                            ))}
                            {isAdmin && (
                                <section aria-label={tr("Только для владельца")} className="owner-zone flex flex-col gap-2.5">
                                    <h2 className="px-1 text-xs font-bold text-amber-300/90 flex items-center gap-1.5"><Icons.Lock /> {tr("Только для владельца")} <span className="owner-zone-note">{tr("видите только вы")}</span></h2>
                                    <div className="owner-zone-box divide-y divide-amber-200/10 overflow-hidden">{renderMenuItems(ownerItems)}</div>
                                </section>
                            )}
                            {desk && profile && (
                                <section className="desk-info" aria-label={tr("О сессии")}>
                                    <h2 className="text-sm font-bold text-white">{tr("О сессии")}</h2>
                                    <ul className="desk-info-stats">
                                        <li><b>{profile.players.length}</b><span>{declOfNum(profile.players.length, ['игрок', 'игрока', 'игроков'])}</span></li>
                                        <li><b>{CATEGORIES.length}</b><span>{declOfNum(CATEGORIES.length, ['тема', 'темы', 'тем'])}</span></li>
                                        <li><b>{stats.availableActive}</b><span>{tr("новых вопросов")}</span></li>
                                        <li><b>{stats.archivedList.length}</b><span>{tr("в архиве")}</span></li>
                                    </ul>
                                    <ul className="room-strip-names">{profile.players.map(p => <li key={p.id}><span>{p.name}</span></li>)}</ul>
                                    <dl className="desk-keys">
                                        <div><dt><kbd>←</kbd><kbd>→</kbd></dt><dd>{tr("листать вопросы в игре")}</dd></div>
                                        <div><dt><kbd>Esc</kbd></dt><dd>{tr("закрыть окно")}</dd></div>
                                    </dl>
                                </section>
                            )}
                            <section className="rounded-[20px] border border-rose-500/25 bg-gradient-to-br from-rose-500/[0.12] to-transparent p-5 flex flex-col gap-3">
                                <div><h2 className="text-sm font-bold text-white">{tr('Поделиться игрой')}</h2><p className="text-xs text-zinc-400 leading-snug mt-1">{tr('Отправьте ссылку на игру — присоединиться можно с любого устройства.')}</p></div>
                                <button type="button" onClick={handleShareGame} className="btn-primary w-full flex items-center justify-center gap-2"><Icons.Share /> {tr('Поделиться')}</button>
                            </section>
                            {profile && ( <button type="button" onClick={() => { SoundFX.warn(); setShowExitConfirm(true); }} className="btn-danger w-full flex items-center justify-center gap-2"><Icons.Logout /> {tr('Выйти из сессии')}</button> )}
                            <nav aria-label={tr("Документы")} className="legal-links-row">
                                {legalDoc().order.map(id => <a key={id} href={SCREEN_TO_HASH[id]}>{legalDoc().docs[id].menu}</a>)}
                            </nav>
                        </main>
                        <AppFooter noLinks divider={false} />
                    </div>
                );
            }

            // состав сессии на экранах выбора режима: игроки и устройства, которые уже в идущей игре (иначе только это устройство)
            const lobbyStrip = profile ? <RoomStrip players={profile.players} devices={1 + Math.max(liveInvite ? liveInvite.count : 0, todInvite ? todInvite.count : 0)} /> : null;
            if (screen === 'game_setup') {
                return (
                    <div className="safe-screen w-full flex flex-col items-center slide-up relative z-10">
                        <header className="w-full max-w-md flex items-center justify-between pt-2">
                            <button type="button" onClick={() => { SoundFX.click(); navigate('mode_select'); }} aria-label={tr("Назад")} className="btn-icon flex-shrink-0"><Icons.Back /></button>
                            <h1 className="flex-1 text-center text-lg font-bold text-white">{tr("Усложнённый режим")}</h1>
                            <button type="button" onClick={() => openInvite('game_setup')} aria-label={tr("Пригласить игроков")} title={tr("Пригласить игроков")} className="btn-icon flex-shrink-0"><Icons.Share /></button>
                        </header>
                        <main className="w-full max-w-md flex flex-col gap-6 py-6">{lobbyStrip}{pregameContent}</main>
                        <AppFooter divider={false} />
                    </div>
                );
            }
            if (screen === 'topics_admin') {
                const draft = topicDraft.length ? topicDraft : CATEGORIES.map(c => c.id);
                const orderChanged = JSON.stringify(draft) !== JSON.stringify(CATEGORIES.map(c => c.id));
                return (
                    <div className="safe-screen w-full flex flex-col items-center slide-up relative z-10">
                        <header className="w-full max-w-md flex items-center justify-between pt-2">
                            <button type="button" onClick={() => { SoundFX.click(); navigate('cat_list'); }} aria-label={tr("Назад")} className="btn-icon flex-shrink-0"><Icons.Back /></button>
                            <h1 className="flex-1 text-center text-lg font-bold text-white">{tr("Управление темами")}</h1>
                            <div className="w-11 flex-shrink-0" aria-hidden="true"></div>
                        </header>
                        <main className="w-full max-w-md flex flex-col gap-7 py-6">
                            {!isAdmin ? ( <p className="text-sm text-zinc-400 text-center">{tr("Раздел доступен только владельцу.")}</p> ) : (
                                <>
                                    <section className="flex flex-col gap-3">
                                        <div><h2 className="text-sm font-bold text-white">{tr("Новая тема")}</h2><p className="text-xs text-zinc-500 leading-snug mt-0.5">{tr("Выберите эмодзи из набора или введите любую с клавиатуры устройства, затем назовите тему. Она сразу появится на главной и в списках.")}</p></div>
                                        <div className="flex gap-2">
                                            <input type="text" value={newTopicIcon} maxLength={16} onChange={e => { setNewTopicIcon(e.target.value); setTopicErr(''); }} placeholder="✨" aria-label={tr("Эмодзи темы")} className="w-20 text-center text-2xl" />
                                            <input type="text" value={newTopicName} maxLength={30} onChange={e => { setNewTopicName(e.target.value); setTopicErr(''); }} placeholder={tr("Название темы")} aria-label={tr("Название темы")} className="flex-1 min-w-0 px-4 text-sm" />
                                        </div>
                                        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist">
                                            {EMOJI_SETS.map((set, i) => ( <button key={set[0]} type="button" role="tab" aria-selected={emojiTab === i} onClick={() => { SoundFX.click(); setEmojiTab(i); }} className={`chip flex-shrink-0 ${emojiTab === i ? 'is-on' : ''}`}>{tr(set[0])}</button> ))}
                                        </div>
                                        <div className="grid grid-cols-7 gap-1.5 max-h-44 overflow-y-auto rounded-[20px] border border-white/10 bg-white/[0.04] p-2">
                                            {EMOJI_SETS[emojiTab][1].split(' ').map(em => ( <button key={em} type="button" aria-label={tf("Эмодзи {v0}", { v0: em })} onClick={() => { SoundFX.click(); setNewTopicIcon(em); setTopicErr(''); }} className={`btn-icon plain fluid ${newTopicIcon === em ? 'is-on' : ''}`}>{em}</button> ))}
                                        </div>
                                        {topicErr && <span className="ui-error">{topicErr}</span>}
                                        <button type="button" disabled={topicBusy} onClick={addTopic} className="btn-primary w-full">{topicBusy ? tr("Сохраняем…") : tr("Добавить тему")}</button>
                                    </section>
                                    <div className="hairline-divider"></div>
                                    <section className="flex flex-col gap-3">
                                        <div><h2 className="text-sm font-bold text-white">{tr("Порядок тем")}</h2><p className="text-xs text-zinc-500 leading-snug mt-0.5">{tr("Потяните за ⠿ или нажимайте стрелки. Порядок изменится на главной и во всех списках.")}</p></div>
                                        <TopicReorderList items={draft.map(id => CATEGORIES.find(c => c.id === id)).filter(Boolean)} onChange={items => setTopicDraft(items.map(c => c.id))} />
                                        <button type="button" disabled={topicBusy || !orderChanged} onClick={saveTopicOrder} className="btn-secondary w-full">{tr("Сохранить порядок")}</button>
                                    </section>
                                </>
                            )}
                        </main>
                        <AppFooter />
                    </div>
                );
            }
            if (screen === 'punish_admin') {
                return (
                    <div className="safe-screen w-full flex flex-col items-center slide-up relative z-10">
                        <header className="w-full max-w-md flex items-center gap-3 pt-2">
                            <button type="button" onClick={() => { SoundFX.click(); navigate('app_menu'); }} aria-label={tr("Назад")} className="btn-icon flex-shrink-0"><Icons.Back /></button>
                            <h1 className="flex-1 text-center pr-11 text-lg font-bold text-white">{tr("Шаблоны наказаний")}</h1>
                        </header>
                        <main className="w-full max-w-md flex flex-col gap-6 pt-6 pb-6">
                            {!isAdmin ? ( <p className="text-sm text-zinc-400 text-center">{tr("Раздел доступен только владельцу.")}</p> ) : (
                                <>
                                    <p className="ui-hint">{tr("Эти наказания видят все игроки в усложнённом режиме. Каждый игрок может скрыть любой шаблон у себя или добавить свои.")}</p>
                                    {ptEdit === null ? (
                                        <button type="button" onClick={() => startPtEdit(null)} className="btn-primary w-full">{tr("+ Новый шаблон")}</button>
                                    ) : (
                                        <section className="flex flex-col gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-4 fade-in">
                                            <h2 className="text-sm font-bold text-white">{ptEdit === 'new' ? tr("Новый шаблон") : tr("Редактирование шаблона")}</h2>
                                            <div className="flex gap-2">
                                                <input type="text" value={ptIcon} maxLength={16} onChange={e => { setPtIcon(e.target.value); setPtErr(''); }} placeholder="🎭" aria-label={tr("Эмодзи шаблона")} className="w-20 text-center text-2xl" />
                                                <input type="text" value={ptText} maxLength={80} onChange={e => { setPtText(e.target.value); setPtErr(''); }} placeholder={tr("Например: спой припев")} aria-label={tr("Текст наказания")} className="flex-1 min-w-0 text-sm" />
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {PUNISH_EMOJIS.map(em => ( <button key={em} type="button" aria-label={tf("Иконка {v0}", { v0: em })} onClick={() => { SoundFX.click(); setPtIcon(em); setPtErr(''); }} className={`btn-icon ${ptIcon === em ? 'is-on' : ''}`}>{em}</button> ))}
                                            </div>
                                            <select value={ptLevel} onChange={e => setPtLevel(e.target.value)} aria-label={tr("Для какой сложности вопроса")} className="text-sm text-white">
                                                {LEVEL_OPTIONS.map(o => <option key={o[0]} value={o[0]} className="bg-[#0a0710]">{tr(o[1])}</option>)}
                                            </select>
                                            {ptErr && <span className="ui-error">{ptErr}</span>}
                                            <div className="grid grid-cols-2 gap-3">
                                                <button type="button" onClick={() => { SoundFX.click(); setPtEdit(null); setPtErr(''); }} className="btn-secondary">{tr("Отмена")}</button>
                                                <button type="button" disabled={ptBusy} onClick={savePt} className="btn-primary">{ptBusy ? tr("Сохраняем…") : tr("Сохранить")}</button>
                                            </div>
                                        </section>
                                    )}
                                    {ptEdit === null && ptErr && <span className="ui-error">{ptErr}</span>}
                                    {LEVEL_OPTIONS.map(([lv, label]) => {
                                        const items = punishTemplates.filter(t => t.level === lv);
                                        if (!items.length) return null;
                                        return (
                                            <section key={lv} className="flex flex-col gap-2">
                                                <h2 className="ui-title-section">{tr(label)}</h2>
                                                {items.map(t => (
                                                    <div key={t.id} className="flex items-center gap-2 rounded-[20px] border border-white/10 bg-white/[0.04] px-3.5 py-3">
                                                        <span aria-hidden="true" className="w-10 h-10 rounded-full bg-white/[0.07] flex items-center justify-center text-lg flex-shrink-0">{t.icon}</span>
                                                        <span className="flex-1 min-w-0 text-sm text-zinc-100 leading-snug">{tr(t.text)}</span>
                                                        <button type="button" aria-label={tf("Изменить: {v0}", { v0: tr(t.text) })} onClick={() => startPtEdit(t)} className="btn-icon plain flex-shrink-0"><Icons.Edit /></button>
                                                        <button type="button" disabled={ptBusy} aria-label={ptConfirmId === t.id ? tr("Подтвердить удаление") : tf("Удалить: {v0}", { v0: tr(t.text) })} onClick={() => deletePt(t.id)} className={`flex-shrink-0 ${ptConfirmId === t.id ? 'btn-danger btn-sm' : 'btn-icon plain'}`}>{ptConfirmId === t.id ? tr("Точно?") : '🗑'}</button>
                                                    </div>
                                                ))}
                                            </section>
                                        );
                                    })}
                                </>
                            )}
                        </main>
                        <AppFooter />
                    </div>
                );
            }
            const todInviteBanner = (
                <>
                    {todInvite && (
                        <div role="status" className="w-full flex items-center justify-between gap-3 rounded-[20px] border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 fade-in">
                            <span className="text-sm text-emerald-100 leading-snug">🎲 {tr('Идёт игра «Правда или действие»')}</span>
                            <button type="button" onClick={() => { SoundFX.click(); todJoin(); }} disabled={todJoining} className="btn-primary btn-sm flex-shrink-0">{todJoining ? tr('Подключаемся…') : tr('Присоединиться')}</button>
                        </div>
                    )}
                    <TodAdultModal ui={todUi} open={!!todJoinWarn} okLabel={tr("Понятно")} onOk={() => { const go = todJoinWarn; setTodJoinWarn(null); if (go) go(); }} onCancel={() => { SoundFX.click(); setTodJoinWarn(null); }} />
                </>
            );
            const todAgain = () => { todLeave(); setTodGame(null); navigate('tod_lobby'); };
            if ((screen === 'tod_play' || screen === 'tod_results') && !todGame) {
                return <div className="safe-screen w-full flex flex-col items-center justify-center relative z-10"><p className="text-sm text-zinc-400 text-center" role="status">{tr('Загружаем игру…')}</p></div>;
            }
            if (screen === 'tod_lobby') {
                return <TodLobby ui={todUi} players={profile ? profile.players : []} cfg={todCfg} setCfg={setTodCfg} deviceCount={1 + todPeers} block={todBlock} onStart={todBegin} onShare={() => openInvite('tod_lobby')} onBack={() => navigate('mode_select')} banner={todInviteBanner} deckInfo={todDeckInfo} peek={todPeek} mine={todMine} onMineAdd={todMineAddCard} onMineDel={todMineDelCard} />;
            }
            if (screen === 'tod_play' && todGame) {
                const lvAvail = { easy: !!todNext(todDeck, todGame.cur, 'dare.easy'), medium: !!todNext(todDeck, todGame.cur, 'dare.medium'), hard: !!todNext(todDeck, todGame.cur, 'dare.hard') };
                if (todGame.phase === 'ended') return <TodResults ui={todUi} state={todGame} titles={todTitles(todGame, TOD_TITLES)} onAgain={todAgain} onMenu={() => navigate('menu')} banner={todInviteBanner} />;
                return <TodGame ui={todUi} desktop={desk} state={todGame} banter={todPickBanter(todGame, TOD_BANTER, tr)} cardText={todTextOf} levelAvail={lvAvail} onAction={todDispatch}
                    onEnd={() => { todTapRef.current = 0; if (todDispatch({ t: 'end' })) navigate('tod_results'); }} onLeave={(to) => { todLeave(); setTodGame(null); navigate(to === 'menu' ? 'app_menu' : 'tod_lobby'); }} />;
            }
            if (screen === 'tod_results' && todGame) {
                return <TodResults ui={todUi} state={todGame} titles={todTitles(todGame, TOD_TITLES)} onAgain={todAgain} onMenu={() => navigate('menu')} banner={todInviteBanner} />;
            }
            if (screen === 'tod_admin') {
                return <TodAdmin ui={todUi} cards={todCards} source={todSource} isAdmin={isAdmin} onSave={todSave} onSeed={todSeed} initialEdit={todEditId} onBack={() => { setTodEditId(''); navigate(todBackTo); }} />;
            }
            if (screen === 'analytics') {
                const ag = anFiltered ? aggregateAnalytics(anFiltered.anon) : null;
                const qTextOf = (id) => { const q = db.find(x => String(x.id) === id || String(x.dbKey) === id); return q ? (q.cleanText || q.text) : tf("Вопрос удалён ({v0})", { v0: id }); };
                const tile = (v, label) => ( <div key={tr(label)} className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4"><div className="font-display text-2xl font-bold text-white">{v}</div><div className="text-xs text-zinc-500 mt-1 leading-snug">{label}</div></div> );
                return (
                    <div className="safe-screen w-full flex flex-col items-center slide-up relative z-10">
                        <header className="w-full max-w-md flex items-center gap-3 pt-2">
                            <button type="button" onClick={() => { SoundFX.click(); navigate('app_menu'); }} aria-label={tr("Назад")} className="btn-icon flex-shrink-0"><Icons.Back /></button>
                            <h1 className="flex-1 text-center pr-11 text-lg font-bold text-white">{tr("Аналитика")}</h1>
                        </header>
                        <main className="w-full max-w-md flex flex-col gap-6 pt-6 pb-6">
                            {!isAdmin ? ( <p className="text-sm text-zinc-400 text-center">{tr("Раздел доступен только владельцу.")}</p> ) : (<>
                                <div className="seg" role="tablist">
                                <button type="button" role="tab" aria-selected={screen === 'analytics'} onClick={() => { SoundFX.click(); navigate('analytics'); }} className={`seg-btn ${screen === 'analytics' ? 'is-active' : ''}`}>{tr("Обзор")}</button>
                                <button type="button" role="tab" aria-selected={screen === 'analytics_sessions'} onClick={() => { SoundFX.click(); setAnSel(null); navigate('analytics_sessions'); }} className={`seg-btn ${screen === 'analytics_sessions' ? 'is-active' : ''}`}>{tr("Сессии")}</button>
                            </div>
                                {anMinControl}
                                {anLoading && <p className="text-sm text-zinc-400 text-center">{tr("Загружаем данные…")}</p>}
                                {anErr && <div className="flex flex-col gap-3"><span className="ui-error">{anErr}</span><button type="button" onClick={() => { setAnErr(''); setAnData(null); }} className="btn-secondary">{tr("Повторить")}</button></div>}
                                {ag && ag.games === 0 && <p className="text-sm text-zinc-400 text-center leading-relaxed">{anHiddenGames > 0 ? tr("Пока нет игр с таким числом отвеченных вопросов. Уменьшите порог выше.") : tr("Данных пока нет. Они появятся после первых игр.")}</p>}
                                {ag && ag.games > 0 && (<>
                                    <p className="ui-hint">{tr("Сводка по обезличенным данным: имена игроков здесь не используются.")}</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {tile(ag.sessions, 'Сессий')}{tile(ag.games, 'Игр в сводке')}
                                        {tile(ag.avgPlayers.toFixed(1), 'Игроков в игре (в среднем)')}{tile(ag.avgAnswered.toFixed(1), 'Отвеченных вопросов за игру')}
                                        {tile(fmtDur(ag.avgDuration), 'Длительность игры')}{tile(ag.avgAnswerSec ? fmtDur(ag.avgAnswerSec) : '—', 'Среднее время ответа')}
                                        {tile(Math.round(ag.skipRate * 100) + '%', 'Доля пропущенных вопросов')}{tile(Math.round(ag.hardShare * 100) + '%', 'Игр в усложнённом режиме')}
                                    </div>
                                    <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5 flex flex-col gap-4"><h2 className="ui-title-section">{tr("Популярные темы")}</h2>
                                        <SummaryBars total={Math.max(1, ...ag.topCats.map(c => c[1]))} rows={ag.topCats.map(([id, n]) => { const c = CATEGORIES.find(x => x.id === id); return { label: (c ? c.icon + ' ' + c.name : id), count: n, cls: 'text-zinc-300', bar: 'bg-rose-500' }; })} />
                                    </section>
                                    <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5 flex flex-col gap-4"><h2 className="ui-title-section">{tr("Сложность отвеченных вопросов")}</h2>
                                        <SummaryBars total={Math.max(1, ...Object.values(ag.levels))} rows={[['Простые', 'Лёгкие', 'diff-text-1', 'bg-emerald-400'], ['Средние', 'Средние', 'diff-text-2', 'bg-amber-400'], ['Глубокие', 'Глубокие', 'diff-text-3', 'bg-rose-500']].map(([k, label, cls, bar]) => ({ label, count: ag.levels[k] || 0, cls, bar }))} />
                                    </section>
                                    <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5 flex flex-col gap-3"><h2 className="ui-title-section">{tr("Чаще всего пропускают")}</h2>
                                        {ag.topSkipped.length === 0 ? <p className="text-sm text-zinc-500">{tr("Пропусков пока нет.")}</p> : ag.topSkipped.map(([id, n]) => ( <div key={id} className="flex items-start gap-3"><span className="font-bold text-rose-300 w-8 flex-shrink-0">×{n}</span><span className="text-sm text-zinc-200 leading-snug">{qTextOf(id)}</span></div> ))}
                                    </section>
                                    <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5 flex flex-col gap-3"><h2 className="ui-title-section">{tr("Таймер и наказания")}</h2>
                                        <p className="text-sm text-zinc-300">{tr("Таймер включали в")} {Math.round(ag.timerShare * 100)}{tr("% игр")}{ag.avgTimer ? tf(", в среднем на {v0} с", { v0: Math.round(ag.avgTimer) }) : ''}{tr(". Наказаний выпало:")} {ag.punishShown}.</p>
                                        {ag.topPunish.map(([t, n]) => ( <div key={t} className="flex items-start gap-3"><span className="font-bold text-amber-300 w-8 flex-shrink-0">×{n}</span><span className="text-sm text-zinc-200 leading-snug">{t}</span></div> ))}
                                    </section>
                                </>)}
                                <button type="button" onClick={() => { SoundFX.click(); setAnData(null); setAnErr(''); }} className="btn-ghost w-full">{tr("Обновить данные")}</button>
                            </>)}
                        </main>
                        <AppFooter />
                    </div>
                );
            }
            if (screen === 'analytics_sessions') {
                const src = anFiltered ? (anView === 'full' ? anFiltered.full : anFiltered.anon) : {};
                const list = Object.entries(src || {}).filter(([k, r]) => r && typeof r === 'object').sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
                const sel = anSel && src && src[anSel] ? src[anSel] : null;
                const qTextOf = (id) => { const q = db.find(x => String(x.id) === id || String(x.dbKey) === id); return q ? (q.cleanText || q.text) : tf("Вопрос удалён ({v0})", { v0: id }); };
                return (
                    <div className="safe-screen w-full flex flex-col items-center slide-up relative z-10">
                        <header className="w-full max-w-md flex items-center gap-3 pt-2">
                            <button type="button" onClick={() => { SoundFX.click(); if (anSel) {{ setAnSel(null); setAnConfirm(''); }} else navigate('analytics'); }} aria-label={tr("Назад")} className="btn-icon flex-shrink-0"><Icons.Back /></button>
                            <h1 className="flex-1 text-center pr-11 text-lg font-bold text-white">{tr("Сессии")}</h1>
                        </header>
                        <main className="w-full max-w-md flex flex-col gap-5 pt-6 pb-6">
                            {!isAdmin ? ( <p className="text-sm text-zinc-400 text-center">{tr("Раздел доступен только владельцу.")}</p> ) : (<>
                                {!sel && (<><div className="seg" role="tablist">
                                <button type="button" role="tab" aria-selected={screen === 'analytics'} onClick={() => { SoundFX.click(); navigate('analytics'); }} className={`seg-btn ${screen === 'analytics' ? 'is-active' : ''}`}>{tr("Обзор")}</button>
                                <button type="button" role="tab" aria-selected={screen === 'analytics_sessions'} onClick={() => { SoundFX.click(); setAnSel(null); navigate('analytics_sessions'); }} className={`seg-btn ${screen === 'analytics_sessions' ? 'is-active' : ''}`}>{tr("Сессии")}</button>
                            </div>
                                    <div className="grid grid-cols-2 gap-2" role="tablist">
                                        <button type="button" role="tab" aria-selected={anView === 'full'} onClick={() => { SoundFX.click(); setAnView('full'); }} className={`chip ${anView === 'full' ? 'is-on' : ''}`}>{tr("Полные данные")}</button>
                                        <button type="button" role="tab" aria-selected={anView === 'anon'} onClick={() => { SoundFX.click(); setAnView('anon'); }} className={`chip ${anView === 'anon' ? 'is-on' : ''}`}>{tr("Обезличенные")}</button>
                                    </div>
                                    {anMinControl}
                                    {anLoading && <p className="text-sm text-zinc-400 text-center">{tr("Загружаем данные…")}</p>}
                                    {anErr && <div className="flex flex-col gap-3"><span className="ui-error">{anErr}</span><button type="button" onClick={() => { setAnErr(''); setAnData(null); }} className="btn-secondary">{tr("Повторить")}</button></div>}
                                    {anData && list.length === 0 && <p className="text-sm text-zinc-400 text-center">{tr("Сессий пока нет.")}</p>}
                                    {list.map(([aid, r], i) => { const gs = gamesOf(r); return (
                                        <button key={aid} type="button" onClick={() => { SoundFX.click(); setAnSel(aid); setAnConfirm(''); }} className="card-btn">
                                            <span className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-white truncate">{anView === 'full' ? ((r.names || []).join(' · ') || tr("Без имён")) : tf("Сессия №{v0}", { v0: list.length - i })}</span><span className="text-zinc-500 text-xl leading-none" aria-hidden="true">›</span></span>
                                            <span className="text-xs text-zinc-500">{tr("игр:")} {gs.length} {tr("· последняя")} {fmtDate(r.updatedAt)}</span>
                                        </button> ); })}
                                </>)}
                                {sel && (() => { const gs = gamesOf(sel); const totalAns = gs.reduce((a, g) => a + (g.answered || 0), 0); return (<>
                                    <section className="rounded-[20px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 flex flex-col gap-2">
                                        <h2 className="text-lg font-bold text-white">{anView === 'full' ? ((sel.names || []).join(' · ') || tr("Без имён")) : tr("Обезличенная сессия")}</h2>
                                        <p className="text-xs text-zinc-400 leading-relaxed">{tr("Ключ записи:")} {anSel}<br />{tr("Создана:")} {fmtDate(sel.createdAt || (gs.length ? gs[gs.length - 1].startedAt : 0))} {tr("· обновлена:")} {fmtDate(sel.updatedAt)}<br />{tr("Игр:")} {gs.length} {tr("· отвечено вопросов:")} {totalAns}</p>
                                    </section>
                                    {gs.map(g => ( <section key={g.startedAt} className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5 flex flex-col gap-3">
                                        <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-white">{fmtDate(g.startedAt)}</h3><span className="text-xs font-bold text-zinc-400">{g.mode === 'hard' ? tr("🔥 Усложнённый") : tr("💬 Обычный")}</span></div>
                                        <p className="text-xs text-zinc-400 leading-relaxed">{tr("Игроков:")} {g.players} {tr("· длилась")} {fmtDur(g.durationSec)} {tr("· отвечено")} {g.answered}{tr(", пропущено")} {g.skipped}{g.avgAnswerSec ? " " + tf("· среднее время ответа {v0}", { v0: fmtDur(g.avgAnswerSec) }) + "" : ''}<br />{g.timerSec ? tf("⏱ Таймер: {v0} с", { v0: g.timerSec }) : tr("Без таймера")} · {g.punishOn ? tf("наказания включены (выпало: {v0})", { v0: g.punishCount || 0 }) : tr("без наказаний")}</p>
                                        {(g.perPlayer || []).length > 0 && <p className="text-xs text-zinc-300 leading-relaxed">{g.perPlayer.map(p => tf("{v0}: {v1} отв. / {v2} проп.", { v0: p.name, v1: p.answered, v2: p.skipped })).join(' · ')}</p>}
                                        {(g.answeredIds || []).length > 0 && ( <details className="text-xs text-zinc-300"><summary className="cursor-pointer text-zinc-400 py-1">{tr("Отвеченные вопросы (")}{g.answeredIds.length})</summary><ul className="flex flex-col gap-1.5 pt-2">{g.answeredIds.map(id => <li key={id} className="leading-snug">• {qTextOf(id)}</li>)}</ul></details> )}
                                        {(g.skippedIds || []).length > 0 && ( <details className="text-xs text-zinc-300"><summary className="cursor-pointer text-zinc-400 py-1">{tr("Пропущенные вопросы (")}{g.skippedIds.length})</summary><ul className="flex flex-col gap-1.5 pt-2">{g.skippedIds.map(id => <li key={id} className="leading-snug">• {qTextOf(id)}</li>)}</ul></details> )}
                                        {(g.punishAll || g.punishTpl || []).length > 0 && ( <details className="text-xs text-zinc-300"><summary className="cursor-pointer text-zinc-400 py-1">{tr("Выпавшие наказания (")}{(g.punishAll || g.punishTpl).length})</summary><ul className="flex flex-col gap-1.5 pt-2">{(g.punishAll || g.punishTpl).map((t, i) => <li key={i} className="leading-snug">• {t}</li>)}</ul></details> )}
                                        {(g.customPunishments || []).length > 0 && ( <details className="text-xs text-zinc-300"><summary className="cursor-pointer text-zinc-400 py-1">{tr("Свои наказания игроков (")}{g.customPunishments.length})</summary><ul className="flex flex-col gap-1.5 pt-2">{g.customPunishments.map((t, i) => <li key={i} className="leading-snug">• {t}</li>)}</ul></details> )}
                                    </section> ))}
                                    <button type="button" disabled={anBusy} onClick={() => deleteAnSession(anSel)} className={`w-full ${anConfirm === anSel ? 'btn-danger' : 'btn-secondary'}`}>{anConfirm === anSel ? tr("Точно удалить? Нажмите ещё раз") : tr("🗑 Удалить сессию и все её данные")}</button>
                                    <p className="ui-hint text-center">{tr("Удаляются и полные, и обезличенные данные этой сессии.")}</p>
                                </>); })()}
                            </>)}
                        </main>
                        <AppFooter />
                    </div>
                );
            }
            if (screen === 'hidden_q') {
                const hid = profileDb.filter(q => q.hidden);
                return (
                    <div className="safe-screen w-full flex flex-col items-center slide-up relative z-10">
                        <header className="w-full max-w-md flex items-center gap-3 pt-2">
                            <button type="button" onClick={() => { SoundFX.click(); navigate('app_menu'); }} aria-label={tr("Назад")} className="btn-icon flex-shrink-0"><Icons.Back /></button>
                            <h1 className="flex-1 text-center pr-11 text-lg font-bold text-white">{tr("Скрытые вопросы")}</h1>
                        </header>
                        <main className="w-full max-w-md flex flex-col gap-6 pt-6 pb-6">
                            {!isAdmin ? ( <p className="text-sm text-zinc-400 text-center">{tr("Раздел доступен только владельцу.")}</p> ) : (<>
                                <p className="ui-hint">{tr("Эти вопросы временно скрыты: игроки их не видят, и они не попадают в игру. Вернуть вопрос можно в любой момент.")}</p>
                                {hid.length === 0 ? ( <p className="text-sm text-zinc-400 text-center py-6">{tr("Скрытых вопросов нет. Скрыть вопрос можно в списке вопросов кнопкой 🙈.")}</p> ) : (<>
                                    {CATEGORIES.map(c => { const items = hid.filter(q => q.categoryId === c.id); if (!items.length) return null; return (
                                        <section key={c.id} className="flex flex-col gap-2">
                                            <h2 className="ui-title-section">{c.icon} {catLabel(c.id, c.name)} · {items.length}</h2>
                                            {items.map(q => (
                                                <div key={q.dbKey} className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] px-3.5 py-3">
                                                    <span className="flex-1 min-w-0 text-sm text-zinc-100 leading-snug">{qDisplay(q)}</span>
                                                    <button type="button" disabled={!!hqBusy} onClick={() => setQuestionHidden(q, false)} className="btn-secondary btn-sm flex-shrink-0">{tr("Вернуть")}</button>
                                                </div>
                                            ))}
                                        </section> ); })}
                                    <button type="button" disabled={!!hqBusy} onClick={restoreAllHidden} className={`w-full ${hqConfirmAll ? 'btn-accent' : 'btn-secondary'}`}>{hqConfirmAll ? tf("Точно вернуть все ({v0})? Нажмите ещё раз", { v0: hid.length }) : tf("Вернуть все ({v0})", { v0: hid.length })}</button>
                                </>)}
                            </>)}
                        </main>
                        <AppFooter />
                    </div>
                );
            }
            if (screen === 'profile_page') {
                return (
                    <div className="safe-screen w-full flex flex-col items-center justify-between slide-up relative z-10">
                        <PwaInstallModal {...pwaModalProps} /> {exitConfirmPopup}
                        <header className="w-full max-w-md flex items-center justify-between pt-2">
                            <button aria-label={tr("Назад")} onClick={() => { SoundFX.click(); navigate('menu'); }} className="btn-icon flex-shrink-0"><Icons.Back /></button>
                            <h1 className="flex-1 text-center text-lg font-bold text-white">{tr("Игроки и сессия")}</h1>
                            <LangMenu lang={lang} onChange={changeLang} />
                        </header>
                        <main className="w-full max-w-sm flex flex-col gap-6 my-auto py-6">
                            <SessionIdBadge sessionKey={profile?.sessionKey} sessionId={profile?.sessionId} onCopy={showToast} size="lg" />
                            <form noValidate onSubmit={handleSaveProfileNames} className="flex flex-col gap-3">{conflictNotice}
                                {playersForm.map((p, idx) => (
                                    <div key={p.id} className="flex gap-2 relative">
                                        <input type="text" placeholder={tf("Игрок {v0}", { v0: idx+1 })} required value={p.name} onChange={e => { const v = sanitizeName(e.target.value); setPlayersForm(playersForm.map((pl, i) => i === idx ? {...pl, name: v} : pl)); setPlayersError(''); }} className="flex-1 h-[54px] px-5 rounded-2xl bg-white/[0.04] border border-white/[0.16] text-white outline-none focus:border-rose-500" />
                                        <button type="button" onClick={() => { setPlayersForm(playersForm.map((pl, i) => i === idx ? {...pl, gender: pl.gender === 'guy' ? 'girl' : 'guy'} : pl)); SoundFX.click(); }} className="btn-icon lg"> {p.gender === 'guy' ? '👨' : '👩'} </button>
                                        {idx > 1 && <button type="button" onClick={() => setPlayersForm(playersForm.filter((_, i) => i !== idx))} className="btn-badge absolute -left-2 -top-2"><Icons.Close /></button>}
                                    </div>
                                ))}
                                {playersForm.length >= MAX_PLAYERS && ( <span className="text-xs text-zinc-500 text-center">{tr("Максимум —")} {MAX_PLAYERS} {tr("игроков")}</span> )}
                                {playersForm.length < MAX_PLAYERS && ( <button type="button" onClick={addPlayerField} className="btn-dashed w-full"> <Icons.Plus /> {tr("Добавить игрока")} </button> )}
                                {playersError && <p className="ui-error text-center">{playersError}</p>}
                                <button type="submit" className="btn-primary w-full mt-1"> {tr("Сохранить имена")} </button>
                            </form>
                            <div className="hairline-divider"></div>
                            <form onSubmit={handleRestoreBySessionId} className="flex flex-col gap-3">
                                <label className="block text-xs font-bold text-zinc-400 ml-1"> {tr("Восстановить другую сессию")} </label>
                                <div className="flex gap-2">
                                    <input type="text" maxLength={400} value={restoreIdInput} onChange={e => setRestoreIdInput(e.target.value.slice(0, 400))} placeholder={tr("Ссылка или ID")} className="flex-1 h-[54px] px-4 rounded-xl bg-white/[0.04] border border-white/[0.16] text-sm text-white outline-none focus:border-rose-500" />
                                    <button type="submit" disabled={isRestoringSession || !restoreIdInput.trim()} className="btn-secondary"> {isRestoringSession ? "..." : tr("Войти")} </button>
                                </div>
                                {restoreError && <span className="ui-error">{restoreError}</span>}
                            </form>
                            <div className="hairline-divider"></div>
                            <button type="button" onClick={() => { SoundFX.warn(); setShowExitConfirm(true); }} className="btn-danger w-full"><Icons.Logout /> {tr("Выйти из сессии")}</button>
                            <div className="flex flex-col items-center gap-1 text-center">
                                <button type="button" onClick={() => { SoundFX.warn(); setDelDataOpen(true); }} className="btn-text text-zinc-400">{tr("Удалить мои данные")}</button>
                                <span className="text-[13px] text-zinc-500 leading-snug">{tr("Удалит текущую сессию, её прогресс и статистику этого устройства")}</span>
                            </div>
                            {isAdmin && ( <><div className="hairline-divider"></div> <button onClick={() => { SoundFX.click(); navigate('admin_login'); }} className="btn-accent w-full"> {tr("👑 Управление доступом владельца")} </button></> )}
                        </main>
                        <PopupModal isOpen={delDataOpen} onClose={() => { if (!delDataBusy) setDelDataOpen(false); }}>
                            <div className="flex flex-col gap-4 pt-1">
                                <h3 className="text-lg font-bold text-white pr-8">{tr("Удалить данные этой сессии?")}</h3>
                                <p className="text-sm text-zinc-300 leading-snug">{tr("Будет стёрто без возможности восстановления:")}</p>
                                <ul className="text-sm text-zinc-400 leading-snug list-disc pl-5 flex flex-col gap-1">
                                    <li>{tr("облачная копия сессии и общая комната игры;")}</li>
                                    <li>{tr("записи статистики этой сессии с этого устройства;")}</li>
                                    <li>{tr("имена, архив и незавершённая партия этой сессии на этом устройстве.")}</li>
                                </ul>
                                <p className="text-sm text-zinc-400 leading-snug">{tr("Другие устройства, где открыта эта сессия, потеряют её. Если сессия может понадобиться — сначала скопируйте ссылку на неё.")}</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button" disabled={delDataBusy} onClick={() => { SoundFX.click(); setDelDataOpen(false); }} className="btn-secondary">{tr("Отмена")}</button>
                                    <button type="button" disabled={delDataBusy} onClick={handleDeleteMyData} className="btn-danger">{delDataBusy ? tr("Удаляем…") : tr("Удалить")}</button>
                                </div>
                            </div>
                        </PopupModal>
                        <AppFooter />
                    </div>
                );
            }

const liveInviteBanner = liveInvite ? (
                <div role="status" className="w-full flex items-center justify-between gap-3 rounded-[20px] border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 fade-in">
                    <span className="text-sm text-emerald-100 leading-snug">{tr("👥 В вашей сессии уже идёт игра — в ней")} {liveInvite.count} {declOfNum(liveInvite.count, ['устройство', 'устройства', 'устройств'])}</span>
                    <button type="button" onClick={joinLive} disabled={liveJoining} className="btn-primary btn-sm flex-shrink-0">{liveJoining ? tr("Подключаемся…") : tr("Присоединиться")}</button>
                </div>
            ) : null;
if (screen === 'mode_select') {
                return (
                    <div className="safe-screen w-full flex flex-col items-center slide-up relative z-10">
                        <header className="w-full max-w-md lg:max-w-5xl flex items-center gap-3 pt-2">
                            <button aria-label={tr("Назад")} onClick={() => { SoundFX.click(); navigate('menu'); }} className="btn-icon flex-shrink-0"><Icons.Back /></button>
                            <h1 className="flex-1 text-center text-lg font-bold text-white">{tr("Выберите режим")}</h1>
                            <button type="button" onClick={() => openInvite('mode_select')} aria-label={tr("Пригласить игроков")} title={tr("Пригласить игроков")} className="btn-icon flex-shrink-0"><Icons.Share /></button>
                        </header>
                        <main className="w-full max-w-md lg:max-w-5xl flex flex-col gap-4 pt-6 pb-8">
                            {liveInviteBanner}
                            {todInviteBanner}
                            {lobbyStrip}
                            <div className="mode-grid">
                            <button disabled={stats.availableActive === 0} onClick={() => { SoundFX.click(); setHardMode(false); startWithMode('normal', { hard: false }); }} className="opt-card opt-brand">
                                <span aria-hidden="true" className="w-12 h-12 rounded-xl bg-rose-500/20 flex items-center justify-center text-2xl flex-shrink-0">💬</span>
                                <span className="flex-1 min-w-0 flex flex-col gap-1.5">
                                    <span className="flex items-center justify-between gap-2"><span className="font-bold text-sm text-white">{tr("Обычный режим")}</span> <span className="flex-shrink-0 whitespace-nowrap text-xs font-bold px-2.5 py-0.5 rounded-lg bg-rose-500/25 text-rose-200">{stats.availableActive} {tr("вопр.")}</span></span>
                                    <span className="text-xs text-zinc-300 leading-relaxed">{tr("Без лишних настроек: жребий определяет, кто отвечает первым. Пройденные вопросы уходят в Архив.")}</span>
                                </span>
                            </button>
                            <button disabled={stats.availableActive === 0} onClick={() => { SoundFX.click(); navigate('game_setup'); }} className="opt-card opt-ember">
                                <span aria-hidden="true" className="w-12 h-12 rounded-xl bg-amber-400/15 flex items-center justify-center text-2xl flex-shrink-0">🔥</span>
                                <span className="flex-1 min-w-0 flex flex-col gap-2">
                                    <span className="font-bold text-sm text-white">{tr("Усложнённый режим")}</span>
                                    <span className="text-xs text-zinc-300 leading-relaxed">{tr("Больше азарта: добавьте таймер на ответ и наказания за пропуск. Нужно выбрать хотя бы одно усложнение.")}</span>
                                    <span className="flex flex-wrap gap-1.5 text-xs font-bold text-amber-100/90"><span className="px-2.5 py-1 rounded-full bg-white/[0.07]">{tr("⏱ Таймер")}</span><span className="px-2.5 py-1 rounded-full bg-white/[0.07]">{tr("🎭 Наказания")}</span></span>
                                </span>
                            </button>
                            <button type="button" onClick={() => { SoundFX.click(); navigate('tod_lobby'); }} className="opt-card">
                                <span aria-hidden="true" className="w-12 h-12 rounded-xl bg-white/[0.07] flex items-center justify-center text-2xl flex-shrink-0">🎲</span>
                                <span className="flex-1 min-w-0 flex flex-col gap-1.5">
                                    <span className="font-bold text-sm text-white">{tr("Правда или действие")}</span>
                                    <span className="text-xs text-zinc-300 leading-relaxed">{tr("Для компании и пар: правда, действие и позор за пропуск. 18+")}</span>
                                </span>
                            </button>
                            </div>
                            <p className="px-2 text-xs text-zinc-400 leading-relaxed text-center">{tr("👥 Если к сессии подключатся другие устройства, игра сама синхронизируется — до")} {profile ? deviceCap(profile) : MAX_PLAYERS} {tr("одновременно (по числу игроков): вопросы, очередь, рулетка")}{'\u00A0'}{tr("и таймер")}{'\u00A0'}{tr("у всех одинаковые. Пока вы играете одни, ничего не отправляется. Пригласить игроков можно кнопкой в шапке.")}</p>
                            {isAdmin && (
                                <button onClick={() => { SoundFX.click(); setHardMode(false); startWithMode('test'); }} className="opt-card">
                                    <span aria-hidden="true" className="w-12 h-12 rounded-xl bg-white/[0.07] flex items-center justify-center text-2xl flex-shrink-0">🧪</span>
                                    <span className="flex-1 min-w-0 flex flex-col gap-1.5">
                                        <span className="flex items-center justify-between gap-2"><span className="font-bold text-sm text-zinc-200">{tr("Тестовый режим")}</span> <span className="flex-shrink-0 whitespace-nowrap text-xs font-bold px-2.5 py-0.5 rounded-lg bg-white/[0.10] text-zinc-300">{stats.availableTotal > 0 ? stats.availableTotal : db.length} {tr("вопр.")}</span></span>
                                        <span className="text-xs text-zinc-400 leading-relaxed">{tr("Для владельца: все вопросы (включая Архив) и редактирование карточек.")}</span>
                                    </span>
                                </button>
                            )}
                        </main>
                        <AppFooter divider={false} />
                    </div>
                );
            }

            if (screen === 'menu') {
                const activeSelectedCatsCount = selectedCats.filter(cid => stats.activeByCat[cid] > 0).length;
                const hasSavedGame = Boolean(profile?.savedGame && profile.savedGame.questionIds?.length > 0);
                // почему нельзя начать игру — показываем сразу под кнопкой, а не молча блокируем её
                const startBlock = !profile ? '' : (activeSelectedCatsCount === 0 && selectedDiffs.length === 0) ? tr("Выберите хотя бы одну тему и один уровень сложности.") : activeSelectedCatsCount === 0 ? tr("Выберите хотя бы одну тему.") : selectedDiffs.length === 0 ? tr("Выберите хотя бы один уровень сложности.") : stats.availableActive === 0 ? tr("Под выбранные темы и сложность не осталось новых вопросов. Измените выбор или верните вопросы из архива.") : '';
                const handleStartClick = () => {
                    if (!profile) return;
                    if (startBlock && !isAdmin) { SoundFX.warn(); setStartErrTick(t => t + 1); return; }
                    if (hasSavedGame) { SoundFX.click(); setNewGameConfirm(true); return; }
                    handlePressStartButton();
                };
                const newGameConfirmPopup = (
                    <PopupModal isOpen={newGameConfirm && hasSavedGame} onClose={() => setNewGameConfirm(false)}>
                        <div className="text-center flex flex-col items-center gap-4 pt-1">
                            <h3 className="text-lg font-bold text-white pr-6">{tr("Вы точно хотите начать новую игру?")}</h3>
                            <p className="text-sm text-zinc-400 leading-snug">{tr("Текущий прогресс")}{hasSavedGame ? " " + tf("(вопрос {v0} из {v1})", { v0: (profile.savedGame.currentIndex || 0) + 1, v1: profile.savedGame.questionIds.length }) + "" : ''} {tr("сбросится — продолжить эту партию будет уже нельзя.")}</p>
                            <div className="w-full grid grid-cols-2 gap-3 pt-1">
                                <button type="button" onClick={() => setNewGameConfirm(false)} className="btn-secondary">{tr("Отмена")}</button>
                                <button type="button" onClick={() => { setNewGameConfirm(false); handlePressStartButton(); }} className="btn-danger">{tr("Начать новую")}</button>
                            </div>
                        </div>
                    </PopupModal>
                );
                const pCount = profile?.players?.length || 0;
                const isGroup = pCount > 2;

                return (
                    <div className="safe-screen w-full flex flex-col items-center justify-between slide-up relative z-10">
                        {exitConfirmPopup} {newGameConfirmPopup} <PwaInstallModal {...pwaModalProps} />
                        <div className="w-full max-w-md lg:max-w-6xl mx-auto flex flex-col gap-7 pt-1">
                            {liveInviteBanner}
                            {todInviteBanner}
                            {!desk && <header className="w-full flex items-center justify-between gap-3">
                                <button onClick={() => { if(profile) { SoundFX.click(); setPlayersForm(profile.players); navigate('profile_page'); } else navigate('onboarding'); }} className="btn-secondary btn-sm min-w-0">
                                    <Icons.User /> <span className="truncate">{profile ? tr("Игроки") : tr("Гость")}</span> {isAdmin && <span className="text-rose-400 text-xs">●</span>}
                                </button>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    
                                    <button type="button" onClick={() => { SoundFX.click(); navigate('app_menu'); }} aria-label={tr('Открыть меню')} className="btn-secondary btn-sm flex-shrink-0">
                                        <span>{tr('Меню')}</span><span aria-hidden="true" className="text-lg leading-none">☰</span>
                                    </button>
                                </div>
                            </header>}

                            <div className="flex flex-col items-center text-center gap-3 py-1">
                                <AskMeLogo size="lg" onClick={handleLogoSecretTap} />
                                <p className="text-rose-400 text-xs sm:text-xs font-extrabold mt-0.5">
                                    {!profile ? tr("Откровенные разговоры для пар и компаний") : isGroup ? tr("Откровенные разговоры для компании") : tr("Откровенные разговоры для двоих")}
                                </p>
                                {profile ? (
                                    <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-base font-semibold text-white max-w-sm">
                                        {profile.players.map((p, i) => (
                                            <React.Fragment key={p.id}>
                                                <span className="truncate max-w-[9rem]">{p.name}</span>
                                                {i < pCount - 1 && <span aria-hidden="true" className={isGroup ? 'text-base' : 'text-rose-500 text-sm'}>{isGroup ? GROUP_EMOJIS_SHUFFLED[i % GROUP_EMOJIS_SHUFFLED.length] : '♥'}</span>}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                ) : ( <p className="text-white text-sm font-semibold">{tr("Режим предпросмотра")}</p> )}
                            </div>
                            <div className="hairline-divider"></div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                <div className="lg:col-span-7 flex flex-col gap-8">
                                    <div className="space-y-4">
                                        <h2 className="text-xs font-bold text-zinc-400">{tr("Для кого")}</h2>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <button type="button" onClick={() => { SoundFX.toggle(true); setAudienceMode('couple'); }} aria-pressed={audienceMode === 'couple'} className={`btn-tile ${ audienceMode === 'couple' ? 'is-on' : '' }`}>❤️ {tr("Пара")}</button>
                                            <button type="button" onClick={() => { SoundFX.toggle(true); setAudienceMode('group'); }} aria-pressed={audienceMode === 'group'} className={`btn-tile ${ audienceMode === 'group' ? 'is-on' : '' }`}>🎉 {tr("Компания")}</button>
                                        </div>
                                        <p className="text-xs text-zinc-500 leading-snug">{audienceMode === 'couple' ? tr("Все вопросы, в том числе самые откровенные.") : tr("Только вопросы, которые подходят для компании.")}</p>
                                    </div>
                                    <div className="space-y-4">
                                        <h2 className="text-xs font-bold text-zinc-400">{tr("Сложность")}</h2>
                                        <div className="grid grid-cols-3 gap-2.5">
                                            {DIFFICULTIES.map(diff => ( <button key={diff.id} onClick={() => toggleDiff(diff.id)} className={`btn-tile ${ selectedDiffs.includes(diff.id) ? diff.classBg : '' }`} >{diffLabel(diff.id, diff.name)}</button> ))}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between"><h2 className="text-xs font-bold text-zinc-400">{tr("Темы вопросов")}</h2><button onClick={() => { SoundFX.click(); const allActiveIds = CATEGORIES.filter(c => stats.activeByCat[c.id] > 0).map(c => c.id); setSelectedCats(allActiveIds.every(id => selectedCats.includes(id)) ? [] : allActiveIds); }} className="btn-text">{CATEGORIES.filter(c => stats.activeByCat[c.id] > 0).every(c => selectedCats.includes(c.id)) ? tr("Снять все") : tr("Выбрать все")}</button></div>
                                        <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5">
                                            {CATEGORIES.map(cat => {
                                                const catActiveCount = stats.activeByCat[cat.id] || 0; const isEmpty = catActiveCount === 0; const isSelected = selectedCats.includes(cat.id) && !isEmpty;
                                                return ( <button key={cat.id} disabled={isEmpty} onClick={() => toggleCategory(cat.id)} className={`tile ${ isEmpty ? 'opacity-30 border border-white/10 text-zinc-500' : isSelected ? 'topic-pill-active' : 'topic-pill-inactive' }`} > <div className="flex items-center gap-2 min-w-0"><span className="text-base flex-shrink-0 max-[340px]:hidden">{cat.icon}</span><span className="text-[13px] truncate">{catLabel(cat.id, cat.name)}</span></div> <span className={`text-xs font-bold flex-shrink-0 ${isSelected ? 'text-rose-400' : 'text-zinc-500'}`}>{catActiveCount}</span> </button> );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-5 flex flex-col gap-7 lg:sticky lg:top-24 lg:p-6 lg:rounded-[28px] lg:border lg:border-white/10 lg:bg-white/[0.03] lg:shadow-[0_30px_70px_-40px_rgba(0,0,0,0.9)]">
                                    <div className="lg:hidden hairline-divider"></div>
                                    <div className="space-y-3.5">
                                        <div className="flex items-center justify-between"><h2 className="text-xs font-bold text-zinc-400">{tr("Список вопросов")}</h2><span className="text-xs text-zinc-500">{tr("В архиве:")} <b className="text-zinc-300">{stats.archivedList.length}</b></span></div>
                                        <button onClick={() => { SoundFX.click(); navigate('cat_list'); }} className="btn-secondary w-full flex items-center justify-center gap-2.5"><Icons.List /> {tr("Все вопросы")}</button>
                                    </div>
                                    <div className="flex flex-col gap-5">
                                        <div className="flex items-center gap-3 w-full"><div className="h-[1px] flex-1 bg-white/[0.10]"></div><span className="text-xs font-bold text-zinc-400">{tr("Доступно для новой игры")}</span><div className="h-[1px] flex-1 bg-white/[0.10]"></div></div>
                                        <div className="grid grid-cols-[1fr_auto_1fr] items-center py-1">
                                            <div className="flex flex-col items-center gap-1"><span className="font-display text-4xl font-bold text-white leading-none">{activeSelectedCatsCount}</span><span className="text-xs font-bold text-zinc-500">{declOfNum(activeSelectedCatsCount, ['Тема', 'Темы', 'Тем'])}</span></div>
                                            <div className="h-9 w-[1px] bg-white/[0.10]"></div>
                                            <div className="flex flex-col items-center gap-1"><span className="font-display text-4xl font-bold text-rose-500 leading-none">{stats.availableActive}</span><span className="text-xs font-bold text-zinc-500">{declOfNum(stats.availableActive, ['Вопрос', 'Вопроса', 'Вопросов'])}</span></div>
                                        </div>

                                        {hasSavedGame && profile && ( <button type="button" onClick={() => handleResumeSavedGame()} className="btn-ghost w-full flex items-center justify-center gap-2"><Icons.Resume /> {tr("Продолжить игру")} <span className="text-xs font-semibold text-zinc-500">{tr("· вопрос")} {(profile.savedGame.currentIndex || 0) + 1}</span></button> )}
                                        <div className="flex flex-col">
                                            <button type="button" onClick={handleStartClick} disabled={!profile} aria-disabled={!!startBlock && !isAdmin ? 'true' : undefined} aria-describedby={startBlock ? 'start-hint' : undefined} className={`w-full ${profile ? 'btn-primary' : 'btn-secondary opacity-60 cursor-not-allowed'}`} > <Icons.Play /> {!profile ? tr("Введите имена для игры") : hasSavedGame ? tr("Начать новую игру") : tr("Начать игру")} </button>
                                            <div id="start-hint" aria-live="polite">{startBlock && ( <p key={startErrTick} role={startErrTick ? 'alert' : undefined} className={`inline-error ${startErrTick ? 'shake' : ''}`}><span aria-hidden="true" className="inline-error-i">!</span><span>{startBlock}{isAdmin ? tr(" Тестовый режим доступен и без выбора.") : ''}</span></p> )}</div>
                                            {profile && ( <p className="mt-3.5 text-center text-xs text-zinc-500">{tr("ID сессии:")} <span className="font-semibold text-zinc-300 select-all">{profile.sessionId}</span></p> )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <AppFooter wide />
                    </div>
                );
            }

            if (screen === 'game') {
                const currentQ = gameQuestions[currentIndex];
                if (!currentQ) return <div className="safe-screen w-full flex flex-col items-center justify-center fade-in relative z-10"><AskMeLogo size="lg" /><p className="text-zinc-500 font-semibold text-xs mt-5">{tr("Возвращаемся в игру...")}</p></div>;
                const categoryInfo = CATEGORIES.find(c => c.id === currentQ.categoryId) || CATEGORIES[0]; const diffInfo = DIFFICULTIES.find(d => d.id === currentQ.level) || DIFFICULTIES[0];
                const cleanText = qDisplay(currentQ);
                const turnEntry = normTurn(turnHistory[currentIndex]);
                const turnPlayer = (turnEntry && turnEntry.cur && profile?.players) ? profile.players.find(p => p.id === turnEntry.cur) : null;
                const assignedPlayerName = turnPlayer ? turnPlayer.name : '';
                const turnPending = (turnEntry && turnEntry.cur) ? (profile.players || []).filter(p => !turnEntry.answered.includes(p.id) && p.id !== turnEntry.cur).length : 0;
                const turnDone = gameMode !== 'normal' || (!!turnEntry && !turnEntry.cur && (profile?.players || []).every(p => turnEntry.answered.includes(p.id)));
                const turnSkipped = turnDone && gameMode === 'normal' && isTurnSkipped(turnEntry, profile?.players || []);
                const skippedNames = (turnEntry ? turnEntry.skippedBy : []).map(id => (profile?.players || []).find(p => p.id === id)).filter(Boolean).map(p => p.name).join(', ');
                const tmFrac = fx.timerSec > 0 ? Math.max(0, Math.min(1, tm.left / fx.timerSec)) : 0;
                const tmUrgent = tm.left <= 5;
                const tmColor = tm.left <= 5 ? '#f43f5e' : tm.left <= 10 ? '#fbbf24' : '#34d399';
                const curHidden = !!(db.find(x => x.dbKey === currentQ.dbKey) || {}).hidden; // «скрыт для всех» — берём свежее значение из базы, а не из копии в колоде
                const progressPercent = Math.min(100, Math.round(((currentIndex + 1) / gameQuestions.length) * 100));
                const nextQ = gameQuestions[currentIndex + 1], prevQ = currentIndex > 0 ? gameQuestions[currentIndex - 1] : null;
                const showNextPeek = !!nextQ && (gameMode === 'test' || turnDone);
                const showPrevPeek = !!prevQ;
                const peekBody = (q) => {
                    const c = CATEGORIES.find(x => x.id === q.categoryId) || CATEGORIES[0];
                    const t = q.cleanText || q.text.replace(/^№\s*\d+\.\s*/, '');
                    return ( <><div className="flex items-center gap-2 text-xs font-bold text-zinc-200 mb-6"><span>{c.icon}</span><span>{catLabel(c.id, c.name)}</span></div><div className="peek-text text-[24px] sm:text-[29px] font-medium leading-[1.18] text-white px-2">{t}</div></> );
                };

                return (
                    <div className="safe-screen w-full flex flex-col justify-between fade-in relative z-10">
                        <div className="fixed top-0 left-0 right-0 h-1 bg-white/[0.04] z-30"><div className="h-full bg-rose-600 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div></div>

                        <header className="w-full max-w-xl mx-auto flex justify-between items-center py-2 flex-shrink-0 gap-2">
                            <div className="flex items-center gap-2">
                                <div className="px-3.5 py-1.5 rounded-full border border-white/[0.16] text-white font-display font-bold text-xs "> {currentIndex + 1} <span className="text-zinc-500">/</span> {gameQuestions.length} </div>
                                {live.room && liveCount > 1 && ( <div className="tag" role="status" aria-label={tf("Устройств в игре: {v0}", { v0: liveCount })}><span aria-hidden="true">👥</span> {liveCount}</div> )}
                                {isAdmin && gameMode === 'test' && ( <>
                                    <button type="button" onClick={() => openEditScreen(currentQ, 'game')} className="btn-icon" aria-label={tr("Редактировать вопрос")} title={tr("Редактировать")}><Icons.Edit /></button>
                                    <button type="button" disabled={!!hqBusy} onClick={() => setQuestionHidden(currentQ, !curHidden)} className="btn-icon" aria-label={curHidden ? tr("Вернуть вопрос всем") : tr("Скрыть вопрос для всех")} title={curHidden ? tr("Вернуть вопрос всем") : tr("Скрыть для всех")}>{curHidden ? <Icons.Eye /> : <Icons.EyeOff />}</button>
                                    {curHidden && <span className="tag tag-warn" role="status">{tr("Скрыт")}</span>}
                                </> )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button onClick={toggleMute} className="btn-icon">{isMuted ? <Icons.SoundOff /> : <Icons.SoundOn />}</button>
                                <button onClick={() => { SoundFX.warn(); setShowEndGameConfirm(true); }} className="btn-secondary btn-sm"><Icons.Menu /> <span className="hidden sm:inline">{tr("Меню")}</span></button>
                            </div>
                        </header>

                        <main className="flex-1 flex flex-col items-center justify-center py-6 pb-28 select-none" style={{ touchAction: 'pan-y' }} onPointerDown={onSwipeStart} onPointerMove={onSwipeMove} onPointerUp={onSwipeEnd} onPointerCancel={onSwipeCancel}>
                            <div className="relative w-full max-w-lg lg:max-w-2xl">
                            {desk && <button type="button" onClick={() => { if (!swipeBusy() && swipeAllowed('left')) commitSwipe('left'); else SoundFX.warn(); }} aria-label={tr("Предыдущий вопрос")} title={tr("Предыдущий вопрос")} disabled={currentIndex === 0} className="desk-arrow is-left"><Icons.Back /></button>}
                            {desk && <button type="button" onClick={() => { if (!swipeBusy() && swipeAllowed('right')) commitSwipe('right'); else SoundFX.warn(); }} aria-label={tr("Следующий вопрос")} title={tr("Следующий вопрос")} className="desk-arrow is-right"><Icons.Next /></button>}
                            <div aria-hidden="true" className="absolute inset-x-9 top-9 bottom-[-26px] rounded-[28px] border border-white/10 bg-[#0f0d15] pointer-events-none"></div>
                            <div aria-hidden="true" className="absolute inset-x-5 top-5 bottom-[-14px] rounded-[28px] border border-white/10 bg-[#141119] pointer-events-none"></div>
                            {showNextPeek && ( <div ref={peekNextRef} aria-hidden="true" data-peek="next" className="peek-soft absolute inset-0 z-[5] rounded-[28px] border border-white/10 bg-gradient-to-b from-[#1b1824] to-[#100e16] px-6 pt-9 pb-6 flex flex-col items-center justify-center text-center pointer-events-none select-none overflow-hidden" style={{ opacity: 0, willChange: 'transform, opacity' }}>{peekBody(nextQ)}</div> )}
                            {showPrevPeek && ( <div ref={peekPrevRef} aria-hidden="true" data-peek="prev" className="peek-dim absolute inset-0 z-[5] rounded-[28px] border border-white/10 bg-gradient-to-b from-[#1b1824] to-[#100e16] px-6 pt-9 pb-6 flex flex-col items-center justify-center text-center pointer-events-none select-none overflow-hidden" style={{ opacity: 0, willChange: 'transform, opacity' }}>{peekBody(prevQ)}</div> )}
                            <div ref={cardRef} className="relative z-10 w-full" style={{ willChange: 'transform, opacity', touchAction: 'pan-y' }}>
                            <div ref={glowRef} aria-hidden="true" className="swipe-glow" data-side="right" data-ok="yes"><span className="swipe-shine"></span></div>
                            {swipeHint && ( <div className="absolute -top-11 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-xs font-bold bg-white/[0.10] border border-white/[0.16] text-zinc-100 pointer-events-none fade-in">{swipeHint}</div> )}
                            <div className="game-card relative w-full flex flex-col items-center justify-center rounded-[28px] border border-white/10 bg-gradient-to-b from-[#1b1824] to-[#100e16] px-6 pt-7 pb-6 sm:px-8 shadow-[0_32px_64px_-24px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.07)]" style={{ minHeight: 'min(60dvh, 540px)' }} key={currentQ.dbKey + '_' + currentIndex}>
                                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 h-7 rounded-full bg-[#1b1824] border border-white/[0.16] flex items-center gap-2 text-xs font-bold text-zinc-300 whitespace-nowrap">{tr("Вопрос №")} {currentQ.num} {gameMode === 'test' && currentQ.archived && ( <span className="text-xs px-1.5 rounded bg-white/[0.10] text-zinc-300">{tr("В архиве")}</span> )}</div>
                                <div className="flex flex-col items-center gap-1.5 mb-6 pt-2">
                                    
                                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-200"> <span>{categoryInfo.icon}</span> <span>{catLabel(categoryInfo.id, categoryInfo.name)}</span> <span className="text-zinc-500">•</span> <span className={diffInfo.classText}>{diffLabel(diffInfo.id, diffInfo.name)}</span> </div>
                                </div>

                                <h2 className="text-[24px] sm:text-[29px] font-medium text-center leading-[1.2] [text-wrap:balance] mb-6 text-white px-2"> {cleanText} </h2>
                                {gameMode === 'normal' && (turnDone ? (
                                    <div className="mb-7 flex flex-col items-center gap-2 fade-in">
                                        {turnSkipped ? (
                                            <div className="tag lg tag-warn"><span aria-hidden="true">↷</span> {tr("Вопрос пропущен")}</div>
                                        ) : (
                                            <div className="tag lg tag-ok"><span aria-hidden="true">✓</span> {tr("Вопрос пройден")}</div>
                                        )}
                                        {!turnSkipped && skippedNames && <span className="text-xs text-amber-200/80 text-center px-4">{tr("Пропустили:")} {skippedNames}</span>}
                                    </div>
                                ) : assignedPlayerName ? (
                                    <div className="mb-7 flex flex-col items-center gap-2 fade-in">
                                        <div key={`${currentIndex}:${turnEntry && turnEntry.cur}`} className="tag lg tag-rose turn-tag"><span aria-hidden="true" className="turn-dot"></span>{tr("Отвечает:")} <span className="turn-name">{assignedPlayerName}</span></div>
                                        {skippedNames && <span className="text-xs text-amber-200/80 text-center px-4">{tr("Пропустили:")} {skippedNames}</span>}
                                        {timerKey && tm.key === timerKey && timerDismissKey === timerKey && (
                                            <div className="w-56 mt-2 flex flex-col items-center gap-1" role="timer">
                                                <div className="w-full h-1.5 rounded-full bg-white/[0.10] overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ease-linear ${tm.left <= 5 ? 'bg-rose-600' : tm.left <= 10 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.max(0, Math.min(100, (tm.left / fx.timerSec) * 100))}%` }}></div></div>
                                                <span className={`font-display text-sm font-bold tabular-nums ${tm.left <= 5 ? 'text-rose-300 animate-pulse' : 'text-zinc-300'}`}>⏱ {Math.max(0, tm.left)} {tr("с")}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : null)}
                                <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                                    <button onClick={() => triggerAI('situation')} className="btn-secondary flex items-center justify-center gap-2"> <span className="text-rose-400"><Icons.Sparkles /></span> {tr("Ситуация")} </button>
                                    <button onClick={() => triggerAI('psych')} className="btn-accent flex items-center justify-center gap-2"> <Icons.Bulb /> {tr("Совет")} </button>
                                </div>
                                {gameMode === 'normal' && turnEntry && turnEntry.cur && !turnDone && (
                                    <button type="button" onClick={() => { SoundFX.click(); setShowSkipPopup(true); }} className="btn-ghost mt-3 w-full max-w-sm"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg> {tr("Пропустить вопрос")}</button>
                                )}
                                {currentIndex === 0 && ( <p className="mt-6 text-xs text-zinc-500 text-center">{tr("Листайте карточки свайпами или кнопками")}</p> )}
                            </div></div></div>
                        </main>

                        <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 z-20 bg-gradient-to-t from-[#0a0710] via-[#0a0710]/90 to-transparent" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
                            <div className="max-w-lg mx-auto grid grid-cols-2 gap-3.5">
                                <button onClick={handlePrevQuestion} disabled={currentIndex === 0} className="btn-secondary w-full flex items-center justify-center gap-2"><Icons.Back /> {tr("Назад")}</button>
                                <button onClick={handleNextQuestion} className="btn-primary w-full flex items-center justify-center gap-2">{(currentIndex === gameQuestions.length - 1 && turnDone) ? (gameMode === 'test' ? tr("В меню") : tr("Итоги")) : tr("Далее")} <Icons.Next /></button>
                            </div>
                        </div>

                        <PopupModal isOpen={gameMode === 'normal' && turnPopup.open} onClose={handleCloseRoulettePopup}>
                            <div className="text-center flex flex-col items-center justify-between gap-5 pt-1 min-h-[300px]">
                                <div className="w-full flex flex-col items-center gap-4">
                                    <span className="text-xs font-bold text-zinc-500">{tr("Вопрос №")} {currentQ.num} {tr("• Очередь")}</span>
                                    <h3 className="text-lg font-bold text-white">{turnPopup.spinning ? tr("Определяем, кто отвечает…") : tr("Отвечает:")}</h3>
                                    {turnPopup.candidates && turnPopup.candidates.length > 0 && ( <TurnReel key={turnPopup.spinId} players={turnPopup.candidates} winnerId={turnPopup.winner} spinning={turnPopup.spinning} /> )}
                                </div>
                                <button type="button" disabled={turnPopup.spinning} onClick={handleCloseRoulettePopup} className="btn-primary w-full">{tr("К вопросу")}</button>
                            </div>
                        </PopupModal>

                        <PopupModal isOpen={timerKey !== '' && tm.key === timerKey && timerDismissKey !== timerKey && !turnPopup.open && !showSkipPopup && !showEndGameConfirm && !punish.open && gameMode === 'normal'} onClose={() => setTimerDismissKey(timerKey)}>
                            <div className="flex flex-col items-center gap-5 pt-1 text-center">
                                <div className="flex items-center gap-2 text-xs font-bold text-zinc-400"><span aria-hidden="true">{turnPlayer && turnPlayer.gender === 'guy' ? '👨' : '👩'}</span><span>{tr("Очередь:")} {assignedPlayerName}</span></div>
                                <div className="relative w-[132px] h-[132px]" role="timer" aria-label={tf("Осталось {v0} секунд", { v0: Math.max(0, tm.left) })}>
                                    <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden="true">
                                        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8"></circle>
                                        <circle cx="60" cy="60" r="54" fill="none" stroke={tmColor} strokeWidth="8" strokeLinecap="round" transform="rotate(-90 60 60)" style={{ strokeDasharray: 339.29, strokeDashoffset: 339.29 * (1 - tmFrac), transition: 'stroke-dashoffset 1s linear, stroke 0.4s' }}></circle>
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className={`font-display text-4xl font-bold tabular-nums ${tmUrgent ? 'text-rose-300 animate-pulse' : 'text-white'}`}>{Math.max(0, tm.left)}</span>
                                        <span className="text-xs font-bold text-zinc-500">{tr("сек")}</span>
                                    </div>
                                </div>
                                <p className="text-sm text-zinc-300 leading-snug max-h-24 overflow-y-auto px-1">{cleanText}</p>
                                {fx.punishOn && <span className="text-xs text-zinc-500">{tr("Не успеете — выпадет наказание")}</span>}
                                <div className="w-full grid grid-cols-2 gap-3 pt-1">
                                    <button type="button" onClick={() => { SoundFX.click(); setShowSkipPopup(true); }} className="btn-secondary">{tr("Пропустить")}</button>
                                    <button type="button" onClick={handleNextQuestion} className="btn-primary">{tr("Ответил(а)")}</button>
                                </div>
                            </div>
                        </PopupModal>

                        <PopupModal isOpen={punish.open && gameMode === 'normal'} onClose={closePunish}>
                            <div className="text-center flex flex-col items-center gap-4 pt-1">
                                <div className="text-6xl animate-pulse" aria-hidden="true">{punish.icon}</div>
                                <span className="text-xs font-bold text-rose-400">{punish.reason === 'skip' ? tr("Пропуск вопроса") : tr("Время вышло")}</span>
                                <h3 className="text-xl font-bold text-white">{punish.reason === 'skip' ? (punish.player ? tf("{v0} пропускает вопрос", { v0: punish.player }) : tr("Вопрос пропущен")) : (punish.player ? tf("{v0}, время вышло!", { v0: punish.player }) : tr("Время вышло!"))}</h3>
                                {punish.text ? (
                                    <div className="w-full rounded-[20px] border border-rose-500/35 bg-rose-500/10 p-4">
                                        <div className="text-xs font-bold text-rose-300 mb-1">{tr("Наказание")}</div>
                                        <p className="text-base font-semibold text-white leading-snug">{tr(punish.text)}</p>
                                    </div>
                                ) : ( <p className="text-sm text-zinc-400">{tr("Ход переходит дальше.")}</p> )}
                                <button type="button" onClick={closePunish} className="btn-primary w-full">{punish.text ? tr("Выполнено") : tr("Продолжить")}</button>
                            </div>
                        </PopupModal>

                        <PopupModal isOpen={showSkipPopup && gameMode === 'normal'} onClose={() => setShowSkipPopup(false)}>
                            <div className="text-center flex flex-col items-center gap-4 pt-1">
                                <h3 className="text-lg font-bold text-white">{tr("Пропустить вопрос?")}</h3>
                                <p className="text-sm text-zinc-400 leading-snug">{tr("Выберите, кто пропускает. Пропуски попадут в итоги игры.")}</p>
                                <div className="w-full flex flex-col gap-3 text-left">
                                    {assignedPlayerName && (
                                        <button type="button" onClick={skipForPlayer} className="card-btn">
                                            <span className="block text-sm font-bold text-white">{tr("Только")} {assignedPlayerName}</span>
                                            <span className="block text-xs text-zinc-400 mt-1 leading-snug">{turnPending > 0 ? tr("Пропускает свою очередь, а рулетка выберет следующего.") : tr("Это последний в очереди — вопрос будет закрыт.")}</span>
                                        </button>
                                    )}
                                    <button type="button" onClick={skipForAll} className="card-btn accent">
                                        <span className="block text-sm font-bold text-rose-200">{tr("Для всех")}</span>
                                        <span className="block text-xs text-rose-200/70 mt-1 leading-snug">{tr("Никто не хочет отвечать — переходим к следующему вопросу.")}</span>
                                    </button>
                                </div>
                                <button type="button" onClick={() => setShowSkipPopup(false)} className="btn-text muted pt-1">{tr("Отмена")}</button>
                            </div>
                        </PopupModal>

                        <PopupModal isOpen={showEndGameConfirm} onClose={() => setShowEndGameConfirm(false)}>
                            <div className="text-center flex flex-col items-center gap-5 pt-2">
                                <h3 className="text-lg font-bold text-white pr-4 pl-4">{tr("Завершить текущую партию?")}</h3>
                                {gameMode === 'normal' && <p className="text-xs text-zinc-400 leading-relaxed">{tr("Пройденные вопросы (")}{maxReachedIndex + 1} {tr("шт.) перейдут в Архив сессии")} <b className="text-rose-300">{profile.sessionId}</b>.</p>}
                                {live.room && liveCount > 1 && <p className="text-xs text-amber-200/90 leading-relaxed">{tr("Партия закончится у всех: в игре")} {liveCount} {declOfNum(liveCount, ['устройство', 'устройства', 'устройств'])}{tr(". Чтобы выйти только самому, выберите «Выйти, остальные продолжат».")}</p>}
                                <div className="grid grid-cols-2 gap-3 w-full"> <button onClick={() => { SoundFX.click(); setShowEndGameConfirm(false); }} className="btn-secondary w-full">{tr("Отмена")}</button> <button onClick={() => handleFinishGame(false)} className="btn-primary w-full">{live.room && liveCount > 1 ? tr("Для всех") : tr("Да")}</button> </div>
                                {live.room && liveCount > 1 && <button type="button" onClick={() => { SoundFX.click(); setShowEndGameConfirm(false); navigate('menu'); }} className="btn-secondary w-full">{tr("Выйти, остальные продолжат")}</button>}
                            </div>
                        </PopupModal>
                    </div>
                );
            }

            if (screen === 'ai_response') {
                const currentQ = gameQuestions[currentIndex]; const isSituation = aiType === 'situation';
                return (
                    <div className="safe-screen w-full flex flex-col justify-between fade-in relative z-10">
                        <header className="w-full max-w-2xl mx-auto flex items-center justify-between py-2 flex-shrink-0"> <button aria-label={tr("Назад")} onClick={() => { SoundFX.click(); navigate('game'); }} className="btn-icon flex-shrink-0"><Icons.Back /></button> <AskMeLogo size="xs" /> <span className="text-xs font-bold text-zinc-500">№ {currentQ?.num}</span> </header>
                        <main className="flex-1 flex flex-col items-center py-6 pb-28 overflow-y-auto no-scrollbar">
                            <div className="w-full max-w-xl flex flex-col items-center slide-up gap-6">
                                <div className="text-center space-y-2"> <span className="text-xs font-bold text-rose-400">{isSituation ? tr("Моделирование ситуации") : tr("Совет от ИИ")}</span> <p className="text-base font-medium text-zinc-200 px-2">«{currentQ?.cleanText || currentQ?.text}»</p> </div>
                                <div className="hairline-divider"></div>
                                <div className={`w-full text-left text-zinc-200 text-[15px] md:text-base leading-relaxed whitespace-pre-wrap ${isAiTyping ? 'ai-cursor' : ''}`}>{aiContent}</div>
                                {!isAiTyping && aiContent && <p className="ui-hint text-center">{tr("Текст создал искусственный интеллект. Он может ошибаться и не заменяет специалиста.")}</p>}
                            </div>
                        </main>
                        <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 z-20 bg-gradient-to-t from-[#0a0710] via-[#0a0710]/90 to-transparent"> <div className="max-w-xl mx-auto"> <button onClick={() => { SoundFX.click(); navigate('game'); }} className="btn-primary w-full flex items-center justify-center">{tr("К вопросу")}</button> </div> </div>
                    </div>
                );
            }

if (screen === 'summary') {
                const skipIdx = new Set(); gameQuestions.slice(0, answeredCount).forEach((q, i) => { const e = normTurn(turnHistory[i]); if (e && isTurnSkipped(e, profile?.players || [])) skipIdx.add(i); }); const skippedCount = skipIdx.size; const answered = gameQuestions.slice(0, answeredCount).filter((q, i) => !skipIdx.has(i)); const cEasy = answered.filter(q => q.level === 'Простые').length; const cMed = answered.filter(q => q.level === 'Средние').length; const cHard = answered.filter(q => q.level === 'Глубокие').length;
                const isAllAnswered = completedAllFlag || stats.availableActive === 0;
                const total = answered.length;
                const frac = (total + skippedCount) > 0 ? total / (total + skippedCount) : 0;
                const titleBadge = isAllAnswered ? tr("🏆 Прошли всю колоду") : (skippedCount === 0 && total >= 5) ? tr("💪 Без пропусков") : (cHard >= Math.max(3, total * 0.5)) ? tr("🌊 Любители глубины") : (skippedCount > total) ? tr("🛡️ Осторожные") : total >= 15 ? tr("🔥 Разговорчивые") : tr("✨ Хорошее начало");
                const namesLine = (profile?.players || []).map(p => p.name).join(' · ');
                const canReplay = stats.availableActive > 0;
                return (
                    <div className="safe-screen w-full flex flex-col items-center justify-between relative z-10 overflow-hidden">
                        <SummaryConfetti />
                        <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-sm py-6 gap-6">
                            <div className="reveal" style={{ animationDelay: '0ms' }}><AskMeLogo size="md" /></div>
                            <div className="reveal text-center space-y-1.5" style={{ animationDelay: '80ms' }}>
                                <div className="text-xs font-bold text-rose-400">{isAllAnswered ? tr("Все вопросы пройдены") : tr("Игра завершена")}</div>
                                {namesLine && <p className="text-sm text-zinc-400 truncate max-w-[18rem] mx-auto">{namesLine}</p>}
                            </div>
                            <div className="reveal flex flex-col items-center gap-3" style={{ animationDelay: '160ms' }}>
                                <SummaryRing frac={frac}>
                                    <div className="font-display text-5xl font-extrabold text-white leading-none"><AnimatedCounter target={total} /></div>
                                    <span className="text-xs font-bold text-zinc-500 mt-2">{tr("отвечено")}</span>
                                </SummaryRing>
                                <p className="text-zinc-500 text-xs">{tr("Пройденные вопросы переехали в архив")}</p>
                            </div>
                            <div className="reveal flex flex-col items-center gap-2.5" style={{ animationDelay: '260ms' }}>
                                <span className="inline-flex px-4 py-2 rounded-full border border-rose-500/35 bg-rose-500/10 text-sm font-semibold text-rose-100">{titleBadge}</span>
                                {isAllAnswered && ( <button type="button" onClick={() => SoundFX.romanticFinale()} className="btn-ghost btn-sm">{tr("🎵 Мелодия финала")}</button> )}
                            </div>
                            <div className="reveal w-full rounded-[20px] border border-white/10 bg-white/[0.04] p-5 flex flex-col gap-5" style={{ animationDelay: '360ms' }}>
                                <SummaryBars total={total} rows={[
                                    { label: 'Лёгкие', count: cEasy, cls: 'diff-text-1', bar: 'bg-emerald-400' },
                                    { label: 'Средние', count: cMed, cls: 'diff-text-2', bar: 'bg-amber-400' },
                                    { label: 'Глубокие', count: cHard, cls: 'diff-text-3', bar: 'bg-rose-500' }
                                ]} />
                                <div className="hairline-divider"></div>
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2.5 font-bold text-xs text-zinc-300"><span aria-hidden="true" className="skip-ico"><Icons.Skip /></span> {tr("Пропущено")}</span>
                                    <span className="font-display text-xl font-bold text-white"><AnimatedCounter target={skippedCount} /></span>
                                </div>
                            </div>
                            <div className={`reveal w-full grid gap-3 ${canReplay ? 'grid-cols-2' : 'grid-cols-1'}`} style={{ animationDelay: '460ms' }}>
                                {canReplay && ( <button type="button" onClick={() => { SoundFX.click(); navigate('mode_select'); }} className="btn-secondary">{tr("Играть ещё")}</button> )}
                                <button type="button" onClick={() => { SoundFX.click(); navigate('menu'); }} className="btn-primary flex items-center justify-center gap-2"><Icons.Check /> {tr("В меню")}</button>
                            </div>
                        </div>
                        <AppFooter />
                    </div>
                );
            }

            if (screen === 'cat_list') {
                return (
                    <div className="safe-screen w-full flex flex-col fade-in max-w-md lg:max-w-5xl mx-auto relative z-10">
                        <header className="flex items-center justify-between gap-4 mb-6 pt-2">
                            <div className="flex items-center gap-3.5"><button aria-label={tr("Назад")} onClick={() => { SoundFX.click(); navigate('menu'); }} className="btn-icon flex-shrink-0"><Icons.Back /></button><div><h2 className="text-2xl font-bold text-white">{tr("Все вопросы")}</h2><p className="text-xs text-zinc-500 mt-0.5">{todTab === 'classic' ? `${tr('Активно:')} ${db.length - stats.archivedList.length - stats.disabledCount} ${tr('из')} ${db.length}` : tr('Правда или действие')}</p></div></div>
                        </header>
                        <div className="seg mb-6" role="tablist" aria-label={tr("Что показать")}>
                            {[['classic', 'Классика'], ['truth', 'Правда'], ['dare', 'Действие']].map(([id, label]) => (
                                <button key={id} type="button" role="tab" aria-selected={todTab === id} onClick={() => { SoundFX.click(); setTodTab(id); }} className={`seg-btn ${todTab === id ? 'is-active' : ''}`}>{tr(label)}</button>
                            ))}
                        </div>
                        {todTab !== 'classic' ? (
                            <div className="flex-1 pb-24"><TodArchive ui={todUi} cards={todCards} tab={todTab} isAdmin={isAdmin} onManage={() => { setTodBackTo('cat_list'); setTodEditId(''); navigate('tod_admin'); }}
                                onEdit={(c) => { setTodBackTo('cat_list'); setTodEditId(c.id); navigate('tod_admin'); }}
                                onToggle={async (c) => { try { await todSave({ ...c, isActive: c.isActive !== true }); SoundFX.click(); showToast(c.isActive === true ? tr('Карточка скрыта') : tr('Карточка снова в игре')); } catch (e) { SoundFX.warn(); showToast(tr('Не удалось сохранить. Проверьте интернет и попробуйте ещё раз.'), 5000, 'warn'); } }} /></div>
                        ) : (<>
                        <div className="flex-1 flex flex-col gap-8 pb-24">
                            {isAdmin && ( <button type="button" onClick={() => { SoundFX.click(); setTopicDraft(CATEGORIES.map(c => c.id)); setTopicErr(''); navigate('topics_admin'); }} className="btn-secondary w-full flex items-center justify-center gap-2.5">{tr("⚙ Управление темами")}</button> )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 divide-y md:divide-y-0 border-y border-white/10 divide-white/[0.08]">
                                {CATEGORIES.map(cat => (
                                    <button key={cat.id} onClick={() => { SoundFX.click(); setViewCategory(cat.id); setVisibleLimit(60); navigate('q_list'); }} className="row justify-between md:border-b md:border-white/10">
                                        <div className="flex items-center gap-3.5"><span className="text-2xl">{cat.icon}</span><div><div className="font-semibold text-base text-white">{catLabel(cat.id, cat.name)}</div><div className="text-xs text-zinc-500">{tr("Активных:")} <span className="text-zinc-300 font-semibold">{stats.activeByCat[cat.id] || 0}</span> {tr("из")} {stats.totalByCat[cat.id] || 0}</div></div></div><span className="text-zinc-500"><Icons.Next /></span>
                                    </button>
                                ))}
                            </div>
                            <div className="pt-2 flex flex-col gap-4">
                                <button onClick={() => { SoundFX.click(); navigate('archive_page'); }} className="flex items-center gap-3 text-left group min-h-[48px]"> <span className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-rose-400 group-hover:border-rose-500/40 transition-all"><Icons.Archive /></span> <div><div className="font-bold text-base text-white flex items-center gap-2">{tr("Архив вопросов")} <span className="text-xs text-zinc-500 font-normal">→</span></div><div className="text-xs text-zinc-500">{tr("В архиве:")} {stats.archivedList.length} {tr("вопр.")}</div></div> </button>
                            </div>
                        </div>
                        {isAdmin && <div className="fixed bottom-5 left-5 right-5 max-w-md mx-auto pointer-events-none"> <button onClick={() => { SoundFX.click(); setAddStatus(null); setAddForm({ text: '', cat: 'family', diff: 'Простые', targetId: '', aud: 'both' }); navigate('add_q'); }} className="btn-primary w-full flex items-center justify-center gap-2 pointer-events-auto"><Icons.Plus /> {tr("Новый вопрос")}</button> </div>}
                        </>)}
                    </div>
                );
            }

            if (screen === 'archive_page') {
                return (
                    <div className="safe-screen w-full flex flex-col fade-in max-w-2xl mx-auto relative z-10">
                        <header className="flex items-center justify-between gap-3 mb-6 pt-2 flex-wrap"> <div className="flex items-center gap-3.5"><button aria-label={tr("Назад")} onClick={() => { SoundFX.click(); navigate('cat_list'); }} className="btn-icon flex-shrink-0"><Icons.Back /></button><div><h2 className="text-2xl font-bold text-white">{tr("Архив вопросов")}</h2></div></div> </header>
                        {stats.archivedList.length === 0 ? ( <div className="flex-1 flex flex-col items-center justify-center text-center py-16 gap-4"><div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-500"><Icons.Archive /></div><p className="text-sm text-zinc-400 max-w-xs leading-relaxed">{tr("Архив пуст.")}</p><button onClick={() => navigate('cat_list')} className="btn-secondary mt-2">{tr("К темам")}</button></div> ) : ( <div className="flex-1 flex flex-col gap-6 pb-24"><div className="flex flex-col divide-y divide-white/[0.08] border-y border-white/10"> {stats.archivedList.slice(0, 50).map(q => ( <div key={q.dbKey} className="py-4 flex items-start justify-between gap-4"><div className="text-sm text-zinc-200"><div className="flex items-center gap-2 text-xs mb-1"><span className="text-rose-400 font-bold">№ {q.num}</span></div>{qDisplay(q)}</div><button onClick={() => handleRestoreSingleFromArchive(q)} className="btn-secondary btn-sm"><Icons.Restore /> {tr("Вернуть")}</button></div> ))} </div> <button onClick={() => handleRestoreBatchFromArchive(stats.archivedList)} className="btn-primary w-full flex items-center justify-center gap-2 mt-2"><Icons.Restore /> {tr("Вернуть все")}</button></div> )}
                    </div>
                );
            }

            if (screen === 'q_list') {
                const qs = profileDb.filter(q => q.categoryId === viewCategory);
                const lvlCount = {}; DIFFICULTIES.forEach(d => { lvlCount[d.id] = qs.filter(q => q.level === d.id).length; });
                const lvlShown = DIFFICULTIES.filter(d => (qLevel === 'all' || qLevel === d.id) && lvlCount[d.id] > 0);
                const lvlDot = (d) => ({ background: `rgb(var(--lvl-${DIFFICULTIES.indexOf(d) + 1}-rgb))` });
                const pickLevel = (id) => { if (id === qLevel) return; SoundFX.click(); setQLevel(id); setVisibleLimit(60); };
                return (
                    <div className="safe-screen w-full flex flex-col fade-in max-w-2xl mx-auto relative z-10">
                        <header className="flex items-center justify-between gap-4 mb-5 pt-2 flex-shrink-0">
                            <div className="flex items-center gap-3.5"><button aria-label={tr("Назад")} onClick={() => { SoundFX.click(); navigate('cat_list'); }} className="btn-icon flex-shrink-0"><Icons.Back /></button><h2 className="text-2xl font-bold text-white">{catLabel(viewCategory, CATEGORIES.find(c => c.id === viewCategory)?.name)}</h2></div>
                        </header>
                        <div role="tablist" aria-label={tr("Сортировка по глубине")} className="seg level-seg mb-6">
                            <button type="button" role="tab" aria-selected={qLevel === 'all'} onClick={() => pickLevel('all')} className={`seg-btn level-seg-btn ${qLevel === 'all' ? 'is-active' : ''}`}><span>{tr("Все")}</span>{' '}<span className="level-seg-n">{qs.length}</span></button>
                            {DIFFICULTIES.map(d => (
                                <button key={d.id} type="button" role="tab" aria-selected={qLevel === d.id} onClick={() => pickLevel(d.id)} className={`seg-btn level-seg-btn ${qLevel === d.id ? 'is-active' : ''}`}><span className="flex items-center gap-1.5"><span aria-hidden="true" className="level-dot" style={lvlDot(d)}></span>{diffLabel(d.id, d.name)}</span>{' '}<span className="level-seg-n">{lvlCount[d.id]}</span></button>
                            ))}
                        </div>
                        <div className="flex-1 flex flex-col gap-10 pb-24">
                            {lvlShown.length === 0 && ( <p className="text-sm text-zinc-400 text-center py-10 leading-relaxed">{qs.length === 0 ? tr("В этой теме пока нет вопросов.") : tf("В этой теме нет вопросов уровня «{v0}».", { v0: (DIFFICULTIES.find(d => d.id === qLevel) || {}).name || '' })}</p> )}
                            {lvlShown.map(diff => {
                                const diffQs = qs.filter(q => q.level === diff.id); const shown = diffQs.slice(0, visibleLimit); const rest = diffQs.length - shown.length;
                                return ( <div key={diff.id} className="space-y-3"><h3 className={`text-sm font-bold ${diff.classText}`}>{diffLabel(diff.id, diff.name)} <span className="text-zinc-500 font-semibold">· {diffQs.length}</span></h3><div className="flex flex-col divide-y divide-white/[0.08] border-y border-white/10"> {shown.map(q => ( <div key={q.dbKey} className="py-4 flex items-start justify-between gap-4"> <div className="text-[15px] text-zinc-100 flex-1"><span className="text-rose-400 font-bold mr-2">№ {q.num}.</span>{qDisplay(q)}{q.hidden && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-200 align-middle">{tr("Скрыт")}</span>}</div> <div className="flex items-center gap-2 flex-shrink-0"> {isAdmin && <button disabled={!!hqBusy} onClick={() => setQuestionHidden(q, !q.hidden)} aria-label={q.hidden ? tr("Вернуть вопрос") : tr("Скрыть вопрос для всех")} title={q.hidden ? tr("Вернуть вопрос") : tr("Скрыть для всех")} className="btn-icon">{q.hidden ? '👁' : '🙈'}</button>} {isAdmin && <button onClick={() => openEditScreen(q, 'q_list')} className="btn-icon"><Icons.Edit /></button>} </div> </div> ))} </div>{rest > 0 && ( <button type="button" onClick={() => { SoundFX.click(); setVisibleLimit(v => v + 60); }} className="btn-secondary btn-sm w-full">{tr("Показать ещё")} {Math.min(60, rest)} {tr("из")} {rest}</button> )}</div> );
                            })}
                        </div>
                        {isAdmin && <div className="fixed bottom-5 left-5 right-5 max-w-md mx-auto pointer-events-none"> <button onClick={() => { SoundFX.click(); setAddStatus(null); setAddForm({ text: '', cat: viewCategory || 'family', diff: qLevel !== 'all' ? qLevel : 'Простые', targetId: '', aud: 'both' }); navigate('add_q'); }} className="btn-primary w-full flex items-center justify-center gap-2 pointer-events-auto"><Icons.Plus /> {tr("Новый вопрос")}</button> </div>}
                    </div>
                );
            }

            if (screen === 'edit_q' && editingQuestion && isAdmin) {
                return (
                    <div className="safe-screen w-full flex flex-col fade-in max-w-lg mx-auto relative z-10">
                        <header className="flex items-center gap-3.5 mb-6 pt-2"><button aria-label={tr("Назад")} onClick={() => { SoundFX.click(); navigate(returnScreen); }} className="btn-icon flex-shrink-0"><Icons.Back /></button><div><h2 className="text-xl font-bold text-white">{tr("Редактирование")}</h2><p className="text-xs text-zinc-500">№ {editingQuestion.num}</p></div></header>
                        <div className="flex-1 flex flex-col gap-5 slide-up">
                            <textarea value={editForm.text} onChange={e => { setEditForm({...editForm, text: e.target.value}); setQFormError(''); }} className="w-full p-4 rounded-2xl bg-white/[0.04] border border-white/[0.16] text-base text-white h-36 focus:border-rose-500"></textarea>
                            {qFormError && <span className="ui-error">{qFormError}</span>}
                            <input type="text" placeholder={tr("ID сессии (оставьте пустым для всех)")} value={editForm.targetId} onChange={e => setEditForm({...editForm, targetId: e.target.value})} className="w-full h-[54px] px-5 rounded-2xl bg-white/[0.04] border border-white/[0.16] text-white" />
                            {editForm.savedTarget && <div className="flex items-center justify-between gap-3 text-xs text-zinc-400"><span>{tr("Вопрос закреплён за сессией. Пустое поле сохранит текущий доступ.")}</span><button type="button" className="btn-secondary btn-sm" onClick={() => setEditForm(f => ({ ...f, savedTarget: '', targetId: '' }))}>{tr("Сделать общим")}</button></div>}
                            <div className="grid grid-cols-2 gap-4"><CustomSelect value={editForm.cat} onChange={val => setEditForm({...editForm, cat: val})} options={CATEGORIES.map(c=>({value:c.id, label:catLabel(c.id, c.name)}))} /><CustomSelect value={editForm.diff} onChange={val => setEditForm({...editForm, diff: val})} options={DIFFICULTIES.map(d=>({value:d.id, label:diffLabel(d.id, d.name)}))} /></div>
                            <CustomSelect value={editForm.aud} onChange={val => setEditForm({...editForm, aud: val})} options={[{value:'both', label:audienceLabel('both')},{value:'couple', label:audienceLabel('couple')},{value:'group', label:audienceLabel('group')}]} />
                            {(() => { const hid = !!(db.find(x => x.dbKey === editingQuestion.dbKey) || {}).hidden; return ( <div className="flex flex-col gap-2"> <button type="button" disabled={!!hqBusy} onClick={() => setQuestionHidden(editingQuestion, !hid)} className="btn-secondary w-full flex items-center justify-center gap-2">{hid ? <Icons.Eye /> : <Icons.EyeOff />} {hid ? tr("Вернуть вопрос всем") : tr("Скрыть для всех")}</button> <p className="text-xs text-zinc-500 leading-snug text-center">{hid ? tr("Сейчас вопрос скрыт: игроки его не видят.") : tr("Игроки перестанут видеть вопрос. Вернуть можно здесь или в разделе «Скрытые вопросы».")}</p> </div> ); })()}
                            <button onClick={() => setConfirmModal({ action: 'delete', title: 'Удалить вопрос?' })} className="btn-danger w-full flex items-center justify-center gap-2"><Icons.Trash /> {tr("Удалить")}</button>
                            <div className="mt-auto pt-4 grid grid-cols-2 gap-3.5"><button onClick={() => navigate(returnScreen)} className="btn-secondary w-full">{tr("Отмена")}</button><button onClick={() => { if (editForm.text.trim().length < 3) { SoundFX.warn(); setQFormError(tr('Введите текст вопроса — минимум 3 символа')); return; } setQFormError(''); setConfirmModal({ action: 'save', title: 'Сохранить?' }); }} disabled={isSaving} className="btn-primary w-full"><Icons.Check /> {tr("Сохранить")}</button></div>
                        </div>
                        <PopupModal isOpen={Boolean(confirmModal)} onClose={() => setConfirmModal(null)}>
                            {confirmModal && <div className="text-center gap-5 pt-2"><h3 className="font-bold text-white mb-4">{tr(confirmModal.title)}</h3><div className="grid grid-cols-2 gap-3 w-full"><button onClick={() => setConfirmModal(null)} className="btn-secondary">{tr("Отмена")}</button><button onClick={() => confirmModal.action === 'delete' ? executeDeleteQuestion() : executeSaveEdit()} className="btn-primary">{tr("Да")}</button></div></div>}
                        </PopupModal>
                        <PopupModal isOpen={Boolean(resultModal)} onClose={() => { const target = resultModal?.afterCloseScreen; setResultModal(null); if (target) navigate(target); }}>
                            {resultModal && <div className="text-center gap-4 pt-2"><h3 className="text-lg font-bold text-white mb-2">{resultModal.msg}</h3><button onClick={() => { const target = resultModal.afterCloseScreen; setResultModal(null); if (target) navigate(target); }} className="btn-primary w-full mt-1">{tr("Понятно")}</button></div>}
                        </PopupModal>
                    </div>
                );
            }

            if (screen === 'add_q' && isAdmin) {
                return (
                    <div className="safe-screen w-full flex flex-col fade-in max-w-lg mx-auto relative z-10">
                        <header className="flex items-center gap-3.5 mb-6 pt-2"><button aria-label={tr("Назад")} onClick={() => { SoundFX.click(); navigate(viewCategory ? 'q_list' : 'cat_list'); }} className="btn-icon flex-shrink-0"><Icons.Back /></button><h2 className="text-xl font-bold text-white">{tr("Новый вопрос")}</h2></header>
                        {addStatus ? (
                            <div className="flex-1 flex flex-col items-center justify-center slide-up"><h3 className="text-2xl font-bold text-white">{addStatus.ok ? tr("Вопрос добавлен") : tr("Ошибка")}</h3><p className="text-xs text-zinc-400 mb-4 mt-2">{addStatus.msg}</p><div className="grid grid-cols-2 gap-3 w-full max-w-xs"><button onClick={() => navigate(viewCategory ? 'q_list' : 'cat_list')} className="btn-secondary">{tr("К списку")}</button><button onClick={() => setAddStatus(null)} className="btn-primary">{tr("Еще один")}</button></div></div>
                        ) : (
                            <form noValidate onSubmit={handleAddQuestion} className="flex-1 flex flex-col gap-5 slide-up">
                                <textarea value={addForm.text} onChange={e => { setAddForm({...addForm, text: e.target.value}); setQFormError(''); }} className="w-full p-4 rounded-2xl bg-white/[0.04] border border-white/[0.16] text-base text-white h-36 focus:border-rose-500" placeholder={tr("Введите вопрос...")}></textarea>
                            {qFormError && <span className="ui-error">{qFormError}</span>}
                                <input type="text" placeholder={tr("ID сессии (оставьте пустым для всех)")} value={addForm.targetId} onChange={e => setAddForm({...addForm, targetId: e.target.value})} className="w-full h-[54px] px-5 rounded-2xl bg-white/[0.04] border border-white/[0.16] text-white" />
                                <div className="grid grid-cols-2 gap-4"><CustomSelect value={addForm.cat} onChange={val => setAddForm({...addForm, cat: val})} options={CATEGORIES.map(c=>({value:c.id, label:catLabel(c.id, c.name)}))} /><CustomSelect value={addForm.diff} onChange={val => setAddForm({...addForm, diff: val})} options={DIFFICULTIES.map(d=>({value:d.id, label:diffLabel(d.id, d.name)}))} /></div>
                                <CustomSelect value={addForm.aud} onChange={val => setAddForm({...addForm, aud: val})} options={[{value:'both', label:audienceLabel('both')},{value:'couple', label:audienceLabel('couple')},{value:'group', label:audienceLabel('group')}]} />
                                <button type="button" disabled={isGeneratingQuestion} onClick={handleGenerateQuestionAI} className="btn-accent w-full flex items-center justify-center gap-2"><Icons.Sparkles /> {isGeneratingQuestion ? tr("Генерация...") : tr("Идея от ИИ")}</button>
                                <div className="mt-auto pt-4 grid grid-cols-2 gap-3.5"><button type="button" onClick={() => navigate(viewCategory ? 'q_list' : 'cat_list')} className="btn-secondary w-full">{tr("Отмена")}</button><button type="submit" disabled={isSaving || !addForm.text.trim()} className="btn-primary w-full flex items-center justify-center gap-2"><Icons.Plus /> {tr("Сохранить")}</button></div>
                            </form>
                        )}
                    </div>
                );
            }

            return null;
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
        const toastRoot = document.createElement('div'); toastRoot.id = 'toast-root'; document.body.appendChild(toastRoot);
        ReactDOM.createRoot(toastRoot).render(<ToastHost />);
        const deskRoot = document.createElement('div'); deskRoot.id = 'desk-root'; document.body.insertBefore(deskRoot, document.getElementById('root'));
        ReactDOM.createRoot(deskRoot).render(<><DesktopNav /><DesktopFx /></>);
    
