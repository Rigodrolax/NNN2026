// ==UserScript==
// @name         No Nut November 2026 – Koh-Lanta
// @namespace    https://jvscript.fr/
// @version      3.7.4
// @updateURL    https://raw.githubusercontent.com/Rigodrolax/NNN2026/main/no-nut-november-2026.user.js
// @downloadURL  https://raw.githubusercontent.com/Rigodrolax/NNN2026/main/no-nut-november-2026.user.js
// @description  Régiments, matricules, éliminés, compteur de messages et OP pour le topic officiel No Nut November 2026 (jeuxvideo.com). Détection des défaites, classements, pastilles dans citations/mentions. Compatible JVChat.
// @author       Toi
// @match        https://www.jeuxvideo.com/forums/*-77479206-*
// @match        https://m.jeuxvideo.com/forums/*-77479206-*
// @match        https://www.jeuxvideo.com/forums/42-*-77479206-*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @connect      docs.google.com
// @connect      googleusercontent.com
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  /* ======================================================================
   *  CONFIG
   * ==================================================================== */
  const TOPIC_ID = '77479206';
  const OP_PSEUDO = 'isssoufle';

  // Colle ici le lien de ton GDOC (Google Sheets, partagé en "Tous les utilisateurs
  // disposant du lien peuvent consulter"). Tu peux aussi le définir via le menu
  // Tampermonkey : « Définir l'URL du GDOC ».
  const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1iGvtBCAfef6TUWblPFMk0mEUKMRoxyk25Hh2hoYDJ80/edit?gid=0';

  const SHEET_REFRESH_MS = 45 * 1000;       // relecture du GDOC (toutes les ~minutes + au retour sur l'onglet)
  const COUNT_REFRESH_MS = 60 * 1000;       // mise à jour des dernières pages
  const POO_USERS = new Set(['brigadeantiporn', 'homme_cinema971']);
  // petites horloges animées (SVG avec aiguilles qui tournent, utilisable en <img> ou en fond d'écran)
  const clockUri = (rim, face, ink, a0, secDur) => {
    const hand = (len, w, col, dur, from, tail) => `<line x1='50' y1='${50 + tail}' x2='50' y2='${50 - len}' stroke='${col}' stroke-width='${w}' stroke-linecap='round'><animateTransform attributeName='transform' type='rotate' from='${from} 50 50' to='${from + 360} 50 50' dur='${dur}s' repeatCount='indefinite'/></line>`;
    let ticks = ''; for (let i = 0; i < 60; i++) { const big = i % 5 === 0; ticks += `<line x1='50' y1='${big ? 11 : 12}' x2='50' y2='${big ? 19 : 15}' stroke='${ink}' stroke-width='${big ? 2.6 : .9}' stroke-linecap='round' transform='rotate(${i * 6} 50 50)'/>`; }
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='r' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff'/><stop offset='.45' stop-color='${rim}'/><stop offset='1' stop-color='#2a0d12'/></linearGradient><radialGradient id='f' cx='.4' cy='.35' r='.8'><stop offset='0' stop-color='${face}'/><stop offset='1' stop-color='#cdb88a'/></radialGradient></defs><circle cx='50' cy='50' r='48' fill='url(#r)' stroke='#1a0a0c' stroke-width='1.5'/><circle cx='50' cy='50' r='42' fill='url(#f)' stroke='#4a1018' stroke-width='2.4'/>${ticks}${hand(24, 4.6, ink, 90, a0, 6)}${hand(35, 3, ink, 8, a0 * 3, 8)}${hand(38, 1.4, '#b01020', secDur, 0, 12)}<circle cx='50' cy='50' r='4.2' fill='url(#r)' stroke='#1a0a0c' stroke-width='1'/></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  };
  const CLOCKS = {
    a: clockUri('#c9ccd2', '#f4ead0', '#2a1a14', 40, 2.4), b: clockUri('#8a1c2c', '#f6ecd2', '#2a1a14', 200, 3),
    c: clockUri('#a8adb5', '#efe2c0', '#2a1a14', 120, 1.8), d: clockUri('#6e1220', '#f1e5c6', '#2a1a14', 300, 3.6),
  };
  const FOOT_USERS = new Set(['levodpa2']);
  const CLOCK_USERS = new Set(['prolissou']);         // thème « horloges » (mème : il donne le temps restant en secondes)
  const KING_USERS = new Set(['kaaido']);           // ancien organisateur : thème « Hall of Fame »
  // Médaillons des éditions (dessins originaux, inspirés des diplômes de chaque édition)
  const medal = (year, rib, body, tip) => `<svg class="nnn-medal" viewBox="0 0 48 60" role="img" aria-label="${tip}"><title>${tip}</title><path d="M13 38 8 58l8-5 5 6 5-19z" fill="${rib}" stroke="#1d1208" stroke-width=".9" stroke-linejoin="round"/><path d="M35 38l5 20-8-5-5 6-5-19z" fill="${rib}" stroke="#1d1208" stroke-width=".9" stroke-linejoin="round"/><path d="M13 38 8 58l8-5" fill="#000" opacity=".18"/><circle cx="24" cy="24" r="22" fill="url(#nnG)" stroke="#5a3a08" stroke-width="1"/><circle cx="24" cy="24" r="18.9" fill="none" stroke="#5a3a08" stroke-width=".8" opacity=".7"/>${body}<rect x="10" y="37" width="28" height="10.4" rx="2.4" fill="#1a120a" stroke="url(#nnG)" stroke-width="1.2"/><text x="24" y="45" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="8.4" fill="#f3d27a" letter-spacing=".4">${year}</text></svg>`;
  const OP_MEDAL = medal('2026', '#7a1626', `<circle cx="24" cy="24" r="17.6" fill="#1b1710"/><circle cx="24" cy="24" r="17.6" fill="url(#nnNight)" opacity=".35"/><path d="M11 29 12.4 14l7 7L24 11l4.6 10 7-7L37 29z" fill="url(#nnG)" stroke="#6b430b" stroke-width=".8" stroke-linejoin="round"/><rect x="11" y="28" width="26" height="4" rx="1.2" fill="url(#nnG)" stroke="#6b430b" stroke-width=".8"/><circle cx="24" cy="30" r="1.2" fill="#e0436f"/><circle cx="16.4" cy="30" r=".9" fill="#59c6f2"/><circle cx="31.6" cy="30" r=".9" fill="#59c6f2"/><circle cx="12.4" cy="13.4" r="1.5" fill="#fff3b8"/><circle cx="24" cy="10.4" r="1.6" fill="#fff3b8"/><circle cx="35.6" cy="13.4" r="1.5" fill="#fff3b8"/>`, 'NNN 2026 — créateur du topic et organisateur');
  const KING_CAMEO = "data:image/webp;base64,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";
  const KING_MEDALS = [
    medal("2021", "#7d1620", `<circle cx="24" cy="24" r="17.6" fill="#5b3a1d"/><circle cx="24" cy="24" r="17.6" fill="url(#nnParch)" opacity=".5"/><polygon points="24.0,8.0 25.5,20.3 35.3,12.7 27.7,22.5 40.0,24.0 27.7,25.5 35.3,35.3 25.5,27.7 24.0,40.0 22.5,27.7 12.7,35.3 20.3,25.5 8.0,24.0 20.3,22.5 12.7,12.7 22.5,20.3" fill="#e8c878" opacity=".35"/><path d="M11 13 36 34M37 13 12 34" stroke="#d8dde3" stroke-width="2.6" stroke-linecap="round"/><path d="M11 13 36 34M37 13 12 34" stroke="#5c6670" stroke-width=".7" stroke-linecap="round"/><circle cx="11" cy="13" r="1.8" fill="#d6a63a"/><circle cx="37" cy="13" r="1.8" fill="#d6a63a"/><ellipse cx="24" cy="24" rx="6.4" ry="6.2" fill="#f5f0e4" stroke="#2a1d10" stroke-width=".7"/><rect x="20.8" y="28" width="6.4" height="3.6" rx="1" fill="#f5f0e4" stroke="#2a1d10" stroke-width=".7"/><ellipse cx="21.7" cy="23.6" rx="1.7" ry="2" fill="#1b130b"/><ellipse cx="26.3" cy="23.6" rx="1.7" ry="2" fill="#1b130b"/><path d="M23.2 26.6 24 25.4 24.8 26.6Z" fill="#1b130b"/><path d="M12.5 19.5C14 11 34 11 35.5 19.5 31 17 17 17 12.5 19.5Z" fill="#14100c" stroke="#d6a63a" stroke-width=".9"/><path d="M12.5 19.5 10 22M35.5 19.5 38 22" stroke="#14100c" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="14.6" r="1.3" fill="#d6a63a"/>`, "NNN 2021 \u2014 Pirate (Google Docs, purges automatis\u00e9es, \u00ab cap de testo \u00bb)"),
    medal("2022", "#1f4f8e", `<circle cx="24" cy="24" r="17.6" fill="#33659f"/><circle cx="24" cy="24" r="17.6" fill="url(#nnDenim)" opacity=".55"/><circle cx="24" cy="24" r="15.6" fill="none" stroke="#f1dfae" stroke-width="1" stroke-dasharray="2.2 1.8" opacity=".85"/><polygon points="24.0,11.5 26.8,18.2 34.0,17.2 29.6,23.0 34.0,28.8 26.8,27.8 24.0,34.5 21.2,27.8 14.0,28.8 18.4,23.0 14.0,17.2 21.2,18.2" fill="url(#nnG)" stroke="#6b430b" stroke-width=".8" stroke-linejoin="round"/><circle cx="24.0" cy="10.5" r="2.1" fill="url(#nnG)" stroke="#6b430b" stroke-width=".5"/><circle cx="34.8" cy="16.8" r="2.1" fill="url(#nnG)" stroke="#6b430b" stroke-width=".5"/><circle cx="34.8" cy="29.2" r="2.1" fill="url(#nnG)" stroke="#6b430b" stroke-width=".5"/><circle cx="24.0" cy="35.5" r="2.1" fill="url(#nnG)" stroke="#6b430b" stroke-width=".5"/><circle cx="13.2" cy="29.2" r="2.1" fill="url(#nnG)" stroke="#6b430b" stroke-width=".5"/><circle cx="13.2" cy="16.8" r="2.1" fill="url(#nnG)" stroke="#6b430b" stroke-width=".5"/><circle cx="24" cy="23" r="3.6" fill="#7a4d10" stroke="#f6dd8a" stroke-width=".8"/><path d="M24 20.4l.8 1.7 1.8.2-1.4 1.2.4 1.8-1.6-1-1.6 1 .4-1.8-1.4-1.2 1.8-.2z" fill="#f6dd8a"/>`, "NNN 2022 \u2014 Far West : les Sherifs de NoFap County"),
    medal("2023", "#8f1e2b", `<circle cx="24" cy="24" r="17.6" fill="#0c1730"/><path d="M24 6.4A17.6 17.6 0 0 0 6.4 24 17.6 17.6 0 0 0 24 41.6Z" fill="url(#nnRed)" opacity=".85"/><path d="M24 6.4A17.6 17.6 0 0 1 41.6 24 17.6 17.6 0 0 1 24 41.6Z" fill="url(#nnBlue)" opacity=".9"/><circle cx="9" cy="11" r=".7" fill="#fff"/><circle cx="36" cy="9" r=".8" fill="#fff"/><circle cx="39" cy="30" r=".6" fill="#fff"/><circle cx="14" cy="36" r=".6" fill="#fff"/><ellipse cx="24" cy="27" rx="14" ry="3.6" fill="none" stroke="#cfe9ff" stroke-width=".8" opacity=".6" transform="rotate(-14 24 27)"/><path d="M8.5 27.5 20 21.4 31.5 17.4 40 16.2 35.4 21.2 38.6 22.8 31 24.4 33.4 28.6 23 26.4 19 29.4 17 26.2Z" fill="#cfd6df" stroke="#0a0f1a" stroke-width=".9" stroke-linejoin="round"/><path d="M20 21.4 31.5 17.4 35.4 21.2 24.6 24.2Z" fill="#8c97a6"/><circle cx="9.2" cy="27.4" r="2.1" fill="#7fd7ff"/><circle cx="9.2" cy="27.4" r="1" fill="#fff"/>`, "NNN 2023 \u2014 Mass Effect : les recrues du Commandant Shepard"),
    medal("2024", "#3a1f5c", `<circle cx="24" cy="24" r="17.6" fill="url(#nnNight)"/><circle cx="29" cy="17" r="9.4" fill="#f4efd6"/><circle cx="26" cy="14" r="2.2" fill="#e0d9b6"/><circle cx="32" cy="20" r="1.6" fill="#e0d9b6"/><circle cx="30" cy="12.5" r="1.1" fill="#e0d9b6"/><path d="M5 41C9 33 12 31 14.5 24.5L13 17.4 17.6 21.2C19.4 20 21 20 22.4 21.4L28.2 14.6 26.6 22.6C28.6 24.6 31 27.4 34 32L36.5 34.6 40 41Z" fill="#0b0912"/><path d="M5 41C9 33 12 31 14.5 24.5L13 17.4 17.6 21.2C19.4 20 21 20 22.4 21.4L28.2 14.6 26.6 22.6C28.6 24.6 31 27.4 34 32" fill="none" stroke="#6e5fa8" stroke-width=".6" opacity=".8"/><circle cx="17.2" cy="23.4" r=".9" fill="#ff4a4a"/><path d="M8.5 13.5c1.4-1.5 2.6-1.4 3.4.2 1-1.2 2.2-1 3 .4-.8-.2-1.6.2-2.2 1-.5-.6-1.2-.6-1.8-.1-.6-.8-1.4-1-2.4-1.5z" fill="#0b0912"/><path d="M31 31.4c1-1.1 1.9-1 2.5.2.7-.9 1.600-.7 2.2.3-.6-.1-1.200.2-1.600.7-.4-.4-.9-.4-1.300 0-.5-.6-1-.8-1.800-1.200z" fill="#0b0912"/>`, "NNN 2024 \u2014 Fantastique : vampires et loups-garous"),
  ].join('');

  const REGIMENTS = {
    1: { name: 'Régiment 1', color: '#FFD521', logo: 'data:image/png;base64,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' },
    2: { name: 'Régiment 2', color: '#45A927', logo: 'data:image/png;base64,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' },
    3: { name: 'Régiment 3', color: '#E00000', logo: 'data:image/png;base64,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' },
    4: { name: 'Régiment 4', color: '#1F6FE0', logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAr7ElEQVR42t19eXxdZZ3393nOuXvuvdmaPW3TfS/QvUXKIgyKLOowKsqMIoujjjPoqw7DKCIq4OuMOr6MgiOC4D6yDKgsspfSLXRvuqRL0uz7TXL3c57n/eP73NwEWyht0jLm88mnaXLvPef89t/3tzwCZ/ZLmm9lvgEhIIREUWVdTXqga242PTwfrpqjNaZpoFIDxQKIAPArwAYAC3AApAAMWkCfEGgXEoc8XntvMBDcXVpc1rD70OEWpRWg9fGvfQa+xBm6pgSgcw8uhISvsKI2E+teLVR2rQKWCWCGBgo1AHgKAF8h4I0A3ihgBwDpBSwPP05lATcDuEkgPQhkYkAmBpEdgtAaEhgQQKMlsNkb9L80a+r09a83NBxVSo1mhjD3o/9SGZAjvJuTdF+krM4d6r7cVeoqACs0EISvEIjUAdHpQGSqRqhWwV8MeAoELC8gLQEIAWkDmh8FjdzPGtAabgbIDmuk+oF4q8TgYYHYIWDwIESqDzaQsG1sDAW8jxVXTn2isbHx8ChmWKeTEeJ0E37t2tvsda99+z0qk7xOAxcDCCE8GZh0DjDpbBeFMzW8hZKE1gLKAZRDAmsX0AqQNpDspVYI8wh2iHRzkoCw+C2t3M8a2tXIxhUGGgW6X7fQvQ1isBGW1nGfB89Giwvvb/3Vo38UF1zgnE5GTDQDrBzhy8sXhbq791yrlfMpDSyGvwSoXA1UvstB4QwBT0hCuwJumuYEAISxDMLcqidEG54dBjZ+FZh/I1A4kzRqegpwU0DdlYCbJmM0ANsHOOb/ThywCwBvWCObUIgd1Gh/1Ub7q7ASHfBIbI8UFPzokiuueujhhx+Ov/EZ/jcxYJTUL/FIuf06rZwvaGAmotOBKe9RqFyt4S+RUI6gDU8bgmvAE6ZdVxkS3BMCWl8CurcCFSvJuOc+CdRcBMz/JPDS54Ce7cDyrwAVq6gFnhDQsQHo2QHM+jA/87VbgOkfBEoX8fZ8EUC5Gskehc5NAkf+IEX/HvglDhSXFf1by5PP3i+WLs1OpDaIiZR6WN7L4GbuAHA2CmcB0z/oomKFgO2XcJIkMkCCeaMkuDcKHHmSJqXqXCAbBywvkBkCdt0LtK8HypcB6QE6YX8pMHgIWPhZoGQBkOqhmbL8/PyNXyUTl/0r8OoXgSVfAipWA+2v5hlaNBsQNqAcha56jYOPWLJ3B4JebC2bVP6VI+3dvzc+Yty1wRpnZvIGA8U1wkn+ENq9E6HKSsy/0cX8G4DoNAsqTTMD0D5rF9jyTSA6DYjOABr/G9j5n8C0K4FwLbVCuYCUQNkyIFxNac8MAPF2IJvga6GA3h1AogtItANDTUCyC/AVAe3rSHBoIFgOHPgN0PAAo6uq1YD0AU4CEFKgcIZE9VqlI9NUZqC5aqin9ZqigGfWeXPmbWrs6oqNM83GTQPkSCwt/ddApb4LIcsw7f0KM/8G8EUlssOUTGEDOktlljYQKAVeu5Um6OzPA099BJhzLTDjb4C+XUCiM+98lUPJ7t1O8+JmaGq8hTQrMz4IBMpMrK/pEwASd8c9QFc9Q9lJZwO1FwHF8wHLZzTGS41IdtO08ZoKhx4H9v1cBnSqq7K05OYj3X2/UMwl5HjkD9Y4aZECKoMQyXugs99EdFoIS/7FwdT3WoASyMYpyULw32wc2P594NCjlGY7SIJ2bgJKF9PGt68jcSPTgMJZQOEM/s0OAvseIqHtIJDsAcqWAos+Q0l2UySodpgrZGKU9oH9ZJj0kNh2EIi3ArFGYPgoGRtvAxoepImzg0CqT6BojsDkixwn1hQe6jnywcKQv/pLn7j0uZfq92fMs+szyQAbgAtveBbc3icB/T7Uvc/FOV8SKKi0kB3i7XlC+fvUDu188VxgoJGEzsaZXCW7KL09O0jsilWAN2ze55KgO/+TBFt+G3D0OaBiBdBdD/TtBipXMTRVWeq2kMD6L/M6068is1UaqDmfpqhyJRCqpibGGsnMtld4v8VzgZc+Q7NYslCi+l1aCY9KdWxdWr+r8dLlM2e/2NzT02NooM4EA2wADizfhXASf4Dlm4GzbnYw6yM2VEaMRDWWB+jcSAnzBClZiU6gZxsQmQos+jRQtgRofZnhZbqfhJ/xAb5HO3n4QFp02NXn0eQ0/hoomgMs+izQ8RrQ9EcSL1hBSc8O8vOW3gLEDpHBoUpqwIKb6NhtP+AvZvJXNJv+o3MLzZF2gfnX85rKFShfJlE4x8l01Nd09bR8eFpVeX3vUPzgqTDBOiXiS/+HodK/Q7A8jBW3u6hYaSMTo12FkdjhFmDT7UDNBUBBNdC2DujbA5QuZPJl+YAN/8qoJ1RBM5XoBJqfIgG8YRJT2mRGqJLOWdq0160vAHM/Dky+hAzVCvCXkFkArxEsA448QT9z1s3Ajh8wAKhYTqYLafyTAEJVwNFngMEjDHEjdUC6D/AWULPCtRKVq12ne1fBUE/LNTXlpQdi8cSOk2WCdfLE910PlX4Q0ekSq76pEa61kImRMPE2mhlfBGh8FBjYRyK1vkgHPOVSOkOt6Ggbf0cHnB0GUr3Ayq/zYfv3AsNtJLg3zOeTNqAMflY0m9FOZCpNWHASUFCTd8LSNoSVQKID6N0NzP0ENe7gI2R+0WyGsfV3A7t/TM20Avz84VZg38PAgV9TQwOlFBJPgUTNBcqNNVqJrkN/XVNa1DqYTG05GSZYp0D8H6N4nsLKOwS8EWnCOJqA3f/FWL7mQuDos5QiT4gx+uSLmZmqjDFRXhKr5gJK9/5fMrZf+GlKaNk5NFta5YM2YXAzy8eY3vbz98oxnyv+PM7zF/N60elAYBJQ9S6T9AXpS2IHgcpzGe727uJ7ShYAUy8DypeSUeGpjLjcFGB5BWougBps0omuA1dOLi1qjSXePhOskzA7H4JK/wzFc12s+LqE7RNwUwwvpSRRys4Bmp8FjvweSPdS3Xu28yEi0yiZtpEyaQFF8/g7fwmZ0PYyULKIf1eOceDiGBG0yucTOcaIY7xOuxSAkgX8WWX5nsAkmqXwZGDWR+jAD/0PNTFQCmQG+bdIHTDlPWSWm6bQaAfQEKg5H2qwScW7Dlw5tbx0b388sfPtMEG8rezW8p0PN/0sotMkVt0pYPuNs7Wo9ipDQg8fpQ1tX8+bdTNAQS0w52MmTncZHoaqgWAlH2bkSj46Tuml7R+37F8f45ENY4VFDVv3eQqCJ0xm1FxIZkDQNE65lH9PGz8nLaYD0tbY+DXt7X5d1VWXX7yvtfPFE82arRNOsnyR6cgmnkWgrACrvqnhjUi4Kd6QkHzl3p8BzU8D3dsIfNVdTtXOmYWeHcDhJ/g76WUkI6yxEq6y1I4cLjSuOeextEOT0YOHaevP/gKjo9gBYPHn6KuK51Ly214BiuYCO++hZgQm0RwJS6DqXO121lvxvqOXL58343dHu/t6R9U9TpoBBlSb4oPqfhZ2oA4rv+4iXGvBSfDG3QwzTcvHhKhoDm9s6b/QicZbmNgk2oFlt1ILpvwVUL7cENkdSxghTnOBStOHDOxnmDrveoavHRuYL1hePl9kKk1s68tA1xa+r2w5YNnGJ/gEype5ztGXQ/09HWvvvfZvH3h8+3Z1qhrAREvEfwSt3oOzPu+gfIWNzAAJ5Y0SV+nZBtReDPTvowOb+h5Kzr6HGEOf8yXCAI3/zYw2PJUPdUzbfprrRCLnIwrobG0/pburnn4gPIVa6SRM0mYBhx6nU69cDdTfRW0umAx4wxLRGU6m+fmqdY17K9OO+7h+C39gvaXdl/4PQWe+hborHMz+MInvLTChnmDo5g3TwXasB6a+N+8UE52053WXM+uUNiWrZD7gieRj7zP+ZbTAG87DFUWzgFQ/iQ5FBmkXKFnIrHmoiQDfwAGG2EIATgoonC4B6WTatyytKy/a2x9P7XwzyEK8id0HgqXlSPTsRKSuCO/6LqBdCWialnAdJeVPHweqzwcCJXReJfMBN0uTJARfG6njQ9kBPqDKnKFy9Ik4auMXLE/eJ2kN7H2QxI7OoGbsfZhR0QX3MvdI9+df6ylQWH8L/L3b+tees2Th0/X1neYC6kQ1gI7XSf8E0lqGpbcqBMstuClKwsFHiM17C4ChZiZeQ0eILhbOJrHT/TQ/BbX5+rubNvfwTiQ+xuYZOQRWWEB/A9D+GgUn3gp0bs7nPMMt9B92gPiScgAhBEoWKKf5uVBvT2ttRunf6uM4ZOtNQs5LoLJ3YdpVLuouI7Ambd5kzYV0VDvvpZrG23hD3giz3aY/UPJLF5pEyxBdiHcw8Y8XNWkmhnWXEfiLt/PZtAuULmCS2Pw0v4Ug1O3EgWCFhOVxs+2bF1YXR14bTKYbj2WKxDGvuuRGC/U/fh3BsvlYe4+CkBaJKIHhZjrToWaaEzvAEE7aDNGExUSs5kIyxM28Q+z8KZglYZk69NcIT+TgbE8ImPO3fO7ho3xtZFquTQOQfhev3Cz9gwd2f/+Ge8+56b6b3Pwfj60BjHo6d1wH7V6P+TcplMyz4AwTH4k1Arvu4814AsRv2l8l1xMdwKRFRCarzzP20PlfTnzka9J7HyLiuuYu1i1mfohVvHQfw9fq8+nER1plNGD7JYJlym15vmJdw7PNqaxb/8YsWb5B+l3UrAxAZW9F4UyNmgsEMkN0rlrRnq++k5HOws8QJBtqYqKy9BagYyPwp08A+39lskv87//KFZB6d7KeHKpi3SBUBUx5L7Eiy08TNBr8E5LMKV8mdNkyPZxI33r11VcH3pj4WG+QfoXhzk9Aq2ux4O8VIlNpetrXM6oJVTE+VmnGzG6aOYBWVMXK1cRbfIWAf9I73OG+DV+gFZ+rdDF/7tjA5DJYTk2PTge6NtPk+qLU+p0/NBW9OgFfkdItzxV3tx1uiqeyY7RgtAa4WHubDZW9GdFpGuXLBRxTSmz4KdDXwKhm8DBQdR6QMTj6kluIIia7eMGypUDJYoPviL8AFdB8zvAU0+4SBornYaTMqg00Xn0+GWMHgcEmttF4CgjolcwXuvRsHR9K3Ky1tkdjRHKUJmisu/MSAHMx9X0atl+OIIdOkja+vyFf9NDGjAUrKBk51DEb5+v/Iog/WjwNfK6ywPQPUNKVQxJmTQ+XN8LKW6yRjCuoJcMsr0Td5TrlYO70qZWXGCdsjTZBAhAa2v0O/MWzsPAmBe1I2CHiOh0bTMzbbDTgXDqcVA//FqrMA3LHhIT/EnyBGAVthwlFaJe5waHHgM3fAIaOkkGxRiZp4Rpgz/1M6ipWuLrtFYHhtnDGtX6ltRYAtDWSdPmrauEMfRe17/Zg8iUCu+4VOPArXsRJEB3s2caIB4KVov2/BErPog1U76BwU+t8O+OE5AejOtqlxWAkPIWZcv9eU1btYrtkpI6+0VcskBkSumPb5MuuuOJn+/bti5l3m7YSJ/5xAJdj/vUO/MUWghXEwA8/yQ9N9lLlEp1A20vk9MLP0Bm5ybwGnHHim0qZkCYknCgmmCRNehnxJbv4u/7drBcICay6k+gvG4sFAqWOanraF+s+cmQ4kd0IwLJMqKUBdTciU6Zi9kc1tCvpzSVj31w5z00x8ln0aTbGRuvoZN4p9l67LBl2bQa6X2dVLdeoOxGMtoNsh1n/zyxrDrfQV/iibATo2kLcqKCaftFfqtGzXereo0HXsh7QnF2Agr+qGsByTFoCeIISmQFg8x3Ahq8w3Fz0WUr8vE8w5n/9O8AzHwO2fXdsU+2ZJr4dIiZVfzfhEWlP0H1pZsPJTmDb91gDOf8eBijR6dTA6R9kW+SrX6KftHwMesqXI6uxfPmCZdUAlA0ASLedCyCASWe7ENJC+3pK9Zpvs3m19WVWiRKdwOq7mf3GW+mMcuXIM6kF2s03dm34Kn2WpyAfqU2Yn7GYnJUtAxp/A/TvBy74EbGweDtwzv9hx8eR39N3qqxA6SLXkVaguXnbuQB+bUMIQKnz4SsECmdoZIZYgJ52FW1+qo++oGoN0PU6f65ck48KsvEzK/05m58ZAjbexnAZYmydeUKSM8ckXoWEZjo2sGYcnUba9e5gxDj/BgqGcgChgHCNVqEaJIabzhdC/tqGUgJCLENkGuCNSiYYZu4q1xDrptjQNHiYBM8VLnJA1ZkkvvTwXjfdToBQek294TRlyMqlNmhFBmTj9JnRGawQFs3No8jaBaywROEspI42LVPaFRLB2ioAM1E0i8XlXENTwwN0KrkpFekj0heZwgft2kKbq9WZCzWlRWHZ/A0+bK7d/bTnB5rob2CSEdgM7b+bMkMmo2c7tEDhbChg5kWrVlVJZLrnAYggUqehlaBKB5hOb/8PjAxS9O6kqqf66Xjs4BmM+zWvLb1A/bfZhXEmiD9aEytXGUk3OYLlzw+feMK8VzaPCUQmaxeIHDi0f56Em54PIYFQtaLdNOn2zL9mYtGznT2YHRuI7r349wShypbm+ypPe9kQFIDt/8GAYCTmP8P5h7AMoS2DiNr8Xcd60tEKUCMCFUp5QkjGB+ZLAHPhNam1cthmoV0CbrM/yvJj70421L76Zdq0JV9m1GH5Tr8D1maGbPd9QPMzbOw6k34Io2C1zBDNdiZmOv9AJHnb90yLvonYfFFofwlURs2VAOrgLQTsoIDWjOsHDgBH/mAyvG5iHLFGXqBiBdD4W7ZjdG8zLeTq9IWbviiLIwcfJSp51j+eyUH3sSbRTQJbvwO8cjPzEDdFQSmcyXt106bg7xXwFSPjoM4GUAlvxEQTGXrxPT9locXy5qcVC2oJKm37Hrlbvnx0Efo0Eb+QcfW+h9mJsOJrFBDlvgOaKQQQncVhwI1fAzZ/03QN2sC8Gww8kethtQBfIRyNShtACXyFgLSJ//tLgRW3M8J4/f+yAyBYTilb/E8kAmA8fvb0tJhoh1FF01PsxgiUAcu/yt8NNZ956fcEaSUOPUZopnIN2xxzswobbiUz5n2SFgRawFcIFyixAYThKWArBWBGRQuBvQ/Q8c76MDH/3T8mPLHmbhIgO5QPUSfySxnJb30Z2Ppd/rziNlbnnMTbsP8TkK1rRWvQ8jyw+yeMeELljCCFINGDZUDdFYTsg5XsmbKDAp4CCCAsAfjZOoI8uhdvYcvh3I+zEyxYyZms6HR68xH853RIfoRl0Pq7OPW+7F8J8WaG3gKD0vkESat8GDjeOYByKJDnfBG45EEGL5aP2lk8n/cZqaMPkKO6UqQXUsAvAdgQdl5IpIdVnZkfYhSUGSIhShfz4avOMxe3JzYC0i7bF/saOEds+YAVX+fIkZuh2lu+4xNW2GSYHSAuNNQ0dshjPCGJotksUrW8yABh2a0ketUaM+z3OUI6I7gZR3SVhi3/jKNukjH+rA+z11EImgE3TQctbWIbiQ7z8Hpikc1NX+cw9oyr6XdGzx/EDhMUPNZXeoCCNNgEHPgVe5ns0ATkCwZiGGpiZLb0FgKYNReQNHP+llp88Hdjp0WFgBqZetGu/WdchZ1vv3OSZljCYOCHn6AkhqeMP96ew9mTXYwm0v2UnP2/JDzyxmvpYzAPAJqeZp6Q+8z5N04MPK0VF4B0b+P4Ve27GZlVrmGNwBuh+Y63jqWVciEARwJIjQGvhGVC0fuZUPhLWV4bPMx29O7X6ZzDU8wkuhh/nD0d446HRGc+y82tN9B67Peb+gCV79Mpmj0xEZuQvLdIHfuE0jEKa+7enARpVXmueYYcAzIAkJIAhpBNANoYp1yy01XPzNfy0dEcepSMqb+bkGvhDGODx1OqDAq7xRS4pZ2vNYjjfB+XoGb0CIKhYEF1fjBwIoIFfzFb3Ec645xRzl/TnOfvVSM7DAUM2QB6kRmohFZM57QChI+27KV/ALb/gA64Zwew5Vs0D4v/kWNGHRuBSWcxSRsP6RKCYdr8G97av+TqAENNwJY7x2qwdjmFM+Nqhst2wAzW6YnrnssMEhWwDTKQ7Of/LR+tR6hqtHJqpGNCAL02gHakBxdwclDml1sUVAPvvp92uOV50wXdzg6x7f+P0+9Fs+j9xwuK0CYMLpz11lqVi8HVcQovvkJqaiaWBxgnDISzyYCdd9MULf6HPFC56XbmUQtuymuBVkBmADbQbgM4jMwA4CQ0N4e45JybZqTjL+UuBuXmE7D0AKv9dVeSw+PaAZ1T1xN4cMjjF1+0w3lkJ23i7wnKWWw/ta5kIcuOex9iG0pmENj1I173rH8ykA1ywqCR6gOAwzaABmRiJGqokm+IHeQ4f+wQie6N5le/LLiJYaoGmTER/UAn9Hkn4gNOw0xC7BCRYmhO4PdsJwzhZpmMrb6LGpDuz5vIzCBEqhdCosGG5dsNN83tguHJpn2ihIlY0WyCXy3P88P79gDr/4UV/+lXmUV5eAeMFZ0B7N8OEKbf+Z+M1qSXjM41BwA0gXsfIhpaeyGtiGUDyU6JzCCkz9ot4Z20B8AghpqF2S7Imm/NhfzA5mfNuP4yYOU3mGCoNFUsV447U4TP2d9jjhlZo0zVBDhdN8MS7apvAZc8TDPjpkh8y0upL5jMItZQE5NJ4kMawy1CAINFk6btsZE42gYhDqB/3xKGooJL9FSWI6cqSzCpbxf9w7Jbza6HbL4KdNrrwsZZ+wpNI2xurkvnawP9+8wobfjEfMrJTs6Eqijlex8Eai/hYhJfMXuGZl9DK5JN0LKw4qjRv08I4MDRo/vbJKTUADYjdghwhtRI7AzBlH/GXxN794Spak6Ktl9aZttUy8RBEm/24MPNfPCGB0attxT5dvLurawXd71uIqUJQEI9Ie4oOvQ4sOyrwIIbab7r3kfYZOu/s40/M0jBEBJQaYWB/ZDAZiEtbVNq5ItIdn0KsSaB4jnklpMApr6PEpTuJxM6NuRhXctPDZE2JyOdhEnKcHomGaWX6OzKbxw/ucrB1RORfAlJOvU1ACvvIOg23MaeKkhg8qVEcBPtZqVBhhFjvF2IoSZYUr6YVYrLrxGoWodkSxK92wIoXaiBBJ/SEzKbRWx+iPRQ4gPllICe7XTO0iLi6KZPjyZoRdUP1xq4Id8rO5ZPBq7O9TCNtyCoDLeseKNAopuz0vEC/r7yAjYxp/vpD7gYUKNvjyXcTDJYXLMu1ddiNoin2loBbELnFsB11MjcRg6+jbdRjcuWAm2vsvk13soFSEWzGcIe+BVGdgadji+VAbJJ+iM3nf/XHfV/Z7Tt1RPjhzwh3ksO60+0M3dSWS7+CE/ND3doodC5CQLY1D/Q3gpun4A0TvQRDBwAho9o2L58McMOsrfx+Rtp8wtnEpnc/gPiQcrlFtv+vWYLljuOpubNwLY3wYdEjkAW1d4bnYCCjM7vs8sO81dulg43WJ4H3oRZKik9QKpLo2c7LIlHNBfB5harQcNf1QZn8FPwRn0oW6LhpgSERckvXUxsvuFB2vlUN6MMN0UnVDSbI6uWd/yKHtrl540JJ/VbJ2nadPbZQQ5MJ7q4L06lDR4zDvcnJH2g9PIeB/azUySboBmK1OXRWyFyDluj9UVLtK1LRgqrPpNKDQ0C+cltCXc4BmA5Uv2zMPliN29LjCRVryXW3fIcoyPlci/Eos8A867jQ+dKlVqffHasFdP75qfy8bxyzcZFH6XseJ+dY1q6j1j8kSeBg48ZcO6yU4cktOY9NP6WYWeq2+zBsLkHNdXDKqJ2zDC3WQrLnUQudt0rZLL7j8l0/F5ASwDKGjWsp2F5B5Ee+CgKpwPRGWJM77+QtP0tL5D7oQqifMlufvtL6IhzmP5JT6doZpOxQxwK79vN0ajOjWyLCU8+diuMVjSB8VYWyPv38T5SfRwcL1ty6sUjYa4TrGAwcuhxDm2XL+EuiZL5pqs8wy7yWCOfxRcF+vZA7P+lDHg9n8+6zoEczeXIiCogcO4tzwBowOHfC2iTXWlNgu//NWdfJ19CNa69hOBTNk7sKKea6QHG4CNdc/rtOUAhqcrVa4HI5HzeobLAgf/m50vr2A6xfx8rYcluorlumoJhjeMGLstPqV/0WWDVHdS2bd+jwIWnsJlh3ReB524AGn7Ge7H8CoefEFKrhmW3PP3MyFD8nw1qN73kADKDROcVKF2oUFAjR1aweAuoXoFJ7H9ZeBO9fcUqZnw5HN7ycmti4SzWQoVl9kW/DY3IYS2JDj6grzC/QqZjI/9eNNesCzMVM28E2PdzDkfYflOMD7KpYPIl5jNOZWZMs0O8dxufb/v3Kf3aJZEFaJJaX6bg1F5E4DJUCcQOKez5sfTa8taDz9+/5fiD2oBAzfKHAX0EB34jIaQauXhkKuAvoopbPn6XLqZ5SHTm9+zYQRb2u7cyJe/fx2TF8p+4BObWxdReYqBxsxatv4EP3bOdzMgVWIRtNLGR/iLewTqA1kD1uygMpzK7rA3x+/eaftQKFo0Wf860m3goAINN/Hf6B9mEpRUgPAoHH5HSzRyZtOSqh0dL/7GXdQy2ZCA9ccRbr0DhbIXIVAk3Q4IIixLpxAnWCZv2rfUF0/uYMqsfH+VNlSzgzv7oNEZKJ2yDTSeGJ0RpHjzMLDPZnU8GgxXUguwQy4END3Dd5Wg/cs4XgPIVBgiTp7jWTNGp1lzIrofieVzZ07mJRalUNy2EtNkPGihljaBvt8Lu+6RtW18caN656Y3LOo5hTCFxzvU70F7/fgw3l2PyXynAlSM4i+1nQpabRAlV8QbbXyWhVJodAoUzgaN/YqPvgptG9RGJt6cF4Tr23vftIoOzw/x991am/8XzgbYXTfFDEzJZ9Gmitv6Sk9/YMrKGAPmt77l9oU4yD9cIiw7+8JOcoJ/1EU7HAEBkmout35FyuHX3Wdf/8NPt9U/+2dYs65h91u31DizfQSS7r4U3ojHpbDmiwpZ/VLyvqBHhydSE3l3Agd9SKvsbaH7OupmSMFIzfjstgiI/YVK2lNhUZApVPdVH6QtW0Ak6Sdr6Jf9MzfAXn5qzzW0Hy4XVmUHmrbmOB2+YI7zR6RSIpqeoHb4ofWPxXKD5GY3G30qvL3jt0U2PHjjWmQPWcSocFrRqhBDz0N+wEJVrXHijcqQLOTeble5n49S+h7jIKFDC8DHVS0adfTObUdMD+V3O0juqnUQcZ6HqGzRBCDJdSo6EVq/l+wb20yZbHq46nv3RPAin3JM0+WaP6O7/Apr/SN8XmUICd2ygtHtC7I2yA3S2vSZUnvN3+dVw6ZiLLd+yLDf5G8d17zZbCdwT3RlHPDpYug7p2McRbwmg9mINlRH5Mp+BY0sWMixM9ZEJ2UFKo+VlJ8WBX9M5li4mJDB0JH8Qm3bNZnTrBCIUnR/5sYNskWxfx909lp+nbvgKRyGg4uSX9kkvJfjgI8z0K9dwJq75GRanDj/GcmP1+eaMG5umMNeo5itU2PEDIXp39RWXTr4ykRhIHK98Z73JnUhkE4OQ/iYMH70als9F+TI5ssImx+lACc3DtPeTIc1PkwDR6QxR/aXsGCuaTaIMHuFCp8qVfNBklwk1i04sTBQWzdL6L5P4a+6iydtxD5PD6HSD4Iq3KOiPztZz/ZoeJnnxNpqcyRdT6mMHaZLS/WR+6WImd66Zn/OEaYadBIXg6LMu9j1seTz+64aHeze82XEn1luIgw3t7oSwatG7YymK5zsomCxH4u9cI5V2CU+s/2ezOyJNW1hzPiXTX2qG/RQQncqh5kyMD7H7Pp5wUXWeOYRNvoV5sGnSOjdzELpwFjehZ4cZIleseutGAW+ByVtMoUZI/j/RyVziyO/Zy9n6Ep8tdoAaHq2jxgtJ/+OmGO1osxHSEwKGjzrYdIdtafUTRzl3jqyBO8nNufQHUyY/jYH+y9GztQpV73LhKZB5OMAkaQcfY5i2/Cu0j8XzzGEIf2L/UK7VxVdIH3HwUWJLO+6h1E46e1Tnms5PnYzpvzGRiScITL00D7ipDMPNsqUnsDhEkLjaMeCcMOO45qC44nm8rynvJcF7tpG5OWCw/VViTIOH+d7iebye9ADKdbHhK7ZIdm+vnXLeB2IDR/RbzU9ZJxSKxGJZ+CLPItX/UfTvCaH2IgUhBXMD0/QUncYblx4mXrFGNii5aeYJvkLa/uFWSk3bKyRm12aWPaPT8pGV9NKu5kyJMGvxR6BunS/+5DTRzbx551uuXmz7mVC9/h3eT8VKYP/Pza7oC/NjRZaX0+7JHjridIxY/8yr2TU4+a8Y/+ecvR1Q2PxNS/Tt7vVGai/u7drRfYwy0UkxgFrgpnthhTYh0f4xDDUL1JwPzhXrfJSiMiY5K6QdnXQO7XKoiiZj+CjR1O6t+TCyei1j56Fmaoa/hDY3PcD3ak0/0V3PLoScn8hpR243kLAo/dZxcH/blz+yqmIFmbH3Z8CkxezrHzrKndduymhrEujdwwWF3VuZUVevBfb8hI1XBbX5IRFvgcb270O0vuTKUPTy7HDX1lGn743LAQ7GH2QPQfr3Y+jI1Uh0KFSvFdCOyEMCOVymgIuccmcHBEr5f2ExEmp9gdCt5aVDO/Ab2t6K5dzVrF3OAGeHSayeHURGcxo2sizJx/WZyqFkH/4fYkWVq0zWPapJt3+fma78HdD4CMG6oSa2W8YO8jC4qjXGF7Qzq550ltmZ9yBD3MmX8vpOnMmWygLeiMau+xQOP2F5PKFrnNTQ79/K7p/sCRqcJ9DOTkhfK2KNVyLers1RIMYcibHTKTlwrukpIqktz5MQo8+OTHbTHtdcyLBOZYGAOdVoy7fYmWf5GA5WnctzYnLR0NBhNkf5ogS9Ep2cZStdRK3TypQLbQpCuNZMe/qYrSd72F0RmERt7W9gHaFtHfc+lC0h7u/EGeNnYtwGXFDDz/OGNXbdq8XBRy2PJ3hDNpt4aGTmYoLOkDFMcLeMMGG4CahcoyFtMabBd/TxIokOhnWeEJ1lYBIfVkh2jC38NEM+6PyKtKI5VPHDj1ODenfQVNlB+hFPgFFV28tAw/00X9XnEY62fIyMGn/L7j1/KTPXYAVQOJ0xe7KDnX5CGvDwdYJ8Pdv42kApCZ3spuYVmJM+HHNohRVQ2PEDgcNPSOnx3eBmU//1dol/sqcojWKCfx8GD1+Jvp02yle48EUlx5pkvrdIK9aOq8+jiles5ME+bspsU0/TfHTVM6P1RvmAXfX0AR0b6D8qV9MkbP03mqayJdSu6rXUgF0/oqPMDpmxWs3Xli5ilJUdNriQTa0Z2MfXJbvzeNbqb9PJ1l5sCj9p5i+BSSzy55JP13FRf6eFlhcc6fF/TGXTPzsZ4p/KOWI5c7QDVuhVxFvfi47XClA010FkshzpRMuZpNxx48qh7d/67wTMCmexqjT/BhKhbw/hhXgrMLCXEqyyNAH+YkIeg0eA6e+nyXFS1JbieXSm+x6mJgRKgX2/JIQw6yP5GrG0CA4O7KdUp/upmeffwxbMgf30BbnZuNy4Vu4gIW8UGG5xsOlrtujd2W35QlepTPKJkyX+qZ6kZ5iQPQhv+HGkelej9fkaeApclCwQEOY07JEzJEUePwpMMsdWVbPkOGSIGq6ltPqi/Jvtp2mAIKEqVjP5ym2wtf0kbts6Fomycf5+6CiTwGW3MsNOdjP07KqnJlSvZS6x8TZ2sZWv4GdmBhlyjs4jcriXJ6zR8oLC5jtsJDrrveHSy5xEbMupEH88zpJUDFEzPahc8jAGW8rQuWkphpoFShY68JfIMfG6VrTJpYuo0naQSZpA3rGl+2ii9v+c+URBdb4kWTTbONDXmTzFGnkIWzpGxknbFEUK8ift9e00px55SOSSBfx76wvUlkX/YE7aNhBDLjvOwRXeMOAkHez8oYWGB6RQmR+jcsmH3N6DHeNxvvA4H2crAGlfA5X9LnxFZZj7dwq1F/PvTpwvyxU3cjCvtEgsJ0Xi7rmfBfjCWcDsa2kWdt9HBsUOAau+Qe1I9ebbQzyGoPt/SQfbVQ8UVBHi8ITNIc6rDCMdA2eYo7I8YZ7uN3qYPlcSFbZC2ytAw08l4u1dUnpuVsr5hcmtxuU4WzEhx5gHimuQ7LsbwDUoXQzM/piLkkUCOjPKP8hRDU4YC4xJD4ljB5gsHXocuOgnwMufo5lY+wOWO3PSuvMeRj/zPskzhZ/6EBtlI9NYn4i3sH28oDY/qpQrEOUSu5zEW34W0Qf2aez7hYWO1wDgF4Hi6i8n+1pbxvt4c2v828VgwUnGAPEILO8WxNvm4uizVYi3CoSqXAQrMRKyQh1j1bEhRq7Zd2A/7XjVucxG4x0mTJ3NMDS2n6d2LPosQ1rpYciqMsC0DxAcrFhpIHB77Pbb0WOudgCwgwrDRxUafmph5w8lhpq3wvLeAKi7nOTg4EQcaT5Rszt5bVhyowf1910H4AuQ9kxUrgGmXqZQPF9D2hJuSuQXAL5h/0Rud39u+VFubNWJmwM3DQGtAJmYHeZrc/vjotPoa3IH8ow+XCEHP9t+DaUU+hsEmv4o0fYy4GYOAPg3LLnxftTflx1vqT+dB3blJaZ8UQidO64F8CkAi1Eyn5lv+TIHgUoBoSXcjMgvuRs96aLfcPSgHDsUkpPkHJIqPflezTFJoUEtLZ+GFgqpHo2uzTZanifcAWwH8COUL3oInTvif/YME9dsj4lu6JcjD7H2Nhsv3f4eANcBuBieUAili2kqiua7CFVqWD4JKAHliJF6gz7RBq9RdWdpm2+PBqSGyigkugT6dlvo2szMNx2LA3gWwP1Ye9sf8dLtztij2ie23/50rj0cywghAW+4DunY5QCuArACljeI8BTa9+hMIDJVw1+q4IkAlofNwkIzQ9JvOKBT5EagheaRWVmN7CCQ6pEYOioQa2QuMHgEcJIJABsBPAZf9Alkhg6P0qjTQvgzwYA3MkKPhK5CAL5oLVL9qwGsBbAMwAwAhfBGCFEHSumMvdFRq2o8+XOEcy0rmWEgM8Bt76ke0xCAAQCNADYDeAn+ovVIx46O0io5ai+9PgMnl+EMrhociafVmNlff7QGyb65AOYDmANgGoBKAMUAIgD8JguFyURTAAYB9AFoB3AIwF4AuxEobkAq1jKyxClPdDn2MIDT//X/AQ78RmvwmrKxAAAAAElFTkSuQmCC' },
  };

  // Torches SVG (flamme, braises et fumée animées en SMIL, fonctionnent dans un <img>)
  const TORCH_LIT = 'data:image/svg+xml;utf8,' + encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 64\" width=\"240\" height=\"320\"><defs><linearGradient id=\"h\" x1=\"0\" x2=\"1\"><stop offset=\"0\" stop-color=\"#3b2210\"/><stop offset=\".35\" stop-color=\"#9a6633\"/><stop offset=\".6\" stop-color=\"#7a4d24\"/><stop offset=\"1\" stop-color=\"#34200e\"/></linearGradient><linearGradient id=\"c\" x1=\"0\" x2=\"1\"><stop offset=\"0\" stop-color=\"#2a170a\"/><stop offset=\".4\" stop-color=\"#6b4a2a\"/><stop offset=\"1\" stop-color=\"#241407\"/></linearGradient><radialGradient id=\"glow\" cx=\".5\" cy=\".62\" r=\".5\"><stop offset=\"0\" stop-color=\"#ffb347\" stop-opacity=\".85\"/><stop offset=\".55\" stop-color=\"#ff6a00\" stop-opacity=\".28\"/><stop offset=\"1\" stop-color=\"#ff6a00\" stop-opacity=\"0\"/></radialGradient><linearGradient id=\"f1\" x1=\"0\" y1=\"1\" x2=\"0\" y2=\"0\"><stop offset=\"0\" stop-color=\"#ffe9a0\"/><stop offset=\".35\" stop-color=\"#ffb300\"/><stop offset=\".75\" stop-color=\"#ff5a00\"/><stop offset=\"1\" stop-color=\"#c81e00\" stop-opacity=\".0\"/></linearGradient><linearGradient id=\"f2\" x1=\"0\" y1=\"1\" x2=\"0\" y2=\"0\"><stop offset=\"0\" stop-color=\"#ffffff\"/><stop offset=\".4\" stop-color=\"#ffe27a\"/><stop offset=\"1\" stop-color=\"#ffb300\" stop-opacity=\"0\"/></linearGradient><filter id=\"bl\"><feGaussianBlur stdDeviation=\"1.1\"/></filter><filter id=\"bl2\"><feGaussianBlur stdDeviation=\".5\"/></filter></defs><circle cx=\"24\" cy=\"24\" r=\"23\" fill=\"url(#glow)\"><animate attributeName=\"opacity\" values=\".8;1;.7;.95;.8\" dur=\"1.3s\" repeatCount=\"indefinite\"/></circle><rect x=\"19.5\" y=\"30\" width=\"9\" height=\"32\" rx=\"3\" fill=\"url(#h)\"/><path d=\"M20.5 34 L27.5 34 M20.5 41 L27.5 41 M20.5 48 L27.5 48\" stroke=\"#00000033\" stroke-width=\".6\"/><path d=\"M15 20 Q14 31 19 33 L29 33 Q34 31 33 20 Z\" fill=\"url(#c)\"/><path d=\"M15.5 24 L32.5 26 M15 28 L33 30 M16 32 L32 33\" stroke=\"#d8b878\" stroke-width=\"1.1\" opacity=\".85\"/><path d=\"M15.5 24 L32.5 26 M15 28 L33 30\" stroke=\"#6b4d1f\" stroke-width=\".4\" transform=\"translate(0 1)\"/><g transform=\"translate(24 21)\" filter=\"url(#bl)\"><g><animateTransform attributeName=\"transform\" type=\"scale\" values=\"1 1;1.07 1.14;.94 .9;1.04 1.08;1 1\" dur=\"1.1s\" repeatCount=\"indefinite\"/><path d=\"M0 -19 Q9 -9 7.5 -2 Q6 3 0 3 Q-6 3 -7.5 -2 Q-9 -9 0 -19Z\" fill=\"url(#f1)\"/></g></g><g transform=\"translate(24 21)\"><g><animateTransform attributeName=\"transform\" type=\"scale\" values=\"1 1;.92 1.1;1.06 .9;.97 1.05;1 1\" dur=\".8s\" repeatCount=\"indefinite\"/><path d=\"M0 -13 Q5.5 -6 4.5 -1 Q3.5 2.5 0 2.5 Q-3.5 2.5 -4.5 -1 Q-5.5 -6 0 -13Z\" fill=\"url(#f1)\" opacity=\".9\"/><path d=\"M0 -8 Q3.2 -3.5 2.6 0 Q1.8 2 0 2 Q-1.8 2 -2.6 0 Q-3.2 -3.5 0 -8Z\" fill=\"url(#f2)\"/></g></g><g fill=\"#ffcf6a\" filter=\"url(#bl2)\"><circle cx=\"19\" cy=\"6\" r=\".7\"><animate attributeName=\"cy\" values=\"10;-2\" dur=\"1.6s\" repeatCount=\"indefinite\"/><animate attributeName=\"opacity\" values=\"1;0\" dur=\"1.6s\" repeatCount=\"indefinite\"/></circle><circle cx=\"29\" cy=\"8\" r=\".6\"><animate attributeName=\"cy\" values=\"12;0\" dur=\"2.1s\" repeatCount=\"indefinite\"/><animate attributeName=\"opacity\" values=\"1;0\" dur=\"2.1s\" repeatCount=\"indefinite\"/></circle><circle cx=\"24\" cy=\"4\" r=\".5\"><animate attributeName=\"cy\" values=\"8;-4\" dur=\"1.9s\" repeatCount=\"indefinite\"/><animate attributeName=\"opacity\" values=\"1;0\" dur=\"1.9s\" repeatCount=\"indefinite\"/></circle></g></svg>");
  const TORCH_OUT = 'data:image/svg+xml;utf8,' + encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 64\" width=\"240\" height=\"320\"><defs><linearGradient id=\"h\" x1=\"0\" x2=\"1\"><stop offset=\"0\" stop-color=\"#2c1b0e\"/><stop offset=\".35\" stop-color=\"#6e4a2a\"/><stop offset=\".6\" stop-color=\"#553619\"/><stop offset=\"1\" stop-color=\"#241508\"/></linearGradient><linearGradient id=\"c\" x1=\"0\" x2=\"1\"><stop offset=\"0\" stop-color=\"#0e0b08\"/><stop offset=\".45\" stop-color=\"#2a2420\"/><stop offset=\"1\" stop-color=\"#0b0906\"/></linearGradient><radialGradient id=\"em\"><stop offset=\"0\" stop-color=\"#ff8a2a\"/><stop offset=\"1\" stop-color=\"#ff5a00\" stop-opacity=\"0\"/></radialGradient><filter id=\"bl\"><feGaussianBlur stdDeviation=\"1.3\"/></filter></defs><rect x=\"19.5\" y=\"30\" width=\"9\" height=\"32\" rx=\"3\" fill=\"url(#h)\"/><path d=\"M15 20 Q14 31 19 33 L29 33 Q34 31 33 20 Z\" fill=\"url(#c)\"/><path d=\"M15.5 24 L32.5 26 M15 28 L33 30 M16 32 L32 33\" stroke=\"#5a4a38\" stroke-width=\"1.1\" opacity=\".7\"/><path d=\"M15 20 Q24 14 33 20 Q33 17 24 15 Q15 17 15 20Z\" fill=\"#050403\"/><circle cx=\"21\" cy=\"21\" r=\"2\" fill=\"url(#em)\"><animate attributeName=\"opacity\" values=\".15;.7;.2\" dur=\"2.4s\" repeatCount=\"indefinite\"/></circle><circle cx=\"27.5\" cy=\"23\" r=\"1.6\" fill=\"url(#em)\"><animate attributeName=\"opacity\" values=\".6;.1;.5\" dur=\"3s\" repeatCount=\"indefinite\"/></circle><g fill=\"none\" stroke=\"#b9b9b9\" stroke-linecap=\"round\" filter=\"url(#bl)\"><path d=\"M22 14 Q27 9 22 5 Q18 1 23 -2\" stroke-width=\"2.2\" opacity=\".5\"><animate attributeName=\"opacity\" values=\".15;.55;.15\" dur=\"3.2s\" repeatCount=\"indefinite\"/></path><path d=\"M27 15 Q31 11 28 8 Q25 5 29 2\" stroke-width=\"1.6\" opacity=\".4\"><animate attributeName=\"opacity\" values=\".5;.1;.5\" dur=\"2.6s\" repeatCount=\"indefinite\"/></path></g></svg>");

  // ---- Textures générées (bois, parchemin, palmes) ----
  const svgUri = (svg) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  const woodSvg = (c1, c2, c3, seed) => svgUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="520" height="260"><defs>' +
    '<filter id="g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0045 0.2" numOctaves="5" seed="' + seed + '" stitchTiles="stitch"/>' +
    '<feColorMatrix type="matrix" values="0 0 0 0 .10  0 0 0 0 .05  0 0 0 0 .01  2.1 0 0 0 -.72"/></filter>' +
    '<filter id="k" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.035 0.05" numOctaves="3" seed="4" stitchTiles="stitch"/>' +
    '<feColorMatrix type="matrix" values="0 0 0 0 .95  0 0 0 0 .78  0 0 0 0 .5  1.2 0 0 0 -.62"/></filter>' +
    '<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset=".5" stop-color="' + c2 + '"/><stop offset="1" stop-color="' + c3 + '"/></linearGradient></defs>' +
    '<rect width="520" height="260" fill="url(#b)"/><rect width="520" height="260" filter="url(#k)" opacity=".3"/><rect width="520" height="260" filter="url(#g)"/></svg>');
  const WOOD = woodSvg('#8a5a2c', '#6e4520', '#583519', 11);
  const WOOD_DARK = woodSvg('#4d3119', '#3a2410', '#27170a', 5);
  const PAPER = svgUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs>' +
    '<filter id="p" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" seed="9" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 .45  0 0 0 0 .3  0 0 0 0 .1  1.4 0 0 0 -.42"/></filter>' +
    '<filter id="f" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 .35  0 0 0 0 .22  0 0 0 0 .08  0 0 0 .5 -.1"/></filter>' +
    '<radialGradient id="v" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#f1deb0"/><stop offset="1" stop-color="#cfae6c"/></radialGradient></defs>' +
    '<rect width="400" height="300" fill="url(#v)"/><rect width="400" height="300" filter="url(#p)" opacity=".5"/><rect width="400" height="300" filter="url(#f)" opacity=".5"/></svg>');
  const palmSvg = (flip) => svgUri(
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 120 120"><defs><linearGradient id="l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b4219"/><stop offset="1" stop-color="#3f8a2e"/></linearGradient>' +
    '<path id="leaf" d="M0 0C6-10 8-30 4-52C14-34 14-12 0 0ZM0 0C-6-10-8-30-4-52C-14-34-14-12 0 0Z"/></defs>' +
    '<g transform="' + (flip ? 'translate(106 106) scale(-1 1)' : 'translate(14 106)') + '" fill="url(#l)">' +
    '<use xlink:href="#leaf" transform="rotate(8) scale(1.5)"/><use xlink:href="#leaf" transform="rotate(34) scale(1.35)"/><use xlink:href="#leaf" transform="rotate(60) scale(1.2)"/>' +
    '<use xlink:href="#leaf" transform="rotate(-16) scale(1.35)"/><use xlink:href="#leaf" transform="rotate(86) scale(1)"/></g></svg>');
  const PALM_L = palmSvg(false), PALM_R = palmSvg(true);
  // pieds (dessins vectoriels maison) : peau claire / peau verte, vernis, motif répété
  // Détourages de photos (images générées par IA, fournies par l'utilisateur) — pieds seuls, sans visage
  const PH = {
    topP: 'data:image/webp;base64,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', topG: 'data:image/webp;base64,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',
    crossP: 'data:image/webp;base64,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', crossG: 'data:image/webp;base64,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',
    solesP: 'data:image/webp;base64,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', solesG: 'data:image/webp;base64,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',
    iconP: 'data:image/webp;base64,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', iconG: 'data:image/webp;base64,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',
    tile: 'data:image/webp;base64,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',
  };
  // carrelage sale + coulures (thème chiottes)
  const TILE = svgUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><defs><filter id="g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="4" seed="8" stitchTiles="stitch"/>' +
    '<feColorMatrix type="matrix" values="0 0 0 0 .36  0 0 0 0 .23  0 0 0 0 .05  1.7 0 0 0 -.66"/></filter></defs>' +
    '<rect width="96" height="96" fill="#e6dfc0"/><rect width="96" height="96" filter="url(#g)" opacity=".9"/>' +
    '<path d="M0 1.5H96M1.5 0V96" stroke="#8f8a6c" stroke-width="3" fill="none"/><path d="M3 4H93" stroke="#fffbe6" stroke-opacity=".6" stroke-width="1.2"/></svg>');
  const DRIP = svgUri(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="34"><path d="M0 0H80V8C74 8 75 24 70 24C65 24 66 8 58 8C52 8 53 15 48 15C43 15 44 8 36 8C30 8 31 31 25 31C19 31 20 8 12 8C6 8 7 17 3 17C1 17 0 8 0 8Z" fill="#6a4010"/>' +
    '<path d="M25 12V27M70 10V21" stroke="#9a6a28" stroke-width="2" stroke-linecap="round" opacity=".55"/></svg>');

  // ---- Polices Koh-Lanta (embarquées ; FontFace depuis un buffer = non bloqué par la CSP du site) ----
  // Sigmar One uniquement pour les 2 grands titres (lettres seulement). Tout le reste : police système, lisible.
  const F_LOGO = "'NNN Ironsides','NNN Title','Sigmar One',Impact,'Arial Black',sans-serif";
  const F_UI = "system-ui,-apple-system,'Segoe UI',Roboto,'Trebuchet MS',Arial,sans-serif";
  const F_TITLE = F_UI, F_MARK = F_UI, F_STENCIL = F_UI;
  (function loadFonts() {
    if (typeof FontFace === 'undefined') return;
    const list = [['NNN Title', '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'], ['NNN Ironsides', 'AAEAAAAQAQAABAAATFRTSGppaeoAAAEMAAAAuU9TLzJ1s+xcAAAByAAAAFZjbWFwhKEM3AAAAiAAAAJYY3Z0IAgBAAAAAAR4AAAAEGZwZ235x80cAAAEiAAAAOlnYXNwABcACQAABXQAAAAQZ2x5Zu4nTcIAAAWEAABTLmhkbXhSZRgvAABYtAAAC4hoZWFkzyDgUAAAZDwAAAA2aGhlYQxDBX8AAGR0AAAAJGhtdHj6oRYWAABkmAAAAtRsb2Nh6H39IQAAZ2wAAAFsbWF4cALDAT8AAGjYAAAAIG5hbWX+8oykAABo+AAAA65wb3N0I0skEQAAbKgAAAGMcHJlcHYAB1YAAG40AAAADAAAALUBGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGQEZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZARkZGRkZAAAAAAEClwGQAAUABgWaBTMAAAEmBZoFMwAAA6AArgOKAAAAAAQAAAAAAAAAgAAAAwAAAAAAAABAAAAAAFNIWUYAQAAg//8FVf6sAAAHqwJlAAAAAQAAAAAAAAAAAAIAAQAAAAAAFAADAAEAAAEaAAABBgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACvAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4/QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXgB8fQCAh4yRlJOVl5aYAJuanJ2fnqChoqSjpaemq6qsrQB0bW4AAACSc3JodnEAfo0AdQAAcAAAAAAAAAAAAJmpd2wAAAAAAAAAYWt4e4tiaQAAZWZjZKgArmoAbwAAAAAAAF9gAHqBeYJ/hIWGg4mKAIiPkI4AAGcAAAAAAAAAAAAEAT4AAAAoACAABAAIACAAfgC0AMYAzwDWAN0A5gDvAPwA/wFTAWEBeALcIB4gJiEi/////wAAACAAIQCCAL8AyADRANcA3wDoAPEA/QFSAWABeALcIBggJiEi/////wAA/+AAAP+4/7f/tgAA/7P/sv+xAAAAAP9Q/vL9iwAA4DvfRgCyAAEAKAAAACYAAAAAAAAAhAAAAAAAAACKAI4AAAAAAAAAigAAAAAAAAAAAK8AXwAAAGAAYQAAAAAAAAAAALAAAABiAAAAAAAAAAAAYwBkAGUAZgAAAAAAAABnAGgAsQAAAGkAAAAAAGoAawBsAG0AbgBvAHAAAAAAAHEAcgAAAAAAAAAAAHMAAAB0AHUAAAAAAHYAsgCNAI4AjwCQAJEAswC0AAAArgBiAGkAYwBkAF8AAABlAGYAYAQAAAAFVQAAAAAAAP6sAAC4AAAsS7gACVBYsQEBjlm4Af+FuACEHbkACQADX14tuAABLCAgRWlEsAFgLbgAAiy4AAEqIS24AAMsIEawAyVGUlgjWSCKIIpJZIogRiBoYWSwBCVGIGhhZFJYI2WKWS8gsABTWGkgsABUWCGwQFkbaSCwAFRYIbBAZVlZOi24AAQsIEawBCVGUlgjilkgRiBqYWSwBCVGIGphZFJYI4pZL/0tuAAFLEsgsAMmUFhRWLCARBuwQERZGyEhIEWwwFBYsMBEGyFZWS24AAYsICBFaUSwAWAgIEV9aRhEsAFgLbgAByy4AAYqLQAAAAAAAAMACAACABAAAf//AAMAAgAr//EBKwVVAAgADAAeQA4IAgkJAAkIBwsEAAALAysQ3BDQENAQ0AAvPzAxASU+ATU0JichESURBQEr/wARERERAQD/AAEAATMigP2Dg/5/+pwPAREiAAIAKwPNAoAFdwAFAAsAEUAICgcLCgMFBAMrKwAvLzAxASMnIxEFASMnIxEFAoBEM4kBAP6rRTOIAQADzaoBACL+eKoBACIAAAIAKwCaBE8EvQBGAFIAGUAMIBoDNhMLRARHR0QDKxDQENAALy8rMDEBBw4BBxQGByc+AT0BIgYHFRQGByc2PQEuATUiJzcWOwEuAScjIiYnNx4BOwEuAScXHgEXNyYnFx4BFz4BNwcOAQcUFhc+AQUuAScOAQceARcyNgRPNTp6QgMCmgEBBT88AQGZAwEBtY0zbTVsAQIBLF6HLDM4cDkkBAgFmgMJBYEICpkHCwQ2mmQ1K3xRAQFJlP6GAQIBFkEsAQICAkECfZoICgRmmDU1G1o/QwEBJ1eALDVtKS8RFwcGmgMXQCoBAZoCAkuhWDMthloDr44zN4JMAgkGmQQGBAhBPAQJEhZBLAECAhZALAIAAAEAK/9XAtUGAAAqACRAEwgEAQQiAB0CFgIbBAcXAhwcFwMrENAQ0AAvLz8/Pz8/MDElByMVIT4BNyMnPgE3MxUzJicuASc1NzMuASchFTMXDgEHIzUjHgEXHgEXAtWqK/8ABQgEPKoOFQbXqj58SHcxqjwECAUBACuqDhUG16o4d0EdXEGrq6kqUyyrLVUoVVjrie1piaotVCqrqi5VKFV27ns4oWoAAAUAK/9eB2EF+QANABMAIQAlACkAMkAdJxwjCCIBKRYDAQQcAggAExEgJwMoGQMMIwMkBQMrKysrAC8vPz8/KxDcENwQ3DAxJQchJzY1NCc3IRcGFRQBAgADJwkBByEnNjU0JzchFwYVFAERIxEBESMRB2Gq/qqqMzOqAVaqM/4zrf7cdu8CR/5jqv6qqjMzqgFWqjMDv6r8Hqqrq6umr66nq6uet7gEWP6C/N/+XVkGQvwHq6umr66oqqqft7b+YQIA/gABVQIA/gAAAAEAK/9XAtUGAAA7ADdAHy4xAwgEAQQrACQAHgIXAhwEMS0MEy0TAwcYAh0dGAMrENAQ0CsQ0BDQAC8vPz8/Pz8/KzAxJQcjFSE+ATcjJz4BNTQnNyc+ATU0Jic3My4BJyEVMxcGFRQGByMOASMiJic1IxEhByMRMzU+ATMyFhcWAtWqK/8ABQgEPKoICRG4uAgJCQiqPAQIBQEAK6oPAQEPBwgCLWY8qgERZ6qqPlgcEB8OAaurqShULassWTCBW29vLW1CMFksqi5VKKuqUEUHCgUBAQEBVf68zf68VQEBAQFVAAEAKwPNASsFVQAFAA5ABgUCAQUEAysALz8wMQEjJwc1JQErRTOIAQADzaoR3hEAAAEAK/9XAdUGAAAMABFACQcKAwsBAwoEAysAKyswMQUhJxIREAM3IREjETMB1f8AqjMzqgEAqqqpqQFUAVcBUgFYq/8A+1UAAAEAK/9XAdUGAAAMABFACQcGAwMCAwULAysAKyswMSEHITUzESMRIRcCERAB1ar/AKqqAQCqM6n+BKsBAKv+qP6u/qkAAQArAgAC1QSrABEACUACDQQALy8wMQEHJxMjEwcnLQE3FwMzAzcXBQLVXNU4uDjVXAEP/vFc1Ti4ONVc/vEC+Z28/ugBGLydXFyevAEY/ui8nlwAAQArATMC9wQiABkAE0AICQkDFwMDEwUALy8rENAvMDEBBwYHFhcnLgEnJic3HgEXNDU0JxcOARU+AQL3IlmXBx3NCA0FUaYiM2U2AcwCA1yKA0TNFAO/bkQtc0kBBc0EBQEqPj5TRDlaIAINAAABACv/VwErAQAABQAQQAcDBAQBBQQDKwAvLz8wMQUjJyMRBQErRTOIAQCpqQEAIgABACsCJwMuAysABgALQAQEAwMAAC8rMDEBBwYlNzYkAy5E5f4mRNQBXQMrzTcEzAIaAAEAKwAAASsBAAADAA5ABgAEAgMCAysALz8wMSElNQUBK/8AAQAR7yIAAAEAAP9eAzcF+QAFAAlAAgUDAC8vMDEBAgADJwEDN63+23bvAkgFoP6C/N/+XVkGQgAAAgArAAAC1QVVAA0AEQAZQA0PCA4BBAgCDA8DEAUDKysAPz/cENwwMSUHISc2ERAnNyEXBhEQBxEjEQLVqv6qqjMzqgFWqjPNqqurq/kBBwEF+6qq8/7z/vGcA1X8qwAAAQArAAABKwVVAAYAD0AHAQQGAgYDAysAPz8wMSkBEhEQAyEBK/8AKioBAAFUAVcBVQFVAAEAKwAAAtUFVQAmAEZAJiMDERYPFg0gAyEDAwYEAAQWAiAQGyQOIyQjAwwVCRAGFRAVAxAhENArENAQ3BDQKxDQENAQ0AA/Pz8rKxDcENwQ3DAxIS4BIyIGBz4BNTQmJzchESMVIy4BJzchFw4BFRQWFwcjETM1MxQWAtVLqWFhqUsICQkIqgEAqvYCBQOqAVaqCAkJCLjyqu8JCAkJCFSYR1SlVKsBKlUtVCqqqjRqOCtdM+/+1VUdqQAAAQArAAAC1QVVADAANUAcEiIQDwMMAQQbABQAIgInDREuEg8TDRILExITAysQ0BDQENAQ3NAQ0AA/Pz8/3CsQ3DAxJQchJzY3PgEzMhYXFTMRIychESMVDgErASImJyI1NCcmJzchFw4BFRQWFwcXBhUUFgLVqv6qqhABDh8QHFg+qqpnARGqPFkdLwEHBQECAwyqAVaqCAkJCLi4EQmrq6tVVQEBAQFVAUTNAURVAQEBAQoKKDM8qqosWTBDbSxvb1uBMFkAAQArAAAC1QVVABAAGkAOAQQNAggCCgYDAQsPCwMrENArAD8/PzAxKQERBSc2NTQnIRE3ESECERAC1f8A/wCqMzMBAKoBADMB7ZiryeLhyf0AVgKq/rH+pf6jAAABACsAAALVBVUAJgBAQCMeFRUcAx8LAwgBBgEEGAISAiQbDx4MEgkcGxwDBx4DEh4SAysQ0BDQKxDQENAQ3BDQAD8/P9wQ3CsrENwwMSUHISc+ATczFTMRISc+ATU0JiceATMyNjcOARUjNSMRMxcOARUUFgLVqv6qqgMFAvaq/wCqCAkJCEupYWGpSwgJ76ryuAgJCaurqypTLVUBK6pUpVRImFMICQkIi6ogVf7W7zRdKzhqAAIAKwAAAtUFVQAaAB4AO0AfGwETHQMRCg8KAQQKAh0SHRMQGw8YGBsDBhIDCRIJAysQ0BDcKxDQENAQ0BDQAD8/ENwQ3CsQ3DAxJQchJz4BNTQmJzchFw4BFSM1IxEzFw4BFRQWJxEjEQLVqv6qqggJCQiqAVaqCAnvqvK4CAkJ+Kqrq6tw/pKS/nCqqixVKlX+1u80XSs4aiIBK/7VAAAB/88AAAJ3BVUACwAWQAwGAgMBBAgCBAIKAgMrAD8/PyswMSkBESEDFjMyNwIREAJ3/wD+vGSjsK+mMwRVAQAiIv6x/qX+owADACsAAALVBVUAIQAlACkAL0AZJgElKAMjEgEEEgIoJCImFx8fJgMGDiQOAysQ0CsQ0BDQENAAPz8Q3CsQ3DAxJQchJz4BNTQmJzcnPgE1NCYnNyEXDgEVFBYXBxcOARUUFgMRIxETESMRAtWq/qqqCAkJCLi4CAkJCKoBVqoICQkIuLgICQn4qqqqq6urLFkwQ20sb28sbUMwWSyqqixZMENtLG9vLG1DMFkCVAEq/tb91QEr/tUAAgArAAAC1QVVABoAHgA3QB0cEx4LAwgBBgEEEwIbCgkVChgKAwcdBg8dDwMAHBDQKxDQENArENzQENAAPz/cENwrENwwMSUHISc+ATUzFTMRIyc+ATU0Jic3IRcOARUUFgMRIxEC1ar+qqoICe+q8rgICQkIqgFWqggJCfiqq6urLFQqVQEr7zNdKzhqNKqqcP6Skv4CEAEq/tYAAgArAAABKwRVAAMABwAWQAoEBAIBBgAHBwYDKxDQENAALz8wMQEFEQURJTUFASv/AAEA/wABAANVIgEiIvvNEe8iAAACACv/VwErBFUAAwAJABhACwcEBQIBCAAJCQgDKxDQENAALy8/MDEBJREFESMnIxEFASv/AAEARTOIAQADMyIBACL7JKkBACIAAAEAKwCrAeYEqwANAAlAAgQBAC8vMDElIQMTIQ4BBwYVFBceAQHm/wC7uwEAGzYcTk4cNqsCAAIAQoJBxjU0x0KBAAIAKwFrAy4D5gAFAAsAD0AHCgkDBAMDAAAvKyswMQEHBiU3JAEHBiU3JAMuROT+JUQBpQEaROX+JkQBpQPmzDkFzQT+uM03BM0DAAABACsAqwHmBKsADQAJQAINAgAvLzAxAQMhPgE3NjU0Jy4BJyEB5rv/ABs2HE5OHDYbAQACq/4AQoFCxzQ1xkGCQgACACv/8QLVBVUAGgAeADlAHh4cERQPFA0CAxwEFAIbEx0QHhgPAwwdBh0CHh4dAysQ0BDQENArENAQ0AAvPz8rENwQ3BDcMDEBByMVDgEHPgE1NCYnNyERIxUjJzchFwYVFBYBJRElAtW48kJ/PwQEBASqAQCq9gqqAVaqEQn+Xv8AAQADGu/FAggHKk0mIEYoqwEqVauqqlhhQWv8qw8BABEAAAQAAACrBAIEqwAPAB4ANQA5ABVADAgUAxsAAwwQAxcEAysrACsrMDElIicmNTQ3NjMyFxYVFAcGEzYnJiMiBgcGFxYzMjc2AwYHBhchJzY3Nic3Fz4BNyMnHgEzMjYDJwcXAdTIhoalp+DIh4enpr8OZGWZme4NDmRkmpl2eJUlDg0Q/uhVGQQFD2SEAgcEV1IjTiwtT4ZXClqrhojF36eniInD36emAgCabG7cmJtsbW1vAa5/l5OFXjQ1MzBdUiA4F4oICQn+py5vEwAAAgAAAAAC7wVVAA8AFAAOQAYHBAAEDQIAPz8/MDEpAQMOAQ8BITYSNxI3IRYSJwsBPgEC7/8AJy5WKRv/ACVGIy4RAVUOZ+Y6QB09AVwRMiL32wG75QEwqoT9VQoCA/2zFyUAAAMAKwAAAtUFVQAXABsAHwArQBccARseAxkIAQQIAh4bGBwNFRUcAxsFAysrENAQ0BDQAD8/ENwrENwwMSUHITYSNTQCJyEXDgEVFBYXBxcOARUUFgMRIxETESMRAtWq/gARERERAgCqCAkJCLi4CAkJ+KqqqqurqwFTra0BUquqLFkwQ20sb28sbUMwWQJUASr+1v3VASv+1QABACsAAALVBVUAFQAnQBMTAREBDwgNCAEECAISEA4REAUDKxDQENwAPz8Q3BDcENwQ3DAxJQchJzYRECc3IRcOAQcjNSMRMzUzFgLVqv6qqjMzqgFWqg4VBteqqtcMq6ur+QEHAQX7qqouVShV/KtVTAACACsAAALVBVUACwAPABlADQ0GDAEEBgIKDQMOBAMrKwA/P9wQ3DAxJQchEhEQAyEXBhEQBxEjEQLVqv4AMzMCAKozzaqrqwFOAV0BWwFPqvP+8/7xnANV/KsAAAEAKwAAAtUFVQAVACVAFhATAwoPAxQCAwQEAAQNAggCExAQBgMrENAAPz8/PysrKzAxISYjIgcSERADFjMyNjcHIREhByMRIQLVp66upzMzp65YqVRm/rwBVWbvAUQiIgFOAV0BWwFPIhER3v6azf6aAAEAK/6sAtUFVQAQAB5AEQMGAw4CAwcGDAIAAgYDAwoDKxDQAD8/PysrMDEBByERIQcjEQESERADFjMyNgLVZv68AVVm7/8AMzOnrlipBVXe/prN/GgBVAFOAV0BWwFPIhEAAQArAAAC1QVVABsAI0ASEQEPCA0IAQQIAg4TGRMDEAUDKysQ0AA/PxDcENwQ3DAxJQchJzYRECc3IRcOAQcjNSMRMxEjNzMOARUUFgLVqv6qqjMzqgFWqg4VBteqqlVm7wgJCaurq/kBBwEF+6qqLlUoVfyrAUTNRZhWVpgAAQArAAAC1QVVABQAIUASBgQABBECCgIEDAwIAwEPEw8DKxDQKxDQAD8/Pz8wMSkBEQYHESESERADIRE+ATcRIQIREALV/wBYUv8AKioBACpULAEAKgIzGjH+GAFUAVcBVQFV/VcXJQ4CX/6r/qv+qQAAAQArAAABKwVVAAYAD0AHAQQGAgYDAysAPz8wMSkBEhEQAyEBK/8AKioBAAFUAVcBVQFVAAH/iv6sASsFVQAKABNACQEGCgIECgoHAysQ3AA/PzAxIQEnEhE0JicCAyEBK/6BItIDBAQmAQD+rCMBIQFwHd7CATcBAQABACsAAALVBVUADwAZQA0EBAAEDAIIAgkCAgYDKxDQAD8/Pz8wMSkBAxEhEhEQAyEREyECFRQC1f8Aqv8AKioBAKoBAO8CDv3yAVQBVwFVAVX98wIN/ZxGRAABACsAAALVBVUADAAWQAwLAwMFBAAECgILBwMrAD8/PyswMSEuASMiBxIREAMhESEC1VSpWK6nMzMBAAFEEREiAU4BXQFbAU/7iQAAAQArAAAEVQVVAB4AJ0AXEQQHBAAEGgIYAhUCFw8PEwMFCwMdAgMrKysQ0AA/Pz8/Pz8wMSkBEQcGFRATATYSNTQmJwcRIRIREAMfASUXNxcCERAEVf8ApA9E/s0UFQMEqv8AMzPeIgEAj/GqMwRVY6KZ/p3+rAEAjwEOgmOaOVX8AAFFAWYBZAFGEYeYj4+q/tv+z/7RAAABACsAAALVBVUAEAAdQBAFBAAEDAIJAgsDAwcDDwIDKysQ0AA/Pz8/MDEpAREHESESERADHwElFwIREALV/wCq/wAzM94iAQCqMwRVVfwAAUUBZgFkAUYRh5iq/tv+z/7PAAIAKwAAAtUFVQANABEAGUANDwgOAQQIAgwPAxAFAysrAD8/3BDcMDElByEnNhEQJzchFwYREAcRIxEC1ar+qqozM6oBVqozzaqrq6v5AQcBBfuqqvP+8/7xnANV/KsAAAIAK/6sAtUFVQAQABQAH0AREgoUAgMDBgoCDhIDAhQUBwMrENArAD8/KxDcMDEBByERATYSNTQCJyEXBhUUFicRIxEC1ar/AP8AEREREQIAqiIR76oCAKv9VwFUqwFTra0BUquqprBYqQECAP4AAAACACv+rAMiBVUAFwAbAB1AEBkMFAQFBAEGDAIQGQMaCQMrKwA/Pz8/ENwwMQEHIicmJyMnNhEQJzchFwYREBcHIxQXFgMRIxEDIiKxg4Q6OaozM6oBVqozM6ohHEeYqv7PI1lZoqv5AQcBBfuqqvP+8/7x8as9PqQCHwNV/KsAAAIAK/6sBG8FVQAcACAAHkAQHg8JBAEGDwIfBxMdAwcMAysrENAAPz8/ENwwMQEHJicmJyYnESE2EjU0AichFwYVFBcHHgEXFhcWAREjEQRvRL95eXyMR/8AEREREQIAqhkZqgosIldtbv4gqv7PI11mZ6rF5v3VqwFTra0BUquqcX52capRnU7EeXoD8wEq/tYAAQArAAAC1QVVAB4AGUALFxAVEAgBBgEEEAIAPz/cENwQ3BDcMDElByEnPgE3MxUzJicuASc1NyEXDgEHIzUjHgEXHgEXAtWq/qqqDhUG16o+fEd3MqoBVqoOFQbXqjl4Px1dQKurqy1VKFVX7Ifuaomqqi5VKFV47nk4oWoAAf/x/qwC7wVVABEAJEATCgoCDwIDAwYMAgACBwIECgIKAysQ0BDcAD8/PysQ0C8wMQEHIxEBNhI1NAInIzceATMyNgLvZpr/AA4PDw7+U1WpWFipBVXe+jUBVJEBEoSZASaR3g0MDAABACsAAALVBVUAEAAdQBADBAAEDQIIAgoGAwILDwsDKxDQKwA/Pz8/MDEhLwEFJxIREAMhETcRIQIREALV3iL/AKozMwEAqgEAMxGHmKsBJAExATABJfurVQQA/rr+nP6aAAEAAAAAAu8FVQANAA5ABgUEDQIKAgA/Pz8wMQEDBgIHISYDJgInIRsBAu9vIC4Q/qsRLiNGJQEAd3gFVf1Xx/6skaYBNOUButz7zQQzAAEAKwAABFUFVQAeACdAFwUEAwQABBsCEQIKAhUPAwwIAwIZHRkDKxDQKysAPz8/Pz8/MDEhLwEFJwcnEhEQAyERNzY1EAMBBgIVFBYXNxEhAhEQBFXeIv8Aj/GqMzMBAKQPRAEzFBUDBKoBADMRh5iPj6sBJAExATABJfurY6KaAWIBVP8Aj/7ygWObOVUEAP66/pz+mgAAAQAAAAAC7wVVABkAEUAIBAQABBACDAIAPz8/PzAxKQELASE2ExI1NAMmJyEbASEOAQcCFRQTHgEC7/8AeHf/ACJBRkZAIwEAd3gBABEyIkZGIjICIv3eVwECAQ9DQwEP/lr93gIiLKuB/vFDQ/7xgqsAAQAr/qwC1QVVABYAIUATBwIDBQYABhMCDgIQDAMIERURAysQ0CsAPz8/PyswMQEmIyIGBxMhJwUnEhEQAyERNxEhAhEQAtWprFepVaoBDg7/AKoqKgEAqgEAM/6sIxIRAQDsmKsBKgErASoBK/urVQQA/mj+Q/5EAAABABEAAAK8BVUAFwAlQBQTEwoPCgMHBxYWAwMGBAAEEgIMAgA/Pz8/KxDQLysQ0C8wMSEuASMiBgc1NhI3ISceATMyNjcVBgIHIQK8UqpaWapSeNVe/rtmUbVkUKBRXtR5AUQICQkI3uEByu7eCAkJCN7u/jfiAAABACv/VwHVBgAACgARQAkGBwMJAAMIAwMrACsrMDEFIRIREAMhESMRMwHV/lYzMwGqqqqpAasBqQGpAaz/APtVAAABAAD/XgM3BfkABQAJQAIFAQAvLzAxBQcCAAM3Azfvd/7cre9JWQGjAyEBflkAAQAr/1cB1QYAAAoAEUAJBgUDAgEDBAkDKwArKzAxBSE1MxEjESECERAB1f5WqqoBqjOp/gSrAQD+VP5X/lcAAAEAKwSrAisFVQAGAApAAwYCBAAvPzAxASMnByM3MwIrq1VWqqqrBKtVVaoAAQAAAAADVQDNAAMACkADAgAEAD/cMDEpATUhA1X8qwNVzQAAAQArBasBogZ3AAMACUACAwEALy8wMQEHJTUBoiL+qwXNIiKqAAACACsAAALVBAAAFgAaAB5AERALAwEEEwANABcIFQgDGQQDKysQ0AA/Pz8rMDEpASc2NTQnNwU0NjcjAx4BMzI2NwYREAc1JxUC1f4AqiIiqgEAAwKeq0iQSkqQSDPNqqtZa1pZq5hIZR4BABERERH1/vX+9BaZVs0AAAIAKwAAAtUFVQAPABMAGUANEAEEBgIOEQMKEhIEAysQ0CsAPz/cMDElByESERADFx4BFyUXBhUUBxEHEQLVqv4AMzPeCxIFAQCqM82qq6sBTgFdAVsBT1VMy4GYq563uEgCAFX+VQAAAQArAAAC1QQAABQAJ0ATEgEQAQ4IDAgBBAgAEQ8NEA8FAysQ0BDcAD8/ENwQ3BDcENwwMSUHISc2NTQnNyEXBgcjNSMRMzUzFgLVqv6qqjMzqgFWqh0M16qq1wyrq6ujsrGkq6teTFX+AFVMAAACACsAAALVBVUADwATABlADRAABAwCCBEOEQMSBAMrKxDQAD8/3DAxKQEnNjU0JzcFPgE/AQIREAcRJxEC1f4AqjMzqgEABRIL3jPNqquduLeeq5iBy0xV/rH+pf6jTgGrVf4AAAACACsAAALVBAAAFAAYABlADQYIBBAAFwITFQMCDAMrKxDQAD8/3DAxAQclFRQGBzMXISc2NTQnNyEXBhUUJzUnFQLVqv8AAwL0d/5EqjMzqgFWqiLeqgHeq5hcM1Eezaumr66nq6tRcGUEzSKZAAEAAP6sA28GAAAYABJACAwGGAYLCxADKxDQAC8/MDEBDgEHIzUHFTY3ByMRATYSNTQnIzcXJicBA28KDwfgq5qiZtb/ABERA+NVhAcOAgAFVSdVLlVVxgcU3vuKAVSYAR6JfWbeD2N5ATMAAAIAK/6sAtUEAAAWABoAIkATGBIIAwMGBgAGEgAZDwMLFxUXAysQ0CsAPz8/KxDcMDEBLgEjIgYHEyEuAScFJzY1NCc3IQIREAMRIxEC1VWpV1epVaoBDgQGBP8AqjMzqgIAM82q/qwREhIRAQArdkuYq6avrqer/rr+m/6cAWQBq/4AAAEAKwAAAtUFVQASABpADgUEAAQJAg0DAwcDEQIDKysQ0AA/Pz8wMSkBEQcRIRIREAMXHgEXJRcGFRQC1f8Aqv8AMzPeCxIFAQCqMwMAVf1VAU4BXQFbAU9VTsqAmKvJ4eIAAgArAAABKwVVAAcADgATQAkJBAYCAA4OCwMrENAAPz8wMQElPgE1NCcFESESETQDBQEr/wAICREBAP8AKioBAAQARCJJKjtBiPszAQABAP8BAVUAAgAr/qwBKwVVAAcADgAXQAwBDgMJBgYCAAgICwMrENAAPz8rMDEBJT4BNTQnBREBEhEQAwUBK/8ACAkRAQD/ACoqAQAEMxEiSSo7QUT67/6sAVYBUwFWAVURAAABACsAAALXBVUAFwAZQA4OBAkEFwASAhYQAwYLAysrAD8/Pz8wMQkBNxcOARUUFhchEQcRIRIREAMXHgEXNwLX/s2Hqg0MDA3/AKr/ADMz3goOBbEEAP5aUas/f0JCfz8Bq1b+qwFOAV0BWwFPVXL5ifQAAAEAKwAAASsFVQAGAA9ABwEEBQIGAwMrAD8/MDEpARIREAMFASv/ADMzAQABTgFdAVsBT1UAAAEAKwAABFUEAAAfACdAFxEEBwQABBsAGQAVABgPDxMDBQsDHgIDKysrENAAPz8/Pz8/MDEpAREHBhUUFwE+ATU0JicHESE2ERAnFxYXJRc3FwYVFARV/wCkD0T+zRMTAgKq/wAzM94ZCQEAj/GqMwMAY2Br8uABAGXIZBg3IFX9VfQBDAEL9RE5TpiPj6vJ4eIAAQArAAAC1QQAABIAHUAQBQQABA4ACQANAwMHAxECAysrENAAPz8/PzAxKQERBxEhNhEQJxceARclFwYVFALV/wCq/wAzM94LEgUBAKozAwBV/VX0AQwBDvIRHEMomKvO3NsAAAIAKwAAAtUEAAANABEAGUANDwgOAQQIAAwPAxAFAysrAD8/3BDcMDElByEnNjU0JzchFwYVFAcRIxEC1ar+qqozM6oBVqozzaqrq6umr66nq6uet7hIAgD+AAAAAgAr/qwC1QQAAA8AEwAbQA4RCgYGCgAOEQMCExMIAysQ0CsAPz8Q3DAxJQclDgEPARIREAMhFwYVFAcRIxEC1ar/AAUSC94zMwIAqjPNqqurmIDKTFYBTgFbAVwBT6uet7hIAgD+VQACACv+rALVBAAADwATABtADhELAAYLABIIAwQQDhADKxDQKwA/PxDcMDEBJy4BJwUnNjU0JzchAhEQAxEjEQLV3gsSBf8AqjMzqgIAM82q/qxWTMqAmKuduLeeq/6x/qT+pQFbAav+AAAAAQArAAAC1QQAABAAFkALCAQQAAwADwYGCgMrENAAPz8/MDEBDgEHIzUHESE2ERAnFxYXJQLVCRAH4Kr/ADMz3hkJAQADVSZUMFVV/VX0AQwBDvIROU6YAAEAKwAAAtUEAAAYABlACxIMEAwHAQUBBAwAAD8/3BDcENwQ3DAxJQchJzY3MxUzAic1NyEXBgcjNSMWFx4BFwLVqv6qqh0M16rP26oBVqodDNeqK25DiEarq6teTFUBCMWIq6teTFVHdkmIPwAAAf/x/qwC7wVVABUAIUARCgwBDAMGFAIMAAAAFAICBwMrENAAPz8/PxDcENwwMQEHIxEBPgE1NCYnITcXPgE1NCYnJREC72aa/wAQDwcH/vFTswEBBQUBAAQA3vuKAVR29oNLmFDeFAsbEChEHar+kwAAAQArAAAC1QQAABIAHUAQBQQABA8ACgAMCAMEDRENAysQ0CsAPz8/PzAxIScuAScFJzY1NCchETcRIQYREALV3gsSBf8AqjMzAQCqAQAzERxDKJirzd3a0f0AVQKr9f71/vEAAAEAAAAAAu8EAAAJABJACQQECQAGAAMEAysAPz8/MDEBBgIDIQIDIRsBAu9UZhP+qyemAQB3eAQA8/4D/vACHwHh/QADAAABACsAAARVBAAAHwAnQBcGBAQEAAQcABIACwAWEAMNCQMDGh4aAysQ0CsrAD8/Pz8/PzAxIScmJwUnByc2NTQnIRE3NjU0JwEOARUUFhc3ESEGERAEVd4ZCf8Aj/GqMzMBAKQPRAEzExMCAqoBADMROU6Yj4+ryeHiyf0AY2Br8uD/AGXIZBg3IFUCq/X+9f70AAEAAAAAAu8EAAAbABFACAQEAAQSAA4AAD8/Pz8wMSkBCwEhPgE3NjU0Jy4BJyEbASEOAQcGFRQXHgEC7/8AeHf/ABw2Gk5OGjYcAQB3eAEAHDYbT08bNgF3/olCg0LGMzPGQoNC/okBd0KDQsU0NMVCgwAAAQAr/qwC1QQAABkAIUATCAMDBgYABhYAEQATDwMLFBgUAysQ0CsAPz8/PyswMQEuASMiBgcTIS4BJwUnNjU0JyERNxEhAhEQAtVVqVdXqVWqAQ4FBwL/AKoqKgEAqgEAM/6sERISEQEALXVKmKvT19bV/QBVAqv+uv6b/pwAAQARAAACvAQAABcAJUAUExMKDwoDBwcWFgMDBgQABBIADAAAPz8/PysQ0C8rENAvMDEhLgEjIgYHNTYSNyEnHgEzMjY3FQYCByECvFKqWlmqUonUTv67ZkybUW+5S1rUfQFECAkJCN60ASBw3ggJCQjejf7flgAAAQAr/1cCVQYAABQAFUALDxIDEwEDBQsSCwMrENAAKyswMQUhJzYSNwYjNz4BNyYCJzchESMRMwJV/wCqFRgEcUAiHEcsBBgVqgEAqqqpqY8BG5AY7wELCowBFY2r/wD7VQABACv/VwErBgAACAAVQAkIAQQIAQcIBwMrENAQ3AAvLzAxBSE2EjU0AichASv/ABEREREBAKnTAajZ2QGo1AAAAQAr/1cCVQYAABMAFUALDQwDCQgDAwsLEgMrENAAKyswMQEHBgcWEhcHITUzESMRIRcGAgc2AlUiOlUEGBWq/wCqqgEAqhUYBHADM+8CFIv+646p/gSrAQCrj/7lkBgAAQArBFUCKwVVABEADUAFEQILAggALz8/MDEBBiMiJyYjIgc1NjMyFxYzMjcCKz5tJjEvJWs/QGolLzEmbj0Eq1YrK1arVSsqVQABACv/aAErAO8ABQANQAUFAQUEAysALy8wMQUjJwc1JQErRTOIAQCYqRHeEQAAAgAr/1cCgAEAAAUACwAXQAwJBAIECgcLCgMFBAMrKwAvLz8/MDEFIycjEQUBIycjEQUCgEQziQEA/qtFM4gBAKmpAQAi/nmpAQAiAAMAK//gA9UBAAADAAcACwAjQBMHBwoFBQkKCQMACwoDBwYDAwIDKysrAC8rENAvENAvMDEFJTUNAjUlASU1BQPV/wABAP6r/wABAP6r/wABACAg3hGrEd4R/wAR7yIAAAIAKwAABIAFVQAlACkAOUAhJxEmCiAjAxofAyQDAwoEAAQdAhECIx8SJygOAwonHycDKxDQKxDQENAAPz8/PysrKxDcENwwMSEuASMiBw4BBwYjISc2ERAnNyEyFx4BFx4BMzI2NwchESEHIxEhJREjEQSAVKlYgW0DGxgpCf8AqjMzqgEABysYGwM3d0BYqVRm/rsBVmfvAUX9u6oREQ8BBQQJq/kBBwEF+6oIBQQBCAgREd7+ms3+miIDVfyrAAEAKwPNASsFVQAFAA5ABgMCAQUCAysALz8wMQEFETMXNwEr/wBEM4kD3hEBiKoRAAEAKwPNASsFVQAFAA5ABgUCAQUEAysALz8wMQEjJwc1JQErRTOIAQADzaoR3hEAAAIAKwPNAoAFdwAFAAsAEUAICQYLCAMFAgMrKwAvLzAxASURMxczASURMxczAoD/AEQzif6r/wBEM4kDzSIBiKr/ACIBiKoAAAIAKwPNAoAFdwAFAAsAEUAICgcLCgMFBAMrKwAvLzAxASMnIxEFASMnIxEFAoBEM4kBAP6rRTOIAQADzaoBACL+eKoBACIAAAEAKwWrAisGqwARAAlAAhEIAC8vMDEBBiMiJyYjIgc1NjMyFxYzMjcCKz1uJjEvJWs/QWklLzEmbT4GAFUqK1WqVisrVgACACsCgAK1BQAAIwAxAB1ADycuJioDGxEGFhEWAyECAysrENwQ0CsALy8wMQEjEQcOARUUFhcnPgE1NCYnBxEjPgE1NCYnHwE3FzcXBhUUFgEHIxEnNjU0JyM3FjMyArVgPQQDDQ1zCAgCAj9hCgoKClMOYDVaQRMJ/qAnOGIMDF8gN0lIAqABoSYjOxdEgkBgNmYxHjocIf6AQn8/QH9BBjI4NDQ/aHk6cAIqUv3SgHZaZ3dSCQAAAwAr/70EgAQAABsAHwAjAC9AGiEUIA0JDAMNBBQAGhwDIhEDBx4EHgIeHiEDKxDQENAQ0CsrAD8/KxDcENwwMQEHJRQVFAcXDwEzFyEnISc2NTQnNyEXIRcGFRQnNScVAREjEQSAq/8AAQEDAvR4/kRE/pmqMzOqAVZEAWarIt6r/wCqAZqrmFo2NREGBB7MQ6ujsrGkq0SrU25lBM0imv68AgD+AAAAAwAr/qwC1QZVAAsAFwAuADFAHB8aAwkJFQMDDxUPAx0GGAYrAiYCKCQDICktKQMrENArAD8/Pz8rENAvENAvKzAxARQGIyImNTQ2MzIWBxQGIyImNTQ2MzIWASYjIgYHEyEnBScSERADIRE3ESECERACRDEkJDExJCQx3jEkJDExJCQxAW+prFepVaoBDg7/AKoqKgEAqgEAMwYAJDExJCQxMSQkMTEkJDEx+IgjEhEBAOyYqwEqASsBKgEr+6tVBAD+aP5D/kQAAAIAK/6bASsEAAADAAwAIEAPAgAFBAYBBQEHBQoFAwAGENArENzQENAQ0AAvPzAxASURBREhEQUOARUUFgEr/wABAP8AAQAREREC3iIBABH6rAQhIoD9g4L9AAEAK/9XAtUGAAAhAChAFggEAQQaABUCDgITBBwLAwcPAhQUDwMrENAQ0CsALy8/Pz8/PzAxJQcjFSE+ATcjJzYRECc3My4BJyEVMxcOAQcjNSMRMzUzFgLVqiv/AAUIBDyqMzOqPAQIBQEAK6oOFQbXqqrXDKurqSpTLKv5AQcBBfuqLVQqq6ouVShV/KtVTAAAAQAAAAADbwYAAB0AGUANHAIDBAQABA8WGxsHAysQ0AAvPz8rMDEhJiMiBzYSNTQnIzcXJicBFw4BByM1BxU2NwcjESEDb6eur6cREQPjVYQHDgIAqwoPB+CrmqJm1gFFIiKYAR6JfWbeD2N5ATOrJ1UuVVXGBxTe/bwAAAIAKwCuA3kEpwAdACEAGUAOEiADIQQDFQYaHwMgCwMrKwAvLysrMDEBBycHIScHJzcnNjU0JzcnNxc3IRc3FwcXBhUUFwcnESMRA3mZXgn+qwVbmVoMIiIJV5lXCQFVDFuZWgUiIgn3qwFIml4JBluaWgx7hYV7CVeZVwkMWplbBXuFhXsIXQFW/qoAAQAAAAAC7wVVADQAGkANBQQlAiECBRIDMTESAysQ0BDQAD8/PzAxAQcGBxUhNQ4BIyImJzceATsBNQ4BIyImJzceATMmAy4BJyEbASEOAQcOAQc+ATcHBgcVPgEC7zNUcf8AG0UqJjcQMyNRLiIbRSomNxAzIlg2JFoQMiMBAHd4AQAOMCMqPxQ4bjgzVHExfAF3zAwJlokBAQEBzAQEXgEBAQHMBASTASA0mWb93gIiI5RwiNVRBQ0IzQwJXgUOAAACACsFqwGzBlUACwAXABVACQkJFQMDDxUPAwArENAvENAvMDEBFAYjIiY1NDYzMhYHFAYjIiY1NDYzMhYBszEkJDExJCQx3jEkJDExJCQxBgAkMTEkJDExJCQxMSQkMTEAAAMAAACrBAAEqwANABsAMQAZQA8KEgMZAwMsIQMWBgMADgMrKysAKyswMQEUACMiADU0NzYzMhcWBzQnJiMiBwYVFBYzMjYPASMnNjU0JzczFw4BByM1IxEzNTMWBAD+1NTU/tSWltTUlpaMbW6ZmW5t2pqa2rpcvFwbG1y8XAgKBHZcXHYIAqvU/tQBLNTTlpeXltOZbW5ubZma2togXl5XY2NXXFwZLhUu/uguLQAABQAAAD0EAASbABQAJgAqADMAPwAfQBESGAMGLioqNAM5DwMGFQAVAysQ0CsrENAALyswMQEUBgcWFwcuAScGIyInJjU0ADMyAAc0JiMiByEXBhUUFwcWFzY3NiU1IxUTLgEnFR4BMzIDNCYnBhUUFxYXPgEEAJR7QWgmOmEmVl3UlpYBLNTUASyM2ppfVgETXA4OXA03YTg5/rpcfS4+EQcXECbNCQq6NTRaBQUCm430Q006Exw/JCGWl9PUASz+1NSa2i9dQEE/QFxubC9aW4CkpP5/Q3s5/gEBAUZat2Bs12VYVzJFiwAAAgArBFUBKwVVAA0AFgAKQAMLAgQALz8wMQEUBwYjIiY1NDc2MzIWBzQmIyIVFDMyASsmJTU2SiUmNTRMRSMYPDw7BNU1JiVKNjUlJkw0GCQ8OwAAAgAr//0C9wQiABkAHwAYQAseHQkJAxcDAx0EEwAvPysQ0C8Q3DAxAQcGBxYXJy4BJyYnNx4BFzQ1NCcXDgEVPgETBwYlNyQC9yJZlwcdzQgNBVGmIjNlNgHMAgNcijBE4/5bRAFrA0TNFAO/bkQtc0kBBc0EBQEqPj5TRDlaIAIN/cbNNgPNAwAAAQArBasBogZ3AAMACUACAwEALy8wMQEFJyUBov6rIgF3Bc0iIqoAAAIAK/6bAtUEAAADAB8ANEAeDhsDHAYDHgUDAwEDAgAZBBMEDx0cCgMBHQAEBB0DKxDQENArENAQ0BDQAD8rKysrMDEBBREFEQchJz4BNTQmJzczNT4BNw4BFRQWFwchETM1MwLV/wABAKr+qqoICQkIuPJCfz8EBAQEqv8AqvYC7xEBIhH7V6urK1syQGss78UCCAcqTSYgRyer/tdWAAADAAAAAALvBncAAwATABgAF0ALAAACAhADCwQEBAMALz8/KxDQLzAxAQclNQEhAw4BDwEhNhI3EjchFhInCwE+AQHeIv6qAon/ACcuVikb/wAlRiMuEQFVDmfmOkAdPQXNIiKq+YkBXBEyIvfbAbvlATCqhP1VCgID/bMXJQADAAAAAALvBncAAwATABgAEUAIARADCwQEBAMALz8/KzAxAQUnJRMhAw4BDwEhNhI3EjchFhInCwE+AQKJ/qoiAXhm/wAnLlYpG/8AJUYjLhEBVQ5n5jpAHT0FzSIiqvmJAVwRMiL32wG75QEwqoT9VQoCA/2zFyUAAAMAAAAAAu8GVQAGABYAGwAQQAcOBAcEFAIGAC8/Pz8wMQEjJwcjNzMBIQMOAQ8BITYSNxI3IRYSJwsBPgECd6pWVaurqwEi/wAnLlYpG/8AJUYjLhEBVQ5n5jpAHT0Fq1VVqvmrAVwRMiL32wG75QEwqoT9VQoCA/2zFyUAAAMAAAAAAu8GqwARACEAJgAQQAcZBBIEHwIRAC8/Pz8wMQEGIyInJiMiBzU2MzIXFjMyNxMhAw4BDwEhNhI3EjchFhInCwE+AQJ3PW0mMS8la0BBaiUvMSZsPnj/ACcuVikb/wAlRiMuEQFVDmfmOkAdPQYAVSorVapWKytW+VUBXBEyIvfbAbvlATCqhP1VCgID/bMXJQAABAAAAAAC7wZVAAsAFwAnACwAHkAPCQkVAwMPFQ8DHwQYBCUCAD8/PysQ0C8Q0C8wMQEUBiMiJjU0NjMyFgcUBiMiJjU0NjMyFgEhAw4BDwEhNhI3EjchFhInCwE+AQI8MiQjMjIjJDLeMiMkMjIkIzIBkf8AJy5WKRv/ACVGIy4RAVUOZ+Y6QB09BgAkMTEkJDExJCQxMSQkMTH53AFcETIi99sBu+UBMKqE/VUKAgP9sxclAAAEAAAAAALvBqsADQAdACYAKwAQQAcVBA4EGwILAC8/Pz8wMQEUBwYjIicmNTQ2MzIWEyEDDgEPASE2EjcSNyEWEgM0JiMiFRQzMgsCPgEB9yYlNTUlJkw0NEz4/wAnLlYpG/8AJUYjLhEBVQ5n5CQYOzs8AjpAHT0GKzUmJSUmNTRMTPmhAVwRMiL32wG75QEwqoT9VQQFGCM7PPxBAgP9sxclAAIAAAAABJoFVQAYABwALkAbFBUDDhIDFwIDCQQEBAAEEAILAhoXFhIXFwUDKxDQ0BDcAD8/Pz8/KysrMDEhJiMiBxEGDwEhEhMjFjMyNwchESEHIxEhAREDNgSaprCup2NVN/8Au60Cu9/evGf+vAFVZu8BRP2+hEEiIgFcI0L3ApUCwBgY3v6azf6aAVICA/2zLgACACsAAALVBncAAwAZADFAGwICAA4OEwMTFBQXAxcYGAYDCAQEBAMXFBQKAysQ0AAvPz8rENwrENwrENzQLzAxAQclNQEmIyIHEhEQAxYzMjY3ByERIQcjESEB2SL+qgJ0p66upzMzp65YqVRm/rwBVWbvAUQFzSIiqvmJIiIBTgFdAVsBTyIREd7+ms3+mgACACsAAALVBncAAwAZAC1AGQEODhMDExQUFwMXGBgGAwgEBAQDFxQUCgMrENAALz8/KxDcKxDcKxDcMDEBBSclEyYjIgcSERADFjMyNjcHIREhByMRIQKF/qsiAXdQp66upzMzp65YqVRm/rwBVWbvAUQFzSIiqvmJIiIBTgFdAVsBTyIREd7+ms3+mgAAAgArAAAC1QZVAAYAHAAhQBMXGgMRFgMbCQMLBAcEBhoXFw0DKxDQAC8/PysrKzAxASMnByM3MwEmIyIHEhEQAxYzMjY3ByERIQcjESECdKtVVaurqgEMp66upzMzp65YqVRm/rwBVWbvAUQFq1VVqvmrIiIBTgFdAVsBTyIREd7+ms3+mgADACsAAALVBlUACwAXAC0AL0AbKCsDIicDLBoDCQkVAwMPFQ8DHAQYBCsoKB4DKxDQAD8/KxDQLxDQLysrKzAxARQGIyImNTQ2MzIWBxQGIyImNTQ2MzIWASYjIgcSERADFjMyNjcHIREhByMRIQI4MSQkMTEkJDHeMSQkMTEkJDEBe6eurqczM6euWKlUZv68AVVm7wFEBgAkMTEkJDExJCQxMSQkMTH53CIiAU4BXQFbAU8iERHe/prN/poAAv+bAAABKwZ3AAMACgAYQAwAAAICCQMFBAMHCgMrAC8/KxDQLzAxAQclNQEhEhEQAyEBESL+rAGQ/wAqKgEABc0iIqr5iQFUAVcBVQFVAAACACsAAAG8BncAAwAKABJACQEJAwUEAwoHAysALz8rMDEBBSclAyESERADIQG8/qoiAXiR/wAqKgEABc0iIqr5iQFUAVcBVQFVAAL/rAAAAasGVQAGAA0AGUAMCAQNAgYKAwUDDQMDKxDQENAALz8/MDEBIycHIzczEyESERADIQGrq1VWqamrK/8AKioBAAWrVVWq+asBVAFXAVUBVQAAA//oAAABbwZVAAsAFwAeAB9AEAkJFQMDDxUPAxkEHgIeGwMrAD8/KxDQLxDQLzAxARQGIyImNTQ2MzIWBxQGIyImNTQ2MzIWEyESERADIQFvMiMkMjIkIzLeMSQkMDAkJDGa/wAqKgEABgAkMTEkJDExJCQxMSQkMTH53AFUAVcBVQFVAAACACsAAALVBqsAEQAiAClAFRcEEgQRHRUPFAsVBhUVGQMCFCEUAysQ0CsQ0BDQENAQ0AAvPz8wMQEGIyInJiMiBzU2MzIXFjMyNxMhEQcRIRIREAMfASUXAhEQAoA9biUxLyVsP0FqJS8xJW0+Vf8Aqv8AMzPeIgEAqjMGAFUqK1WqVisrVvlVBFVV/AABRQFmAWQBRhGHmKr+2/7P/s8AAwArAAAC1QZ3AAMAEQAVACdAFRMMEgUAAAICDAMFBAwCAxMQAxQJAysrAC8/PysQ0C8Q3BDcMDEBByU1AQchJzYRECc3IRcGERAHESMRAeYi/qsCZqr+qqozM6oBVqozzaoFzSIiqvo0q6v5AQcBBfuqqvP+8/7xnANV/KsAAwArAAAC1QZ3AAMAEQAVACFAEhMMEgUBDAMFBAwCAxATAxQJAysrAC8/PysQ3BDcMDEBBSclEwchJzYRECc3IRcGERAHESMRApH+qyIBd0Sq/qqqMzOqAVaqM82qBc0iIqr6NKur+QEHAQX7qqrz/vP+8ZwDVfyrAAADACsAAALVBlUABgAUABgAK0AWFg8VCAQPAgYGFgUXAxcXDAMBFhMWAysQ0CsQ0BDQENAALz8/3BDcMDEBIycHIzczAQchJzYRECc3IRcGERAHESMRAoCrVVWrq6oBAKr+qqozM6oBVqozzaoFq1VVqvpWq6v5AQcBBfuqqvP+8/7xnANV/KsAAwArAAAC1QarABEAHwAjABtADiEaIBMEGgIRHiEDIhcDKysALz8/3BDcMDEBBiMiJyYjIgc1NjMyFxYzMjcTByEnNhEQJzchFwYREAcRIxECdz1tJjEvJWtAQWolLzEmbD5eqv6qqjMzqgFWqjPNqgYAVSorVapWKytW+gCrq/kBBwEF+6qq8/7z/vGcA1X8qwAEACsAAALVBlUACwAXACUAKQArQBcnICYZCQkVAwMPFQ8DGQQgAiQnAygdAysrAD8/KxDQLxDQLxDcENwwMQEUBiMiJjU0NjMyFgcUBiMiJjU0NjMyFgEHISc2ERAnNyEXBhEQBxEjEQJEMSQkMTEkJDHeMSQkMTEkJDEBb6r+qqozM6oBVqozzaoGACQxMSQkMTEkJDExJCQxMfqHq6v5AQcBBfuqqvP+8/7xnANV/KsAAwArAAAC1QVVAA0AEwAZACNAEhQBDwgBBAgCGBEOFQwVAxEFAysrENAQ0AA/PxDcENwwMSUHISc2ERAnNyEXBhEQAxEjET4BExEOAQcRAtWq/qqqMzOqAVaqM82qJlQwLlUnq6ur+QEHAQX7qqrz/vP+8QF/ATr+sAcL/ekBWQIJCP66AAACACsAAALVBncAAwAUAClAFhAQDAAAAgIMAwcEBAQDDgoDBhMPEwMrENArAC8/PysQ0C8Q0C8wMQEHJTUBLwEFJxIREAMhETcRIQIREAHmIv6rAmbeIv8AqjMzAQCqAQAzBc0iIqr5iRGHmKsBJAExATABJfurVQQA/rr+nP6aAAIAKwAAAtUGdwADABQAI0ATEBANAQ0DBwQEBAMOCgMGDxMPAysQ0CsALz8/KxDQLzAxAQUnJRMvAQUnEhEQAyERNxEhAhEQApH+qyIBd0TeIv8AqjMzAQCqAQAzBc0iIqr5iRGHmKsBJAExATABJfurVQQA/rr+nP6aAAACACsAAALVBlUABgAXAC9AGQoEBwQUAg8CBgkSBhIFEQMREQ0DARIWEgMrENArENAQ0BDQENAALz8/Pz8wMQEjJwcjNzMBLwEFJxIREAMhETcRIQIREAKAq1VVq6uqAQDeIv8AqjMzAQCqAQAzBatVVar5qxGHmKsBJAExATABJfurVQQA/rr+nP6aAAMAKwAAAtUGVQALABcAKAAtQBkJCRUDAw8VDwMbBBgEJQIgAiIeAxojJyMDKxDQKwA/Pz8/KxDQLxDQLzAxARQGIyImNTQ2MzIWBxQGIyImNTQ2MzIWAS8BBScSERADIRE3ESECERACRDEkJDExJCQx3jEkJDExJCQxAW/eIv8AqjMzAQCqAQAzBgAkMTEkJDExJCQxMSQkMTH53BGHmKsBJAExATABJfurVQQA/rr+nP6aAAEAK/6sAtUFVQAeAC5AGAkSDAYCBBICFgQPCgwSChIDCB0BHQQdAysQ0BDQKxDQENwQ0AA/Pz8Q3DAxJQUjETMRIxEzESMRITYSNTQCJyEXBhUUFhcHFwYVFALV/wB3d3d3qv8ADQwMDQIAqhEJCLi4EaurAQABKwEAASr6V9IBp9vcAajRqlhcRW0rb29YiFkAAwArAAAC1QUiAAMAGgAeACJAEgICABQUDwMFBAMbGQwZAx0IAysrENAALz8rENzQLzAxAQclNQEhJzY1NCc3BTQ2NyMDHgEzMjY3BhEQBzUnFQHmIv6rAmb+AKoiIqoBAAMCnqtIkEpKkEgzzaoEdyIiq/req1lrWlmrmEhlHgEAEREREfX+9f70FplWzQAAAwArAAAC1QUiAAMAGgAeAB5AEAEUFA8DBQQDGwwZDAMdCAMrKxDQAC8/KxDcMDEBBSclEyEnNjU0JzcFNDY3IwMeATMyNjcGERAHNScVApH+qyIBd0T+AKoiIqoBAAMCnqtIkEpKkEgzzaoEdyIiq/req1lrWlmrmEhlHgEAEREREfX+9f70FplWzQADACsAAALVBQAABgAdACEAKkAWFxIDCAQGHg8GDwUgAyAgCwMBDxwPAysQ0CsQ0BDQENAQ0AAvPyswMQEjJwcjNzMBISc2NTQnNwU0NjcjAx4BMzI2NwYREAc1JxUCgKtVVaurqgEA/gCqIiKqAQADAp6rSJBKSpBIM82qBFVWVqv7AKtZa1pZq5hIZR4BABERERH1/vX+9BaZVs0AAAMAKwAAAtUFVQARACgALAAeQBEiHQMTBBECCwIpGicaAysWAysrENAAPz8/KzAxAQYjIicmIyIHNTYzMhcWMzI3EyEnNjU0JzcFNDY3IwMeATMyNjcGERAHNScVAnc+bCYxLyVqQUBrJS8xJm09Xv4AqiIiqgEAAwKeq0iQSkqQSDPNqgSrVisrVqtVKypV+qurWWtaWauYSGUeAQARERER9f71/vQWmVbNAAAEACsAAALVBQAACwAXAC4AMgAoQBYoIwMJCRUDAw8VDwMZBC8gLSADMRwDKysQ0AA/KxDQLxDQLyswMQEUBiMiJjU0NjMyFgcUBiMiJjU0NjMyFgEhJzY1NCc3BTQ2NyMDHgEzMjY3BhEQBzUnFQJEMSQkMTEkJDHeMSQkMTEkJDEBb/4AqiIiqgEAAwKeq0iQSkqQSDPNqgSrJDIyJCQxMSQkMjIkJDEx+zGrWWtaWauYSGUeAQARERER9f71/vQWmVbNAAAEACsAAALVBVUADQAkAC0AMQAbQA8eGQMPBAsCLhYjFgMwEgMrKxDQAD8/KzAxARQHBiMiJjU0NzYzMhYTISc2NTQnNwU0NjcjAx4BMzI2NwYREAM0JiMiFRQzMhM1JxUCACYlNTZKJSY1NEzV/gCqIiKqAQADAp6rSJBKSpBIM+YkGDw8PBmqBNU1JiVKNjUlJkz696tZa1pZq5hIZR4BABERERH1/vX+9APhGCQ8O/xEmVbNAAMAK/+bBNUEAAAkACgALAAqQBkZFAMFCAMKBBwAFgAnAiMlAxEqKw0DAioDKysQ0CsQ0AA/Pz8rKzAxAQclFAYHMxchJyEnNjU0JzcFNDY3IwMeATMyNjcGBzchFwYVFCc1JxUBNScVBNWq/wADAvR3/kRm/maqIiKqAQADAp6rSJBKSpBIDwkYAVaqIt6q/qqqAXeqmGJ/Hstlq1lrWlmrmEhlHgEAEREREU0xGKtTbmQDzSKa/ryZVs0AAwArAAAC1QUiAAMAGAAcACRAEwoMAAACAhMDDAQDGwYZFwMGEAMrKxDQAC8/KxDQLxDcMDEBByU1AQclFRQGBzMXISc2NTQnNyEXBhUUJzUnFQHmIv6rAmaq/wADAvR3/kSqMzOqAVaqIt6qBHciIqv8vKuYXDNRHs2rpq+up6urUXBlBM0imQAAAwArAAAC1QUiAAMAGAAcAB5AEAoMARMDDAQDGwYXGQMGEAMrKxDQAC8/KxDcMDEBBSclEwclFRQGBzMXISc2NTQnNyEXBhUUJzUnFQKR/qsiAXdEqv8AAwL0d/5EqjMzqgFWqiLeqgR3IiKr/LyrmFwzUR7Nq6avrqerq1FwZQTNIpkAAwArAAAC1QUAAAYAGwAfACtAFg0PBBcABh4JBhwFCQMJCRMDARwaHAMrENArENAQ0BDQENAALz8/3DAxASMnByM3MwEHJRUUBgczFyEnNjU0JzchFwYVFCc1JxUCgKtVVaurqgEAqv8AAwL0d/5EqjMzqgFWqiLeqgRVVlar/N6rmFwzUR7Nq6avrqerq1FwZQTNIpkABAArAAAC1QUAAAsAFwAsADAAK0AXHiAJCRUDAw8VDwMgBCgALxorLQMaJAMrKxDQAD8/KxDQLxDQLxDcMDEBFAYjIiY1NDYzMhYHFAYjIiY1NDYzMhYBByUVFAYHMxchJzY1NCc3IRcGFRQnNScVAkQxJCQxMSQkMd4xJCQxMSQkMQFvqv8AAwL0d/5EqjMzqgFWqiLeqgSrJDIyJCQxMSQkMjIkJDEx/Q+rmFwzUR7Nq6avrqerq1FwZQTNIpkAAv+bAAABKwUiAAMACgAOQAYFBAMHCgMrAC8/MDEBByU1ASESETQDBQERIv6sAZD/ACoqAQAEdyIiq/reAQABAP8BAVUAAAIAKwAAAbwFIgADAAoADkAGBQQDCgcDKwAvPzAxAQUnJQMhEhE0AwUBvP6qIgF4kf8AKioBAAR3IiKr+t4BAAEA/wEBVQAC/6wAAAGrBQAABgANABZACggEBgoDBQMNAwMrENAQ0AAvPzAxASMnByM3MxMhEhE0AwUBq6tVVqmpqyv/ACoqAQAEVVZWq/sAAQABAP8BAVUAA//oAAABbwUAAAsAFwAeABxADgkJFQMDDxUPAxkEHhsDKwA/KxDQLxDQLzAxARQGIyImNTQ2MzIWBxQGIyImNTQ2MzIWEyESETQDBQFvMiMkMjIkIzLeMSQkMDAkJDGa/wAqKgEABKskMjIkJDExJCQyMiQkMTH7MQEAAQD/AQFVAAIAKwAAAtUFVQARACQAHUAQFwQSBBECCwIfFRUZAyMUAysrENAAPz8/PzAxAQYjIicmIyIHNTYzMhcWMzI3EyERBxEhNhEQJxceARclFwYVFAJ3PmwmMS8lakFAayUvMSZtPV7/AKr/ADMz3gsSBQEAqjMEq1YrK1arVSsqVfqrAwBV/VX0AQwBDvIRHEMomKvO3NsAAAMAKwAAAtUFIgADABEAFQAnQBUTDBIFAAACAgwDBQQMAAMSEAMUCQMrKwAvPz8rENAvENwQ3DAxAQclNQEHISc2NTQnNyEXBhUUBxEjEQHmIv6rAmaq/qqqMzOqAVaqM82qBHciIqv7iaurpq+up6urnre4SAIA/gAAAwArAAAC1QUiAAMAEQAVACFAEhMMEgUBDAMFBAwAAxATAxQJAysrAC8/PysQ3BDcMDEBBSclEwchJzY1NCc3IRcGFRQHESMRApH+qyIBd0Sq/qqqMzOqAVaqM82qBHciIqv7iaurpq+up6urnre4SAIA/gAAAAMAKwAAAtUFAAAGABQAGAArQBYWDxUIBA8ABgYWBRcDFxcMAwEWExYDKxDQKxDQENAQ0AAvPz/cENwwMQEjJwcjNzMBByEnNjU0JzchFwYVFAcRIxECgKtVVaurqgEAqv6qqjMzqgFWqjPNqgRVVlar+6urq6avrqerq563uEgCAP4AAAMAKwAAAtUFVQARAB8AIwAvQBkhGiATBBECCwIaAA8hCyIGIiIXAwIhHiEDKxDQKxDQENAQ0AA/Pz8/3BDcMDEBBiMiJyYjIgc1NjMyFxYzMjcTByEnNjU0JzchFwYVFAcRIxECgD5tJTEvJWw/QGslLzElbj1Vqv6qqjMzqgFWqjPNqgSrVisrVqtVKypV+1arq6avrqerq563uEgCAP4AAAQAKwAAAtUFAAALABcAJQApACtAFycgJhkJCRUDAw8VDwMZBCAAJCcDKB0DKysAPz8rENAvENAvENwQ3DAxARQGIyImNTQ2MzIWBxQGIyImNTQ2MzIWAQchJzY1NCc3IRcGFRQHESMRAkQxJCQxMSQkMd4xJCQxMSQkMQFvqv6qqjMzqgFWqjPNqgSrJDIyJCQxMSQkMjIkJDEx+9yrq6avrqerq563uEgCAP4AAAMAKwFVAysEAAALABQAIAAaQA0MEAMJABgGGwAVFRsDKxDQENAALz8rMDEBFAYjIiY1NDYzMhYFBw4BIyAnNxYTFAYjIiY1NDYzMhYCADEkJDIyJCQxAStFFy8Z/p76RPuWMSQkMjIkJDEDqyQyMiQkMTHPzQEBJM0x/rokMjIkJDExAAMAKwAAAtUEAAANABMAGQAjQBIUAQ8IAQQIABgRDhUMFQMRBQMrKxDQENAAPz8Q3BDcMDElByEnNjU0JzchFwYVFAM1IxU+ARM1DgEHFQLVqv6qqjMzqgFWqjPNqiZUMC5VJ6urq6OysaSrq563uAEpj6YHC/6UrgIJCJsAAAIAKwAAAtUFIgADABYAKUAWEhIOAAACAg4DCQQEBAMQDAMIFREVAysQ0CsALz8/KxDQLxDQLzAxAQclNQEnLgEnBSc2NTQnIRE3ESEGERAB5iL+qwJm3gsSBf8AqjMzAQCqAQAzBHciIqv63hEcQyiYq83d2tH9AFUCq/X+9f7xAAACACsAAALVBSIAAwAWACNAExISDwEPAwkEBAQDEAwDCBEVEQMrENArAC8/PysQ0C8wMQEFJyUTJy4BJwUnNjU0JyERNxEhBhEQApH+qyIBd0TeCxIF/wCqMzMBAKoBADMEdyIiq/reERxDKJirzd3a0f0AVQKr9f71/vEAAgArAAAC1QUAAAYAGQAvQBkMBAcEFgARAAYLFAYUBRMDExMPAwEUGBQDKxDQKxDQENAQ0BDQAC8/Pz8/MDEBIycHIzczAScuAScFJzY1NCchETcRIQYREAKAq1VVq6uqAQDeCxIF/wCqMzMBAKoBADMEVVZWq/sAERxDKJirzd3a0f0AVQKr9f71/vEAAAMAKwAAAtUFAAALABcAKgAtQBkJCRUDAw8VDwMdBBgEJwAiACQgAxwlKSUDKxDQKwA/Pz8/KxDQLxDQLzAxARQGIyImNTQ2MzIWBxQGIyImNTQ2MzIWAScuAScFJzY1NCchETcRIQYREAJEMSQkMTEkJDHeMSQkMTEkJDEBb94LEgX/AKozMwEAqgEAMwSrJDIyJCQxMSQkMjIkJDEx+zERHEMomKvN3drR/QBVAqv1/vX+8QAAAwAr/qwC1QUAAAsAFwAxADFAHCAbAwkJFQMDDxUPAx4GGAYuACkAKycDIywwLAMrENArAD8/Pz8rENAvENAvKzAxARQGIyImNTQ2MzIWBxQGIyImNTQ2MzIWAS4BIyIGBxMhLgEnBSc2NTQnIRE3ESECERACRDEkJDExJCQx3jEkJDExJCQxAW9VqVdXqVWqAQ4FBwL/AKoqKgEAqgEAMwSrJDIyJCQxMSQkMjIkJDEx+d0REhIRAQAtdUqYq9PX1tX9AFUCq/66/pv+nAACACsAAALVBlUABgAlABtADB4XHBcPCA0IBBcCBgAvPz/cENwQ3BDcMDEBByMnMxc3AQchJz4BNzMVMyYnLgEnNTchFw4BByM1Ix4BFx4BFwJ3qqurq1VWAQiq/qqqDhUG16o+fEd3MqoBVqoOFQbXqjl4Px1dQAZVqqpVVfpWq6stVShVV+yH7mqJqqouVShVeO55OKFqAAIAKwAAAtUFAAAGAB8AG0AMGRMXEw4IDAgEEwAGAC8/P9wQ3BDcENwwMQEHIyczFzcBByEnNjczFTMCJzU3IRcGByM1IxYXHgEXAneqq6urVVYBCKr+qqodDNeqz9uqAVaqHQzXqituQ4hGBQCrq1VV+6urq15MVQEIxYirq15MVUd2SYg/AAABACsBfQLmBBQAFgAJQAISBQAvLzAxAQcmJwYHJz4BNy4BJzceARc2NxcGBxYC5sBIbzt4eSNMKh5YO8EUPCp+Nnkva48B9mIwYzdzqR1GKB1YOmEXQSyGUahIc4QAAgAr/qwC1QZ3AAMAGgAnQBYWFhMLBgMBEwMJBgQGAxQQAwwVGRUDKxDQKwAvPz8rKxDQLzAxAQUnJRMmIyIGBxMhJwUnEhEQAyERNxEhAhEQApH+qyIBd0SprFepVaoBDg7/AKoqKgEAqgEAMwXNIiKq+DUjEhEBAOyYqwEqASsBKgEr+6tVBAD+aP5D/kQAAgAr/qwC1QUiAAMAHQAnQBYZGRYMBwMBFgMKBgQGAxcTAw8YHBgDKxDQKwAvPz8rKxDQLzAxAQUnJRMuASMiBgcTIS4BJwUnNjU0JyERNxEhAhEQApH+qyIBd0RVqVdXqVWqAQ4FBwL/AKoqKgEAqgEAMwR3IiKr+YoREhIRAQAtdUqYq9PX1tX9AFUCq/66/pv+nAAAAAAAABAAAAC4CQgFAgMFAwgDAgICAwQCBAIEAwIDAwMDAwMDAwICAgQCAwUDAwMDAwMDAwICAwMFAwMDAwMDAwMDBQMDAwIEAgMEAgMDAwMDAwMDAgIDAgUDAwMDAwMDAwMFAwMDAwIDAwIDBQUCAgMDAwMFAwICAwQEAwIFBQIEAgMDAwMDAwMFAwMDAwICAgIDAwMDAwMDAwMDAwMDAwMDAwMGAwMDAwICAgIDAwMDAwMEAwMDAwMDAgMDAwMDAAoJBQIDBgQJBAIDAwQEAgQCBAQCBAQEBAQDBAQCAgMEAwQFBAQEBAQEBAQCAgQEBgQEBAQEBAQEBAYEBAQDBAMDBAIEBAQEBAQEBAICBAIGBAQEBAQEBAQEBgQEBAMCAwMCAwUGAgIDAwMEBgQCAgQFBQQCBQUCBAIEBAQEBAQEBgQEBAQCAgICBAQEBAQEBAQEBAQEBAQEBAQEBgQEBAQCAgICBAQEBAQEBAQEBAQEBAIEBAQEBAALCgYCBAYECgQCAwMEBAIFAgQEAgQEBAQEAwQEAgIDBQMEBgQEBAQEBAQEAgIEBAYEBAQEBAQEBAQGBAQEAwQDAwUCBAQEBAQEBAQCAgQCBgQEBAQEBAQEBAYEBAQDAgMDAgQGBgICBAQDBAYEAgIEBQUEAwYGAgQCBAQEBAQEBAYEBAQEAgICAgQEBAQEBAQEBAQEBAQEBAQEBAcEBAQEAgICAgQEBAQEBAUEBAQEBAQCBAQEBAQADAsGAgQHBQsFAgMDBQUCBQIFBQIFBQUFBQQFBQICAwUDBQYEBQUFBAQFBQICBAQHBQUFBQUFBAUEBwQFBAMFAwQFAwUFBQUFBQUFAgIFAgcFBQUFBAUEBQQHBAUEBAIEBAIEBgcCAgQEBAQHBQICBQUFBAMGBgIFAwUEBAQEBAQHBAQEBAICAgIFBQUFBQUFBQUFBQUFBQUFBQUIBQUFBQICAgIFBQUFBQUFBQUFBQUFAgUFBQUFAA0MBwIEBwUMBQIDAwUFAgUCBQUCBQUFBQUEBQUCAgMFAwUHBQUFBQUFBQUCAgUFBwUFBQUFBQUFBQcFBQUDBQMEBQMFBQUFBQUFBQICBQIHBQUFBQUFBQUFBwUFBQQCBAQCBAcHAgIEBAQFCAUCAgUGBgUDBwcCBQMFBQUFBQUFBwUFBQUCAgICBQUFBQUFBQUFBQUFBQUFBQUFCAUFBQUCAgICBQUFBQUFBQUFBQUFBQIFBQUFBQAODQcCBQgFDQUCBAQFBQIGAgYFAgUFBQUFBAUFAgIEBgQFBwUFBQUFBQUFAgIFBQgFBQUFBQUFBQUIBQUFBAYEBAYDBQUFBQUFBQUCAgUCCAUFBQUFBQUFBQgFBQUEAgQEAgUHCAICBQUEBQgFAgIFBgYFAwcHAgUDBQUFBQUFBQgFBQUFAgICAgUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFAgICAgUFBQUFBQYFBQUFBQUCBQUFBQUADw4IAwUIBg4GAwQEBgYDBgMGBgMGBgYGBgUGBgMDBAYEBggGBgYGBQUGBgMDBQUIBgYGBgYGBQYGCAYGBQQGBAQGAwYGBgYGBgYGAwMGAwgGBgYGBQYFBgYIBgYFBQMFBAMFCAkDAwUFBAUJBgMDBgcHBgQICAMGAwYGBgYGBgYJBQUFBQMDAwMGBgYGBgYGBgYGBgYGBgYGBgYJBgYGBgMDAwMGBgYGBgYGBgYGBgYGAwYGBgYGABAPCAMFCQYPBgMEBAYGAwcDBgYDBgYGBgYFBgYDAwQHBAYIBgYGBgYGBgYDAwYGCQYGBgYGBgYGBgkGBgYEBgQFBwQGBgYGBgYGBgMDBgMJBgYGBgYGBgYGCQYGBgUDBQUDBQgJAwMFBQUGCQYDAwYHBwYECAgDBgQGBgYGBgYGCQYGBgYDAwMDBgYGBgYGBgYGBgYGBgYGBgYGCgYGBgYDAwMDBgYGBgYGBwYGBgYGBgMGBgYGBgAREAkDBgoGEAYDBAQGBwMHAwcGAwYGBgYGBQYGAwMEBwQGCQYGBgYGBgYGAwMGBgoGBgYGBgYGBgYKBgYGBAcEBQcEBgYGBgYGBgYDAwYDCgYGBgYGBgYGBgoGBgYFAwUFAwYJCgMDBgYFBgoGAwMGCAgGBAkJAwcEBgYGBgYGBgoGBgYGAwMDAwYGBgYGBgYGBgYGBgYGBgYGBgsGBgYGAwMDAwYGBgYGBgcGBgYGBgYDBgYHBgYAEhEJAwYKBxEHAwUFBwcDCAMHBwMHBwcHBwYHBwMDBQgFBwkHBwcHBwYHBwMDBgcKBwcHBwcHBgcHCgcHBgUHBQUIBAcHBwcHBwcHAwMHAwoHBwcHBgcGBwcKBwcGBgMGBQMGCQoDAwYGBQYLBwMDBwgIBwQJCQMHBAcHBwcHBwcKBwcHBwMDAwMHBwcHBwcHBwcHBwcHBwcHBwcLBwcHBwMDAwMHBwcHBwcIBwcHBwcHAwcHBwcHABMSCgMGCwcSBwMFBQcHAwgDCAcDBwcHBwcGBwcDAwUIBQcKBwcHBwcHBwcDAwcHCwcHBwcHBwcHBwsHBwcFCAUGCAQHBwcHBwcHBwMDBwMLBwcHBwcHBwcHCwcHBwYDBgYDBgoLAwMGBgYHCwcDAwcJCQcECgoDBwQHBwcHBwcHCwcHBwcDAwMDBwcHBwcHBwcHBwcHBwcHBwcHDAcHBwcDAwMDBwcHBwcHCAcHBwcHBwMHBwcHBwAUEwoDBwsIEwgDBQUICAMIAwgIAwgICAgIBggIAwMFCAUICgcICAgHBwgIAwMHBwsICAgICAgHCAcLBwgHBQgFBggFCAgICAgICAgDAwgDCwgICAgHCAcIBwsHCAcGAwYGAwcKCwMDBwcGBwwIAwMICQkHBQoKAwgFCAcHBwcHBwsHBwcHAwMDAwgICAgICAgICAgICAgICAgICA0ICAgIAwMDAwgICAgICAgICAgICAgDCAgICAgAFRQLBAcMCBQIBAUFCAgECQQICAQICAgICAcICAQEBQkFCAsICAgICAcICAQEBwgMCAgICAgICAgIDAgIBwUIBQYJBQgICAgICAgIBAQIBAwICAgIBwgICAgMCAgHBwQHBgQHCwwEBAcHBggMCAQECAkKCAULCwQIBQgICAgICAgMCAgICAQEBAQICAgICAgICAgICAgICAgICAgNCAgICAQEBAQICAgICAgJCAgICAgIBAgICAgIABYVCwQHDAgVCAQGBggJBAkECQgECAgICAgHCAgEBAYJBggLCAgICAgICAgEBAgIDAgICAgICAgICAwICAgGCQYGCQUICAgICAgICAQECAQMCAgICAgICAgIDAgI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AAEECQACAA4BjgADAAEECQADAE4BnAADAAEECQAEABgB6gADAAEECQAFAF4CAgADAAEECQAGABYCYAADAAEECQAHAHICdkNvcHlyaWdodCAoYykgU2h5Rm9udHMgVHlwZSBGb3VuZHJ5LCAxOTk5LiBBbGwgcmlnaHRzIHJlc2VydmVkLlNGIElyb25zaWRlc1JlZ3VsYXJTaHlGb250c1R5cGVGb3VuZHJ5OiBTRiBJcm9uc2lkZXM6IDE5OTlTRiBJcm9uc2lkZXN2ZXIgMS4wOyAxOTk5LiBGcmVld2FyZSBmb3Igbm9uLWNvbW1lcmNpYWwgdXNlLlNGSXJvbnNpZGVzU0YgSXJvbnNpZGVzIGlzIGEgdHJhZGVtYXJrIG9mIHRoZSBTaHlGb250cyBUeXBlIEZvdW5kcnkuAEMAbwBwAHkAcgBpAGcAaAB0ACAAKABjACkAIABTAGgAeQBGAG8AbgB0AHMAIABUAHkAcABlACAARgBvAHUAbgBkAHIAeQAsACAAMQA5ADkAOQAuACAAQQBsAGwAIAByAGkAZwBoAHQAcwAgAHIAZQBzAGUAcgB2AGUAZAAuAFMARgAgAEkAcgBvAG4AcwBpAGQAZQBzAFIAZQBnAHUAbABhAHIAUwBoAHkARgBvAG4AdABzAFQAeQBwAGUARgBvAHUAbgBkAHIAeQA6ACAAUwBGACAASQByAG8AbgBzAGkAZABlAHMAOgAgADEAOQA5ADkAUwBGACAASQByAG8AbgBzAGkAZABlAHMAdgBlAHIAIAAxAC4AMAA7ACAAMQA5ADkAOQAuACAARgByAGUAZQB3AGEAcgBlACAAZgBvAHIAIABuAG8AbgAtAGMAbwBtAG0AZQByAGMAaQBhAGwAIAB1AHMAZQAuAFMARgBJAHIAbwBuAHMAaQBkAGUAcwBTAEYAIABJAHIAbwBuAHMAaQBkAGUAcwAgAGkAcwAgAGEAIAB0AHIAYQBkAGUAbQBhAHIAawAgAG8AZgAgAHQAaABlACAAUwBoAHkARgBvAG4AdABzACAAVAB5AHAAZQAgAEYAbwB1AG4AZAByAHkALgAAAAIAAAAAAAD/ewAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAtQAAAAQABQAGAAcACAAJAAoACwAMAA0ADgAPABAAEQASABMAFAAVABYAFwAYABkAGgAbABwAHQAeAB8AIAAhACIAIwAkACUAJgAnACgAKQAqACsALAAtAC4ALwAwADEAMgAzADQANQA2ADcAOAA5ADoAOwA8AD0APgA/AEAAQQBCAEMARABFAEYARwBIAEkASgBLAEwATQBOAE8AUABRAFIAUwBUAFUAVgBXAFgAWQBaAFsAXABdAF4AXwBgAGEAxADFAKsAsAC2ALcAtAC1ANkAjACxALsArACjAIQAhQC9AJYAjgCLAIoAgwCTAI0AogCtAMkAxwCuAGIAYwCQAMsAZQDIAMoAzwDMAM0AzgBmANMA0ADRAK8AZwCRANYA1ADVAGgAiQBqAGkAawBtAGwAbgCgAHEAcAByAHMAdQB0AHYAdwB4AHoAeQB7AH0AfAC4AKEAfwB+AIAAgQC6AAMA5ADlAPAA6wDsuAAAK7oAAAAEAAcr']];
    list.forEach(([name, b64]) => {
      try {
        const bin = atob(b64), u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        new FontFace(name, u.buffer).load().then((f) => document.fonts.add(f)).catch(() => {});
      } catch (e) { /* police par défaut */ }
    });
  })();

  /* ======================================================================
   *  OUTILS
   * ==================================================================== */
  const norm = (s) => (s || '').toString().trim().toLowerCase();
  const stripAccents = (s) => norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const todayFR = () => new Date().toLocaleDateString('fr-FR');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const load = (k, d) => { try { const v = GM_getValue(k); return v === undefined ? d : JSON.parse(v); } catch (e) { return d; } };
  const save = (k, v) => GM_setValue(k, JSON.stringify(v));

  /* ======================================================================
   *  ÉTAT
   * ==================================================================== */
  let sheetUrl = GM_getValue('sheetUrl2', DEFAULT_SHEET_URL);
  let lastSync = 0;
  let sheetData = load('sheetData', {});         // { pseudo: {matricule, regiment, dead, date} }
  let overrides = load('overrides', {});         // corrections manuelles
  let counts = load('counts_' + TOPIC_ID, { pages: {} });  // { pages: { n: {final, c:{pseudo:n}} } }
  if (counts.v !== 2) counts = { pages: {}, v: 2 };        // nouvelle version du cache (messages par jour)
  let totals = {};                               // { pseudo: total }
  let dismissed = load('dismissed', {});         // suggestions de défaite ignorées { msgId: true }
  let detectOn = GM_getValue('detectOn', true);  // détection semi-automatique ON/OFF
  let wallMode = GM_getValue('wallMode', 'beach');   // 'beach' | 'list'
  let view = '';                      // vue ouverte dans le panneau : '', 'rank', 'charts', 'wall', 'final'
  let chartKind = 'elim', chartCum = false, finalPreview = false;
  let rankTab = 'member', rankOnlyMembers = true;
  let profiles = load('profiles', { names: {}, avatars: {} });  // casse des pseudos + avatars
  let profDirty = false;
  let colMap = load('colMap', {});                 // colonnes du GDOC choisies à la main { matricule:'C', ... }
  let autoMat = GM_getValue('autoMat', true);      // numérotation auto si le GDOC n'a pas de colonne matricule
  const pooOn = true;                              // thème « chiottes » pour 2 forumeurs : toujours actif
  let kingOn = GM_getValue('kingOn', true);        // thème « Fondateur » pour Kaaido
  let opOn = GM_getValue('opOn', true);            // thème étendu de l'OP (Isssoufle)
  let settingsOpen = false;
  let clockOn = GM_getValue('clockOn', true);      // thème « horloges » pour Prolissou
  let footOn = GM_getValue('footOn', true);        // thème « pieds » pour Levodpa2
  let sheetReport = GM_getValue('sheetReport', '');
  let gdocInfo = '';
  let crawling = false;
  let crawlFailed = false;
  let crawlInfo = '';

  /* ======================================================================
   *  GDOC (Google Sheets → CSV)
   * ==================================================================== */
  function toCsvUrl(url) {
    url = url.trim();
    const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1];
    const pub = url.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9_-]+)/);       // lien « Publier sur le Web »
    if (pub) return `https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub?output=csv${gid ? '&gid=' + gid : ''}`;
    const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!m) return url;
    return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid || '0'}`;
  }
  const sheetUrls = () => (sheetUrl || '').split(/[\s|]+/).filter(Boolean);   // plusieurs onglets possibles
  const colIndex = (letters) => { let n = 0; for (const ch of String(letters).toUpperCase().replace(/[^A-Z]/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const colLetter = (i) => { let s = '', n = i + 1; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); rows.push(row); row = []; cur = '';
      } else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  function parseRegiment(v) {
    const s = stripAccents(v);
    const d = s.match(/[1-4]/);
    if (d) return +d[0];
    if (s.includes('jaune')) return 1;
    if (s.includes('vert')) return 2;
    if (s.includes('rouge')) return 3;
    if (s.includes('bleu')) return 4;
    return null;
  }

  const cleanCell = (v) => String(v == null ? '' : v).replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, '').trim();
  const FALSY = /^(false|faux|non|no|0|-|—|–|n\/a|\?+)$/i;
  const TRUTHY = /^(true|vrai|oui|yes|x|✓|✔|☑|☠|✝|1)$/i;

  // 12/11/2026, 12/11, 12-11-26, 2026-11-12, « 12 novembre (2026) » → JJ/MM/AAAA
  function parseDateCell(v) {
    const t = stripAccents(cleanCell(v));
    let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    m = t.match(/(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?/);
    if (m && +m[1] <= 31 && +m[2] <= 12) { let y = m[3] || '2026'; if (y.length === 2) y = '20' + y; return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${y}`; }
    m = t.match(/(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/);
    if (m && MONTHS_FR[m[2]]) return `${m[1].padStart(2, '0')}/${String(MONTHS_FR[m[2]]).padStart(2, '0')}/${m[3] || '2026'}`;
    return '';
  }

  function sheetToData(csv) {
    const rows = parseCSV(csv);
    const cfg = {
      pseudo: colMap.pseudo ? colIndex(colMap.pseudo) : 0,                       // A
      matricule: colMap.matricule ? colIndex(colMap.matricule) : 1,              // B
      regiment: colMap.regiment ? colIndex(colMap.regiment) : 9,                 // J
      buddy: colMap.buddy ? colIndex(colMap.buddy) : 8,                          // I (binôme)
      elim: colMap.elim ? colMap.elim.split('+').map(colIndex) : [5, 6, 7],      // F, G, H
    };
    const out = {}; let nDead = 0, nMat = 0, nReg = 0, nBud = 0; const unknownReg = new Set();
    for (const r of rows) {
      const name = cleanCell(r[cfg.pseudo]);
      if (!name || name.length > 40 || /^(pseudo|joueur|membre|participant|nom)$/i.test(name)) continue;
      const matricule = cleanCell(r[cfg.matricule]);
      if (!matricule && !cleanCell(r[cfg.regiment])) {
        // ligne sans matricule ni régiment : on ne garde que si elle ressemble à un pseudo seul
        if (/\s{2,}|[.!?]{2,}/.test(name)) continue;
      }
      // ---- élimination (colonnes F, G, H) ----
      const cells = cfg.elim.map((i) => cleanCell(r[i]));
      const filled = cells.filter((c) => c && !FALSY.test(c));
      const explicitFalse = !!cells[0] && FALSY.test(cells[0]);
      let date = '', cause = '', boolTrue = false, link = '';
      cells.forEach((c) => {
        if (!c || FALSY.test(c)) return;
        if (/^https?:\/\/\S+$/i.test(c)) { if (!link) link = c; return; }
        if (TRUTHY.test(c)) { boolTrue = true; return; }
        const d = parseDateCell(c);
        if (d && !date) { date = d; if (c.replace(/[\d\/.\-\s]/g, '').length < 4) return; }
        if (!cause && c.length > 1) cause = c.slice(0, 200);
      });
      const dead = boolTrue || !!date || !!link || (filled.length > 0 && !explicitFalse);
      if (dead) nDead++;
      const reg = parseRegiment(r[cfg.regiment]);
      if (reg) nReg++; else if (cleanCell(r[cfg.regiment])) unknownReg.add(cleanCell(r[cfg.regiment]).slice(0, 25));
      if (matricule) nMat++;
      let buddy = cleanCell(r[cfg.buddy]).replace(/^@+/, '').trim();
      if (!buddy || buddy.length > 40 || FALSY.test(buddy) || TRUTHY.test(buddy) || /^https?:/i.test(buddy) || norm(buddy) === norm(name)) buddy = '';
      if (buddy) nBud++;
      out[norm(name)] = { name, matricule, autoMat: false, regiment: reg, dead, date: dead ? date : '', cause: dead ? cause : '', link: dead ? link : '', buddy: norm(buddy), buddyName: buddy };
    }
    const n = Object.keys(out).length;
    const report = `Colonnes → pseudo : ${colLetter(cfg.pseudo)} · matricule : ${colLetter(cfg.matricule)} · élimination : ${cfg.elim.map(colLetter).join('+')} · régiment : ${colLetter(cfg.regiment)}\n` +
      `${n} membres lus · ${nMat} matricules · ${nReg} régiments reconnus · ${nDead} tombés` + (nBud ? ` · ${nBud} binômes (colonne ${colLetter(cfg.buddy)})` : '') +
      (unknownReg.size ? `\nValeurs de régiment non reconnues (colonne ${colLetter(cfg.regiment)}) : ${[...unknownReg].slice(0, 4).join(' | ')}` : '');
    return { data: out, report };
  }

  function fetchCsv(url) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET', url: toCsvUrl(url) + (toCsvUrl(url).includes('?') ? '&' : '?') + '_=' + Date.now(), headers: { 'Cache-Control': 'no-cache' },
        onload: (res) => {
          if (res.status !== 200 || /<html/i.test(res.responseText.slice(0, 200))) resolve({ ok: false, err: 'HTTP ' + res.status + ' (GDOC non public ?)' });
          else resolve({ ok: true, csv: res.responseText });
        },
        onerror: () => resolve({ ok: false, err: 'injoignable' }),
      });
    });
  }

  function refreshSheet(force) {
    const urls = sheetUrls();
    if (!urls.length) return Promise.resolve();
    const last = GM_getValue('sheetFetchedAt', 0);
    if (!force && Date.now() - last < SHEET_REFRESH_MS && Object.keys(sheetData).length) return Promise.resolve();
    return Promise.all(urls.map(fetchCsv)).then((results) => {
      const merged = {}, reports = [], errs = [];
      results.forEach((r, i) => {
        if (!r.ok) { errs.push(r.err); return; }
        const { data, report } = sheetToData(r.csv);
        Object.assign(merged, data);
        reports.push((urls.length > 1 ? 'Feuille ' + (i + 1) + ' : ' : '') + report);
      });
      if (reports.length) {
        sheetData = merged; save('sheetData', sheetData);
        sheetReport = reports.join('\n'); GM_setValue('sheetReport', sheetReport);
        GM_setValue('sheetFetchedAt', Date.now());
        lastSync = Date.now();
      }
      gdocInfo = errs.length ? '⚠ GDOC : ' + errs[0] : '';
      if (errs.length) console.warn('[NNN] GDOC :', errs);
    });
  }

  /* ======================================================================
   *  DONNÉES FUSIONNÉES (GDOC + corrections manuelles)
   * ==================================================================== */
  function infoFor(pseudo) {
    const k = norm(pseudo);
    const base = sheetData[k] || {};
    const ov = overrides[k] || {};
    const merged = {
      matricule: ov.matricule !== undefined && ov.matricule !== '' ? ov.matricule : (base.matricule || ''),
      regiment: ov.regiment ? ov.regiment : (base.regiment || null),
      dead: ov.dead !== undefined ? ov.dead : !!base.dead,
      date: ov.date !== undefined && ov.date !== '' ? ov.date : (base.date || ''),
      autoMat: !!base.autoMat && !(ov.matricule),
      cause: base.cause || '',
      link: base.link || '',
      buddy: base.buddy || '',
      buddyName: base.buddyName || '',
      manual: !!overrides[k],
    };
    return merged;
  }

  const disp = (p) => profiles.names[p] || (sheetData[p] && sheetData[p].name) || p;

  function avatarUrl(root) {
    const img = root.querySelector('img.avatar__image, img.user-avatar-msg, .jvchat-avatar img, img[class*="avatar"]');
    if (!img) return '';
    const u = img.getAttribute('data-src') || img.getAttribute('src') || '';
    if (!u || u.startsWith('data:')) return '';
    try { return new URL(u, location.href).href; } catch (e) { return u; }
  }
  function noteProfile(key, name, avatar) {
    if (name && profiles.names[key] !== name) { profiles.names[key] = name; profDirty = true; }
    if (avatar && profiles.avatars[key] !== avatar) { profiles.avatars[key] = avatar; profDirty = true; }
    if (profDirty && !noteProfile.t) noteProfile.t = setTimeout(() => { noteProfile.t = null; profDirty = false; save('profiles', profiles); }, 2500);
  }

  /* ======================================================================
   *  COMPTEUR DE MESSAGES (crawl des pages du topic)
   * ==================================================================== */
  const URL_RE = /\/forums\/(\d+)-(\d+)-(\d+)-(\d+)-(\d+)-(\d+)-(\d+)-(.+)\.htm/;
  function pageUrl(n) {
    const m = location.pathname.match(URL_RE);
    if (!m) return null;
    return `${location.origin}/forums/${m[1]}-${m[2]}-${m[3]}-${n}-${m[5]}-${m[6]}-${m[7]}-${m[8]}.htm`;
  }
  const pageOfUrl = (u) => { const m = (u || '').match(URL_RE); return m ? +m[4] : null; };

  const MONTHS_FR = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
  function dateFromText(t) {
    const m = stripAccents(t || '').match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if (m && MONTHS_FR[m[2]]) return `${m[1].padStart(2, '0')}/${String(MONTHS_FR[m[2]]).padStart(2, '0')}/${m[3]}`;
    return '';
  }

  let dateIdx = {};   // { idMessage: 'JJ/MM/AAAA' } (alimenté par le comptage)
  let dayAgg = {};    // { 'JJ/MM/AAAA': { pseudo: nbMessages } }
  function recomputeTotals() {
    const t = {}, d = {}, da = {};
    for (const p of Object.values(counts.pages)) {
      for (const [a, n] of Object.entries(p.c)) t[a] = (t[a] || 0) + n;
      if (p.d) Object.assign(d, p.d);
      if (p.dd) for (const [dk, auth] of Object.entries(p.dd)) {
        const slot = da[dk] || (da[dk] = {});
        for (const [a, n] of Object.entries(auth)) slot[a] = (slot[a] || 0) + n;
      }
    }
    totals = t; dateIdx = d; dayAgg = da;
  }

  // Lit les messages d'une page téléchargée (nouveau design JV, sinon ancien)
  function readMessages(doc) {
    let nodes = [...doc.querySelectorAll('.messageUser')].filter((m) => m.querySelector('.messageUser__label'));
    if (nodes.length) {
      return nodes.map((m) => ({
        author: norm((m.querySelector('.messageUser__label') || {}).textContent),
        name: ((m.querySelector('.messageUser__label') || {}).textContent || '').trim(),
        avatar: avatarUrl(m),
        id: (m.id || '').split('-').pop(),
        date: dateFromText((m.querySelector('.messageUser__date') || {}).textContent),
      }));
    }
    nodes = [...doc.querySelectorAll('.bloc-message-forum')].filter((m) => !m.closest('.blockquote-jv'));
    return nodes.map((m) => ({
      author: norm((m.querySelector('.bloc-pseudo-msg') || {}).textContent),
      name: ((m.querySelector('.bloc-pseudo-msg') || {}).textContent || '').trim(),
      avatar: avatarUrl(m),
      id: m.getAttribute('data-id') || '',
      date: dateFromText((m.querySelector('.bloc-date-msg') || {}).textContent),
    }));
  }

  function parseResult(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const msgs = readMessages(doc);
    if (!msgs.length) return null;
    const c = {}, d = {}, dd = {}, names = {}, avatars = {};
    msgs.forEach((m) => {
      if (m.author) { names[m.author] = m.name; if (m.avatar) avatars[m.author] = m.avatar; c[m.author] = (c[m.author] || 0) + 1; }
      if (m.id && m.date) d[m.id] = m.date;
      if (m.author && m.date) { const slot = dd[m.date] || (dd[m.date] = {}); slot[m.author] = (slot[m.author] || 0) + 1; }
    });
    return { c, d, dd, names, avatars, firstId: msgs[0].id || '' };
  }

  let nextAllowed = 0;    // pause globale quand le site ralentit (HTTP 429/403/5xx)
  async function fetchPage(n) {
    const w = nextAllowed - Date.now();
    if (w > 0) await sleep(w);
    let res;
    try { res = await fetch(pageUrl(n), { credentials: 'include' }); } catch (e) { return { ok: false, retry: true, status: 0 }; }
    if (res.status === 429 || res.status === 403 || res.status >= 500) { nextAllowed = Date.now() + 3000; return { ok: false, retry: true, status: res.status }; }
    if (!res.ok) return { ok: false, retry: false, status: res.status };
    const rp = pageOfUrl(res.url);
    if (rp !== null && rp !== n) return { ok: false, retry: false, missing: true };   // redirigé : la page n'existe pas
    const html = await res.text();
    const data = parseResult(html);
    if (!data) return { ok: false, retry: false, status: 200, empty: true, sample: html.slice(0, 160) };
    return { ok: true, data };
  }

  // Dernière page du topic : JV redirige une page hors-limites vers la dernière → 1 seule requête.
  async function findLastPage() {
    try {
      const res = await fetch(pageUrl(99999), { credentials: 'include' });
      const lp = pageOfUrl(res.url);
      if (res.ok && lp && lp > 1 && lp < 99999) return lp;
    } catch (e) { /* on bascule sur la recherche */ }
    const exists = async (n) => {
      for (let a = 0; a < 4; a++) {
        const f = await fetchPage(n);
        if (f.ok) return true;
        if (!f.retry) { if (f.empty) console.warn('[NNN] page', n, 'illisible :', f.sample); return false; }
        await sleep(700 * (a + 1));
      }
      return false;
    };
    if (!(await exists(1))) return 0;
    let lo = 1, hi = 2;
    while (hi <= 200000 && (await exists(hi))) { lo = hi; hi *= 2; }
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (await exists(mid)) lo = mid; else hi = mid; }
    return lo;
  }

  let uiTimer = null, lastSave = 0;
  const scheduleUi = () => { if (!uiTimer) uiTimer = setTimeout(() => { uiTimer = null; recomputeTotals(); refreshAll(); }, 800); };

  async function crawl() {
    if (crawling || !pageUrl(1)) return;
    crawling = true;
    try {
      const last = await findLastPage();
      if (!last) { crawlFailed = true; crawlInfo = '⚠ comptage impossible (page 1 illisible — voir la console F12)'; return; }
      crawlFailed = false;
      Object.keys(counts.pages).forEach((k) => { if (+k > last) delete counts.pages[k]; });   // topic raccourci
      const todo = [];
      for (let n = 1; n <= last; n++) { const p = counts.pages[n]; if (!p || !p.final) todo.push(n); }
      const total = todo.length;
      let idx = 0, done = 0, fails = 0;
      const conc = Math.max(1, Math.min(8, +GM_getValue('conc', 3) || 3));
      const worker = async () => {
        for (;;) {
          const i = idx++;
          if (i >= todo.length) return;
          const n = todo[i];
          let data = null;
          for (let a = 0; a < 5; a++) {
            const f = await fetchPage(n);
            if (f.ok) { data = f.data; break; }
            if (!f.retry) { if (f.empty) console.warn('[NNN] page', n, 'illisible :', f.sample); break; }
            await sleep(600 * (a + 1) + Math.random() * 400);
          }
          if (data) {
            counts.pages[n] = { c: data.c, d: data.d, dd: data.dd, firstId: data.firstId, final: n < last };
            Object.assign(profiles.names, data.names); Object.assign(profiles.avatars, data.avatars);
          } else fails++;
          done++;
          crawlInfo = total > 3 ? `Comptage : ${done}/${total} pages` : '';
          if (Date.now() - lastSave > 3000) { lastSave = Date.now(); save('counts_' + TOPIC_ID, counts); save('profiles', profiles); }
          scheduleUi();
        }
      };
      await Promise.all(Array.from({ length: Math.min(conc, Math.max(1, total)) }, worker));
      // on garde les dates seulement pour les 40 dernières pages (économie de stockage)
      Object.keys(counts.pages).forEach((k) => { if (+k < last - 40 && counts.pages[k].d) delete counts.pages[k].d; });
      save('counts_' + TOPIC_ID, counts); save('profiles', profiles);
      if (fails && fails === total) { crawlFailed = true; crawlInfo = '⚠ comptage bloqué par le site (HTTP) — réessaie plus tard ou baisse la vitesse'; }
      else if (fails) crawlInfo = `⚠ ${fails} page(s) non lues, nouvel essai au prochain passage`;
    } catch (e) { console.warn('[NNN] crawl :', e); crawlInfo = '⚠ erreur de comptage'; }
    crawling = false;
    if (!crawlFailed && !/^⚠/.test(crawlInfo)) crawlInfo = '';
    recomputeTotals(); refreshAll();
  }

  /* ======================================================================
   *  STYLE
   * ==================================================================== */
  const css = `
  /* =============== EN-TÊTE DE MESSAGE =============== */
  .nnn-line{display:inline-flex;align-items:center;flex-wrap:wrap;gap:6px;vertical-align:middle}
  .nnn-orig{display:none!important}
  .nnn-line .nnn-clone{display:inline-block}
  .nnn-mat{position:relative;font:800 11px/1 ${F_UI};letter-spacing:1.5px;padding:4px 8px 3px 17px;border-radius:3px 10px 10px 3px;
    background:repeating-linear-gradient(90deg,rgba(255,255,255,.1) 0,rgba(255,255,255,.1) 1px,transparent 1px,transparent 3px),linear-gradient(#ececec,#a4a4a4 50%,#7a7a7a);color:#1c1c1c;border:1px solid #444;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.8),inset 0 -1px 0 rgba(0,0,0,.25),0 2px 3px rgba(0,0,0,.5);white-space:nowrap;text-shadow:0 1px 0 rgba(255,255,255,.55)}
  .nnn-mat::before{content:"";position:absolute;left:5px;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:radial-gradient(#111,#3a3a3a);box-shadow:inset 0 1px 2px #000,0 1px 0 rgba(255,255,255,.6)}
  .nnn-crown{font-size:17px;line-height:1;filter:drop-shadow(0 0 4px rgba(255,200,0,.9));animation:nnn-bob 2.6s ease-in-out infinite}
  @keyframes nnn-bob{50%{transform:translateY(-2px) rotate(-7deg)}}
  .nnn-op{font:800 11px/1 ${F_UI};letter-spacing:2px;padding:4px 8px 3px;border-radius:5px;background:linear-gradient(135deg,#8a6508,#ffd700 45%,#fff2a0 55%,#8a6508);color:#3b2a00;border:1px solid #6b4d00;box-shadow:0 0 10px rgba(255,200,0,.7),inset 0 1px 0 rgba(255,255,255,.7)}
  .nnn-logo{width:24px;height:24px;border-radius:50%;display:inline-block;vertical-align:middle;box-shadow:0 0 0 2px rgba(0,0,0,.45),0 2px 5px rgba(0,0,0,.5)}
  .nnn-count{font:800 11px/1 ${F_UI};padding:4px 8px 3px;border-radius:9px;background:linear-gradient(rgba(255,255,255,.25),rgba(0,0,0,.18)),url("${WOOD}");background-size:auto,260px;color:#fff0cf;text-shadow:0 1px 0 #000;border:1px solid #2a1808;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 1px 3px rgba(0,0,0,.5);white-space:nowrap}
  .nnn-dead{font:800 11px/1 ${F_UI};padding:4px 9px 3px;border-radius:4px;background:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.6)),url("${WOOD_DARK}");background-size:auto,260px;color:#e8d8b4;border:1px solid #7a4b24;box-shadow:inset 0 0 10px rgba(255,110,30,.35);white-space:nowrap;letter-spacing:.4px}
  .nnn-edit{cursor:pointer;opacity:.35;font-size:12px;border:0;background:none;padding:0 2px;color:inherit}
  .nnn-edit:hover{opacity:1}
  .nnn-pseudo-reg{text-shadow:0 0 1px rgba(0,0,0,.9),0 0 3px rgba(0,0,0,.5);font-weight:800}
  .nnn-gold{background:linear-gradient(90deg,#b8860b,#ffd700,#fff4a8,#ffd700,#b8860b);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent!important;font-weight:900;animation:nnn-shine 4s linear infinite;filter:drop-shadow(0 0 3px rgba(255,200,0,.55))}
  .nnn-gold *{-webkit-text-fill-color:transparent}
  @keyframes nnn-shine{to{background-position:200% 0}}
  .nnn-torch{width:26px;height:26px;display:inline-block;vertical-align:middle}

  /* =============== MESSAGE : bande de régiment =============== */
  [data-nnn-reg]{border-color:var(--nnn-c)!important;box-shadow:inset 0 0 0 1px var(--nnn-c),0 0 12px color-mix(in srgb,var(--nnn-c) 28%,transparent)}
  .nnn-is-op{box-shadow:inset 0 0 0 1px rgba(255,215,0,.6);border-color:rgba(255,215,0,.6)!important}
  .nnn-is-op[data-nnn-reg]{box-shadow:inset 0 0 0 1px rgba(255,215,0,.75),inset 0 0 0 3px color-mix(in srgb,var(--nnn-c) 60%,transparent),0 0 14px rgba(255,200,0,.25)}
  .nnn-is-dead,.nnn-is-dead[data-nnn-reg]{border-color:rgba(130,130,130,.55)!important;box-shadow:inset 0 0 0 1px rgba(130,130,130,.55)}
  .nnn-is-dead .nnn-clone{filter:grayscale(1);opacity:.55}
  .nnn-is-dead .nnn-mat{filter:grayscale(1) brightness(.7)}
  .nnn-is-dead .messageUser__msg,.nnn-is-dead .txt-msg,.nnn-is-dead .jvchat-content{filter:grayscale(.75);opacity:.68;transition:opacity .2s}
  .nnn-is-dead:hover .messageUser__msg,.nnn-is-dead:hover .txt-msg,.nnn-is-dead:hover .jvchat-content{opacity:.95}
  .nnn-is-dead .nnn-logo:not(.nnn-torch){filter:grayscale(1);opacity:.55}
  .nnn-is-dead .user-avatar-msg,.nnn-is-dead .avatar,.nnn-is-dead .avatar__image,.nnn-is-dead .jvchat-avatar,.nnn-is-dead .jvchat-bloc-avatar{filter:grayscale(1) contrast(1.05);opacity:.6}

  /* =============== CITATIONS / MENTIONS =============== */
  .nnn-minilogo{width:16px;height:16px;border-radius:50%;margin-right:3px;vertical-align:-3px;box-shadow:0 0 0 1px rgba(0,0,0,.4);object-fit:contain}
  .nnn-tag-dead{filter:grayscale(1);opacity:.55}
  .nnn-mention,.nnn-qp{white-space:nowrap}

  /* =============== SUGGESTION DE DÉFAITE =============== */
  .nnn-suggest{cursor:pointer;font:800 11px/1 ${F_UI};letter-spacing:.8px;padding:5px 10px 4px;border-radius:5px;border:1px solid #6a2306;background:linear-gradient(#ffb347,#e0601c 55%,#b83e0c);color:#fff;text-shadow:0 1px 0 #6a2306;box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 0 0 0 rgba(255,140,40,.6);animation:nnn-pulse 2.2s infinite}
  .nnn-suggest:hover{filter:brightness(1.12)}
  @keyframes nnn-pulse{70%{box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 0 0 8px rgba(255,140,40,0)}100%{box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 0 0 0 rgba(255,140,40,0)}}
  .nnn-suggest-x{cursor:pointer;font:700 11px/1 sans-serif;padding:4px 6px;border-radius:5px;border:0;background:rgba(128,128,128,.3);color:inherit}

  /* =============== FENÊTRE DE CORRECTION =============== */
  .nnn-pop{position:absolute;z-index:99999;background:radial-gradient(ellipse at 50% 40%,transparent 55%,rgba(0,0,0,.5)),url("${WOOD}");background-size:auto,300px;color:#f6e7c8;border:3px solid #1a0f06;border-radius:10px;padding:13px;width:252px;font:13px 'Trebuchet MS',sans-serif;box-shadow:inset 0 0 0 2px rgba(255,220,150,.14),0 10px 28px rgba(0,0,0,.65)}
  .nnn-pop b{font:800 17px ${F_UI};letter-spacing:1.5px;color:#ffd34d;text-shadow:0 2px 0 #000}
  .nnn-pop label{display:block;margin:8px 0 2px;font:800 10px ${F_UI};letter-spacing:1.5px;text-transform:uppercase;color:#f0cf8a}
  .nnn-pop input,.nnn-pop select{width:100%;box-sizing:border-box;padding:6px;border-radius:5px;border:1px solid #3a2410;background:url("${PAPER}");background-size:260px;color:#3a2410;font:800 13px ${F_UI};box-shadow:inset 0 1px 3px rgba(0,0,0,.35)}
  .nnn-pop .nnn-btns{display:flex;gap:6px;margin-top:13px}
  .nnn-pop button{flex:1;padding:7px 4px;border-radius:6px;border:2px solid #1a0f06;cursor:pointer;background:linear-gradient(rgba(255,255,255,.12),rgba(0,0,0,.28)),url("${WOOD}");background-size:auto,260px;color:#fff0cf;font:800 12px ${F_UI};text-shadow:0 1px 0 #000;box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 2px 0 #0e0803}
  .nnn-pop button.ok{background:linear-gradient(rgba(255,255,255,.14),rgba(0,0,0,.25)),linear-gradient(#5aa83a,#2f7a1d)}

  /* =============== PANNEAU : panneau de bois de l'aventure =============== */
  #nnn-panel{position:relative;box-sizing:border-box;margin:18px 0 14px;padding:16px 16px 14px;border-radius:12px;color:#f6e7c8;font:13px/1.35 'Trebuchet MS',sans-serif;overflow:visible;
    background:radial-gradient(ellipse at 50% 135%,rgba(255,120,30,.3),transparent 62%),radial-gradient(ellipse at 50% 35%,transparent 50%,rgba(0,0,0,.6)),
      repeating-linear-gradient(180deg,transparent 0,transparent 92px,rgba(0,0,0,.6) 92px,rgba(0,0,0,.6) 95px,rgba(255,230,170,.1) 95px,rgba(255,230,170,.1) 96px),url("${WOOD}");
    background-size:auto,auto,auto,520px 260px;
    border:4px solid #1a0f06;box-shadow:inset 0 0 0 2px rgba(255,220,150,.14),inset 0 0 50px rgba(0,0,0,.55),0 8px 22px rgba(0,0,0,.55)}
  #nnn-panel::before{content:"";position:absolute;left:18px;right:18px;top:-11px;height:11px;border-radius:6px;
    background:linear-gradient(rgba(255,255,255,.4),transparent 45%,rgba(0,0,0,.4)),repeating-linear-gradient(58deg,#e6c98a 0,#e6c98a 4px,#a37a38 4px,#a37a38 7px,#654822 7px,#654822 9px);box-shadow:0 3px 4px rgba(0,0,0,.6)}
  #nnn-panel::after{content:none;
    background:url("${PALM_L}") left -8px bottom -10px/118px no-repeat,url("${PALM_R}") right -8px bottom -10px/118px no-repeat;opacity:.9}
  #nnn-panel>*{position:relative;z-index:1}
  #nnn-panel.nnn-side{font-size:12px;padding:12px}
  #nnn-panel .nnn-ph{position:relative;display:flex;align-items:center;justify-content:center;gap:14px;cursor:pointer;user-select:none}
  #nnn-panel .nnn-ft{width:44px;height:58px;filter:drop-shadow(0 0 8px rgba(255,140,30,.65))}
  #nnn-panel.nnn-side .nnn-ft{width:30px;height:40px}
  #nnn-panel .nnn-title{display:flex;flex-direction:column;align-items:center;text-align:center}
  #nnn-panel .nnn-title b{font:400 36px/1.05 'NNN Ironsides',${F_LOGO};letter-spacing:2px;
    background:linear-gradient(#fff3b0,#ffd34d 48%,#e0951a);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;
    filter:url(#nnn-rough) drop-shadow(1.5px 0 0 #140a03) drop-shadow(-1.5px 0 0 #140a03) drop-shadow(0 1.5px 0 #140a03) drop-shadow(0 -1.5px 0 #140a03) drop-shadow(0 4px 0 #6a2f00)}
  #nnn-panel.nnn-side .nnn-title b{font-size:24px}
  #nnn-panel .nnn-title span{font:800 13px/1 ${F_UI};letter-spacing:2px;color:#f0cf8a;margin-top:9px;text-shadow:0 2px 0 #000}
  #nnn-panel .nnn-days{margin:16px 8px 6px}
  #nnn-panel .nnn-dbar{position:relative;height:13px;border-radius:7px;background:repeating-linear-gradient(58deg,#4a3418 0,#4a3418 4px,#33230f 4px,#33230f 7px);border:1px solid #140a03;box-shadow:inset 0 2px 4px #000,0 1px 0 rgba(255,220,150,.2)}
  #nnn-panel .nnn-dbar::after{content:"";position:absolute;top:0;left:0;right:0;bottom:0;border-radius:7px;background:repeating-linear-gradient(90deg,transparent 0,transparent calc(100%/6 - 2px),rgba(0,0,0,.65) calc(100%/6 - 2px),rgba(0,0,0,.65) calc(100%/6));pointer-events:none}
  #nnn-panel .nnn-dbar i{position:absolute;left:0;top:0;bottom:0;border-radius:7px;background:linear-gradient(rgba(255,255,255,.4),transparent 45%,rgba(0,0,0,.3)),repeating-linear-gradient(58deg,#e6c98a 0,#e6c98a 4px,#a37a38 4px,#a37a38 7px,#654822 7px,#654822 9px)}
  #nnn-panel .nnn-dbar em{position:absolute;top:-24px;width:24px;height:40px;margin-left:-12px;background:url("${TORCH_LIT}") center/contain no-repeat;filter:drop-shadow(0 0 6px rgba(255,140,30,.8));z-index:2}
  #nnn-panel .nnn-dtxt{text-align:center;margin-top:9px;font:800 12px ${F_UI};letter-spacing:2px;text-transform:uppercase;color:#f0cf8a;text-shadow:0 2px 0 #000}
  #nnn-panel .nnn-score{display:flex;gap:12px;justify-content:center;margin:12px 0 10px}
  #nnn-panel .nnn-sc{flex:1;max-width:180px;text-align:center;padding:8px 10px 6px;border-radius:9px;border:3px solid #140a03;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),inset 0 -8px 14px rgba(0,0,0,.3),0 3px 0 #0e0803}
  #nnn-panel .nnn-sc b{display:block;font:400 40px/1 ${F_LOGO};text-shadow:0 2px 0 rgba(0,0,0,.6);font-variant-numeric:tabular-nums}
  #nnn-panel .nnn-sc span{font:400 13px ${F_LOGO};letter-spacing:2px;text-transform:uppercase;opacity:.95}
  #nnn-panel .nnn-sc.alive{background:linear-gradient(rgba(60,140,40,.78),rgba(20,70,15,.88)),url("${WOOD}");background-size:auto,300px;color:#eaffd8}
  #nnn-panel .nnn-sc.dead{background:linear-gradient(rgba(110,35,25,.8),rgba(40,12,8,.9)),url("${WOOD_DARK}");background-size:auto,300px;color:#ffe0d6}
  #nnn-panel .nnn-regs{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}
  #nnn-panel .nnn-reg{position:relative;display:flex;align-items:center;gap:9px;padding:8px 10px 8px 12px;border-radius:8px;border:2px solid #140a03;border-left:8px solid var(--c);
    background:linear-gradient(rgba(0,0,0,.28),rgba(0,0,0,.5)),url("${WOOD}");background-size:auto,300px;box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 3px 0 #0e0803}
  #nnn-panel .nnn-reg img{width:36px;height:36px;border-radius:50%;box-shadow:0 0 0 2px rgba(0,0,0,.55),0 2px 6px rgba(0,0,0,.6)}
  #nnn-panel .nnn-reg>div{flex:1;min-width:0}
  #nnn-panel .nnn-reg b{display:block;font:400 17px/1.1 ${F_LOGO};letter-spacing:1.5px;color:var(--c);text-shadow:0 2px 0 #000,0 0 1px #000}
  #nnn-panel .nnn-rb{height:9px;border-radius:5px;background:rgba(0,0,0,.6);margin:5px 0 4px;overflow:hidden;box-shadow:inset 0 1px 3px #000}
  #nnn-panel .nnn-rb i{display:block;height:100%;background:linear-gradient(rgba(255,255,255,.35),transparent 50%,rgba(0,0,0,.25)),var(--c);box-shadow:0 0 8px var(--c)}
  #nnn-panel .nnn-reg small{font:800 11px ${F_UI};opacity:.92}
  #nnn-panel .nnn-pbody{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:14px}
  #nnn-panel .nnn-warn{margin-top:10px;font-size:12px;color:#ffb347;text-align:center;text-shadow:0 1px 0 #000}
  #nnn-panel button{cursor:pointer;border:3px solid #140a03;border-radius:8px;padding:7px 14px 6px;
    background:linear-gradient(rgba(255,255,255,.14),rgba(0,0,0,.32)),url("${WOOD}");background-size:auto,300px;color:#fff0cf;font:800 13px ${F_UI};letter-spacing:1px;text-shadow:0 2px 0 #000;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 3px 0 #0e0803}
  #nnn-panel button:hover{filter:brightness(1.18)}
  #nnn-panel button:active{transform:translateY(2px);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 1px 0 #0e0803}
  #nnn-panel button.on{background:linear-gradient(rgba(255,255,255,.35),rgba(0,0,0,.2)),linear-gradient(#f0b440,#b5741b);color:#2a1808;text-shadow:0 1px 0 rgba(255,255,255,.5)}

  /* =============== CLASSEMENT : parchemin =============== */
  #nnn-panel .nnn-rank{margin-top:14px}
  #nnn-panel .nnn-tabs{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:10px;margin-bottom:10px}
  #nnn-panel .nnn-tabs label{font:800 11px ${F_UI};color:#f0cf8a}
  #nnn-panel .nnn-parch{background:url("${PAPER}");background-size:380px;color:#3a2410;border:4px solid #4a2c12;border-radius:7px 12px 8px 13px;padding:10px;box-shadow:inset 0 0 30px rgba(110,60,15,.55),inset 0 0 6px rgba(60,30,5,.6),0 4px 10px rgba(0,0,0,.5)}
  #nnn-panel .nnn-scroll{max-height:340px;overflow:auto;scrollbar-color:#8a5a2c rgba(0,0,0,.15)}
  #nnn-panel table{width:100%;border-collapse:collapse;font-size:12px}
  #nnn-panel .nnn-parch td,#nnn-panel .nnn-parch th{padding:5px 6px;text-align:left;border-bottom:1px dashed rgba(90,58,29,.4)}
  #nnn-panel .nnn-parch th{font:800 10px ${F_UI};letter-spacing:2px;text-transform:uppercase;color:#7a5428}
  #nnn-panel td.n,#nnn-panel th.n{text-align:right}
  #nnn-panel .nnn-parch td{font:800 13px ${F_UI}}
  #nnn-panel .nnn-parch td.n{font:800 16px ${F_UI};color:#6b3a10}
  #nnn-panel .nnn-parch small{font:800 10px ${F_UI};letter-spacing:1px;color:#6b4a24}
  #nnn-panel table img{width:16px;height:16px;vertical-align:middle;margin-right:4px;border-radius:50%}
  #nnn-panel table img.nnn-av,#nnn-panel .nnn-av{width:28px;height:28px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:7px;display:inline-block;border:3px double #8a5a2c;box-sizing:border-box;box-shadow:0 2px 4px rgba(0,0,0,.4)}
  #nnn-panel .nnn-av0{line-height:22px;text-align:center;font:800 13px ${F_UI};background:#c9ab70;color:#3a2410}
  #nnn-panel .nnn-bar{height:7px;border-radius:4px;background:rgba(90,58,29,.28);margin-top:4px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.35)}
  #nnn-panel .nnn-bar i{display:block;height:100%}
  #nnn-panel .nnn-foot{margin-top:8px;font:800 11px ${F_UI};opacity:.8;text-align:center}
  #nnn-panel .nnn-podium{display:flex;justify-content:center;align-items:flex-end;gap:10px;margin:2px 0 12px}
  #nnn-panel .pd{flex:1;max-width:124px;display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0}
  #nnn-panel .pd .av{width:48px;height:48px;border-radius:50%;border:4px double;overflow:hidden;background:#c9ab70;box-shadow:0 3px 8px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font:800 18px ${F_UI}}
  #nnn-panel .pd .av img{width:100%;height:100%;margin:0;border-radius:0;object-fit:cover}
  #nnn-panel .pd b{font:800 13px ${F_UI};margin-top:5px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #nnn-panel .pd small{font:800 10px ${F_UI}!important;opacity:.85}
  #nnn-panel .pd .blk{width:100%;margin-top:5px;border:3px solid #1a0f06;border-radius:6px 6px 0 0;background:linear-gradient(rgba(255,255,255,.12),rgba(0,0,0,.3)),url("${WOOD}");background-size:auto,260px;color:#ffe9b0;font:800 24px ${F_UI};text-shadow:0 2px 0 #000;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
  #nnn-panel .pd.p1 .blk{height:64px}#nnn-panel .pd.p2 .blk{height:46px}#nnn-panel .pd.p3 .blk{height:32px}

  /* =============== MUR DES DISPARUS =============== */


  #nnn-panel .nnn-gear{position:absolute;right:0;top:50%;margin-top:-16px;width:32px;height:32px;cursor:pointer;border:2px solid #0e0803;border-radius:8px;background:linear-gradient(#4a3322,#2a1d10);color:#e8c27a;font:400 17px/1 ${F_UI};padding:0;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 2px 0 #0a0502}
  #nnn-panel .nnn-gear.on,#nnn-panel .nnn-gear:hover{background:linear-gradient(#f3d27a,#b88a22);color:#1a0f06}
  #nnn-panel .nnn-set{margin:10px 0 4px;padding:10px 12px;border:3px solid #1a0f06;border-radius:8px;background:radial-gradient(ellipse at 50% 50%,transparent 50%,rgba(0,0,0,.45)),linear-gradient(rgba(0,0,0,.2),rgba(0,0,0,.32)),url("${WOOD}");background-size:auto,auto,300px 150px;box-shadow:inset 0 0 0 2px rgba(255,255,255,.07),0 3px 0 #0a0502;color:#f3e3c0}
  #nnn-panel .nnn-set h4{margin:0 0 8px;font:400 15px ${F_LOGO};letter-spacing:2px;color:#f0cf8a;text-align:center;text-shadow:0 2px 0 #000}
  #nnn-panel .nnn-set label{display:flex;align-items:center;gap:10px;padding:6px 8px;margin:4px 0;border-radius:6px;background:rgba(0,0,0,.35);cursor:pointer;font:700 12.5px ${F_UI}}
  #nnn-panel .nnn-set label small{display:block;font-weight:500;opacity:.65;font-size:11px}
  #nnn-panel .nnn-set input{width:18px;height:18px;accent-color:#e8c27a;flex:none}

  .nnn-bud{display:inline-flex;align-items:center;gap:3px;vertical-align:middle;font:700 11px/1 ${F_UI};opacity:.95;white-space:nowrap}
  .nnn-bud .nnn-av{border-radius:50%;object-fit:cover;border:2px solid #888;display:inline-flex;align-items:center;justify-content:center;background:#444;color:#fff;font-size:10px;flex:none;box-sizing:border-box;width:18px!important;height:18px!important;border-width:2px!important;margin:0!important}
  .nnn-bud b{font-weight:700;max-width:90px;overflow:hidden;text-overflow:ellipsis}
  .nnn-bud.dead .nnn-av{filter:grayscale(1) brightness(.7)}
  .nnn-bud.dead b{text-decoration:line-through;opacity:.7}
  .nnn-bud i{font-style:normal;font-size:10px}
  .nnn-bud-w{display:inline-flex;align-items:center;margin-left:6px;padding:1px 6px 1px 4px;border-radius:999px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.14)}
 .nnn-cel{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 30%,rgba(24,30,80,.93),rgba(3,5,18,.97) 70%);color:#fff;outline:0;animation:nnn-cel-in .8s ease both;overflow:auto}
  @keyframes nnn-cel-in{from{opacity:0}to{opacity:1}}
  .nnn-cel canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
  .nnn-cel .in{position:relative;z-index:1;max-width:900px;width:100%;margin:auto;padding:28px 18px;text-align:center;font-family:${F_UI}}
  .nnn-cel .logos{display:flex;justify-content:center;gap:14px;margin-bottom:14px}
  .nnn-cel .logos img{width:54px;height:54px;border-radius:50%;filter:drop-shadow(0 0 10px rgba(255,200,80,.6));animation:nnn-cel-pop .7s ease both}
  .nnn-cel .logos img:nth-child(2){animation-delay:.12s}.nnn-cel .logos img:nth-child(3){animation-delay:.24s}.nnn-cel .logos img:nth-child(4){animation-delay:.36s}
  @keyframes nnn-cel-pop{from{transform:scale(0) rotate(-90deg)}to{transform:none}}
  .nnn-cel h1{margin:0;font:400 clamp(26px,5.4vw,58px)/1.12 ${F_LOGO};letter-spacing:2px;text-shadow:0 3px 0 #000,0 0 28px rgba(255,190,60,.35);animation:nnn-cel-rise 1s .3s ease both}
  .nnn-cel h1 span{display:block;color:#fff}
  .nnn-cel h1 em{display:block;font-style:normal;margin-top:6px;font-size:1.28em;color:#ffd34d;text-shadow:0 3px 0 #7a4a08,0 0 26px rgba(255,190,60,.6)}
  @keyframes nnn-cel-rise{from{opacity:0;transform:translateY(24px) scale(.94)}to{opacity:1;transform:none}}
  .nnn-cel .sub{margin:16px 0 0;font:700 clamp(13px,2vw,17px) ${F_UI};letter-spacing:.5px;color:#f0cf8a;animation:nnn-cel-rise 1s .6s ease both}
  .nnn-cel .stats{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin:20px 0 6px;animation:nnn-cel-rise 1s .9s ease both}
  .nnn-cel .b{min-width:130px;padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.07);border:1px solid var(--c,rgba(255,255,255,.18));backdrop-filter:blur(4px)}
  .nnn-cel .b b{display:block;font:400 34px/1 ${F_LOGO};color:#ffd34d;text-shadow:0 2px 0 #000}
  .nnn-cel .b img{width:38px;height:38px;border-radius:50%;display:block;margin:0 auto 4px}
  .nnn-cel .b small{display:block;font:600 11px/1.3 ${F_UI};opacity:.85;margin-top:3px}
  .nnn-cel .bud{margin-top:12px;font:600 14px ${F_UI};color:#cfe6ff;animation:nnn-cel-rise 1s 1.1s ease both}
  .nnn-cel .btns{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:22px;animation:nnn-cel-rise 1s 1.2s ease both}
  .nnn-cel .btns button{cursor:pointer;border:2px solid rgba(255,255,255,.25);border-radius:10px;background:rgba(255,255,255,.09);color:#fff;padding:9px 16px;font:700 13px ${F_UI}}
  .nnn-cel .btns button:hover{background:rgba(255,255,255,.18)}
  .nnn-cel .btns .pri{background:linear-gradient(#ffe38a,#d9a02a);color:#2a1a04;border-color:#7a5210}
  .nnn-cel .pv{margin-top:14px;font:600 11px ${F_UI};opacity:.6}
  /* ---- Plage des éteints ---- */
  .nnn-wmode{display:flex;gap:6px;margin:10px 0 8px}
  .nnn-wmode button{flex:1;cursor:pointer;border:2px solid #0e0803;border-radius:8px;padding:6px;font:800 12px ${F_UI};background:#2a1d10;color:#e8c27a}
  .nnn-wmode button.on{background:#e8c27a;color:#1a0f06}
  .nnn-bch{--ui:${F_UI};position:relative;border:3px solid #0e0803;border-radius:10px;overflow:hidden;background:#05081a;color:#e9ecf8;font:500 12px var(--ui)}
  .nnn-bch.full{position:fixed;inset:0;z-index:2147483000;border-radius:0;border:0;display:flex;flex-direction:column}
  .nnn-bch .cvbox{position:relative;height:min(62vh,460px);min-height:300px;background:#05081a}
  .nnn-bch.full .cvbox{flex:1;height:auto}
  .nnn-bch canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:none;outline:none}
  .nnn-bch canvas.drag{cursor:grabbing}
  .nnn-bch .tip{position:absolute;z-index:3;display:flex;gap:8px;max-width:260px;padding:8px 10px;background:rgba(8,12,30,.94);border:1px solid var(--c,#555);border-radius:8px;pointer-events:none;box-shadow:0 6px 18px rgba(0,0,0,.6)}
  .nnn-bch .tip img,.nnn-bch .fh img{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid var(--c,#888);flex:none}
  .nnn-bch .m{opacity:.7;font-size:11px}
  .nnn-bch .hud{position:absolute;right:8px;top:8px;display:flex;gap:5px;z-index:2}
  .nnn-bch .hud button,.nnn-bch .goto button{cursor:pointer;border:1px solid rgba(255,255,255,.2);border-radius:7px;background:rgba(8,12,30,.8);color:#e9ecf8;padding:5px 9px;font:700 12px var(--ui)}
  .nnn-bch .goto{position:absolute;left:8px;top:8px;display:flex;flex-wrap:wrap;gap:5px;z-index:2;max-width:60%}
  .nnn-bch [hidden]{display:none!important}
  .nnn-bch .empty{position:absolute;inset:0;display:grid;place-items:center;font:800 15px var(--ui);color:#e8c27a;pointer-events:none;text-shadow:0 2px 0 #000}
  .nnn-bch .bar{display:flex;align-items:center;gap:8px;padding:7px 10px;background:#0a1030;border-top:1px solid rgba(255,255,255,.08);flex-wrap:wrap}
  .nnn-bch .bar input[type=range]{flex:1;min-width:120px}
  .nnn-bch .bar .play{cursor:pointer;border:0;border-radius:7px;background:#e8c27a;color:#1a0f06;padding:5px 10px;font:800 12px var(--ui)}
  .nnn-bch .day{font-weight:800;min-width:56px}
  .nnn-bch .chips{display:flex;gap:5px;flex-wrap:wrap;flex:1}
  .nnn-bch .chip{cursor:pointer;display:inline-flex;align-items:center;gap:5px;border:1px solid var(--c);border-radius:999px;background:transparent;color:#e9ecf8;padding:3px 9px;font:700 11px var(--ui)}
  .nnn-bch .chip i{width:9px;height:9px;border-radius:50%;background:var(--c)}
  .nnn-bch .chip[aria-pressed=false]{opacity:.35}
  .nnn-bch .q{background:#05081a;border:1px solid rgba(255,255,255,.2);border-radius:7px;color:#fff;padding:5px 8px;font:500 12px var(--ui);min-width:120px}
  .nnn-bch .fiche{padding:8px 12px;background:#070b22;min-height:44px}
  .nnn-bch .fh{display:flex;gap:10px;align-items:center}
  .nnn-bch .fiche a{color:#ffd34d}
  .nnn-bch-hint{opacity:.55}
  #nnn-panel .nnn-wall{margin-top:14px;position:relative;background:radial-gradient(ellipse at 50% 118%,rgba(255,110,30,.34),transparent 62%),radial-gradient(ellipse at 50% 40%,transparent 45%,rgba(0,0,0,.65)),url("${WOOD_DARK}");background-size:auto,auto,420px 210px;
    border:4px solid #0e0803;border-radius:10px;padding:14px;color:#f3e3c0;box-shadow:inset 0 0 44px rgba(0,0,0,.75),0 4px 10px rgba(0,0,0,.5)}
  #nnn-panel .nnn-wt-title{display:flex;align-items:center;justify-content:center;gap:14px;font:400 26px/1 ${F_LOGO};letter-spacing:4px}
  #nnn-panel .nnn-wt-title span{background:linear-gradient(#fff0c0,#f1c460 50%,#b87a1c);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;filter:url(#nnn-rough) drop-shadow(1.5px 0 0 #000) drop-shadow(-1.5px 0 0 #000) drop-shadow(0 1.5px 0 #000) drop-shadow(0 -1.5px 0 #000) drop-shadow(0 4px 0 #4a1f00)}
  #nnn-panel .nnn-wt-title img{width:40px;height:52px;animation:nnn-sway 3.6s ease-in-out infinite;transform-origin:50% 100%}
  #nnn-panel .nnn-wt-title img:last-child{animation-delay:-1.8s}
  @keyframes nnn-sway{50%{transform:rotate(4deg)}0%,100%{transform:rotate(-4deg)}}
  #nnn-panel .nnn-wt-sub{text-align:center;font:800 13px ${F_UI};opacity:.92;margin:8px 0 12px;color:#e8c27a;text-shadow:0 2px 0 #000}
  #nnn-panel .nnn-wt-regs{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-bottom:8px}
  #nnn-panel .nnn-wt-regs span{display:inline-flex;align-items:center;gap:5px;background:rgba(0,0,0,.5);border-radius:12px;padding:3px 10px;font:800 12px ${F_UI};border:1px solid rgba(255,255,255,.1)}
  #nnn-panel .nnn-wt-regs img{width:18px;height:18px;border-radius:50%}
  #nnn-panel .nnn-wd{text-align:center;font:800 11px/1 ${F_UI};letter-spacing:3px;color:#f0cf8a;margin:14px 0 6px;display:flex;align-items:center;gap:10px}
  #nnn-panel .nnn-wd::before,#nnn-panel .nnn-wd::after{content:"";flex:1;height:6px;border-radius:3px;background:repeating-linear-gradient(58deg,#c9a458 0,#c9a458 4px,#7a5a2a 4px,#7a5a2a 7px);opacity:.75;box-shadow:0 1px 2px #000}
  #nnn-panel .nnn-stele{position:relative;display:flex;align-items:center;gap:10px;margin:8px 0;padding:8px 16px;border:3px solid #1a0f06;border-radius:6px;
    background:radial-gradient(ellipse at 50% 50%,transparent 50%,rgba(0,0,0,.45)),linear-gradient(rgba(0,0,0,.18),rgba(0,0,0,.3)),url("${WOOD}");background-size:auto,auto,300px 150px;
    box-shadow:inset 0 0 0 2px rgba(255,255,255,.07),inset 0 -8px 12px rgba(0,0,0,.35),0 4px 0 #0a0502,0 6px 8px rgba(0,0,0,.5)}
  #nnn-panel .nnn-stele .nnn-av{width:36px!important;height:36px!important;flex:none;border-width:3px!important;filter:grayscale(.55) brightness(.85)}
  #nnn-panel .nnn-stele::before,#nnn-panel .nnn-stele::after{content:"";position:absolute;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#e8e8e8,#4a4a4a 70%);box-shadow:0 1px 1px #000}
  #nnn-panel .nnn-stele::before{left:4px}#nnn-panel .nnn-stele::after{right:4px}
  #nnn-panel .nnn-stele .num{font:800 13px ${F_UI};letter-spacing:1px;color:#2a1808;background:url("${PAPER}");background-size:200px;border-radius:4px;padding:4px 7px 3px;white-space:nowrap;border:1px solid #4a2c12;box-shadow:0 1px 2px rgba(0,0,0,.5)}
  #nnn-panel .nnn-stele img.t{width:30px;height:40px;margin:0;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6))}
  #nnn-panel .nnn-stele img.r{width:26px;height:26px;border-radius:50%;margin:0 0 0 auto;box-shadow:0 0 0 2px rgba(0,0,0,.5),0 2px 4px rgba(0,0,0,.5)}
  #nnn-panel .nnn-stele .nm{display:flex;flex-direction:column;min-width:0}
  #nnn-panel .nnn-stele .nm b{font:800 18px/1.1 ${F_UI};color:#fff0cf;text-shadow:0 2px 0 #000,0 0 6px rgba(0,0,0,.6);overflow:hidden;text-overflow:ellipsis}
  #nnn-panel .nnn-stele .nm small{font:800 10px ${F_UI};letter-spacing:1px;opacity:.9;margin-top:3px}
  #nnn-panel .nnn-stele .dt{font:800 12px ${F_UI};color:#2a1808;background:url("${PAPER}");background-size:200px;border-radius:4px;padding:4px 7px 3px;white-space:nowrap;border:1px solid #4a2c12;box-shadow:0 1px 2px rgba(0,0,0,.5);transform:rotate(-2deg)}
  #nnn-panel .nnn-wt-empty{text-align:center;padding:18px;font:800 14px ${F_UI};opacity:.9}

  /* =============== THÈME CHIOTTES : intérieur d'une cuvette blanche =============== */
  .nnn-poo-e{display:inline-block;font-size:18px;line-height:1;animation:nnn-wob 1.5s ease-in-out infinite}
  .nnn-poo-e:last-of-type{animation-delay:-.7s}
  @keyframes nnn-wob{0%,100%{transform:rotate(-12deg) translateY(0)}50%{transform:rotate(12deg) translateY(-2px)}}
  .nnn-poo-name{font-weight:900;text-shadow:0 0 6px rgba(130,160,20,.5)}
  .nnn-poo-plate{font:800 10px/1 ${F_UI};letter-spacing:.5px;padding:4px 7px;border-radius:4px;background:linear-gradient(#6a4010,#4a2b08);color:#f3e2b0;border:1px solid #3a2106;white-space:nowrap}
  .nnn-emoji{width:auto!important;height:auto!important;box-shadow:none!important;border-radius:0!important;font-size:14px;line-height:1}
  .nnn-poo-msg{position:relative!important;
    background:
      url("${DRIP}") repeat-x left top/80px 34px,
      radial-gradient(ellipse 90px 28px at 93% 90%,rgba(96,58,12,.5),transparent 72%),
      radial-gradient(ellipse 60px 20px at 5% 80%,rgba(90,66,12,.4),transparent 72%),
      linear-gradient(to bottom,transparent 87%,rgba(150,196,206,.5) 87%,rgba(104,150,150,.68) 100%),
      linear-gradient(to bottom,#c4cfcd 0,#f6faf9 14px,transparent 16px),
      radial-gradient(ellipse 130% 95% at 28% 0%,#ffffff 0%,#f2f6f5 52%,#dde6e4 100%) !important;
    background-size:80px 34px,auto,auto,auto,auto,auto !important;
    box-shadow:inset 0 0 70px rgba(110,128,125,.4),inset 16px 16px 34px rgba(255,255,255,.95),inset -10px -12px 30px rgba(150,165,162,.35) !important;
    border-color:#cdd6d4 !important}
  .nnn-poo-msg::before{content:"🪰";position:absolute;top:14px;right:18%;font-size:16px;pointer-events:none;z-index:3;animation:nnn-fly 4.2s linear infinite}
  .nnn-poo-msg::after{content:"🚽";position:absolute;right:12px;bottom:10px;font-size:30px;opacity:.9;pointer-events:none;z-index:0}
  @keyframes nnn-fly{0%{transform:translate(0,0) rotate(0)}15%{transform:translate(-40px,12px) rotate(-30deg)}30%{transform:translate(-90px,-4px) rotate(10deg)}50%{transform:translate(-30px,22px) rotate(40deg)}70%{transform:translate(40px,6px) rotate(-20deg)}85%{transform:translate(70px,-6px) rotate(20deg)}100%{transform:translate(0,0) rotate(0)}}
  .nnn-poo-msg *:not(.nnn-line):not(.nnn-line *){color:#1d1206!important}
  .nnn-poo-msg :is(.messageUser__msg,.txt-msg,.jvchat-content) a{color:#6b3a08!important;text-decoration:underline wavy #6b3a08!important}
  .nnn-poo-msg :is(.messageUser__date,.bloc-date-msg,.jvchat-date) a,.nnn-poo-msg a:is(.messageUser__date,.bloc-date-msg){text-decoration:none!important}
  .nnn-poo-msg blockquote{background:rgba(110,70,14,.1)!important;border-left:4px solid #8a5a1c!important}
  .nnn-poo-msg .messageUser__msg::after,.nnn-poo-msg .txt-msg::after{content:" 🧻 💩";font-size:15px}
  .nnn-poo-msg.nnn-is-dead .nnn-clone{filter:none;opacity:1}
  .nnn-poo-msg.nnn-is-dead .messageUser__msg,.nnn-poo-msg.nnn-is-dead .txt-msg,.nnn-poo-msg.nnn-is-dead .jvchat-content{filter:none;opacity:1}
  .nnn-poo-msg .nnn-mat{filter:sepia(1) saturate(1.5) hue-rotate(-12deg) brightness(.85)}
  .nnn-poo-msg .avatar__image,.nnn-poo-msg .user-avatar-msg,.nnn-poo-msg .jvchat-avatar,.nnn-poo-msg .jvchat-bloc-avatar{filter:sepia(.95) saturate(1.8) hue-rotate(-18deg) brightness(.85)}

  /* =============== LISIBILITÉ =============== */
  .nnn-mat{font:800 12px/1 ui-monospace,SFMono-Regular,Consolas,'Courier New',monospace!important;letter-spacing:.5px!important}
  .nnn-count,.nnn-dead,.nnn-op{font-size:12px!important;letter-spacing:.2px!important}
  .nnn-op{letter-spacing:1px!important}
  #nnn-panel{font-size:14px}
  #nnn-panel button{font-size:13px;letter-spacing:.3px;text-transform:none}
  #nnn-panel .nnn-dtxt{letter-spacing:.8px;font-size:13px}
  #nnn-panel .nnn-sc span{font-size:13px;letter-spacing:1px}
  #nnn-panel .nnn-reg b{font-size:17px;letter-spacing:1px}
  #nnn-panel .nnn-reg small{font-size:12px}
  #nnn-panel .nnn-parch td{font-size:14px;font-weight:700}
  #nnn-panel .nnn-parch td.n{font-size:16px;font-variant-numeric:tabular-nums}
  #nnn-panel .nnn-parch th{letter-spacing:1px;font-size:11px}
  #nnn-panel .nnn-stele .nm b{font-size:17px;letter-spacing:.2px}
  #nnn-panel .nnn-stele .num{font-size:13px;letter-spacing:0}
  #nnn-panel .nnn-stele .dt{font-size:12px;transform:none}
  #nnn-panel .nnn-wd{letter-spacing:1.5px;font-size:12px}
  #nnn-panel .nnn-sync{text-align:center;font-size:11px;opacity:.7;margin-top:8px}

  /* =============== AMBIANCE : palmes, braises, torches =============== */
  #nnn-panel>.nnn-palm{position:absolute;bottom:-10px;width:120px;height:120px;z-index:0;pointer-events:none;opacity:.92}
  #nnn-panel>.nnn-palm.l{left:-8px;transform-origin:12% 96%;animation:nnn-leafL 7s ease-in-out infinite alternate}
  #nnn-panel>.nnn-palm.r{right:-8px;transform-origin:88% 96%;animation:nnn-leafR 8.5s ease-in-out infinite alternate}
  @keyframes nnn-leafL{from{transform:rotate(-2.5deg)}to{transform:rotate(3deg)}}
  @keyframes nnn-leafR{from{transform:rotate(2.5deg)}to{transform:rotate(-3deg)}}
  #nnn-panel>.nnn-embers{position:absolute;left:0;right:0;top:0;height:120px;overflow:hidden;pointer-events:none;z-index:0;border-radius:10px 10px 0 0}
  .nnn-embers i{position:absolute;bottom:-8px;width:3px;height:3px;border-radius:50%;background:#ffb347;box-shadow:0 0 6px 2px rgba(255,140,30,.7);opacity:0;animation:nnn-ember linear infinite}
  @keyframes nnn-ember{0%{transform:translate(0,0) scale(1);opacity:0}12%{opacity:.95}100%{transform:translate(var(--dx),-110px) scale(.3);opacity:0}}
  #nnn-panel>.nnn-content{position:relative;z-index:1}
  #nnn-panel .nnn-ft{animation:nnn-glow 2.4s ease-in-out infinite alternate}
  @keyframes nnn-glow{from{filter:drop-shadow(0 0 5px rgba(255,140,30,.45))}to{filter:drop-shadow(0 0 13px rgba(255,170,40,.95))}}
  #nnn-panel .nnn-lead{position:absolute;top:-10px;right:12px;background:linear-gradient(#ffe27a,#d99a1c);color:#3a2410;font:800 11px/1 ${F_UI};padding:3px 9px;border-radius:10px;border:1px solid #6b4d00;box-shadow:0 2px 5px rgba(0,0,0,.55);animation:nnn-bob 2.6s ease-in-out infinite}
  #nnn-panel button.off{opacity:.55}
  #nnn-panel .nnn-pbody{gap:8px}

  /* =============== COURBES =============== */
  #nnn-panel .nnn-chart{width:100%;height:auto;display:block}
  #nnn-panel .nnn-chart text{font:700 11px ${F_UI};fill:#5a3a1d}
  #nnn-panel .nnn-chart .grid{stroke:rgba(90,58,29,.22);stroke-width:1}
  #nnn-panel .nnn-chart .axis{stroke:#5a3a1d;stroke-width:1.5}
  #nnn-panel .nnn-chart .today{stroke:#b3261e;stroke-width:1.5;stroke-dasharray:4 3}
  #nnn-panel .nnn-legend{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:2px 0 8px}
  #nnn-panel .nnn-legend span{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:12px;background:rgba(90,58,29,.14);font:800 12px ${F_UI};color:#3a2410}
  #nnn-panel .nnn-legend img{width:18px;height:18px;border-radius:50%;margin:0}
  #nnn-panel .nnn-facts{display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:center;margin-top:8px;font:700 12px ${F_UI};color:#4a2c12}

  /* =============== PODIUM FINAL =============== */
  #nnn-panel .nnn-final{margin-top:14px;position:relative;overflow:hidden;border:4px solid #0e0803;border-radius:10px;padding:16px 12px 14px;color:#f6e7c8;
    background:radial-gradient(ellipse at 50% 0%,rgba(255,210,90,.38),transparent 60%),radial-gradient(ellipse at 50% 40%,transparent 45%,rgba(0,0,0,.6)),url("${WOOD_DARK}");background-size:auto,auto,420px 210px;box-shadow:inset 0 0 44px rgba(0,0,0,.7),0 4px 10px rgba(0,0,0,.5)}
  #nnn-panel .nnn-final h3{margin:0;text-align:center;font:400 26px/1 ${F_LOGO};letter-spacing:3px;background:linear-gradient(#fff0c0,#f1c460 50%,#b87a1c);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 3px 0 #4a1f00)}
  #nnn-panel .nnn-final .fnote{text-align:center;font:700 12px ${F_UI};opacity:.85;margin:6px 0 10px}
  #nnn-panel .nnn-final .fw{text-align:center;margin:6px auto 14px;padding:10px 14px;max-width:340px;border-radius:10px;border:3px solid var(--c);background:rgba(0,0,0,.45);box-shadow:0 0 22px color-mix(in srgb,var(--c) 55%,transparent)}
  #nnn-panel .nnn-final .fw small{display:block;font:800 11px ${F_UI};letter-spacing:2px;text-transform:uppercase;color:#f0cf8a}
  #nnn-panel .nnn-final .fw b{display:block;font:800 26px/1.2 ${F_UI};color:var(--c);text-shadow:0 2px 0 #000,0 0 14px color-mix(in srgb,var(--c) 70%,transparent)}
  #nnn-panel .nnn-steps{display:flex;justify-content:center;align-items:flex-end;gap:10px}
  #nnn-panel .fp{flex:1;max-width:170px;display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0;position:relative}
  #nnn-panel .fp .crown{font-size:30px;line-height:1;animation:nnn-bob 2.4s ease-in-out infinite;filter:drop-shadow(0 0 8px rgba(255,200,0,.9))}
  #nnn-panel .fp img.fl{width:64px;height:64px;border-radius:50%;box-shadow:0 0 0 3px #140a03,0 0 18px color-mix(in srgb,var(--c) 70%,transparent)}
  #nnn-panel .fp.p1 img.fl{width:80px;height:80px;box-shadow:0 0 0 4px #ffd34d,0 0 26px rgba(255,200,60,.85)}
  #nnn-panel .fp b{font:800 14px ${F_UI};margin-top:6px;color:var(--c);text-shadow:0 2px 0 #000}
  #nnn-panel .fp small{font:700 12px ${F_UI};opacity:.92}
  #nnn-panel .fp .blk{width:100%;margin-top:6px;border:3px solid #140a03;border-top-color:var(--c);border-radius:7px 7px 0 0;background:linear-gradient(rgba(255,255,255,.12),rgba(0,0,0,.35)),url("${WOOD}");background-size:auto,260px;display:flex;align-items:center;justify-content:center;font:800 30px ${F_UI};color:#ffe9b0;text-shadow:0 2px 0 #000;box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
  #nnn-panel .nnn-final .f4{text-align:center;margin-top:10px;font:700 12px ${F_UI};opacity:.85}
  #nnn-panel .nnn-final .f4 img{width:16px;height:16px;border-radius:50%;vertical-align:middle;margin-right:4px}
  #nnn-panel .nnn-final h4{margin:14px 0 6px;text-align:center;font:800 12px ${F_UI};letter-spacing:2px;text-transform:uppercase;color:#f0cf8a}
  #nnn-panel .nnn-surv{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
  #nnn-panel .nnn-surv span{display:inline-flex;align-items:center;gap:5px;padding:2px 9px 2px 3px;border-radius:14px;background:rgba(0,0,0,.45);font:700 12px ${F_UI}}
  #nnn-panel .nnn-surv img,#nnn-panel .nnn-surv .nnn-av{width:22px;height:22px;margin:0;border-width:2px}
  #nnn-panel .nnn-titles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:12px}
  #nnn-panel .nnn-titles div{background:rgba(0,0,0,.4);border-radius:8px;padding:6px 8px;text-align:center;font:700 12px ${F_UI}}
  #nnn-panel .nnn-titles small{display:block;font:800 10px ${F_UI};letter-spacing:1.5px;text-transform:uppercase;color:#f0cf8a;margin-bottom:2px}
  #nnn-panel>.nnn-confetti{position:absolute;left:0;right:0;top:0;bottom:0;overflow:hidden;pointer-events:none;z-index:6;border-radius:10px}
  .nnn-confetti i{position:absolute;top:-14px;width:8px;height:14px;opacity:0;animation:nnn-fall linear 1 forwards}
  @keyframes nnn-fall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(560px) rotate(720deg);opacity:0}}


  /* =============== THÈME HORLOGES (Prolissou) =============== */
  .nnn-clock-ico{width:26px;height:26px;flex:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))}
  .nnn-clock-ico.big{width:34px;height:34px}
  .nnn-clock-name{font-weight:900;text-shadow:0 1px 0 #2a0d12,0 0 8px rgba(255,190,90,.55)}
  .nnn-clock-plate{font:800 10px/1 ${F_UI};letter-spacing:.8px;padding:4px 9px;border-radius:4px;background:linear-gradient(#e9c98a,#b8873f);color:#3a1208;border:1px solid #5a2a0c;white-space:nowrap;text-shadow:0 1px 0 rgba(255,255,255,.35);box-shadow:inset 0 0 0 1px rgba(255,235,190,.5)}
  .nnn-clock-msg{position:relative!important;
    background:
      url("${CLOCKS.c}") no-repeat right 100px bottom 10px/40px 40px,
      url("${CLOCKS.d}") no-repeat right 54px bottom -14px/68px 68px,
      url("${CLOCKS.c}") no-repeat right 256px bottom 6px/26px 26px,
      url("${CLOCKS.a}") no-repeat right 410px bottom 8px/44px 44px,
      url("${CLOCKS.c}") no-repeat right 548px bottom -6px/54px 54px,
      url("${CLOCKS.a}") no-repeat right 700px bottom 10px/28px 28px,
      url("${CLOCKS.c}") no-repeat right 150px bottom 50px/22px 22px,
      repeating-linear-gradient(90deg,rgba(0,0,0,.28) 0 2px,transparent 2px 46px),
      repeating-linear-gradient(90deg,rgba(255,200,120,.05) 0 7px,transparent 7px 23px),
      radial-gradient(ellipse 80% 160% at 0% 0%,rgba(255,170,70,.28),transparent 66%),
      linear-gradient(135deg,#3b2112,#4a2a17 55%,#2a160b) !important;
    border-color:#b8873f !important;
    box-shadow:inset 0 0 0 1px #8a1c2c,inset 0 0 44px rgba(0,0,0,.35),0 0 14px rgba(184,135,63,.35) !important}
  .nnn-clock-msg *:not(.nnn-line):not(.nnn-line *){color:#f6e7c8!important}
  .nnn-clock-msg :is(.messageUser__msg,.txt-msg,.jvchat-content) a{color:#ffcf7a!important;text-decoration:underline dotted #ffcf7a!important}
  .nnn-clock-msg :is(.messageUser__date,.bloc-date-msg,.jvchat-date) a,.nnn-clock-msg a:is(.messageUser__date,.bloc-date-msg){text-decoration:none!important}
  .nnn-clock-msg blockquote{background:rgba(255,255,255,.07)!important;border-left:4px solid #b8873f!important}
  .nnn-clock-msg .messageUser__msg::after,.nnn-clock-msg .txt-msg::after{content:" 🤠";font-size:15px}
  .nnn-clock-msg.nnn-is-dead .nnn-clone{filter:none;opacity:1}
  .nnn-clock-msg.nnn-is-dead .messageUser__msg,.nnn-clock-msg.nnn-is-dead .txt-msg,.nnn-clock-msg.nnn-is-dead .jvchat-content{filter:none;opacity:1}

  /* =============== THÈME PIEDS (Levodpa2) =============== */
  @keyframes nnn-wiggle{0%,100%{transform:rotate(var(--r,0deg))}50%{transform:rotate(calc(var(--r,0deg) + 9deg))}}
  .nnn-foot-ico{width:auto;height:34px;object-fit:contain;--r:-10deg;transform-origin:50% 92%;animation:nnn-wiggle 2.6s ease-in-out infinite;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))}
  .nnn-foot-ico.g{--r:12deg;animation-delay:-1.2s}
  .nnn-foot-name{font-weight:900;text-shadow:0 0 8px rgba(255,105,180,.75)}
  .nnn-foot-plate{font:800 10px/1 ${F_UI};letter-spacing:.5px;padding:4px 8px;border-radius:12px;background:linear-gradient(#ff6fb0,#b3318a);color:#fff;border:1px solid #6e1c55;white-space:nowrap;text-shadow:0 1px 0 rgba(0,0,0,.4)}
  .nnn-foot-msg{position:relative!important;
    background:
      url("${PH.topG}") no-repeat left 10px bottom -34px/auto 132px,
      url("${PH.tile}") 0 0/260px 260px,
      radial-gradient(ellipse 70% 150% at 0% 0%,rgba(255,105,180,.34),transparent 66%),
      radial-gradient(ellipse 70% 150% at 100% 100%,rgba(120,220,100,.32),transparent 66%),
      linear-gradient(135deg,#2c1235,#3b1743 55%,#1c2a20) !important;
    border-color:#ff7ac0 !important;
    box-shadow:inset 0 0 0 1px #ff7ac0,inset 0 0 44px rgba(255,100,170,.14),0 0 18px rgba(255,105,180,.38) !important}
  .nnn-foot-msg::before,.nnn-foot-msg::after{content:"";position:absolute;pointer-events:none;z-index:0;background-repeat:no-repeat;background-position:center;background-size:contain;transform-origin:50% 92%;animation:nnn-wiggle 3.2s ease-in-out infinite}
  .nnn-foot-msg::before{right:118px;bottom:-16px;width:68px;height:124px;background-image:url("${PH.crossG}");--r:6deg;animation-name:nnn-sway}
  .nnn-foot-msg::after{right:4px;bottom:-12px;width:110px;height:122px;background-image:url("${PH.solesP}");--r:-3deg;animation-name:nnn-sway;animation-delay:-1.6s}
  @keyframes nnn-sway{0%,100%{transform:rotate(var(--r,0deg))}50%{transform:rotate(calc(var(--r,0deg) + 4deg))}}
  .nnn-foot-msg *:not(.nnn-line):not(.nnn-line *){color:#fbe9f5!important}
  .nnn-foot-msg :is(.messageUser__msg,.txt-msg,.jvchat-content) a{color:#ffb3dc!important;text-decoration:underline dotted #ffb3dc!important}
  .nnn-foot-msg :is(.messageUser__date,.bloc-date-msg,.jvchat-date) a,.nnn-foot-msg a:is(.messageUser__date,.bloc-date-msg){text-decoration:none!important}
  .nnn-foot-msg blockquote{background:rgba(255,255,255,.07)!important;border-left:4px solid #ff7ac0!important}
  .nnn-foot-msg .messageUser__msg::after,.nnn-foot-msg .txt-msg::after{content:" 🦶💚🦶";font-size:15px}
  .nnn-foot-msg.nnn-is-dead .nnn-clone{filter:none;opacity:1}
  .nnn-king-cam{height:46px;width:auto;border-radius:10px;filter:drop-shadow(0 0 3px rgba(230,195,92,.85)) drop-shadow(0 1px 3px rgba(0,0,0,.5))}
  .nnn-op-msg{padding-top:14px!important;
    background:
      linear-gradient(#f3d27a,#b88a22) no-repeat 0 0/100% 3px,
      radial-gradient(520px 150px at 50% 0,rgba(230,195,92,.16),transparent),
      linear-gradient(165deg,#1d1810,#15120c 55%,#241b0e) !important}
  .nnn-op-msg *:not(.nnn-line):not(.nnn-line *){color:#fff!important;text-shadow:0 1px 2px rgba(0,0,0,.85)}
  .nnn-op-msg :is(.messageUser__msg,.txt-msg,.jvchat-content) a{color:#ffd877!important}
  .nnn-op-msg blockquote{background:rgba(0,0,0,.35)!important;border-left:4px solid #e6c35c!important}
  .nnn-op-msg .nnn-gold{text-shadow:none!important;filter:drop-shadow(0 0 7px rgba(255,200,0,.55))!important;font-size:1.06em}
  .nnn-op-plate{font:800 10px/1 ${F_UI};letter-spacing:.9px;text-transform:uppercase;padding:4px 10px;border-radius:12px;background:linear-gradient(#f6dd8a,#b88a22);color:#2a1a04;border:1px solid #6b430b;white-space:nowrap;box-shadow:0 1px 0 rgba(255,255,255,.55) inset}
  .nnn-hof-op{gap:8px;padding:5px 8px 3px;background:linear-gradient(rgba(24,20,12,.95),rgba(12,10,6,.95))!important}
  .nnn-king-e{font-size:17px;color:#e6c35c;text-shadow:0 0 6px rgba(230,195,92,.7)}
  .nnn-king-name{font-weight:900;letter-spacing:.4px;text-shadow:0 1px 0 #3b0a14,0 0 9px rgba(230,195,92,.55)}
  .nnn-king-plate{font:800 10px/1 ${F_UI};letter-spacing:.9px;text-transform:uppercase;padding:4px 10px;border-radius:12px;background:linear-gradient(#f6dd8a,#b88a22);color:#3b0a14;border:1px solid #6b430b;white-space:nowrap;box-shadow:0 1px 0 rgba(255,255,255,.55) inset}
  .nnn-hof{flex:0 0 auto;display:flex;gap:6px;align-items:flex-end;padding:6px 12px 4px;border-radius:14px;background:linear-gradient(rgba(6,10,32,.95),rgba(3,6,20,.95));border:1px solid #b88a22;box-shadow:inset 0 0 10px rgba(230,195,92,.2),0 2px 6px rgba(0,0,0,.35);}
  .nnn-medal{width:40px;height:50px;display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.6));transition:transform .18s}
  .nnn-medal:hover{transform:translateY(-3px) scale(1.14)}
  .nnn-king-msg{position:relative!important;padding-top:20px!important;
    background:
      url("${KING_CAMEO}") no-repeat right 10px bottom 14px/92px auto,
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='16' viewBox='0 0 30 16'%3E%3Crect width='30' height='16' fill='%23f3efe3'/%3E%3Cg fill='%2315110d'%3E%3Cpath d='M15 2l1.6 4.6L15 12l-1.6-5.4z'/%3E%3Ccircle cx='11.4' cy='10.6' r='1.1'/%3E%3Ccircle cx='15' cy='13' r='1.1'/%3E%3Ccircle cx='18.6' cy='10.6' r='1.1'/%3E%3C/g%3E%3C/svg%3E") repeat-x 0 0/30px 16px,
      linear-gradient(#e6c35c,#b88a22) no-repeat 0 16px/100% 2px,
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='16' viewBox='0 0 30 16'%3E%3Crect width='30' height='16' fill='%23f3efe3'/%3E%3Cg fill='%2315110d'%3E%3Cpath d='M15 2l1.6 4.6L15 12l-1.6-5.4z'/%3E%3Ccircle cx='11.4' cy='10.6' r='1.1'/%3E%3Ccircle cx='15' cy='13' r='1.1'/%3E%3Ccircle cx='18.6' cy='10.6' r='1.1'/%3E%3C/g%3E%3C/svg%3E") repeat-x 0 100%/30px 16px,
      linear-gradient(#b88a22,#e6c35c) no-repeat 0 calc(100% - 16px)/100% 2px,
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='72' viewBox='0 0 64 72'%3E%3Cg fill='%23e6c35c' opacity='.13'%3E%3Cg id='f'%3E%3Cpath d='M16 6c3 5 5 9 0 17-5-8-3-12 0-17z'/%3E%3Cpath d='M13 20c-5-2-9 1-8 6 1 4 6 5 9 2-3-1-4-4-1-8zM19 20c5-2 9 1 8 6-1 4-6 5-9 2 3-1 4-4 1-8z'/%3E%3Crect x='9' y='26' width='14' height='3' rx='1'/%3E%3Cpath d='M12 30h8l1 5h-10z'/%3E%3C/g%3E%3Cuse href='%23f' x='32' y='36'/%3E%3C/g%3E%3C/svg%3E") 0 18px/64px 72px,
      radial-gradient(ellipse 90% 120% at 50% 0%,rgba(40,70,160,.45),transparent 70%),
      linear-gradient(160deg,#0a1130,#0f1c4d 50%,#060a20) !important;
    border-color:#d9b34a !important;
    box-shadow:inset 0 0 0 1px #e6c35c,inset 0 0 0 4px rgba(6,10,32,.8),inset 0 0 0 5px rgba(230,195,92,.55),0 0 18px rgba(230,195,92,.28) !important}
  .nnn-king-msg *:not(.nnn-line):not(.nnn-line *){color:#fff!important;text-shadow:0 1px 2px rgba(0,0,0,.85)}
  .nnn-king-msg :is(.messageUser__msg,.txt-msg,.jvchat-content) a{color:#ffd877!important;text-decoration:underline dotted #ffd877!important}
  .nnn-king-msg :is(.messageUser__date,.bloc-date-msg,.jvchat-date) a,.nnn-king-msg a:is(.messageUser__date,.bloc-date-msg){text-decoration:none!important}
  .nnn-king-msg blockquote{background:rgba(0,0,0,.35)!important;border-left:4px solid #e6c35c!important}
  .nnn-king-msg.nnn-is-dead .nnn-clone{filter:none;opacity:1}
  .nnn-king-msg.nnn-is-dead .messageUser__msg,.nnn-king-msg.nnn-is-dead .txt-msg,.nnn-king-msg.nnn-is-dead .jvchat-content{filter:none;opacity:1}
  .nnn-foot-msg.nnn-is-dead .messageUser__msg,.nnn-foot-msg.nnn-is-dead .txt-msg,.nnn-foot-msg.nnn-is-dead .jvchat-content{filter:none;opacity:1}
  `;
  document.body.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="nnG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b8"/><stop offset=".4" stop-color="#e2b23c"/><stop offset=".75" stop-color="#a8741a"/><stop offset="1" stop-color="#f0cf66"/></linearGradient><linearGradient id="nnParch" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9a066"/><stop offset="1" stop-color="#3b230f"/></linearGradient><linearGradient id="nnDenim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fb0ea"/><stop offset="1" stop-color="#17325e"/></linearGradient><linearGradient id="nnRed" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5a5a"/><stop offset="1" stop-color="#5a0b17"/></linearGradient><linearGradient id="nnBlue" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#58b6ff"/><stop offset="1" stop-color="#0b2a63"/></linearGradient><linearGradient id="nnNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2a6b"/><stop offset="1" stop-color="#0f1c33"/></linearGradient></defs><filter id="nnn-rough" x="-5%" y="-8%" width="110%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/></filter></svg>');
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ======================================================================
   *  PASTILLES DANS LES CITATIONS ET LES MENTIONS
   * ==================================================================== */
  const MSG_SEL = '.messageUser, .bloc-message-forum, .jvchat-message';
  // premier élément qui n'est pas l'un des nôtres
  const qOwn = (root, sel) => [...root.querySelectorAll(sel)].find((e) => !e.closest('.nnn-line')) || null;
  function parts(msg) {
    if (msg.classList.contains('jvchat-message')) {      // JVChat (ancien et nouveau)
      return {
        pseudoEl: qOwn(msg, '.jvchat-user, .jvchat-author'), body: qOwn(msg, '.jvchat-content, .txt-msg'),
        id: msg.getAttribute('jvchat-id') || msg.getAttribute('data-id'), dateEl: qOwn(msg, '.jvchat-date'),
      };
    }
    if (msg.classList.contains('messageUser')) {         // nouveau design JV
      return {
        pseudoEl: qOwn(msg, '.messageUser__label'), body: qOwn(msg, '.messageUser__msg'),
        id: (msg.id || '').split('-').pop(), dateEl: qOwn(msg, '.messageUser__date'),
      };
    }
    return {                                             // ancien design JV
      pseudoEl: qOwn(msg, '.bloc-pseudo-msg'), body: qOwn(msg, '.txt-msg'),
      id: msg.getAttribute('data-id'), dateEl: qOwn(msg, '.bloc-date-msg'),
    };
  }
  const isPoo = (p) => pooOn && POO_USERS.has(p);
  const isFoot = (p) => footOn && FOOT_USERS.has(p);
  const isKing = (p) => kingOn && KING_USERS.has(p);
  const isClock = (p) => clockOn && CLOCK_USERS.has(p);
  const fancy = (p) => (isClock(p) ? '⏱ ' + esc(disp(p)) + ' ⏱' : isPoo(p) ? '💩 ' + esc(disp(p)) + ' 💩' : isFoot(p) ? '🦶 ' + esc(disp(p)) + ' 🦶' : isKing(p) ? '⚜ ' + esc(disp(p)) : esc(disp(p)));
  const isKnown = (p) => !!(sheetData[p] || overrides[p]);

  function tagify(el, pseudo) {
    const info = infoFor(pseudo);
    const reg = info.regiment ? REGIMENTS[info.regiment] : null;
    const gold = pseudo === OP_PSEUDO;
    const poo = isPoo(pseudo), foot = isFoot(pseudo), king = isKing(pseudo), clk = isClock(pseudo);
    el.dataset.nnnP = pseudo;
    [...el.children].forEach((c) => { if (c.classList.contains('nnn-minilogo')) c.remove(); });
    if (poo || foot || king || clk || gold || reg) {
      el.style.setProperty('color', clk ? '#9a2234' : poo ? '#8a5a1c' : (foot ? '#e0529f' : (king ? '#a87d14' : (gold ? '#FFD700' : reg.color))), 'important');
      el.classList.add('nnn-pseudo-reg');
    } else {
      el.style.removeProperty('color');
      el.classList.remove('nnn-pseudo-reg');
    }
    if (poo || foot || king || clk) {
      const e = document.createElement('span');
      e.className = 'nnn-minilogo nnn-emoji'; e.textContent = clk ? '⏱️' : poo ? '💩' : (foot ? '🦶' : '⚜️');
      el.insertBefore(e, el.firstChild);
    } else if (reg || info.dead) {
      const img = document.createElement('img');
      img.className = 'nnn-minilogo';
      img.src = info.dead ? TORCH_OUT : reg.logo; img.alt = '';
      img.title = info.dead ? 'Torche éteinte' : reg.name;
      el.insertBefore(img, el.firstChild);
    }
    el.classList.toggle('nnn-tag-dead', !!info.dead);
  }

  function decorateQuotes(msg) {
    const body = parts(msg).body;
    if (!body) return;
    body.querySelectorAll('blockquote').forEach((bq) => {
      const done = bq.querySelector('.nnn-qp');
      if (done && done.closest('blockquote') === bq) { tagify(done, done.dataset.nnnP); return; }
      // textes d'en-tête de la citation (sans descendre dans les citations imbriquées)
      const w = document.createTreeWalker(bq, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement && n.parentElement.closest('blockquote') !== bq) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
      });
      const nodes = []; let full = '', n;
      while ((n = w.nextNode()) && full.length < 400) { nodes.push({ node: n, start: full.length }); full += n.data; }
      const m = full.match(/(\S+)\s+a écrit/i);
      if (!m) return;
      const pseudo = norm(m[1]);
      if (!isKnown(pseudo)) return;
      const start = m.index, end = start + m[1].length;
      const hit = nodes.find((x) => x.start <= start && end <= x.start + x.node.data.length);
      if (!hit) return;
      const off = start - hit.start;
      const mid = hit.node.splitText(off);
      mid.splitText(m[1].length);
      const sp = document.createElement('span');
      sp.className = 'nnn-qp';
      mid.parentNode.insertBefore(sp, mid);
      sp.appendChild(mid);
      tagify(sp, pseudo);
    });
  }

  function decorateMentions(msg) {
    const body = parts(msg).body;
    if (!body) return;
    // liens vers un profil
    body.querySelectorAll('a[href*="/profil/"]').forEach((a) => {
      const m = (a.getAttribute('href') || '').match(/\/profil\/([^/?#]+)/);
      if (!m) return;
      let p; try { p = norm(decodeURIComponent(m[1])); } catch (e) { return; }
      if (isKnown(p)) tagify(a, p);
    });
    // mentions « @pseudo » en texte brut
    const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && n.parentElement.closest('.nnn-mention,.nnn-qp,a,script,style'))
        ? NodeFilter.FILTER_REJECT
        : (n.data.includes('@') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    const nodes = []; let n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach((node) => {
      const re = /@([A-Za-z0-9_\-\[\]]{3,15})/g;
      let last = 0, m, frag = null;
      while ((m = re.exec(node.data))) {
        const p = norm(m[1]);
        if (!isKnown(p)) continue;
        frag = frag || document.createDocumentFragment();
        frag.appendChild(document.createTextNode(node.data.slice(last, m.index)));
        const sp = document.createElement('span');
        sp.className = 'nnn-mention';
        sp.textContent = m[0];
        tagify(sp, p);
        frag.appendChild(sp);
        last = m.index + m[0].length;
      }
      if (frag) { frag.appendChild(document.createTextNode(node.data.slice(last))); node.parentNode.replaceChild(frag, node); }
    });
  }

  /* ======================================================================
   *  DÉTECTION SEMI-AUTOMATIQUE DES DÉFAITES (suggestion uniquement)
   * ==================================================================== */
  const MONTHS = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
  function msgDate(msg) {
    const el = parts(msg).dateEl;
    const d = el && dateFromText(el.getAttribute('to-quote') || el.textContent);
    if (d) return d;
    const id = parts(msg).id;
    return (id && dateIdx[id]) || todayFR();
  }

  const STRONG = [/\bj ai pas tenu\b/, /\bj ai (fini|termine) par (craquer|nut)/];
  const DEFEAT = [
    /\bj ai (craque|nut|nute|fail|failed|cede|lache|rechute|echoue|jouis|ejacule)\b/,
    /\bj ai perdu\s*$/, /\bj ai perdu (le |au )?(no nut|nnn|defi|pari|koh)/,
    /\bje viens de (craquer|nut|nuter|fail|perdre|ceder|jouir|ejaculer)\b/,
    /\bje suis (tombe au combat|elimine|out)\b/,
    /\bje suis mort(?! de)\b/,
    /\bgame over pour moi\b/,
  ];
  const BLOCKERS = /\b(pas|jamais|plus|si|quand|sinon|peur|faut|faudrait|vais|vas|va|veux|pourrais|pourra|peut etre|jure|dis)\b/;

  function detectDefeat(msg, pseudo) {
    if (!detectOn) return null;
    const id = parts(msg).id;
    if (id && dismissed[id]) return null;
    if (sheetUrl && Object.keys(sheetData).length && !isKnown(pseudo)) return null; // participants seulement
    const body = parts(msg).body;
    if (!body) return null;
    const clone = body.cloneNode(true);
    clone.querySelectorAll('blockquote,.blockquote-jv,.nnn-gen,.nnn-line').forEach((e) => e.remove());
    const text = clone.textContent || '';
    for (const raw of text.split(/[.!\n]+/)) {
      if (raw.includes('?')) continue;
      const s = stripAccents(raw.replace(/['’`]/g, ' '));
      if (STRONG.some((r) => r.test(s))) return raw.trim().slice(0, 140);
      if (DEFEAT.some((r) => r.test(s)) && !BLOCKERS.test(s)) return raw.trim().slice(0, 140);
    }
    return null;
  }

  /* ======================================================================
   *  CLASSEMENTS
   * ==================================================================== */
  // binôme assigné (colonne I du GDOC) : petite photo + pseudo, avec la couleur de son régiment et ☠ s'il est tombé
  function buddyHtml(p, withName) {
    const b = infoFor(p).buddy; if (!b) return '';
    const bi = infoFor(b), br = bi.regiment ? REGIMENTS[bi.regiment] : null;
    const nm = (sheetData[b] && sheetData[b].name) || profiles.names[b] || infoFor(p).buddyName || b;
    return `<span class="nnn-bud${bi.dead ? ' dead' : ''}" title="Binôme de ${esc(disp(p))} : ${esc(nm)}${br ? ' (' + br.name + ')' : ''}${bi.dead ? ' — tombé au combat' : ''}">🤝${avatarHtml(b, br ? br.color : '')}${withName ? `<b>${esc(nm.length > 14 ? nm.slice(0, 13) + '…' : nm)}</b>` : ''}${bi.dead ? '<i>☠</i>' : ''}</span>`;
  }
  function avatarHtml(p, ring) {
    const st = ring ? ` style="border-color:${ring}"` : '';
    return profiles.avatars[p]
      ? `<img class="nnn-av" src="${esc(profiles.avatars[p])}" alt=""${st}>`
      : `<span class="nnn-av nnn-av0"${st}>${esc((disp(p)[0] || '?').toUpperCase())}</span>`;
  }

  function rankingHtml() {
    const names = new Set(Object.keys(totals));
    Object.keys(sheetData).forEach((k) => names.add(k));
    Object.keys(overrides).forEach((k) => names.add(k));
    let rows = [...names].map((p) => ({ p, n: totals[p] || 0, info: infoFor(p), known: isKnown(p) }));
    const medals = ['🥇', '🥈', '🥉'];
    const nameStyle = (r, reg) => isClock(r.p) ? 'color:#8a1c2c;font-weight:900' : isPoo(r.p) ? 'color:#7a4a12;font-weight:900' : isFoot(r.p) ? 'color:#c2338a;font-weight:900' : isKing(r.p) ? 'color:#a87d14;font-weight:900' : r.p === OP_PSEUDO ? 'color:#a8780a;font-weight:900;text-shadow:0 0 4px rgba(255,200,0,.5)' : (reg ? `color:${reg.color};font-weight:800;text-shadow:0 0 1px rgba(0,0,0,.75),0 0 2px rgba(0,0,0,.4)` : 'font-weight:700');
    let podium = '', body = '';
    if (rankTab === 'member') {
      if (rankOnlyMembers) rows = rows.filter((r) => r.known);
      rows.sort((a, b) => b.n - a.n);
      const top = rows.slice(0, 3);
      if (top.length === 3 && top[0].n > 0) {
        const rings = ['#ffd34d', '#d5dce2', '#cd7f32'];
        podium = '<div class="nnn-podium">' + [1, 0, 2].map((i) => {
          const r = top[i], reg = r.info.regiment ? REGIMENTS[r.info.regiment] : null;
          const av = profiles.avatars[r.p] ? `<img src="${esc(profiles.avatars[r.p])}" alt="">` : esc((disp(r.p)[0] || '?').toUpperCase());
          return `<div class="pd p${i + 1}" style="${r.info.dead ? 'filter:grayscale(1);opacity:.6' : ''}"><div class="av" style="border-color:${rings[i]}">${av}</div><b style="${nameStyle(r, reg)}">${fancy(r.p)}</b><small>${r.n} msgs</small><div class="blk">${i + 1}</div></div>`;
        }).join('') + '</div>';
      }
      body = `<table><tr><th>#</th><th>Membre</th><th class="n">Msgs</th></tr>` + rows.map((r, i) => {
        const reg = r.info.regiment ? REGIMENTS[r.info.regiment] : null;
        const dead = r.info.dead ? 'opacity:.5;filter:grayscale(1)' : '';
        const badge = r.info.dead ? `<img src="${TORCH_OUT}" title="Torche éteinte">` : (reg ? `<img src="${reg.logo}" title="${reg.name}">` : '');
        return `<tr style="${dead}"><td>${medals[i] || i + 1}</td><td>${avatarHtml(r.p, reg ? reg.color : '')}<span style="${nameStyle(r, reg)}">${fancy(r.p)}</span>${r.p === OP_PSEUDO ? ' 👑' : ''} ${badge}${r.info.matricule ? ` <small>#${esc(r.info.matricule)}</small>` : ''}${r.info.dead ? ' ☠' : ''} ${buddyHtml(r.p, false)}</td><td class="n">${r.n}</td></tr>`;
      }).join('') + '</table>';
    } else {
      const agg = [1, 2, 3, 4].map((i) => ({ i, members: 0, alive: 0, n: 0, top: null }));
      rows.forEach((r) => {
        const a = agg[(r.info.regiment || 0) - 1];
        if (!a) return;
        a.members++; if (!r.info.dead) a.alive++; a.n += r.n;
        if (!a.top || r.n > a.top.n) a.top = r;
      });
      agg.sort((a, b) => b.n - a.n);
      const max = Math.max(1, ...agg.map((a) => a.n));
      body = `<table><tr><th>#</th><th>Régiment</th><th class="n">Vivants</th><th class="n">Msgs</th><th class="n">Moy.</th></tr>` + agg.map((a, k) => {
        const reg = REGIMENTS[a.i];
        return `<tr><td>${medals[k] || k + 1}</td><td><img src="${reg.logo}"><b style="color:${reg.color};text-shadow:0 0 1px #000,0 0 2px rgba(0,0,0,.5)">${reg.name}</b>${a.top && a.top.n ? `<br><small>top : ${fancy(a.top.p)} (${a.top.n})</small>` : ''}<div class="nnn-bar"><i style="width:${(a.n / max * 100).toFixed(0)}%;background:${reg.color}"></i></div></td><td class="n">${a.alive}/${a.members}</td><td class="n">${a.n}</td><td class="n">${a.members ? (a.n / a.members).toFixed(1) : '–'}</td></tr>`;
      }).join('') + '</table>';
    }
    return `<div class="nnn-rank">
      <div class="nnn-tabs">
        <button class="${rankTab === 'member' ? 'on' : ''}" data-tab="member">Par membre</button>
        <button class="${rankTab === 'reg' ? 'on' : ''}" data-tab="reg">Par régiment</button>
        ${rankTab === 'member' ? `<label><input type="checkbox" id="nnn-only" ${rankOnlyMembers ? 'checked' : ''}> participants du GDOC</label>` : ''}
      </div>
      <div class="nnn-parch">${podium}<div class="nnn-scroll">${body}</div></div>
      <div class="nnn-foot">${crawling ? 'Comptage en cours… ' + esc(crawlInfo) : 'Comptage à jour'}</div></div>`;
  }

  /* ======================================================================
   *  LA PLAGE DES ÉTEINTS (remplace le mur : une torche plantée par disparu)
   * ==================================================================== */
  const Beach = (() => {
    const TAU = Math.PI * 2;
    const NONE = { id: 0, name: 'Sans régiment', c: '#9aa4b5' };
    const regList = () => [1, 2, 3, 4].map((i) => ({ id: i, name: REGIMENTS[i].name, c: REGIMENTS[i].color })).concat([NONE]);
    const regOf = (id) => regList().find((r) => r.id === id) || NONE;
    const FD = F_LOGO, FB = "system-ui,'Segoe UI',Roboto,Arial,sans-serif";
    const CW = 40, CH = 58, GAP = 90, ZPAD = 14;
    let stage = null, cv, ctx, tipEl, ficheEl, dayEl, dayLbl, playBtn, qEl, chipsEl, gotoEl, boxEl, emptyEl, fullBtn, lastHost = null, ro = null;
    let items = [], zones = [], world = { w: 100, h: 100 }, sorted = [], drawList = [], sig = '';
    const S = { day: 30, maxDay: 30, play: false, q: '', on: new Set([0, 1, 2, 3, 4]), sel: null, hover: null, full: false };
    const cam = { x: 0, y: 0, s: 1 }, tgt = { x: 0, y: 0, s: 1 };
    let baseS = 1, Dbase = 300, Eh = 100, camZ = 0, HY0 = 100;
    // zoom en perspective : chaque plan grossit moins vite que le premier plan, autour du point de fuite (centre de l'horizon)
    const lz = (e, fn, py) => { if (py === undefined) py = HY; const f = Math.pow(Math.max(.05, cam.s) / baseS, e); ctx.save(); ctx.translate(W / 2, py); ctx.scale(f, f); ctx.translate(-W / 2, -py); fn(); ctx.restore(); };
    let W = 0, H = 0, dpr = 1, HY = 0, stepPh = 0, bob = 0, speed = 0, prints = [], lastPrintX = 0, printSide = 1;
    let raf = 0, dirty = true, lastTs = 0, clockT = 0, walkDir = 0, ready = false;
    const keys = new Set();
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const imgCache = {}, fbCache = {};

    function curDay() { const n = new Date(); if (n < new Date(2026, 10, 1) || n >= new Date(2026, 11, 1)) return 30; return Math.max(1, n.getDate()); }
    function hash(str) { let h = 2166136261 >>> 0; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; }
    function tOf(p, d) {
      const m = (d || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/), jit = (hash(p) % 90) / 100 + .05;
      if (m && +m[2] === 11 && +m[3] === 2026) return Math.min(29.98, +m[1] - 1 + jit);
      return Math.max(.05, curDay() - 1 + jit);
    }

    /* ---------- avatars : photo du membre, sinon pastille à son initiale ---------- */
    function fallbackAv(it) {
      if (fbCache[it.p]) return fbCache[it.p];
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), h = hash(it.p) % 360;
      const gr = g.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, 'hsl(' + h + ',60%,48%)'); gr.addColorStop(1, 'hsl(' + ((h + 50) % 360) + ',55%,22%)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.fillStyle = '#fff'; g.font = '700 34px ' + FB; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText((it.name[0] || '?').toUpperCase(), 32, 35);
      return (fbCache[it.p] = c);
    }
    function imgFor(it) {
      if (!it.url) return null;
      let e = imgCache[it.url];
      if (!e) { e = imgCache[it.url] = new Image(); e.referrerPolicy = 'no-referrer'; e.onload = () => { dirty = true; }; e.src = it.url; }
      return e.complete && e.naturalWidth ? e : null;
    }
    const avSrc = (it) => imgFor(it) || fallbackAv(it);
    const avUrl = (it) => it.url || (it.fbu = it.fbu || fallbackAv(it).toDataURL());

    /* ---------- données ---------- */
    function layout() {
      zones = []; let x = 0, maxH = 0;
      for (const rg of regList()) {
        const its = sorted.filter((i) => i.g === rg.id); if (!its.length) continue;
        const cols = Math.max(3, Math.ceil(Math.sqrt(its.length * 1.7))), rows = Math.ceil(its.length / cols);
        its.forEach((it, k) => { it.x = x + (k % cols) * CW; it.y = Math.floor(k / cols) * CH; });
        zones.push({ rg, x, w: cols * CW, h: rows * CH, n: its.length, nf: 0 }); x += cols * CW + GAP; maxH = Math.max(maxH, rows * CH);
      }
      world = { w: Math.max(1, x - GAP), h: Math.max(CH, maxH) };
      Dbase = Math.max(250, world.h * .7); camZ = world.h - CH + 55 + 12;
      drawList = sorted.slice().sort((a, b) => a.y - b.y || a.x - b.x);
    }
    function update() {
      const names = new Set([...Object.keys(sheetData), ...Object.keys(overrides)]);
      const list = [...names].map((p) => ({ p, i: infoFor(p) })).filter((x) => x.i.dead);
      const s = list.map((x) => [x.p, x.i.date, x.i.regiment, profiles.avatars[x.p] || '', totals[x.p] || 0, x.i.link || '', x.i.cause || '', x.i.matricule || '', x.i.buddy || '', disp(x.p)].join('|')).join('~') + '#' + curDay();
      if (s === sig) return; sig = s;
      const prevMax = S.maxDay, newMax = curDay(); S.maxDay = newMax; if (S.day >= prevMax || S.day > newMax) S.day = newMax;
      items = list.map((x) => { const h = hash(x.p); return { p: x.p, name: disp(x.p), mat: x.i.matricule || '', g: x.i.regiment || 0, t: tOf(x.p, x.i.date), date: x.i.date || '', bud: x.i.buddy || '', c: x.i.cause || '', link: x.i.link || '', bud: x.i.buddy || '', m: totals[x.p] || 0, url: profiles.avatars[x.p] || '', phase: (h % 628) / 100, tilt: ((h >> 8) % 90 - 45) / 500, seed: h }; });
      sorted = items.slice().sort((a, b) => a.t - b.t || a.name.localeCompare(b.name));
      sorted.forEach((it, i) => { it.id = i; });
      if (sorted.length) { sorted[0].first = true; sorted[sorted.length - 1].lastFall = true; }
      layout();
      S.sel = S.sel ? (sorted.find((i) => i.p === S.sel.p) || null) : null;
      if (stage) { buildUi(); sync(); if (!ready && W) { home(false); ready = true; } }
      dirty = true;
    }

    /* ---------- caméra : on marche ---------- */
    /* Perspective : le sol est un plan. Chaque point (x, yb) du sable est projeté sous l'horizon, plus il est loin plus il est petit et proche de l'horizon. */
    const dOf = (yb) => Dbase + camZ - yb;
    const kAt = (yb) => { const d = dOf(yb); return d < 30 ? 0 : cam.s * Dbase / d; };
    const gy = (k) => HY + Eh * k + bob;
    const gx = (x, k) => W / 2 + (x - cam.x) * k;
    const gT = (Yg, k) => { ctx.translate(W / 2 - cam.x * k, gy(k) - Yg * k); ctx.scale(k, k); };
    // le mouvement vertical est une inclinaison de la caméra : l'horizon monte ou descend, le sable reste ancré dessous
    function limits() {
      const minX = -420, maxX = world.w + 300;
      const kF = tgt.s * Dbase / Math.max(30, dOf(world.h - CH + 55));
      const maxY = Math.max(0, HY0 - (H - 26 - Eh * kF));
      return { minX, maxX: Math.max(minX, maxX), minY: 0, maxY };
    }
    function clampT() { tgt.s = Math.max(.12, Math.min(4, tgt.s)); const l = limits(); tgt.x = Math.min(l.maxX, Math.max(l.minX, tgt.x)); tgt.y = Math.min(l.maxY, Math.max(l.minY, tgt.y)); }
    function resize() {
      if (!stage || !boxEl.clientWidth) return;
      dpr = Math.min(2, window.devicePixelRatio || 1); W = boxEl.clientWidth; H = boxEl.clientHeight; HY0 = H * .4; HY = HY0 - cam.y; Eh = (H - HY0) * .75;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    function home(all) {
      tgt.s = all ? Math.max(.12, Math.min(1.4, (W - 40) / (world.w + 560))) : (items.length > 250 ? .8 : 1.1);
      tgt.y = 0; tgt.x = all ? world.w / 2 : -300 + W * .36 / tgt.s; clampT();
      if (!all) baseS = tgt.s;
      cam.x = tgt.x; cam.y = tgt.y; cam.s = tgt.s; dirty = true;
    }
    function zoomAtPx(f, px, py) {
      const hyT = HY0 - tgt.y, below = py > hyT + 12, k0 = below ? Math.max(.05, (py - hyT) / Eh) : tgt.s;
      const wx = tgt.x + (px - W / 2) / k0, ns = Math.max(.12, Math.min(4, tgt.s * f)), f2 = ns / tgt.s;
      tgt.s = ns; tgt.x = wx - (px - W / 2) / (k0 * f2);
      if (below) tgt.y = HY0 - (py - (py - hyT) * f2);
      clampT();
    }
    const walkTo = (wx) => { tgt.x = wx; clampT(); };

    /* ---------- sprites ---------- */
    const mkC = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    function rngf(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    let glow, pool, sandPat, stars, clouds, flies, palms, rocks, tufts, milky, moonSpr, smokeP, torchSpr, palmSpr, cloudSpr;
    const islands = [[320, 60, 150], [980, 44, 120], [1700, 70, 190], [2400, 50, 140]];
    function wrapDraw(S, x, y, r, fn) { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { const X = x + dx, Y = y + dy; if (X > -r && X < S + r && Y > -r && Y < S + r) fn(X, Y); } }
    function makeSand() {
      const S = 512, c = mkC(S, S), g = c.getContext('2d'), r = rngf(5);
      const bg = g.createLinearGradient(0, 0, 0, S); bg.addColorStop(0, '#54464d'); bg.addColorStop(1, '#493c45'); g.fillStyle = bg; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 50; i++) { const x = r() * S, y = r() * S, rad = 30 + r() * 90, light = r() < .5; wrapDraw(S, x, y, rad, (X, Y) => { const gr = g.createRadialGradient(X, Y, 0, X, Y, rad); gr.addColorStop(0, light ? 'rgba(255,228,196,.075)' : 'rgba(8,4,16,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(X - rad, Y - rad, rad * 2, rad * 2); }); }
      for (let i = 0; i < 26; i++) {
        const y0 = r() * S, a = 2 + r() * 5, f1 = Math.round(1 + r() * 3) * TAU / S, ph = r() * 6, f2 = Math.round(4 + r() * 5) * TAU / S, b = r() * 1.6;
        for (const dy of [-S, 0, S]) {
          const path = (off) => { g.beginPath(); for (let x = 0; x <= S; x += 4) { const y = y0 + dy + off + Math.sin(x * f1 + ph) * a + Math.sin(x * f2 + ph * 2) * b; x ? g.lineTo(x, y) : g.moveTo(x, y); } };
          g.lineCap = 'round'; g.lineWidth = 2.6; g.strokeStyle = 'rgba(10,5,18,.24)'; path(2); g.stroke(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,238,216,.15)'; path(-.5); g.stroke();
        }
      }
      for (let i = 0; i < 9000; i++) { const q = r(), x = r() * S, y = r() * S, z = .5 + r() * 1.5; g.fillStyle = q < .4 ? 'rgba(255,238,216,' + (.05 + r() * .12) + ')' : q < .8 ? 'rgba(8,4,14,' + (.1 + r() * .16) + ')' : 'rgba(200,160,115,' + (.06 + r() * .1) + ')'; g.fillRect(x, y, z, z); }
      for (let i = 0; i < 34; i++) {
        const x = r() * S, y = r() * S, rx = 2 + r() * 4.5, ry = rx * (.55 + r() * .3), a = r() * 3, col = r() < .5 ? [88, 78, 82] : [112, 98, 92];
        wrapDraw(S, x, y, rx + 4, (X, Y) => {
          g.fillStyle = 'rgba(6,3,12,.35)'; g.beginPath(); g.ellipse(X + 1.2, Y + 1.6, rx + .8, ry + .5, a, 0, TAU); g.fill();
          const gr = g.createRadialGradient(X - rx * .35, Y - ry * .4, .3, X, Y, rx); gr.addColorStop(0, 'rgb(' + (col[0] + 60) + ',' + (col[1] + 54) + ',' + (col[2] + 52) + ')'); gr.addColorStop(1, 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')');
          g.fillStyle = gr; g.beginPath(); g.ellipse(X, Y, rx, ry, a, 0, TAU); g.fill();
        });
      }
      for (let i = 0; i < 16; i++) {
        const x = r() * S, y = r() * S, z = 2.4 + r() * 2.4, a = r() * TAU;
        wrapDraw(S, x, y, z + 4, (X, Y) => {
          g.save(); g.translate(X, Y); g.rotate(a); g.fillStyle = 'rgba(8,4,14,.3)'; g.beginPath(); g.ellipse(.9, 1.2, z, z * .8, 0, 0, TAU); g.fill();
          g.fillStyle = '#d9c8aa'; g.beginPath(); g.moveTo(0, z * .8); g.bezierCurveTo(-z * 1.1, z * .2, -z * .8, -z, 0, -z); g.bezierCurveTo(z * .8, -z, z * 1.1, z * .2, 0, z * .8); g.fill();
          g.strokeStyle = 'rgba(120,96,70,.7)'; g.lineWidth = .35; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(0, z * .75); g.lineTo(k * z * .38, -z * .9); g.stroke(); } g.restore();
        });
      }
      return c;
    }
    function makeMilky() {
      const w = 1400, h = 280, c = mkC(w, h), g = c.getContext('2d'), r = rngf(77);
      for (let i = 0; i < 160; i++) { const x = r() * w, y = h / 2 + (r() - .5) * h * .55 * (.4 + .6 * Math.sin(x / w * Math.PI)), rad = 30 + r() * 80, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(150,170,255,' + (.035 + r() * .04) + ')'); gr.addColorStop(1, 'rgba(150,170,255,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
      for (let i = 0; i < 70; i++) { const x = r() * w, y = h / 2 + (r() - .5) * h * .4, rad = 14 + r() * 40, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(4,6,18,' + (.12 + r() * .12) + ')'); gr.addColorStop(1, 'rgba(4,6,18,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
      for (let i = 0; i < 2600; i++) { const x = r() * w, y = h / 2 + (r() + r() - 1) * h * .3 * (.3 + .7 * Math.sin(x / w * Math.PI)); g.fillStyle = 'rgba(' + (200 + r() * 55 | 0) + ',' + (210 + r() * 45 | 0) + ',255,' + (.15 + r() * .55) + ')'; g.fillRect(x, y, r() < .1 ? 1.6 : 1, r() < .1 ? 1.6 : 1); }
      return c;
    }
    function makeMoon() {
      const c = mkC(140, 140), g = c.getContext('2d'), r = rngf(31), R = 60;
      const gr = g.createRadialGradient(62, 62, 6, 70, 70, R); gr.addColorStop(0, '#fffdf0'); gr.addColorStop(.7, '#f2e8c4'); gr.addColorStop(1, '#d8c99a'); g.fillStyle = gr; g.beginPath(); g.arc(70, 70, R, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(70, 70, R, 0, TAU); g.clip();
      for (let i = 0; i < 7; i++) { const x = 70 + (r() - .5) * 70, y = 70 + (r() - .5) * 70, rad = 10 + r() * 20, mg = g.createRadialGradient(x, y, 0, x, y, rad); mg.addColorStop(0, 'rgba(150,138,108,.45)'); mg.addColorStop(1, 'rgba(150,138,108,0)'); g.fillStyle = mg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
      for (let i = 0; i < 16; i++) { const x = 70 + (r() - .5) * 100, y = 70 + (r() - .5) * 100, rad = 1.6 + r() * 5; g.strokeStyle = 'rgba(120,108,84,.5)'; g.lineWidth = .9; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.stroke(); g.strokeStyle = 'rgba(255,255,240,.5)'; g.beginPath(); g.arc(x - .5, y - .5, rad, 3.6, 5.4); g.stroke(); }
      const lg = g.createRadialGradient(70, 70, R * .55, 70, 70, R); lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(60,50,30,.35)'); g.fillStyle = lg; g.fillRect(0, 0, 140, 140); g.restore();
      return c;
    }
    function makeCloud(seed) {
      const w = 360, h = 100, c = mkC(w, h), g = c.getContext('2d'), r = rngf(seed);
      for (let i = 0; i < 26; i++) { const x = 40 + r() * (w - 80), y = h * .55 + (r() - .5) * 26, rad = 14 + r() * 30, gr = g.createRadialGradient(x + 5, y - 6, 1, x, y, rad); gr.addColorStop(0, 'rgba(170,180,235,.16)'); gr.addColorStop(.55, 'rgba(110,125,200,.09)'); gr.addColorStop(1, 'rgba(60,70,150,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rad * 1.6, rad * .7, 0, 0, TAU); g.fill(); }
      return c;
    }
    function makeSmoke() {
      const c = mkC(64, 64), g = c.getContext('2d'), r = rngf(9);
      for (let i = 0; i < 6; i++) { const x = 32 + (r() - .5) * 18, y = 32 + (r() - .5) * 18, rad = 12 + r() * 10, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(205,210,230,.34)'); gr.addColorStop(1, 'rgba(205,210,230,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
      return c;
    }
    function makeTorch(lit) {
      const SS = 4, c = mkC(40 * SS, 64 * SS), g = c.getContext('2d'), r = rngf(lit ? 3 : 4);
      g.scale(SS, SS); g.translate(0, 4);
      // ombre portée de la torche sur le sable (flanc)
      // manche en bois : dégradé cylindrique + veines + nœuds
      const px = 17.2, pw = 5.6, pg = g.createLinearGradient(px, 0, px + pw, 0);
      pg.addColorStop(0, '#9b7447'); pg.addColorStop(.35, '#73512f'); pg.addColorStop(.75, '#4a3220'); pg.addColorStop(1, '#2a1c12');
      g.fillStyle = pg; g.beginPath(); g.moveTo(px + .4, 14); g.lineTo(px + pw - .4, 14); g.lineTo(px + pw + .3, 58); g.lineTo(px - .3, 58); g.closePath(); g.fill();
      for (let i = 0; i < 16; i++) { const x = px + .6 + r() * (pw - 1.2), y0 = 14 + r() * 30, len = 6 + r() * 14; g.strokeStyle = 'rgba(25,14,8,' + (.25 + r() * .3) + ')'; g.lineWidth = .22 + r() * .2; g.beginPath(); g.moveTo(x, y0); g.bezierCurveTo(x + (r() - .5) * .8, y0 + len * .3, x + (r() - .5) * .8, y0 + len * .7, x + (r() - .5) * .6, y0 + len); g.stroke(); }
      for (let i = 0; i < 5; i++) { const y = 26 + r() * 28, x = px + 1 + r() * 3.6; g.fillStyle = 'rgba(20,10,5,.55)'; g.beginPath(); g.ellipse(x, y, .8 + r() * .5, 1.2 + r() * .6, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(190,150,100,.3)'; g.lineWidth = .2; g.beginPath(); g.ellipse(x - .1, y - .1, 1.1, 1.6, 0, 3.4, 5.6); g.stroke(); }
      g.fillStyle = 'rgba(255,230,190,.16)'; g.fillRect(px + .8, 15, .7, 43);
      // cordage enroulé (haut du manche)
      for (let y = 17; y < 33; y += 1.6) { g.strokeStyle = '#cfae72'; g.lineWidth = .95; g.beginPath(); g.moveTo(px - .2, y + 1.2); g.lineTo(px + pw + .2, y - .5); g.stroke(); g.strokeStyle = 'rgba(30,18,8,.65)'; g.lineWidth = .35; g.beginPath(); g.moveTo(px - .2, y + 1.9); g.lineTo(px + pw + .2, y + .2); g.stroke(); }
      // bague de fer + rivets
      const ig = g.createLinearGradient(0, 0, 0, 1); ig.addColorStop(0, '#59616c'); ig.addColorStop(1, '#2a2f38');
      for (const y of [12.6, 34]) { const mg = g.createLinearGradient(px - .6, 0, px + pw + .6, 0); mg.addColorStop(0, '#848d99'); mg.addColorStop(.4, '#4a525d'); mg.addColorStop(1, '#1d2128'); g.fillStyle = mg; g.fillRect(px - .6, y, pw + 1.2, 2.2); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(px - .6, y, pw + 1.2, .35); g.fillStyle = '#9aa3ae'; g.beginPath(); g.arc(px + 1, y + 1.1, .3, 0, TAU); g.arc(px + pw - 1, y + 1.1, .3, 0, TAU); g.fill(); }
      // coupelle en fer
      const cg = g.createLinearGradient(13, 0, 27, 0); cg.addColorStop(0, '#767f8b'); cg.addColorStop(.45, '#454c57'); cg.addColorStop(1, '#171a20');
      g.fillStyle = cg; g.beginPath(); g.moveTo(13.4, 5.2); g.lineTo(26.6, 5.2); g.lineTo(23.2, 12.8); g.lineTo(16.8, 12.8); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = .3; g.beginPath(); g.moveTo(13.6, 5.4); g.lineTo(17, 12.5); g.stroke();
      g.fillStyle = '#1b1e25'; g.beginPath(); g.ellipse(20, 5.2, 6.6, 1.5, 0, 0, TAU); g.fill();
      // tête de chiffons imbibée d'huile
      const hg = g.createRadialGradient(18, 3, .5, 20, 4.5, 8); hg.addColorStop(0, lit ? '#8a4a18' : '#3a2a20'); hg.addColorStop(.6, lit ? '#4a2810' : '#241812'); hg.addColorStop(1, '#120a06');
      g.fillStyle = hg; g.beginPath(); g.moveTo(14, 5.6); g.bezierCurveTo(12.4, 1.4, 15.5, -3.4, 20, -3.6); g.bezierCurveTo(24.5, -3.4, 27.6, 1.4, 26, 5.6); g.closePath(); g.fill();
      for (let i = 0; i < 12; i++) { const a = r() * 3, x = 14.6 + r() * 10.8, y = -2.4 + r() * 7.4; g.strokeStyle = lit ? 'rgba(20,8,2,.6)' : 'rgba(0,0,0,.55)'; g.lineWidth = .35 + r() * .3; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 2, y + Math.sin(a) * 1.4 - .6, x + Math.cos(a) * 3.4, y + Math.sin(a) * 1.2); g.stroke(); }
      g.strokeStyle = 'rgba(190,160,120,.5)'; g.lineWidth = .45; for (const y of [.8, 3.2]) { g.beginPath(); g.moveTo(14.3, y + 2); g.quadraticCurveTo(20, y + 4, 25.7, y + 2); g.stroke(); }
      if (lit) { const eg = g.createRadialGradient(20, -1, .3, 20, -1, 7); eg.addColorStop(0, 'rgba(255,190,70,.85)'); eg.addColorStop(1, 'rgba(255,120,20,0)'); g.fillStyle = eg; g.fillRect(12, -8, 16, 16); }
      else { g.fillStyle = 'rgba(0,0,0,.28)'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(15.5 + r() * 9, -2 + r() * 7, .5 + r() * .8, 0, TAU); g.fill(); } }
      g.fillStyle = lit ? 'rgba(220,160,80,.5)' : 'rgba(30,20,12,.7)'; for (const x of [15.4, 24.6]) { g.beginPath(); g.ellipse(x, 7.4, .4, 1.2, 0, 0, TAU); g.fill(); }
      return c;
    }
    function makePalm(p, seed) {
      const r = rngf(seed), SC = 1.4, cw = 340, ch = Math.ceil(p.h + 130), c = mkC(cw * SC, ch * SC), g = c.getContext('2d');
      g.scale(SC, SC); const bx = cw / 2 - p.lean * .5, by = ch - 4, tx = bx + p.lean, ty = by - p.h;
      // tronc : ruban courbe, annelures, liseré de lune
      const N = 28, L = [], R2 = [], P = [];
      for (let i = 0; i <= N; i++) { const t = i / N, u = 1 - t, x = u * u * bx + 2 * u * t * (bx + p.lean * .15) + t * t * tx, y = u * u * by + 2 * u * t * (by - p.h * .55) + t * t * ty, dx = 2 * u * (p.lean * .15) + 2 * t * (p.lean * .85), dy = -(2 * u * p.h * .55 + 2 * t * p.h * .45), len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, w = 6.4 - 3 * t + (t < .08 ? (.08 - t) * 28 : 0); P.push([x, y, nx, ny, w]); L.push([x + nx * w, y + ny * w]); R2.push([x - nx * w, y - ny * w]); }
      const tg = g.createLinearGradient(bx - 8, 0, bx + 8, 0); tg.addColorStop(0, '#05081a'); tg.addColorStop(.7, '#0c1330'); tg.addColorStop(1, '#1a2550');
      g.fillStyle = tg; g.beginPath(); L.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); for (let i = N; i >= 0; i--) g.lineTo(R2[i][0], R2[i][1]); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(2,4,12,.7)'; g.lineWidth = .9; for (let i = 1; i < N; i += 1) { const q = P[i]; g.beginPath(); g.moveTo(q[0] + q[2] * q[4], q[1] + q[3] * q[4]); g.quadraticCurveTo(q[0], q[1] + 1.6, q[0] - q[2] * q[4], q[1] - q[3] * q[4]); g.stroke(); }
      g.strokeStyle = 'rgba(120,150,235,.35)'; g.lineWidth = 1.1; g.beginPath(); R2.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke();
      c._tx = tx * SC; c._ty = ty * SC; c._sc = SC;
      // couronne dans un canevas à part (pivot au sommet) pour qu'elle se balance
      const cr = mkC(340 * SC, 260 * SC), q = cr.getContext('2d'); q.scale(SC, SC); const ox = 170, oy = 140;
      const fronds = 11;
      for (let i = 0; i < fronds; i++) {
        const a = -Math.PI + (i + .5) * Math.PI / fronds + (r() - .5) * .22, len = 74 + r() * 30, droop = .5 + r() * .55, side = Math.cos(a) < 0 ? -1 : 1;
        const ex = ox + Math.cos(a) * len, ey = oy + Math.sin(a) * len * .7 + len * droop * .5, cx2 = ox + Math.cos(a) * len * .55, cy2 = oy + Math.sin(a) * len * .8 - 10;
        const at = (t) => { const u = 1 - t; return [u * u * ox + 2 * u * t * cx2 + t * t * ex, u * u * oy + 2 * u * t * cy2 + t * t * ey]; };
        const tan = (t) => { const u = 1 - t; const dx = 2 * u * (cx2 - ox) + 2 * t * (ex - cx2), dy = 2 * u * (cy2 - oy) + 2 * t * (ey - cy2), l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
        q.strokeStyle = '#050917'; q.lineWidth = 1.7; q.lineCap = 'round'; q.beginPath(); q.moveTo(ox, oy); q.quadraticCurveTo(cx2, cy2, ex, ey); q.stroke();
        for (let t = .1; t <= .99; t += .045) {
          const [x, y] = at(t), [tx2, ty2] = tan(t), ll = (21 - t * 12) * (.85 + r() * .3);
          for (const sgn of [-1, 1]) {
            const ang = Math.atan2(ty2, tx2) + sgn * (1.0 - t * .25), lx = Math.cos(ang), ly = Math.sin(ang) + .55, n = Math.hypot(lx, ly), x2 = x + lx / n * ll, y2 = y + ly / n * ll;
            const px2 = -(y2 - y) * .09, py2 = (x2 - x) * .09;
            q.fillStyle = '#060b1c'; q.beginPath(); q.moveTo(x - px2, y - py2); q.lineTo(x2, y2); q.lineTo(x + px2, y + py2); q.closePath(); q.fill();
            if (ly < .2) { q.strokeStyle = 'rgba(125,155,240,.33)'; q.lineWidth = .5; q.beginPath(); q.moveTo(x, y); q.lineTo(x2, y2); q.stroke(); }
          }
        }
      }
      for (let i = 0; i < 4; i++) { const x = ox + (i - 1.5) * 3.6, y = oy + 3 + (i % 2) * 2; q.fillStyle = '#0a1024'; q.beginPath(); q.arc(x, y, 3.5, 0, TAU); q.fill(); q.fillStyle = 'rgba(130,160,240,.5)'; q.beginPath(); q.arc(x - 1, y - 1.2, .9, 0, TAU); q.fill(); }
      cr._ox = ox * SC; cr._oy = oy * SC; c._crown = cr; return c;
    }
    function buildSprites() {
      glow = (() => { const c = mkC(96, 96), g = c.getContext('2d'), gr = g.createRadialGradient(48, 48, 2, 48, 48, 48); gr.addColorStop(0, 'rgba(255,190,80,.9)'); gr.addColorStop(.3, 'rgba(255,130,30,.32)'); gr.addColorStop(1, 'rgba(255,100,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 96, 96); return c; })();
      pool = (() => { const c = mkC(160, 60), g = c.getContext('2d'); g.translate(80, 30); g.scale(1, .38); const gr = g.createRadialGradient(0, 0, 2, 0, 0, 78); gr.addColorStop(0, 'rgba(255,170,70,.55)'); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 78, 0, TAU); g.fill(); return c; })();
      sandPat = ctx.createPattern(makeSand(), 'repeat'); milky = makeMilky(); moonSpr = makeMoon(); smokeP = makeSmoke();
      cloudSpr = [1, 2, 3, 4].map((i) => makeCloud(i * 17));
      torchSpr = { lit: makeTorch(true), out: makeTorch(false) };
      stars = Array.from({ length: 420 }, (_, i) => { const r = rngf(i + 11); return { x: r(), y: Math.pow(r(), 1.15), a: .25 + r() * .75, p: r() * 6, s: r() < .08 ? 2.3 : r() < .3 ? 1.6 : 1.1, c: ['#ffffff', '#cfe0ff', '#ffe9c7', '#b8c8ff'][Math.floor(r() * 4)], big: r() < .05 }; });
      clouds = Array.from({ length: 6 }, (_, i) => { const r = rngf(i + 50); return { x: r() * 2600, y: .05 + r() * .2, s: .8 + r() * 1.1, a: .5 + r() * .5, v: 2 + r() * 5, k: i % 4 }; });
      flies = Array.from({ length: 22 }, (_, i) => { const r = rngf(i + 99); return { x: r(), y: .46 + r() * .5, p: r() * 6, sp: .2 + r() * .5 }; });
      palms = Array.from({ length: 9 }, (_, i) => { const r = rngf(i + 300); return { x: i * 430 + r() * 180, h: 110 + r() * 70, lean: (r() - .5) * 70, leaves: 7, p: r() * 6 }; });
      palmSpr = palms.map((p, i) => makePalm(p, i * 13 + 5));
      rocks = Array.from({ length: 7 }, (_, i) => { const r = rngf(i + 700); return { x: i * 520 + r() * 260, w: 34 + r() * 46, h: 14 + r() * 16 }; });
      tufts = Array.from({ length: 26 }, (_, i) => { const r = rngf(i + 900); return { x: i * 190 + r() * 120, h: 26 + r() * 40, n: 5 + Math.floor(r() * 5), p: r() * 6 }; });
    }

    /* ---------- décor ---------- */
    const layerX = (x, f, period) => { const o = (x - cam.x * cam.s * f) % period; return o < 0 ? o + period : o; };
    function drawSky(t) {
      const hz = HY - H * .1;                         // ligne d'horizon de la mer
      const g = ctx.createLinearGradient(0, 0, 0, HY); g.addColorStop(0, '#01040c'); g.addColorStop(.4, '#08102e'); g.addColorStop(.78, '#17205a'); g.addColorStop(1, '#33377a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Math.max(0, HY) + 2);
      if (HY > 10) {
        lz(.02, () => { ctx.save(); ctx.translate(W * .4, HY * .3); ctx.rotate(-.36); ctx.globalAlpha = .85; ctx.drawImage(milky, -700, -140); ctx.restore(); });
        lz(.03, () => {
          for (const s of stars) {
            const x = layerX(s.x * W * 2, .015, W * 2); if (x > W) continue; const y = s.y * HY * .92;
            const tw = reduce ? .85 : .55 + .45 * Math.sin(t * (s.big ? 2.4 : 1.4) + s.p); ctx.globalAlpha = s.a * tw; ctx.fillStyle = s.c; ctx.fillRect(x, y, s.s, s.s);
            if (s.big) { ctx.globalAlpha = s.a * tw * .5; ctx.fillRect(x - 3, y + s.s / 2 - .3, 7 + s.s, .6); ctx.fillRect(x + s.s / 2 - .3, y - 3, .6, 7 + s.s); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = s.a * tw * .35; ctx.drawImage(glow, x - 6, y - 6, 12 + s.s, 12 + s.s); ctx.globalCompositeOperation = 'source-over'; }
          }
          ctx.globalAlpha = 1;
        });
        const ph = t % 13; if (!reduce && ph < .8) { const k = ph / .8, sx = W * .2 + k * W * .3, sy = HY * .1 + k * HY * .25, gr = ctx.createLinearGradient(sx, sy, sx - 70, sy - 22); gr.addColorStop(0, 'rgba(255,255,255,' + (1 - k) + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.strokeStyle = gr; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 70, sy - 22); ctx.stroke(); }
        const mx = W * .8, my = HY * .34;
        lz(.05, () => {
          ctx.globalCompositeOperation = 'lighter';
          const hg = ctx.createRadialGradient(mx, my, 20, mx, my, 220); hg.addColorStop(0, 'rgba(255,238,200,.32)'); hg.addColorStop(.4, 'rgba(190,200,255,.1)'); hg.addColorStop(1, 'rgba(160,180,255,0)'); ctx.fillStyle = hg; ctx.fillRect(mx - 230, my - 230, 460, 460);
          ctx.strokeStyle = 'rgba(210,220,255,.07)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(mx, my, 50, 0, TAU); ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(210,220,255,.035)'; ctx.beginPath(); ctx.arc(mx, my, 66, 0, TAU); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(moonSpr, mx - 29, my - 29, 58, 58);
        });
        lz(.08, () => { for (const c of clouds) { const x = ((c.x + (reduce ? 0 : t * c.v) - cam.x * cam.s * .05) % (W + 900) + W + 900) % (W + 900) - 450, y = c.y * HY, sp = cloudSpr[c.k]; ctx.globalAlpha = c.a; ctx.drawImage(sp, x - 180 * c.s, y - 50 * c.s, 360 * c.s, 100 * c.s); } ctx.globalAlpha = 1; });
      }
      // brume d'horizon + mer
      const hh = ctx.createLinearGradient(0, hz - 46, 0, hz + 2); hh.addColorStop(0, 'rgba(80,90,180,0)'); hh.addColorStop(1, 'rgba(100,110,200,.38)'); ctx.fillStyle = hh; ctx.fillRect(0, hz - 46, W, 48);
      const sg = ctx.createLinearGradient(0, hz, 0, HY + H * .07); sg.addColorStop(0, '#26337a'); sg.addColorStop(.25, '#141f56'); sg.addColorStop(1, '#070d2a'); ctx.fillStyle = sg; ctx.fillRect(0, hz, W, HY + H * .07 - hz);
      ctx.fillStyle = 'rgba(150,165,240,.55)'; ctx.fillRect(0, hz - .5, W, 1.3);
      lz(.15, () => {
        const mx = W * .8;
        ctx.fillStyle = '#0a1030';
        for (const [x, h, w] of islands) {
          const px = ((x - cam.x * cam.s * .07) % 2900 + 2900) % 2900 - 250, b = hz + 2; ctx.beginPath(); ctx.moveTo(px - w / 2, b); ctx.quadraticCurveTo(px - w * .22, b - h * 1.15, px - w * .08, b - h); ctx.quadraticCurveTo(px + w * .1, b - h * 1.08, px + w * .28, b - h * .5); ctx.quadraticCurveTo(px + w * .4, b - h * .2, px + w / 2, b); ctx.fill();
          ctx.strokeStyle = 'rgba(130,150,235,.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px - w * .08, b - h); ctx.quadraticCurveTo(px + w * .1, b - h * 1.08, px + w * .28, b - h * .5); ctx.stroke();
        }
        const bx = ((t * (reduce ? 0 : 9) + W * .2 - cam.x * cam.s * .09) % (W + 300) + W + 300) % (W + 300) - 150, by = hz + 7;
        ctx.fillStyle = '#060a1c'; ctx.beginPath(); ctx.moveTo(bx - 18, by); ctx.lineTo(bx + 18, by); ctx.lineTo(bx + 11, by + 6); ctx.lineTo(bx - 12, by + 6); ctx.fill(); ctx.beginPath(); ctx.moveTo(bx, by - 1); ctx.lineTo(bx, by - 34); ctx.lineTo(bx + 16, by - 3); ctx.fill(); ctx.beginPath(); ctx.moveTo(bx - 2, by - 1); ctx.lineTo(bx - 2, by - 26); ctx.lineTo(bx - 14, by - 3); ctx.fill();
        ctx.fillStyle = 'rgba(255,205,110,.9)'; ctx.fillRect(bx + 14, by + 1, 1.4, 1.4);
        // reflet de la lune : colonne douce + éclats
        const rg = ctx.createLinearGradient(0, hz, 0, HY + H * .06); rg.addColorStop(0, 'rgba(255,236,190,.34)'); rg.addColorStop(1, 'rgba(255,236,190,.04)');
        { const ex = HY + H * .06 - hz, cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 70); cg.addColorStop(0, 'rgba(255,236,190,.34)'); cg.addColorStop(.5, 'rgba(255,236,190,.12)'); cg.addColorStop(1, 'rgba(255,236,190,0)'); ctx.save(); ctx.translate(mx, hz); ctx.scale(.62, Math.max(.2, ex / 70)); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI); ctx.fill(); ctx.restore(); }
        for (let k = 0; k < 34; k++) { const y = hz + 3 + Math.pow(k / 34, 1.5) * (HY + H * .06 - hz), spread = 8 + (y - hz) * .5, w = (6 + k * 1.9) * (.55 + .45 * Math.sin(t * .9 + k * 1.3)); ctx.fillStyle = 'rgba(255,240,200,' + (.3 * (1 - k / 40)) * (reduce ? .7 : .45 + .55 * Math.sin(t * 1.9 + k * 2.3)) + ')'; ctx.fillRect(mx + Math.sin(t * .7 + k * 1.9) * spread * .5 - w / 2, y, w, 1.3 + k * .04); }
        // houle en perspective
        for (let k = 0; k < 14; k++) {
          const u = k / 13, y = hz + 4 + Math.pow(u, 1.7) * (HY + H * .055 - hz), amp = .4 + u * 2.2, fr = .05 - u * .03;
          ctx.strokeStyle = 'rgba(' + (150 + u * 40) + ',' + (178 + u * 30) + ',255,' + (.05 + .13 * u) + ')'; ctx.lineWidth = .5 + u * 1.5; ctx.beginPath();
          for (let x = -W / 2; x <= W * 1.5; x += 10) { const yy = y + Math.sin(x * fr + (reduce ? 0 : t) * (.8 + u * .5) + k * 1.7 - cam.x * cam.s * .0012 * (k + 1)) * amp; x === -W / 2 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke();
        }
      });
      if (!reduce) { ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 46; i++) { const f = ((t * .45 + i * .137) % 1), x = W * .8 + (Math.sin(i * 12.9) * 1) * 90 * (.2 + f), y = hz + 4 + f * f * (HY + H * .05 - hz); ctx.globalAlpha = Math.max(0, Math.sin(f * Math.PI)) * (.35 + .35 * Math.sin(t * 6 + i)); ctx.fillStyle = '#fff4d0'; ctx.fillRect(x, y, 1.6, 1); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    function palm(x, base, p, spr) {
      const sc = spr._sc, cr = spr._crown, sway = reduce ? 0 : Math.sin(clockT / 1.6 + p.p) * .045 + Math.sin(clockT / .7 + p.p * 2) * .012;
      ctx.drawImage(spr, x - (170 - p.lean * .5) , base - spr.height / sc, spr.width / sc, spr.height / sc);
      const tx = x - (170 - p.lean * .5) + spr._tx / sc, ty = base - spr.height / sc + spr._ty / sc;
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(sway); ctx.drawImage(cr, -cr._ox / sc, -cr._oy / sc, cr.width / sc, cr.height / sc); ctx.restore();
    }
    function drawGround(t) {
      const top = HY + H * .02;
      const sg = ctx.createLinearGradient(0, top, 0, H); sg.addColorStop(0, '#2a2d52'); sg.addColorStop(.1, '#3f364b'); sg.addColorStop(1, '#2c2531'); ctx.fillStyle = sg; ctx.fillRect(0, top, W, H * 3);
      ctx.save(); ctx.beginPath(); ctx.rect(0, top, W, H * 3); ctx.clip();
      sandPat.setTransform(new DOMMatrix().translate(-cam.x * Math.min(1.5, cam.s * 1.25) * 1.6, -cam.y + bob).scale(Math.max(.4, Math.min(1.5, cam.s * 1.25)))); ctx.globalAlpha = .92; ctx.fillStyle = sandPat; ctx.fillRect(0, top, W, H * 3); ctx.globalAlpha = 1; ctx.restore();
      // sable mouillé près de l'eau + éclat de lune
      const wet = ctx.createLinearGradient(0, top, 0, top + H * .12); wet.addColorStop(0, 'rgba(10,14,44,.62)'); wet.addColorStop(.5, 'rgba(18,22,60,.28)'); wet.addColorStop(1, 'rgba(18,22,60,0)'); ctx.fillStyle = wet; ctx.fillRect(0, top, W, H * .12);
      const sh = ctx.createRadialGradient(W * .8, top + 8, 4, W * .8, top + 8, 170); sh.addColorStop(0, 'rgba(210,220,255,.22)'); sh.addColorStop(1, 'rgba(210,220,255,0)'); ctx.save(); ctx.translate(0, top + 8); ctx.scale(1, .22); ctx.translate(0, -(top + 8)); ctx.fillStyle = sh; ctx.fillRect(W * .8 - 180, top - 120, 360, 300); ctx.restore();
      const haze = ctx.createLinearGradient(0, HY, 0, HY + H * .22); haze.addColorStop(0, 'rgba(60,70,130,.4)'); haze.addColorStop(1, 'rgba(60,70,130,0)'); ctx.fillStyle = haze; ctx.fillRect(0, HY, W, H * .22);
      // écume : trois nappes qui montent et redescendent sur le sable
      lz(.2, () => {
        const fy = HY + H * .015;
        for (let L = 2; L >= 0; L--) {
          const amp = 1.8 + L * 1.1, ph = (reduce ? 0 : t) * (.7 + L * .25) + L * 2, off = (reduce ? 0 : Math.sin(t * .55 + L * 1.7)) * (3 + L * 2) + L * 3.6;
          const edge = (x) => fy + off + Math.sin(x * .02 + ph - cam.x * cam.s * .004) * amp + Math.sin(x * .057 + ph * 1.6) * amp * .5;
          ctx.beginPath(); for (let x = -W / 2; x <= W * 1.5; x += 8) { const y = edge(x); x === -W / 2 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
          ctx.strokeStyle = 'rgba(236,246,255,' + (.2 - L * .04) + ')'; ctx.lineWidth = 7 - L; ctx.stroke(); ctx.strokeStyle = 'rgba(244,250,255,' + (.62 - L * .13) + ')'; ctx.lineWidth = 1.9 - L * .35; ctx.stroke();
          ctx.fillStyle = 'rgba(240,248,255,' + (.34 - L * .07) + ')'; for (let i = 0; i < 34; i++) { const x = ((i * 53.7 + L * 31) % (W * 2)) - W / 2, y = edge(x) + 1.5 + ((i * 7) % 4); ctx.beginPath(); ctx.arc(x, y, .6 + (i % 3) * .5, 0, TAU); ctx.fill(); }
        }
        const sd = ctx.createLinearGradient(0, fy + 6, 0, fy + 34); sd.addColorStop(0, 'rgba(6,8,28,.35)'); sd.addColorStop(1, 'rgba(6,8,28,0)'); ctx.fillStyle = sd; ctx.fillRect(-W / 2, fy + 6, W * 2, 28);
      });
      lz(.4, () => { for (let i = 0; i < palms.length; i++) { const p = palms[i], x = layerX(p.x, .34, 9 * 430) - 300; if (x > -200 && x < W + 220) palm(x, HY + H * .045, p, palmSpr[i]); } });
      lz(.5, () => {
        for (const r of rocks) {
          const x = layerX(r.x, .5, 3640) - 260; if (x < -140 || x > W + 60) continue; const b = HY + H * .035;
          const gr = ctx.createLinearGradient(x, b - r.h, x + r.w, b); gr.addColorStop(0, '#1c2342'); gr.addColorStop(.5, '#0c1126'); gr.addColorStop(1, '#070a18'); ctx.fillStyle = gr;
          ctx.beginPath(); ctx.moveTo(x, b); ctx.quadraticCurveTo(x + r.w * .1, b - r.h, x + r.w * .45, b - r.h * .85); ctx.quadraticCurveTo(x + r.w * .9, b - r.h * .7, x + r.w, b); ctx.fill();
          ctx.strokeStyle = 'rgba(140,165,240,.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + r.w * .1, b - r.h * .7); ctx.quadraticCurveTo(x + r.w * .3, b - r.h * .95, x + r.w * .45, b - r.h * .85); ctx.stroke();
        }
      });
    }
    function drawFoot() {
      for (const p of prints) { const k = kAt(p.y); if (!k) continue; const x = gx(p.x, k), y = gy(k); if (x < -20 || x > W + 20 || y > H + 20) continue; ctx.fillStyle = 'rgba(8,5,12,' + (.32 * p.a) + ')'; ctx.save(); ctx.translate(x, y); ctx.rotate(p.r); ctx.beginPath(); ctx.ellipse(0, 0, 3.2 * k + .5, 6.4 * k + 1, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    }
    function drawFront(t) {
      ctx.fillStyle = '#04060f';
      lz(1.25, () => {
      for (const f of tufts) { const x = layerX(f.x, 1.45, 26 * 190) - 200; if (x < -60 || x > W + 60) continue; const b = H + 8;
        for (let i = 0; i < f.n; i++) { const ox = x + (i - f.n / 2) * 5, hh = f.h * (.6 + ((i * 53) % 40) / 100), sw = (reduce ? 0 : Math.sin(t * 1.5 + f.p + i) * 3) + (i - f.n / 2) * 3; ctx.beginPath(); ctx.moveTo(ox - 2.2, b); ctx.quadraticCurveTo(ox + sw * .3, b - hh * .6, ox + sw, b - hh); ctx.quadraticCurveTo(ox + sw * .4, b - hh * .55, ox + 2.2, b); ctx.fill(); } }
      }, H);
      const vg = ctx.createLinearGradient(0, H * .7, 0, H); vg.addColorStop(0, 'rgba(2,3,10,0)'); vg.addColorStop(1, 'rgba(2,3,10,.65)'); ctx.fillStyle = vg; ctx.fillRect(0, H * .7, W, H * .3);
      const rv = ctx.createRadialGradient(W / 2, H * .55, H * .45, W / 2, H * .55, H * 1.05); rv.addColorStop(0, 'rgba(0,0,0,0)'); rv.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = rv; ctx.fillRect(0, 0, W, H);
    }

    /* ---------- éléments du monde ---------- */
    function drawTotem(t) {
      const x = -300, b = 62;
      ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.moveTo(x - 8, b); ctx.lineTo(x + 8, b); ctx.lineTo(x - 70, b + 14); ctx.lineTo(x - 84, b + 8); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, b, 34, 9, 0, 0, TAU); ctx.fill();
      const bands = [1, 2, 3, 4].map((i) => REGIMENTS[i].color);
      for (let i = 0; i < 4; i++) { const y = b - 24 - i * 26; ctx.fillStyle = '#4a3322'; ctx.fillRect(x - 17, y - 26, 34, 26); ctx.fillStyle = '#6b4b31'; ctx.fillRect(x - 17, y - 26, 6, 26); ctx.fillStyle = bands[i]; ctx.fillRect(x - 17, y - 18, 34, 5); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - 17, y - 26, 34, 1.5); }
      ctx.fillStyle = '#3a2819'; ctx.fillRect(x - 22, b - 134, 44, 8); ctx.fillRect(x - 22, b - 20, 44, 10);
      ctx.fillStyle = '#1d130c'; ctx.beginPath(); ctx.ellipse(x, b - 139, 13, 7, 0, 0, TAU); ctx.fill();
      const f = reduce ? 1 : 1 + .12 * Math.sin(t * 7) + .05 * Math.sin(t * 11);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow, x - 70, b - 210, 140, 140); ctx.drawImage(pool, x - 110, b - 22, 220, 80); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(x - 12, b - 139); ctx.quadraticCurveTo(x - 18, b - 170 * f + 22, x, b - 188 * f + 12); ctx.quadraticCurveTo(x + 18, b - 170 * f + 22, x + 12, b - 139); ctx.fill();
      ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.moveTo(x - 6, b - 139); ctx.quadraticCurveTo(x - 8, b - 158 * f + 8, x, b - 168 * f + 8); ctx.quadraticCurveTo(x + 8, b - 158 * f + 8, x + 6, b - 139); ctx.fill();
      ctx.fillStyle = '#e9dcc0'; ctx.font = '400 11px ' + FD; ctx.textAlign = 'center'; ctx.fillText('NNN', x, b - 95); ctx.font = '400 9px ' + FD; ctx.fillText('2026', x, b - 83);
    }
    function drawBanner(z, t, sc) {
      const k = Math.max(1, .45 / sc), gy = -6, pw = Math.max(160, z.rg.name.length * 9) * k;
      ctx.save(); ctx.translate(z.x - 4, gy); ctx.scale(k, k);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 2.5, 0, 0, TAU); ctx.ellipse(pw / k, 0, 7, 2.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6a4d33'; ctx.fillRect(-2.5, -112, 5, 112); ctx.fillRect(pw / k - 2.5, -112, 5, 112);
      ctx.fillStyle = '#8a6a43'; ctx.fillRect(-2.5, -112, 1.6, 112); ctx.fillRect(pw / k - 2.5, -112, 1.6, 112);
      ctx.fillStyle = '#3a2819'; ctx.fillRect(-7, -116, pw / k + 14, 4);
      const w = pw / k, wave = reduce ? 0 : Math.sin(t * 1.8 + z.x) * 2;
      ctx.beginPath(); ctx.moveTo(2, -112); ctx.lineTo(w - 2, -112); ctx.lineTo(w - 2, -62 + wave);
      for (let i = 0; i <= 10; i++) { const x = w - 2 - i * (w - 4) / 10; ctx.lineTo(x, -62 + wave * (1 - i / 10) + (i % 2 ? 5 : 0) + Math.sin(i + t * (reduce ? 0 : 2)) * 1.5); }
      ctx.closePath(); const bg = ctx.createLinearGradient(0, -112, 0, -62); bg.addColorStop(0, '#1a1f3f'); bg.addColorStop(1, '#0e1230'); ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = z.rg.c; ctx.lineWidth = 2.2; ctx.stroke(); ctx.fillStyle = z.rg.c; ctx.fillRect(2, -112, w - 4, 5);
      ctx.textAlign = 'center'; ctx.fillStyle = z.rg.c; ctx.font = '400 17px ' + FD; ctx.fillText(z.rg.name.toUpperCase(), w / 2, -86);
      ctx.fillStyle = '#cfd5ea'; ctx.font = '500 11.5px ' + FB; ctx.fillText(z.nf + ' / ' + z.n + ' tombé' + (z.n > 1 ? 's' : ''), w / 2, -70);
      ctx.restore();
    }
    function drawRope(z) {
      const x0 = z.x - ZPAD, x1 = z.x + z.w + ZPAD, y0 = -26, y1 = z.h + 22;
      ctx.strokeStyle = '#8a6a43'; ctx.lineCap = 'round';
      const P = (x, y) => { const k = kAt(y); return k ? { x: gx(x, k), y: gy(k), k } : null; };
      const seg = (a, b) => { const A = P(...a), B = P(...b); if (!A || !B) return; ctx.lineWidth = Math.max(.8, 1.6 * (A.k + B.k) / 2); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo((A.x + B.x) / 2, (A.y + B.y) / 2 + 5 * (A.k + B.k) / 2, B.x, B.y); ctx.stroke(); };
      const post = (x, y) => { const A = P(x, y); if (!A) return; ctx.save(); ctx.translate(A.x, A.y); ctx.scale(A.k, A.k); ctx.fillStyle = '#4b3524'; ctx.fillRect(-1.8, -12, 3.6, 18); ctx.fillStyle = '#7a5b3c'; ctx.fillRect(-1.8, -12, 1.3, 18); ctx.restore(); };
      const px = [], py = []; for (let x = x0; x <= x1; x += 120) px.push(x); if (px[px.length - 1] < x1) px.push(x1); for (let y = y0; y <= y1; y += 120) py.push(y); if (py[py.length - 1] < y1) py.push(y1);
      for (let i = 0; i < px.length - 1; i++) seg([px[i], y1], [px[i + 1], y1]);
      for (let j = 0; j < py.length - 1; j++) { seg([x0, py[j]], [x0, py[j + 1]]); seg([x1, py[j]], [x1, py[j + 1]]); }
      for (const x of px) post(x, y1); for (const y of py) { post(x0, y); post(x1, y); }
    }
    function stake(it, lit, t, sc, rec, isLast) {
      const b = 55;
      ctx.fillStyle = 'rgba(0,0,0,.30)'; ctx.beginPath(); ctx.moveTo(18, b); ctx.lineTo(22.5, b); ctx.lineTo(-10, b + 5); ctx.lineTo(-14, b + 3); ctx.fill(); ctx.beginPath(); ctx.ellipse(-12, b + 4.2, 5, 1.7, 0, 0, TAU); ctx.fill();
      const mg = ctx.createRadialGradient(18, b - 2, 1, 20, b, 14); mg.addColorStop(0, '#7a655a'); mg.addColorStop(1, '#3a2f33'); ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(20, b + .5, 13.5, 4.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,235,210,.22)'; ctx.beginPath(); ctx.ellipse(18, b - .8, 8, 2, -.1, 0, TAU); ctx.fill();
      if (sc > .7) { ctx.fillStyle = 'rgba(20,12,22,.4)'; for (let i = 0; i < 7; i++) ctx.fillRect(9 + ((it.seed >> (i * 3)) & 15) * 1.5, b - 1.5 + ((it.seed >> (i * 2)) & 3), .9, .9); }
      if (lit && sc > .45) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(pool, -18, b - 20, 76, 28); ctx.globalCompositeOperation = 'source-over'; }
      ctx.save(); ctx.translate(20, b); ctx.rotate(it.tilt); ctx.translate(-20, -b);
      ctx.drawImage(lit ? torchSpr.lit : torchSpr.out, 0, -4, 40, 64);
      if (lit) {
        const ph = it.phase, wind = reduce ? 0 : Math.sin(t * .6 + ph) * 1.1;
        const fl = reduce ? 1 : 1 + .1 * Math.sin(t * 9 + ph) + .06 * Math.sin(t * 15 + ph * 2) + .04 * Math.sin(t * 23 + ph * 3);
        const sw = reduce ? 0 : Math.sin(t * 4.2 + ph) * 1.6 + Math.sin(t * 7.3 + ph * 2) * .8 + wind;
        if (sc > .45) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= .6; ctx.drawImage(glow, -8, -26, 56, 56); ctx.drawImage(glow, 6, -12, 28, 28); ctx.globalAlpha /= .6; ctx.globalCompositeOperation = 'source-over'; }
        const tongue = (cx, by, h, w, s, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx - w, by); ctx.bezierCurveTo(cx - w * 1.25, by - h * .38, cx - w * .3 + s * .45, by - h * .72, cx + s, by - h); ctx.bezierCurveTo(cx + w * .3 + s * .45, by - h * .72, cx + w * 1.25, by - h * .38, cx + w, by); ctx.closePath(); ctx.fill(); };
        const by = 1.5, h0 = 19 * fl;
        tongue(15.8, by + .5, h0 * .55, 2.6, sw * .55 - .7, 'rgba(235,70,10,.8)'); tongue(24.2, by + .5, h0 * .5, 2.5, sw * .5 + .8, 'rgba(235,70,10,.8)');
        tongue(20, by, h0, 6.2, sw, 'rgba(232,62,8,.9)'); tongue(20, by, h0 * .84, 4.9, sw * .85, '#ff8a1c'); tongue(20, by, h0 * .62, 3.4, sw * .65, '#ffc93d'); tongue(20, by, h0 * .38, 2.0, sw * .4, '#fff2b4');
        ctx.fillStyle = 'rgba(110,150,255,.5)'; ctx.beginPath(); ctx.ellipse(20, by - .3, 3.2, 1.1, 0, 0, TAU); ctx.fill();
        if (sc > .6 && !reduce) {
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffb64a';
          for (let k = 0; k < 4; k++) { const p = ((t * .5 + ph + k * .25) % 1); ctx.globalAlpha = (1 - p) * .95; ctx.fillRect(20 + Math.sin(ph * 3 + p * 8 + k * 2) * (3 + p * 7) + sw * p, -6 - p * 40, 1.1, 1.1); }
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          if (sc > .9) for (let k = 0; k < 3; k++) { const p = ((t * .22 + ph * .7 + k / 3) % 1), s2 = 6 + p * 16; ctx.globalAlpha = .14 * (1 - p) * Math.min(1, p * 5); ctx.drawImage(smokeP, 20 + Math.sin(p * 5 + ph + k) * 5 * p + wind * p * 7 - s2, -18 - p * 54 - s2, s2 * 2, s2 * 2); ctx.globalAlpha = 1; }
        }
      } else {
        if (rec > 0 && sc > .5) {
          for (let k = 0; k < 7; k++) { const p = ((t * .2 + it.phase * .6 + k / 7) % 1), s2 = 5 + p * 17; ctx.globalAlpha = Math.min(1, p * 6) * (1 - p) * .55 * rec; ctx.drawImage(smokeP, 20 + Math.sin(p * 6 + it.phase + k * 1.3) * 5 * p + (reduce ? 0 : Math.sin(t * .5 + it.phase) * p * 9) - s2, 2 - p * 50 - s2, s2 * 2, s2 * 2); }
          ctx.globalAlpha = 1;
          const gl = .5 + .5 * Math.sin((reduce ? 0 : t) * 5 + it.phase); ctx.fillStyle = 'rgba(255,' + (70 + gl * 40 | 0) + ',20,' + (.5 * rec + .2 * gl) + ')'; ctx.beginPath(); ctx.arc(19 + (it.seed & 3), 1 + (it.seed & 1), .9, 0, TAU); ctx.fill();
        }
        if (isLast) { ctx.fillStyle = 'rgba(255,80,40,.9)'; ctx.beginPath(); ctx.arc(20, 5, 1.8, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ff6a4a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(20, 8, 10 + (reduce ? 0 : 1.6 * Math.sin(t * 3)), 0, TAU); ctx.stroke(); }
        if (it.lastFall && sc > .5) { ctx.fillStyle = '#ffd76a'; ctx.font = '700 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', 20, -6); }
        if (it.first && sc > .5) { ctx.fillStyle = '#ff9a9a'; ctx.font = '700 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⚑', 20, -6); }
      }
      const rg = regOf(it.g);
      if (sc > .4) {
        ctx.fillStyle = '#b88a22'; ctx.beginPath(); ctx.arc(20, 29, 8.2, 0, TAU); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(20, 29, 6.6, 0, TAU); ctx.clip(); try { ctx.drawImage(avSrc(it), 13.4, 22.4, 13.2, 13.2); } catch (e) { ctx.drawImage(fallbackAv(it), 13.4, 22.4, 13.2, 13.2); }
        if (!lit) { ctx.fillStyle = 'rgba(30,34,52,.5)'; ctx.fillRect(13, 22, 14, 14); } ctx.restore();
        ctx.strokeStyle = rg.c; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(20, 29, 7.6, 0, TAU); ctx.stroke();
      }
      ctx.fillStyle = '#2e2118'; ctx.fillRect(5, 38.5, 30, 13); ctx.fillStyle = '#3b2b1e'; ctx.fillRect(5, 38.5, 30, 1.6); ctx.fillStyle = rg.c; ctx.fillRect(5, 38.5, 30, 2.2);
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = .6; ctx.strokeRect(5, 38.5, 30, 13);
      ctx.fillStyle = '#888'; ctx.fillRect(8, 36.5, .9, 3); ctx.fillRect(31, 36.5, .9, 3);
      if (sc > .95) {
        ctx.textAlign = 'center'; ctx.fillStyle = '#f4e8cb'; let f = 5.2; ctx.font = '600 ' + f + 'px ' + FB;
        while (ctx.measureText(it.name).width > 27 && f > 3) { f -= .3; ctx.font = '600 ' + f + 'px ' + FB; }
        ctx.fillText(it.name, 20, 46.2); ctx.fillStyle = '#b9ab8c'; ctx.font = '500 3.7px ' + FB; ctx.fillText((it.mat ? '#' + it.mat + ' · ' : '') + 'J' + Math.ceil(it.t + .001), 20, 50.2);
      }
      ctx.restore();
    }

    /* ---------- ambiance sonore : vagues, criquets, mouettes lointaines (Web Audio, rien à télécharger) ---------- */
    const Snd = { on: GM_getValue('beachSound', true) !== false, ctx: null, master: null, voices: null, nextGull: 0, timer: 0, hid: false };
    function sndChirp(at, v) {
      const c = Snd.ctx, o = c.createOscillator(), g = c.createGain(), pn = c.createStereoPanner ? c.createStereoPanner() : null;
      o.type = 'sine'; o.frequency.value = v.f * (1 + (Math.random() - .5) * .012);
      const a = v.amp * (.55 + .45 * Math.sin(at * .27 + v.f));
      for (let i = 0; i < v.n; i++) { const t0 = at + i * .047; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(a, t0 + .012); g.gain.linearRampToValueAtTime(0, t0 + .036); }
      o.connect(g); if (pn) { pn.pan.value = v.pan; g.connect(pn); pn.connect(Snd.master); } else g.connect(Snd.master);
      o.start(at); o.stop(at + v.n * .047 + .1);
    }
    function sndGull(at) {
      const c = Snd.ctx, n = 2 + Math.floor(Math.random() * 3), pan = Math.random() * 1.6 - .8, base = 1000 + Math.random() * 200;
      for (let i = 0; i < n; i++) {
        const t0 = at + i * (.62 + Math.random() * .25), o = c.createOscillator(), bp = c.createBiquadFilter(), lp = c.createBiquadFilter(), g = c.createGain(), vib = c.createOscillator(), vg = c.createGain(), pn = c.createStereoPanner ? c.createStereoPanner() : null;
        o.type = 'sawtooth'; o.frequency.setValueAtTime(base, t0); o.frequency.linearRampToValueAtTime(base * 1.9, t0 + .1); o.frequency.exponentialRampToValueAtTime(base * 1.25, t0 + .3); o.frequency.exponentialRampToValueAtTime(base * .85, t0 + .5);
        vib.frequency.value = 26; vg.gain.value = 45; vib.connect(vg); vg.connect(o.frequency);
        bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 2.2; lp.type = 'lowpass'; lp.frequency.value = 2800;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.05 * (1 - i * .12), t0 + .08); g.gain.exponentialRampToValueAtTime(.0008, t0 + .55);
        o.connect(bp); bp.connect(lp); lp.connect(g); if (pn) { pn.pan.value = pan; g.connect(pn); pn.connect(Snd.gullBus); } else g.connect(Snd.gullBus);
        o.start(t0); vib.start(t0); o.stop(t0 + .6); vib.stop(t0 + .6);
      }
    }
    function sndTick() {
      const c = Snd.ctx; if (!c || c.state !== 'running') return; const now = c.currentTime;
      for (const v of Snd.voices) while (v.next < now + .9) { sndChirp(Math.max(now, v.next), v); v.next += v.period * (.85 + Math.random() * .3); }
      if (now > Snd.nextGull) { sndGull(now + .2); Snd.nextGull = now + 20 + Math.random() * 35; }
    }
    function sndStart() {
      if (!Snd.on) return;
      try {
        if (!Snd.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const c = Snd.ctx = new AC();
          Snd.master = c.createGain(); Snd.master.gain.value = 0; Snd.master.connect(c.destination);
          const len = c.sampleRate * 5, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); let b0 = 0;
          for (let i = 0; i < len; i++) { b0 = b0 * .97 + (Math.random() * 2 - 1) * .03; d[i] = b0 * 4; }
          const fade = Math.floor(c.sampleRate * .3); for (let i = 0; i < fade; i++) { const k = i / fade; d[len - fade + i] = d[len - fade + i] * (1 - k) + d[i] * k; }
          const src = c.createBufferSource(); src.buffer = buf; src.loop = true; src.loopEnd = (len - fade) / c.sampleRate;
          const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; const wg = c.createGain(); wg.gain.value = .32;
          src.connect(lp); lp.connect(wg); wg.connect(Snd.master); src.start();
          const lfo = c.createOscillator(), ld = c.createGain(); lfo.frequency.value = .11; ld.gain.value = .22; lfo.connect(ld); ld.connect(wg.gain); lfo.start();
          const l2 = c.createOscillator(), l2g = c.createGain(); l2.frequency.value = .09; l2g.gain.value = 240; l2.connect(l2g); l2g.connect(lp.frequency); l2.start();
          Snd.gullBus = c.createGain(); Snd.gullBus.gain.value = 1; Snd.gullBus.connect(Snd.master);
          const dl = c.createDelay(1); dl.delayTime.value = .27; const fb = c.createGain(); fb.gain.value = .32; Snd.gullBus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(Snd.master);
          const t0 = c.currentTime;
          Snd.voices = [[4300, .62, .011, -.6, 3], [4700, .55, .009, .5, 4], [3950, .8, .010, -.2, 3], [5100, .7, .007, .8, 4], [4500, 1.05, .008, .1, 5]].map(([f, period, amp, pan, n]) => ({ f, period, amp, pan, n, next: t0 + Math.random() * period }));
          Snd.nextGull = t0 + 6 + Math.random() * 10; Snd.timer = setInterval(sndTick, 300);
        }
        Snd.ctx.resume(); Snd.master.gain.cancelScheduledValues(Snd.ctx.currentTime); Snd.master.gain.setTargetAtTime(.6, Snd.ctx.currentTime, 1.2);
      } catch (e) { /* pas d'audio : tant pis */ }
    }
    function sndPause() { try { if (Snd.ctx && Snd.ctx.state === 'running') Snd.ctx.suspend(); } catch (e) { /* rien */ } }
    function sndSet(on) {
      Snd.on = on; GM_setValue('beachSound', on); if (snd$) snd$.textContent = on ? '🔊' : '🔇';
      if (on) sndStart(); else try { if (Snd.ctx) { Snd.master.gain.setTargetAtTime(0, Snd.ctx.currentTime, .15); setTimeout(() => { if (!Snd.on) sndPause(); }, 700); } } catch (e) { /* rien */ }
    }
    let snd$ = null;
    document.addEventListener('visibilitychange', () => { if (document.hidden) sndPause(); else if (stage && stage.isConnected && Snd.on && Snd.ctx) sndStart(); });

    /* ---------- boucle ---------- */
    function fallenIdx() { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m].t < S.day) lo = m + 1; else hi = m; } return lo; }
    const dimmed = (it) => !S.on.has(it.g) || (S.q && !it.name.toLowerCase().includes(S.q) && !it.p.includes(S.q));
    function draw(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSky(t); drawGround(t);
      const fi = fallenIdx(), lastIt = fi > 0 ? sorted[fi - 1] : null;
      drawFoot();
      for (const z of zones) {
        const kb = kAt(-6); if (!kb) continue;
        const sx0 = gx(z.x, kb); if (sx0 > W + 200 || gx(z.x + z.w, kb) < -200) continue;
        drawRope(z); ctx.save(); gT(-6, kb); drawBanner(z, t, kb); ctx.restore();
      }
      { const kt = kAt(62); if (kt && gx(-300, kt) > -120 && gx(-300, kt) < W + 120) { ctx.save(); gT(62, kt); drawTotem(t); ctx.restore(); } }
      for (const it of drawList) {
        it._k = 0; const yb = it.y + 55, k = kAt(yb); if (!k) continue;
        const sx = gx(it.x + 20, k), sy = gy(k);
        if (sx < -60 * k - 20 || sx > W + 60 * k + 20 || sy - 75 * k > H) continue;
        it._k = k; it._sx = sx; it._sy = sy;
        const lit = it.t >= S.day, dim = dimmed(it); ctx.globalAlpha = dim ? .16 : 1;
        if (k < .4) {
          const rg = regOf(it.g), r = Math.max(3.2, 14 * k), cy = sy - 20 * k;
          if (lit) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow, sx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4); ctx.globalCompositeOperation = 'source-over'; }
          ctx.fillStyle = lit ? '#ffcf6a' : '#3d4660'; ctx.beginPath(); ctx.arc(sx, cy, r, 0, TAU); ctx.fill();
          ctx.strokeStyle = rg.c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, cy, r + 1.8, 0, TAU); ctx.stroke();
          if (!lit && it === lastIt) { ctx.strokeStyle = '#ff6a4a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, cy, r + 7, 0, TAU); ctx.stroke(); }
        } else {
          ctx.save(); ctx.translate(sx, sy); ctx.scale(k, k); ctx.translate(-20, -55);
          stake(it, lit, t, k, lit ? 0 : Math.max(0, 1 - (S.day - it.t) / 1.6), it === lastIt && !lit);
          if (S.sel === it) { ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 / Math.max(k, .5); ctx.setLineDash([5, 4]); ctx.strokeRect(1, -16, 38, 74); ctx.setLineDash([]); }
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(0, bob * .6);
      for (let k = 0; k < 3; k++) { const off = ((reduce ? 0 : t * (7 + k * 4)) + cam.x * cam.s * (.1 + k * .06)) % W; const mg = ctx.createLinearGradient(0, 0, W, 0); mg.addColorStop(0, 'rgba(160,180,235,0)'); mg.addColorStop(.5, 'rgba(160,180,235,.07)'); mg.addColorStop(1, 'rgba(160,180,235,0)'); ctx.fillStyle = mg; const y = HY + H * (.03 + k * .1); ctx.fillRect(-off, y, W, H * .07); ctx.fillRect(W - off, y, W, H * .07); }
      for (const f of flies) { const xx = (((f.x * W * 1.4 - cam.x * cam.s * .5 + (reduce ? 0 : Math.sin(t * f.sp + f.p) * 14)) % (W * 1.4)) + W * 1.4) % (W * 1.4) - W * .2, yy = (f.y + (reduce ? 0 : Math.cos(t * f.sp * 1.3 + f.p) * .015)) * H; ctx.fillStyle = 'rgba(255,230,120,' + (.3 + (reduce ? .3 : .4 * Math.sin(t * 2 + f.p))) + ')'; ctx.beginPath(); ctx.arc(xx, yy, 1.7, 0, TAU); ctx.fill(); }
      ctx.restore();
      drawFront(t);
    }
    function loop(ts) {
      if (!stage || !stage.isConnected) { raf = 0; return; }
      const dt = Math.min(.05, (ts - lastTs) / 1000 || 0); lastTs = ts; clockT += dt;
      if (S.play) { S.day = Math.min(S.maxDay, S.day + dt * 2.1); if (S.day >= S.maxDay) { S.play = false; playBtn.textContent = '▶ Rejouer'; } sync(); }
      if (keys.size || walkDir) { const d = ((keys.has('ArrowRight') || keys.has('d')) ? 1 : 0) - ((keys.has('ArrowLeft') || keys.has('q') || keys.has('a')) ? 1 : 0) + walkDir; tgt.x += Math.sign(d) * dt * (380 / Math.max(.5, tgt.s)); clampT(); }
      const px = cam.x, k = reduce ? 1 : Math.min(1, dt * 7.5);
      cam.x += (tgt.x - cam.x) * k; cam.y += (tgt.y - cam.y) * k; cam.s += (tgt.s - cam.s) * Math.min(1, (dt * 9) || 1);
      HY = HY0 - cam.y;
      const dx = (cam.x - px) * cam.s; speed = dt ? Math.abs(dx) / dt : 0;
      if (!reduce) {
        stepPh += Math.abs(dx) * .052; bob = Math.sin(stepPh) * Math.min(3.2, speed * .012);
        if (Math.abs(cam.x - lastPrintX) > 26 / cam.s * 1.6 && speed > 20) { lastPrintX = cam.x; printSide *= -1; prints.push({ x: cam.x + printSide * 5, y: camZ + Dbase * .2, r: printSide * .12, a: 1 }); if (prints.length > 70) prints.shift(); }
      } else bob = 0;
      for (const p of prints) p.a = Math.max(.15, p.a - dt * .03);
      const moving = Math.abs(tgt.x - cam.x) > .05 || Math.abs(tgt.y - cam.y) > .05 || Math.abs(tgt.s - cam.s) > .001;
      if (W && !document.hidden && (!reduce || dirty || moving)) { draw(reduce ? 0 : clockT); dirty = false; }
      raf = requestAnimationFrame(loop);
    }

    /* ---------- interface ---------- */
    function pick(px, py) {
      for (let i = drawList.length - 1; i >= 0; i--) { const it = drawList[i]; if (!it._k || dimmed(it)) continue; const k = it._k, r = k < .4 ? Math.max(8, 14 * k + 4) : 19 * k; if (k < .4 ? (Math.abs(px - it._sx) <= r && Math.abs(py - (it._sy - 20 * k)) <= r) : (Math.abs(px - it._sx) <= r && py >= it._sy - 72 * k && py <= it._sy + 3 * k)) return it; }
      return null;
    }
    function showTip(it, px, py) {
      const rg = regOf(it.g), fell = it.t < S.day;
      tipEl.style.setProperty('--c', rg.c);
      tipEl.innerHTML = '<img src="' + esc(avUrl(it)) + '" alt=""><div><b>' + esc(it.name) + '</b><div class="m">' + (it.mat ? '#' + esc(it.mat) + ' · ' : '') + esc(rg.name) + '</div>' + (fell ? '<div>Tombé le ' + esc(it.date || 'jour ' + Math.ceil(it.t + .001)) + '</div>' + (it.c ? '<div class="m">' + esc(it.c.slice(0, 80)) + '</div>' : '') : '<div>Toujours en lice à ce jour</div>') + (it.m ? '<div class="m">💬 ' + it.m + ' messages</div>' : '') + '</div>';
      tipEl.hidden = false; const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
      tipEl.style.left = Math.min(W - tw - 8, Math.max(8, px + 16)) + 'px'; tipEl.style.top = Math.min(H - th - 8, Math.max(8, py + 16)) + 'px';
    }
    function fiche() {
      const it = S.sel;
      if (!it) { ficheEl.innerHTML = '<span class="nnn-bch-hint">Clique sur un piquet pour afficher sa fiche.</span>'; return; }
      const rg = regOf(it.g), fell = it.t < S.day;
      ficheEl.innerHTML = '<div class="fh" style="--c:' + rg.c + '"><img src="' + esc(avUrl(it)) + '" alt=""><div><b style="color:' + rg.c + '">' + esc(it.name) + '</b><div class="m">' + (it.mat ? '#' + esc(it.mat) + ' · ' : '') + esc(rg.name) + (it.m ? ' · 💬 ' + it.m : '') + '</div><div>' + (fell ? '☠ Tombé au combat le ' + esc(it.date || '?') : 'Toujours en lice à ce jour') + '</div>' + (fell && it.c ? '<div class="m">' + esc(it.c.slice(0, 140)) + '</div>' : '') + (it.bud ? '<div class="m">' + buddyHtml(it.p, true) + '</div>' : '') + (fell && it.link ? '<div><a href="' + esc(it.link) + '" target="_blank" rel="noopener">voir le message ↗</a></div>' : '') + '</div></div>';
    }
    function sync() {
      const d = S.day; dayEl.max = S.maxDay; dayEl.value = d; dayLbl.textContent = d <= 0 ? 'Jour 0' : 'Jour ' + Math.min(30, Math.ceil(d));
      for (const z of zones) { z.nf = 0; for (const it of sorted) if (it.g === z.rg.id && it.t < S.day) z.nf++; }
      emptyEl.hidden = items.length > 0; dirty = true; fiche();
    }
    function buildUi() {
      chipsEl.innerHTML = '';
      for (const r of regList()) {
        if (r.id === 0 && !zones.some((z) => z.rg.id === 0)) continue;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.style.setProperty('--c', r.c); b.setAttribute('aria-pressed', String(S.on.has(r.id))); b.title = r.name;
        b.innerHTML = '<i></i>' + (r.id ? 'R' + r.id : 'Sans rég.');
        b.onclick = () => { S.on.has(r.id) ? S.on.delete(r.id) : S.on.add(r.id); b.setAttribute('aria-pressed', String(S.on.has(r.id))); dirty = true; };
        chipsEl.appendChild(b);
      }
      gotoEl.innerHTML = '';
      const mk = (txt, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.onclick = fn; gotoEl.appendChild(b); };
      mk('Totem', () => walkTo(-300)); for (const z of zones) mk(z.rg.id ? 'R' + z.rg.id : 'Sans rég.', () => walkTo(z.x + z.w / 2));
    }
    function toggleFull(on) {
      S.full = on === undefined ? !S.full : on; stage.classList.toggle('full', S.full);
      fullBtn.textContent = S.full ? '✕' : '⛶'; fullBtn.title = S.full ? 'Quitter le plein écran' : 'Plein écran';
      if (S.full) { document.body.appendChild(stage); document.documentElement.style.overflow = 'hidden'; }
      else { document.documentElement.style.overflow = ''; if (lastHost && lastHost.isConnected) lastHost.appendChild(stage); }
      setTimeout(() => { resize(); clampT(); dirty = true; }, 30);
    }
    function ensureStage() {
      if (stage) return;
      stage = document.createElement('div'); stage.className = 'nnn-bch';
      stage.innerHTML = `<div class="cvbox"><canvas tabindex="0" aria-label="Plage des éteints : une torche plantée par membre tombé. Flèches du clavier pour marcher, molette pour zoomer, Maj + molette pour monter ou descendre."></canvas>
        <div class="tip" hidden></div><div class="goto"></div><div class="empty" hidden>Aucune torche éteinte… pour l'instant. 🔥</div>
        <div class="hud"><button type="button" data-w="-1" aria-label="Marcher vers la gauche">◀</button><button type="button" data-w="1" aria-label="Marcher vers la droite">▶</button><button type="button" data-v="-1" aria-label="Monter">▲</button><button type="button" data-v="1" aria-label="Descendre">▼</button><button type="button" data-z="1" aria-label="Zoom avant">+</button><button type="button" data-z="-1" aria-label="Zoom arrière">−</button><button type="button" class="w" data-fit="1">Tout voir</button><button type="button" class="snd" title="Ambiance sonore" aria-label="Ambiance sonore">🔊</button><button type="button" class="full" title="Plein écran">⛶</button></div></div>
        <div class="bar"><button type="button" class="play">▶ Rejouer</button><input type="range" min="0" max="30" step="0.02" value="30" aria-label="Jour du NNN"><span class="day">Jour 30</span></div>
        <div class="bar"><span class="chips"></span><input type="search" class="q" placeholder="Chercher un pseudo…" autocomplete="off"></div>
        <div class="fiche"></div>`;
      boxEl = stage.querySelector('.cvbox'); cv = stage.querySelector('canvas'); ctx = cv.getContext('2d'); tipEl = stage.querySelector('.tip'); gotoEl = stage.querySelector('.goto'); emptyEl = stage.querySelector('.empty');
      dayEl = stage.querySelector('input[type=range]'); dayLbl = stage.querySelector('.day'); playBtn = stage.querySelector('.play'); chipsEl = stage.querySelector('.chips'); qEl = stage.querySelector('.q'); ficheEl = stage.querySelector('.fiche'); fullBtn = stage.querySelector('.full'); snd$ = stage.querySelector('.snd'); snd$.textContent = Snd.on ? '🔊' : '🔇'; snd$.onclick = () => sndSet(!Snd.on);
      for (const ev of ['pointerdown', 'keydown', 'wheel']) stage.addEventListener(ev, () => { if (Snd.on && (!Snd.ctx || Snd.ctx.state !== 'running')) sndStart(); }, { passive: true });
      buildSprites();
      let drag = null, moved = 0;
      cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, tx: tgt.x, ty: tgt.y }; moved = 0; cv.classList.add('drag'); });
      cv.addEventListener('pointermove', (e) => {
        const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
        if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy)); tgt.x = drag.tx - dx / tgt.s; tgt.y = drag.ty - dy; clampT(); tipEl.hidden = true; return; }
        const it = pick(px, py); if (it !== S.hover) { S.hover = it; dirty = true; } it ? showTip(it, px, py) : (tipEl.hidden = true); cv.style.cursor = it ? 'pointer' : 'grab';
      });
      cv.addEventListener('pointerup', (e) => { cv.classList.remove('drag'); if (drag && moved < 5) { const r = cv.getBoundingClientRect(); S.sel = pick(e.clientX - r.left, e.clientY - r.top); dirty = true; fiche(); } drag = null; });
      cv.addEventListener('pointerleave', () => { tipEl.hidden = true; S.hover = null; });
      cv.addEventListener('wheel', (e) => { e.preventDefault(); if (e.shiftKey) { tgt.y += (e.deltaY || e.deltaX) * .6; clampT(); return; } const r = cv.getBoundingClientRect(); zoomAtPx(e.deltaY < 0 ? 1.14 : 1 / 1.14, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
      cv.addEventListener('keydown', (e) => {
        const k = e.key;
        if (['ArrowLeft', 'ArrowRight', 'd', 'q', 'a'].includes(k)) { keys.add(k); e.preventDefault(); e.stopPropagation(); }
        else if (k === 'ArrowUp') { tgt.y -= 45; clampT(); e.preventDefault(); } else if (k === 'ArrowDown') { tgt.y += 45; clampT(); e.preventDefault(); }
        else if (k === '+' || k === '=') zoomAtPx(1.3, W / 2, H / 2); else if (k === '-') zoomAtPx(1 / 1.3, W / 2, H / 2);
      });
      cv.addEventListener('keyup', (e) => keys.delete(e.key)); cv.addEventListener('blur', () => keys.clear());
      stage.querySelectorAll('[data-w]').forEach((b) => { const d = +b.dataset.w, on = (e) => { e.preventDefault(); walkDir = d; }, off = () => { walkDir = 0; }; b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off); });
      stage.querySelectorAll('[data-v]').forEach((b) => { b.onclick = () => { tgt.y += +b.dataset.v * 90; clampT(); }; });
      stage.querySelectorAll('[data-z]').forEach((b) => { b.onclick = () => zoomAtPx(+b.dataset.z > 0 ? 1.3 : 1 / 1.3, W / 2, H / 2); });
      stage.querySelector('[data-fit]').onclick = () => home(true);
      fullBtn.onclick = () => toggleFull();
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.full) toggleFull(false); });
      dayEl.addEventListener('input', () => { S.day = +dayEl.value; S.play = false; playBtn.textContent = '▶ Rejouer'; sync(); });
      playBtn.onclick = () => { if (S.play) { S.play = false; playBtn.textContent = '▶ Rejouer'; return; } if (S.day >= S.maxDay) S.day = 0; S.play = true; playBtn.textContent = '❚❚ Pause'; };
      qEl.addEventListener('input', () => { S.q = qEl.value.trim().toLowerCase(); dirty = true; });
      ro = new ResizeObserver(() => { const first = !W; resize(); if (first && W) { home(false); ready = true; } else clampT(); dirty = true; }); ro.observe(boxEl);
      buildUi();
    }
    function mount(host) {
      ensureStage(); lastHost = host;
      if (!S.full && stage.parentNode !== host) host.appendChild(stage);
      resize(); if (W && !ready) { home(false); ready = true; }
      sync(); if (!raf) { lastTs = performance.now(); raf = requestAnimationFrame(loop); }
    }
    function unmount() { sndPause(); if (raf) { cancelAnimationFrame(raf); raf = 0; } if (S.full) toggleFull(false); walkDir = 0; keys.clear(); }
    return { update, mount, unmount, fullscreen: (on) => { if (stage) toggleFull(on); } };
  })();


  function wallHtml() {
    const sw = `<div class="nnn-wmode"><button data-wmode="beach" class="${wallMode === 'beach' ? 'on' : ''}">🏝 Plage</button><button data-wmode="list" class="${wallMode === 'list' ? 'on' : ''}">📜 Liste</button></div>`;
    if (wallMode === 'beach') return `<div class="nnn-wall2">${sw}<div class="nnn-beach-host"></div></div>`;
    return sw + wallListHtml();
  }
  function wallListHtml() {
    const names = new Set([...Object.keys(sheetData), ...Object.keys(overrides)]);
    const key = (d) => { const m = (d || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? +(m[3] + m[2].padStart(2, '0') + m[1].padStart(2, '0')) : 99999999; };
    const list = [...names].map((p) => ({ p, i: infoFor(p) })).filter((x) => x.i.dead)
      .sort((a, b) => key(a.i.date) - key(b.i.date) || a.p.localeCompare(b.p));
    const torch = `<img src="${TORCH_OUT}" alt="">`;
    let html = `<div class="nnn-wall"><div class="nnn-wt-title">${torch}<span>LES DISPARUS</span>${torch}</div>
      <div class="nnn-wt-sub">🌴 Ton aventure s'arrête ici — ${list.length} torche${list.length > 1 ? 's' : ''} éteinte${list.length > 1 ? 's' : ''} 🌴</div>
      <div class="nnn-wt-regs">${[1, 2, 3, 4].map((r) => `<span><img src="${REGIMENTS[r].logo}">${list.filter((x) => x.i.regiment === r).length} ☠</span>`).join('')}</div>
      <div class="nnn-scroll">`;
    if (!list.length) html += `<div class="nnn-wt-empty">Aucune torche éteinte… pour l'instant. 🔥</div>`;
    let last = null;
    list.forEach((x, k) => {
      const d = x.i.date || 'Date inconnue';
      if (d !== last) { html += `<div class="nnn-wd">— ${esc(d)} —</div>`; last = d; }
      const reg = x.i.regiment ? REGIMENTS[x.i.regiment] : null;
      const n = totals[x.p];
      html += `<div class="nnn-stele" style="${reg ? 'border-left:6px solid ' + reg.color : ''}">
        <span class="num">N°${k + 1}</span><img class="t" src="${TORCH_OUT}" alt="">${avatarHtml(x.p, reg ? reg.color : '')}
        <div class="nm"><b>${fancy(x.p)}</b><small>${x.i.matricule ? '#' + esc(x.i.matricule) + ' · ' : ''}${reg ? reg.name : 'Sans régiment'}${n ? ' · 💬 ' + n : ''}${x.i.cause ? ' · ' + esc(x.i.cause.slice(0, 70)) : ''}${x.i.link ? ' · <a href="' + esc(x.i.link) + '" target="_blank" rel="noopener" style="color:#ffd34d">voir le message ↗</a>' : ''}</small></div>
        ${reg ? `<img class="r" src="${reg.logo}" title="${reg.name}">` : ''}
        <span class="dt">${esc(x.i.date || '?')}</span></div>`;
    });
    return html + '</div></div>';
  }

  const dateKey = (d) => { const m = (d || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? +(m[3] + m[2].padStart(2, '0') + m[1].padStart(2, '0')) : 0; };
  const finalReached = () => new Date() >= new Date(2026, 10, 30);

  // Classement des régiments : survivants → taux de survie → dernière chute la plus tardive → messages
  function standings() {
    const st = [1, 2, 3, 4].map((i) => ({ i, total: 0, alive: 0, msgs: 0, last: 0, members: [] }));
    new Set([...Object.keys(sheetData), ...Object.keys(overrides)]).forEach((p) => {
      const inf = infoFor(p);
      if (!inf.regiment) return;
      const a = st[inf.regiment - 1];
      a.total++; a.msgs += totals[p] || 0; a.members.push({ p, dead: inf.dead, n: totals[p] || 0 });
      if (inf.dead) a.last = Math.max(a.last, dateKey(inf.date)); else a.alive++;
    });
    st.forEach((a) => { a.rate = a.total ? a.alive / a.total : 0; });
    st.sort((x, y) => y.alive - x.alive || y.rate - x.rate || y.last - x.last || y.msgs - x.msgs || x.i - y.i);
    return st;
  }

  function chartsHtml() {
    const DAYS = 30;
    const mk = () => ({ 1: Array(DAYS).fill(0), 2: Array(DAYS).fill(0), 3: Array(DAYS).fill(0), 4: Array(DAYS).fill(0) });
    const E = mk(), M = mk(); let undated = 0;
    new Set([...Object.keys(sheetData), ...Object.keys(overrides)]).forEach((p) => {
      const inf = infoFor(p);
      if (!inf.dead || !inf.regiment) return;
      const m = (inf.date || '').match(/^(\d{2})\/11\/2026$/);
      if (m && +m[1] >= 1 && +m[1] <= DAYS) E[inf.regiment][+m[1] - 1]++; else undated++;
    });
    Object.entries(dayAgg).forEach(([dk, auth]) => {
      const m = dk.match(/^(\d{2})\/11\/2026$/);
      if (!m || +m[1] < 1 || +m[1] > DAYS) return;
      Object.entries(auth).forEach(([a, n]) => { const r = infoFor(a).regiment; if (r) M[r][+m[1] - 1] += n; });
    });
    const base = chartKind === 'elim' ? E : M;
    const sum = (arr) => arr.reduce((x, y) => x + y, 0);
    const series = {};
    [1, 2, 3, 4].forEach((r) => {
      let run = 0;
      series[r] = chartCum ? base[r].map((v) => (run += v)) : base[r].slice();
    });
    const W = 620, H = 260, L = 40, R = 12, T = 14, B = 30, iw = W - L - R, ih = H - T - B;
    const stacked = chartKind === 'elim';
    const dayTot = Array.from({ length: DAYS }, (_, k) => [1, 2, 3, 4].reduce((x, r) => x + series[r][k], 0));
    const rawMax = Math.max(1, ...(stacked ? dayTot : [1, 2, 3, 4].flatMap((r) => series[r])));
    const q = Math.max(1, rawMax) / 4, pw = Math.pow(10, Math.floor(Math.log10(q))), f = q / pw;
    const ymax = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pw * 4;     // graduations entières (ymax multiple de 4)
    const X = (k) => L + (k + 0.5) * iw / DAYS, Y = (v) => T + ih - v / ymax * ih;
    let svg = `<svg class="nnn-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
    for (let t = 0; t <= 4; t++) { const v = ymax * t / 4, y = Y(v); svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${Math.round(v * 10) / 10}</text>`; }
    svg += `<line class="axis" x1="${L}" x2="${W - R}" y1="${T + ih}" y2="${T + ih}"/>`;
    [1, 5, 10, 15, 20, 25, 30].forEach((d) => { svg += `<text x="${X(d - 1)}" y="${H - 10}" text-anchor="middle">${d}</text>`; });
    const now = new Date();
    if (now.getFullYear() === 2026 && now.getMonth() === 10) svg += `<line class="today" x1="${X(now.getDate() - 1)}" x2="${X(now.getDate() - 1)}" y1="${T}" y2="${T + ih}"/>`;
    if (stacked) {
      const bw = iw / DAYS * 0.68;
      for (let k = 0; k < DAYS; k++) {
        let acc = 0;
        [1, 2, 3, 4].forEach((r) => {
          const v = series[r][k]; if (!v) return;
          const y1 = Y(acc + v), y0 = Y(acc); acc += v;
          svg += `<rect x="${X(k) - bw / 2}" y="${y1}" width="${bw}" height="${y0 - y1}" fill="${REGIMENTS[r].color}" stroke="#2a1808" stroke-width=".7"><title>Jour ${k + 1} · ${REGIMENTS[r].name} : ${v}${chartCum ? ' (cumulé)' : ''}</title></rect>`;
        });
      }
    } else {
      [1, 2, 3, 4].forEach((r) => {
        const pts = series[r].map((v, k) => `${X(k).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
        svg += `<polyline points="${pts}" fill="none" stroke="#2a1808" stroke-width="4.6" stroke-linejoin="round" stroke-linecap="round" opacity=".55"/><polyline points="${pts}" fill="none" stroke="${REGIMENTS[r].color}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`;
        series[r].forEach((v, k) => { if (v) svg += `<circle cx="${X(k)}" cy="${Y(v)}" r="3" fill="${REGIMENTS[r].color}" stroke="#2a1808" stroke-width="1"><title>Jour ${k + 1} · ${REGIMENTS[r].name} : ${v} message${v > 1 ? 's' : ''}${chartCum ? ' (cumulé)' : ''}</title></circle>`; });
      });
    }
    svg += '</svg>';
    const legend = `<div class="nnn-legend">${[1, 2, 3, 4].map((r) => `<span><img src="${REGIMENTS[r].logo}">${chartKind === 'elim' ? sum(E[r]) + ' ☠' : sum(M[r]) + ' 💬'}</span>`).join('')}</div>`;
    const dayE = Array.from({ length: DAYS }, (_, k) => [1, 2, 3, 4].reduce((x, r) => x + E[r][k], 0));
    const dayM = Array.from({ length: DAYS }, (_, k) => [1, 2, 3, 4].reduce((x, r) => x + M[r][k], 0));
    const best = (arr) => { const m = Math.max(...arr); return m > 0 ? { d: arr.indexOf(m) + 1, v: m } : null; };
    const be = best(dayE), bm = best(dayM);
    const facts = `<div class="nnn-facts">${be ? `<span>☠ Jour le plus meurtrier : jour ${be.d} (${be.v})</span>` : '<span>☠ Aucune élimination datée</span>'}${bm ? `<span>💬 Jour le plus bavard : jour ${bm.d} (${bm.v} msgs)</span>` : ''}${undated ? `<span>⚠ ${undated} tombé(s) sans date novembre dans le GDOC</span>` : ''}</div>`;
    return `<div class="nnn-rank"><div class="nnn-tabs">
      <button class="${chartKind === 'elim' ? 'on' : ''}" data-chart="elim">☠ Éliminations par jour</button>
      <button class="${chartKind === 'msg' ? 'on' : ''}" data-chart="msg">💬 Messages par jour</button>
      <button class="${chartCum ? 'on' : ''}" data-cum="1">Cumulé</button></div>
      <div class="nnn-parch">${legend}${svg}${facts}</div>
      <div class="nnn-foot">${crawling ? 'Comptage en cours… ' + esc(crawlInfo) : 'Par régiment · données du GDOC et du topic'}</div></div>`;
  }

  function finalHtml() {
    const st = standings();
    const hasData = st.some((a) => a.total);
    const reached = finalReached();
    if (!hasData) return `<div class="nnn-final"><h3>PODIUM FINAL</h3><div class="fnote">Pas encore de données de régiments dans le GDOC.</div></div>`;
    const win = st[0], wreg = REGIMENTS[win.i];
    const heights = [96, 66, 46];
    const steps = [1, 0, 2].map((idx) => {
      const a = st[idx], reg = REGIMENTS[a.i];
      return `<div class="fp p${idx + 1}" style="--c:${reg.color}">${idx === 0 ? '<div class="crown">👑</div>' : ''}<img class="fl" src="${reg.logo}" alt=""><b>${reg.name}</b><small>${a.alive}/${a.total} en vie · ${(a.rate * 100).toFixed(0)} %</small><small>💬 ${a.msgs}</small><div class="blk" style="height:${heights[idx]}px">${idx + 1}</div></div>`;
    }).join('');
    const a4 = st[3], r4 = REGIMENTS[a4.i];
    const survivors = win.members.filter((m) => !m.dead).sort((x, y) => y.n - x.n);
    const survHtml = survivors.length
      ? survivors.map((m) => `<span>${avatarHtml(m.p, wreg.color)}${fancy(m.p)}</span>`).join('')
      : '<span>Aucun survivant…</span>';
    const dead = [...new Set([...Object.keys(sheetData), ...Object.keys(overrides)])].map((p) => ({ p, i: infoFor(p) })).filter((x) => x.i.dead && dateKey(x.i.date));
    dead.sort((a, b) => dateKey(a.i.date) - dateKey(b.i.date));
    const firstF = dead[0], lastF = dead[dead.length - 1];
    const chatty = Object.entries(totals).filter(([p]) => isKnown(p)).sort((a, b) => b[1] - a[1])[0];
    const titles = `<div class="nnn-titles">
      <div><small>Premier tombé</small>${firstF ? fancy(firstF.p) + '<br>' + esc(firstF.i.date) : '–'}</div>
      <div><small>Dernier tombé</small>${lastF ? fancy(lastF.p) + '<br>' + esc(lastF.i.date) : '–'}</div>
      <div><small>Le plus bavard</small>${chatty ? fancy(chatty[0]) + '<br>💬 ' + chatty[1] : '–'}</div></div>`;
    return `<div class="nnn-final">
      <h3>PODIUM FINAL</h3>
      <div class="fnote">${reached ? "L'aventure est terminée !" : 'Aperçu provisoire — résultat définitif le 30 novembre'}</div>
      <div class="fw" style="--c:${wreg.color}"><small>🏆 Régiment vainqueur</small><b>${wreg.name}</b></div>
      <div class="nnn-steps">${steps}</div>
      <div class="f4"><img src="${r4.logo}" alt="">4ᵉ : ${r4.name} — ${a4.alive}/${a4.total} en vie</div>
      <h4>Les survivants du ${wreg.name.toLowerCase()}</h4><div class="nnn-surv">${survHtml}</div>
      ${titles}</div>`;
  }

  /* ======================================================================
   *  DÉCORATION DES MESSAGES  (idempotent → compatible JVChat)
   * ==================================================================== */
  // « Carte » du message = l'élément qui a les coins arrondis du forum (pour que bordures et fonds suivent la courbe)
  function cardOf(msg) {
    try {
      const rad = (e) => parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0;
      if (rad(msg) > 0) return msg;
      const w = msg.getBoundingClientRect().width;
      if (!w) return msg;
      const queue = [...msg.children]; let n = 0;
      while (queue.length && n++ < 80) {
        const e = queue.shift();
        if (e.classList.contains('nnn-line')) continue;
        if (rad(e) > 0 && e.getBoundingClientRect().width > w * 0.85) return e;
        queue.push(...e.children);
      }
    } catch (e) { /* on retombe sur le message */ }
    return msg;
  }
  function clearCard(c) {
    c.classList.remove('nnn-is-dead', 'nnn-is-op', 'nnn-poo-msg', 'nnn-foot-msg', 'nnn-clock-msg', 'nnn-king-msg', 'nnn-op-msg');
    c.removeAttribute('data-nnn-reg'); c.style.removeProperty('--nnn-c');
  }

  function decorate(msg) {
    // en mode JVChat, les messages d'origine sont masqués : on ne les décore pas
    if (!msg.classList.contains('jvchat-message') && document.querySelector('.jvchat-container, #jvchat-main')) return;
    const pseudoEl = parts(msg).pseudoEl;
    if (!pseudoEl) return;
    const pseudo = norm(pseudoEl.textContent);
    if (!pseudo) return;
    noteProfile(pseudo, pseudoEl.textContent.trim(), avatarUrl(msg));

    // On ne déplace JAMAIS les éléments de JV (le site est en React) :
    // on masque l'original et on affiche une copie dans notre conteneur.
    let target = pseudoEl;
    const par = pseudoEl.parentElement;
    if (par && par.tagName === 'A' && par.children.length === 1 && msg.contains(par)) target = par;
    let wrap = target.previousElementSibling && target.previousElementSibling.classList.contains('nnn-line') ? target.previousElementSibling : null;
    if (!wrap) {
      wrap = document.createElement('span');
      wrap.className = 'nnn-line';
      target.parentNode.insertBefore(wrap, target);
    }
    target.classList.add('nnn-orig');
    wrap.textContent = '';

    const info = infoFor(pseudo);
    const reg = info.regiment ? REGIMENTS[info.regiment] : null;
    const isOP = pseudo === OP_PSEUDO;
    const poo = isPoo(pseudo), foot = isFoot(pseudo), king = isKing(pseudo), clk = isClock(pseudo);

    const mk = (tag, cls, html, title) => {
      const e = document.createElement(tag);
      e.className = 'nnn-gen ' + cls;
      if (html !== undefined) e.innerHTML = html;
      if (title) e.title = title;
      return e;
    };

    // ---- à GAUCHE du pseudo : matricule, couronne
    if (poo) wrap.appendChild(mk('span', 'nnn-poo-e', '💩'));
    if (foot) { const fi = mk('img', 'nnn-foot-ico'); fi.src = PH.iconP; fi.alt = '🦶'; wrap.appendChild(fi); }
    if (clk) { const ci = mk('img', 'nnn-clock-ico big'); ci.src = CLOCKS.c; ci.alt = '⏱'; wrap.appendChild(ci); }
    if (king) { const kc = mk('img', 'nnn-king-cam', undefined, 'Père fondateur'); kc.src = KING_CAMEO; kc.alt = '⚜'; wrap.appendChild(kc); }
    if (info.matricule) wrap.appendChild(mk('span', 'nnn-mat', '#' + esc(info.matricule), info.autoMat ? 'Matricule automatique (ordre du GDOC) — corrige-le avec ✎' : 'Matricule'));
    if (isOP) wrap.appendChild(mk('span', 'nnn-crown', '👑', 'Opérateur du topic'));

    // ---- le pseudo (copie), coloré selon le régiment
    const clone = target.cloneNode(true);
    clone.classList.remove('nnn-orig');
    clone.classList.add('nnn-clone');
    clone.removeAttribute('id');
    if (poo) {
      clone.classList.add('nnn-poo-name');
      [clone, ...clone.querySelectorAll('*')].forEach((e) => e.style.setProperty('color', '#7a4a12', 'important'));
    } else if (clk) {
      clone.classList.add('nnn-clock-name');
      [clone, ...clone.querySelectorAll('*')].forEach((e) => e.style.setProperty('color', '#ffd89a', 'important'));
    } else if (foot) {
      clone.classList.add('nnn-foot-name');
      [clone, ...clone.querySelectorAll('*')].forEach((e) => e.style.setProperty('color', '#ff8ccf', 'important'));
    } else if (king) {
      clone.classList.add('nnn-king-name');
      [clone, ...clone.querySelectorAll('*')].forEach((e) => e.style.setProperty('color', '#f3d27a', 'important'));
    } else if (isOP) {
      clone.classList.add('nnn-gold');                 // pseudo doré
    } else if (reg) {
      clone.classList.add('nnn-pseudo-reg');
      [clone, ...clone.querySelectorAll('*')].forEach((e) => e.style.setProperty('color', reg.color, 'important'));
    }
    wrap.appendChild(clone);
    { const bh = buddyHtml(pseudo, true); if (bh) wrap.appendChild(mk('span', 'nnn-bud-w', bh)); }
    if (poo) { wrap.appendChild(mk('span', 'nnn-poo-e', '💩')); wrap.appendChild(mk('span', 'nnn-poo-plate', '🚽 Chiottes publiques')); }
    if (clk) {
      wrap.appendChild(mk('span', 'nnn-clock-plate', '🤠 Le Maître du temps', 'Demandez-lui combien de secondes il reste…'));
    }
    if (king) wrap.appendChild(mk('span', 'nnn-king-plate', '⚜ Père fondateur'));
    if (foot) { const fg = mk('img', 'nnn-foot-ico g'); fg.src = PH.iconG; fg.alt = '🦶'; wrap.appendChild(fg); wrap.appendChild(mk('span', 'nnn-foot-plate', '🦶 Club des pieds')); }

    // ---- à DROITE du pseudo : logo, OP, compteur, statut, édition
    if (info.dead) {                                   // torche éteinte à la place du logo
      const img = mk('img', 'nnn-logo nnn-torch');
      img.src = TORCH_OUT; img.alt = 'Torche éteinte';
      img.title = 'Torche éteinte' + (reg ? ' — ' + reg.name : '');
      wrap.appendChild(img);
    } else if (reg) {
      const img = mk('img', 'nnn-logo');
      img.src = reg.logo; img.alt = reg.name; img.title = reg.name;
      wrap.appendChild(img);
    }
    if (isOP) wrap.appendChild(mk('span', 'nnn-op', 'OP'));
    if (king) wrap.appendChild(mk('span', 'nnn-hof', KING_MEDALS, 'Hall of Fame — éditions organisées par le père fondateur'));
    const n = totals[pseudo];
    if (n) wrap.appendChild(mk('span', 'nnn-count', '💬 ' + n, n + ' message(s) sur ce topic'));
    else if (crawling) wrap.appendChild(mk('span', 'nnn-count', '💬 …', 'Comptage en cours'));
    else if (crawlFailed) wrap.appendChild(mk('span', 'nnn-count', '💬 ?', 'Comptage indisponible'));
    if (info.dead) {
      wrap.appendChild(mk('span', 'nnn-dead', (info.link ? '<a href="' + esc(info.link) + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">' : '') + '☠ Tombé au combat' + (info.date ? ' le ' + esc(info.date) : '') + (info.link ? ' ↗</a>' : ''), (info.cause ? 'Cause : ' + info.cause : '') + (info.link ? ' (clic : voir le message)' : '')));
    }
    if (!info.dead) {
      const hit = detectDefeat(msg, pseudo);
      if (hit) {
        const sg = mk('button', 'nnn-suggest', '☠ Marquer comme tombé ?', 'Message détecté : « ' + hit + ' ». Clique pour valider (jamais automatique).');
        sg.type = 'button';
        sg.addEventListener('click', (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          const date = msgDate(msg);
          if (!confirm(`Marquer ${disp(pseudo)} comme tombé au combat le ${date} ?\n\nMessage détecté : « ${hit} »`)) return;
          overrides[pseudo] = Object.assign({}, overrides[pseudo], { dead: true, date });
          save('overrides', overrides); refreshAll();
        });
        const x = mk('button', 'nnn-suggest-x', '✕', 'Ignorer cette suggestion (faux positif / blague)');
        x.type = 'button';
        x.addEventListener('click', (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          const id = parts(msg).id;
          if (id) { dismissed[id] = true; save('dismissed', dismissed); }
          decorate(msg);
        });
        wrap.appendChild(sg); wrap.appendChild(x);
      }
    }
    const edit = mk('button', 'nnn-edit', '✎', 'Corriger ce membre (matricule, régiment, statut)');
    edit.type = 'button';
    edit.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); openEditor(pseudo, edit); });
    wrap.appendChild(edit);

    const card = cardOf(msg);
    if (msg._nnnCard && msg._nnnCard !== card) clearCard(msg._nnnCard);
    msg._nnnCard = card;
    card.classList.toggle('nnn-is-dead', !!info.dead);
    card.classList.toggle('nnn-is-op', isOP);
    card.classList.toggle('nnn-poo-msg', poo);
    card.classList.toggle('nnn-foot-msg', foot);
    card.classList.toggle('nnn-clock-msg', clk);
    card.classList.toggle('nnn-king-msg', king);
    card.classList.toggle('nnn-op-msg', isOP && opOn);
    if (reg) { card.setAttribute('data-nnn-reg', info.regiment); card.style.setProperty('--nnn-c', reg.color); }
    else { card.removeAttribute('data-nnn-reg'); card.style.removeProperty('--nnn-c'); }
    msg.dataset.nnn = '1';
    decorateQuotes(msg);
    decorateMentions(msg);
  }

  function allMessages() {
    return document.querySelectorAll(MSG_SEL);
  }
  function refreshAll() {
    allMessages().forEach(decorate);
    document.querySelectorAll('[data-nnn-p]').forEach((el) => tagify(el, el.dataset.nnnP));
    renderPanel();
  }

  /* ======================================================================
   *  ÉDITEUR MANUEL
   * ==================================================================== */
  function openEditor(pseudo, anchor) {
    document.querySelectorAll('.nnn-pop').forEach((p) => p.remove());
    const info = infoFor(pseudo);
    const pop = document.createElement('div');
    pop.className = 'nnn-pop';
    pop.innerHTML = `
      <b>${esc(disp(pseudo))}</b>
      <label>Matricule</label><input id="nnn-f-mat" value="${esc(info.matricule)}" placeholder="${esc((sheetData[pseudo] || {}).matricule || '')}">
      <label>Régiment</label>
      <select id="nnn-f-reg"><option value="">—</option>${[1, 2, 3, 4].map((i) => `<option value="${i}" ${info.regiment === i ? 'selected' : ''}>${REGIMENTS[i].name}</option>`).join('')}</select>
      <label>Statut</label>
      <select id="nnn-f-dead"><option value="0" ${!info.dead ? 'selected' : ''}>En vie</option><option value="1" ${info.dead ? 'selected' : ''}>Tombé au combat</option></select>
      <label>Date de l'échec (JJ/MM/AAAA)</label><input id="nnn-f-date" value="${esc(info.date)}" placeholder="${todayFR()}">
      <div class="nnn-btns"><button class="ok">Enregistrer</button><button class="rs" title="Revenir aux données du GDOC">Reset</button><button class="cn">×</button></div>`;
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + innerWidth - 256)) + 'px';
    pop.style.top = (window.scrollY + r.bottom + 6) + 'px';
    document.body.appendChild(pop);
    const $ = (s) => pop.querySelector(s);
    $('.cn').onclick = () => pop.remove();
    $('.rs').onclick = () => { delete overrides[pseudo]; save('overrides', overrides); pop.remove(); refreshAll(); };
    $('.ok').onclick = () => {
      const dead = $('#nnn-f-dead').value === '1';
      let date = $('#nnn-f-date').value.trim();
      if (dead && !date) date = todayFR();
      overrides[pseudo] = {
        matricule: $('#nnn-f-mat').value.trim(),
        regiment: $('#nnn-f-reg').value ? +$('#nnn-f-reg').value : null,
        dead,
        date: dead ? date : '',
      };
      save('overrides', overrides);
      pop.remove(); refreshAll();
    };
  }
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.nnn-pop') && !e.target.closest('.nnn-edit')) document.querySelectorAll('.nnn-pop').forEach((p) => p.remove());
  });

  /* ======================================================================
   *  PANNEAU STATS (vivants / tombés par régiment)
   * ==================================================================== */
  let panelOpen = GM_getValue('panelOpen', true);

  // Place le panneau DANS la page : sidebar JVChat si elle existe, sinon au-dessus des messages
  function ensurePanelHost() {
    let p = document.getElementById('nnn-panel');
    if (!p) { p = document.createElement('div'); p.id = 'nnn-panel'; }
    if (!p.querySelector('.nnn-content')) {      // décors persistants (ne sont pas recréés à chaque mise à jour)
      const embers = Array.from({ length: 16 }, (_, i) => `<i style="left:${(6 + (i * 37) % 88)}%;--dx:${((i * 13) % 40) - 20}px;animation-duration:${3 + (i * 7) % 4}s;animation-delay:${((i * 11) % 50) / 10}s"></i>`).join('');
      p.innerHTML = `<img class="nnn-palm l" src="${PALM_L}" alt=""><img class="nnn-palm r" src="${PALM_R}" alt=""><div class="nnn-embers">${embers}</div><div class="nnn-content"></div>`;
    }
    const newSide = document.querySelector('.jvchat-sidebar');
    const side = document.getElementById('jvchat-info');
    if (newSide) {                                   // nouveau JVChat
      p.classList.add('nnn-side');
      if (p.parentElement !== newSide) {
        const loader = newSide.querySelector('.refresh-loader');
        const spacer = loader ? loader.previousElementSibling : null;
        newSide.insertBefore(p, spacer || null);
      }
    } else if (side) {
      p.classList.add('nnn-side');
      if (p.parentElement !== side) side.appendChild(p);
    } else {
      p.classList.remove('nnn-side');
      const ref = document.querySelector('.bloc-pre-pagi-forum') || document.querySelector('.conteneur-messages-pagi') || document.querySelector('#forum-main-col');
      if (ref && ref.parentElement) { if (p.nextElementSibling !== ref) ref.parentElement.insertBefore(p, ref); }
      else if (!p.parentElement) document.body.prepend(p);
    }
    return p;
  }

  // Compteur de jours de l'aventure (1er → 30 novembre 2026)

  function dayInfo() {
    const start = new Date(2026, 10, 1), now = new Date();
    if (now < start) { const d = Math.ceil((start - now) / 864e5); return { txt: `Départ dans ${d} jour${d > 1 ? 's' : ''}`, pct: 0 }; }
    if (now >= new Date(2026, 11, 1)) return { txt: "L'aventure est terminée", pct: 100 };
    const day = now.getDate(), left = 30 - day;
    return { txt: `Jour ${day} sur 30 · ${left ? left + ' jour' + (left > 1 ? 's' : '') + ' restant' + (left > 1 ? 's' : '') : 'dernier jour !'}`, pct: day / 30 * 100 };
  }

  function makeConfetti() {
    const el = document.createElement('div');
    el.className = 'nnn-confetti';
    const cols = ['#ffd34d', '#ffe9a0', REGIMENTS[1].color, REGIMENTS[2].color, REGIMENTS[3].color, REGIMENTS[4].color];
    el.innerHTML = Array.from({ length: 44 }, (_, i) => `<i style="left:${(i * 23) % 100}%;background:${cols[i % cols.length]};animation-duration:${2.6 + (i * 7) % 20 / 10}s;animation-delay:${((i * 13) % 20) / 10}s;width:${6 + i % 4 * 2}px"></i>`).join('');
    return el;
  }

  /* ======================================================================
   *  CÉLÉBRATION DE FIN (1er décembre, minuit) : écran de félicitations + feux d'artifice + diplôme
   * ==================================================================== */
  const TAU = Math.PI * 2;
  const CELEB_AT = () => new Date(2026, 11, 1, 0, 0, 0);
  const celebReached = () => new Date() >= CELEB_AT();
  function myPseudo() {
    const m = GM_getValue('myPseudo', ''); if (m) return norm(m);
    const e = document.querySelector('.headerAccount__pseudo'); return e ? norm(e.textContent) : '';
  }
  const Cel = { el: null, raf: 0, parts: [], rockets: [], flashes: [], W: 0, H: 0, dpr: 1, cv: null, g: null, timer: 0, t0: 0, last: 0, snd: false, ac: null, preview: false };
  const CEL_COLORS = ['#ffd34d', '#ffe9a0', '#ff4d3d', '#6dff4a', '#4d9dff', '#ff5ad1', '#4dfff0', '#ffffff', '#ff9a2e'];

  function celSound(kind) {
    if (!Cel.snd) return;
    try {
      const c = Cel.ac; if (!c || c.state !== 'running') return; const now = c.currentTime;
      if (kind === 'boom') {
        const len = Math.floor(c.sampleRate * .9), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        const s = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, now); lp.frequency.exponentialRampToValueAtTime(90, now + .7);
        g.gain.value = .5; s.connect(lp); lp.connect(g); g.connect(c.destination); s.start(now);
      } else {
        const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(380, now); o.frequency.exponentialRampToValueAtTime(1500, now + .55); g.gain.setValueAtTime(.025, now); g.gain.linearRampToValueAtTime(0, now + .56); o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + .6);
      }
    } catch (e) { /* pas de son */ }
  }
  function celLaunch(x) {
    const { W, H } = Cel, sc = Math.min(W, H) / 800;
    Cel.rockets.push({ x: x === undefined ? W * (.12 + Math.random() * .76) : x, y: H + 8, vx: (Math.random() - .5) * 1.1, vy: -(9.5 + Math.random() * 3.2) * Math.max(.7, H / 800), ty: H * (.14 + Math.random() * .32), col: CEL_COLORS[Math.floor(Math.random() * CEL_COLORS.length)], tr: [], sc });
    celSound('whistle');
  }
  function celExplode(x, y, col, sc) {
    celSound('boom');
    const kinds = ['sphere', 'sphere', 'ring', 'heart', 'star', 'willow', 'double'], kind = kinds[Math.floor(Math.random() * kinds.length)];
    const col2 = CEL_COLORS[Math.floor(Math.random() * CEL_COLORS.length)];
    const add = (vx, vy, c, life, o) => Cel.parts.push(Object.assign({ x, y, vx, vy, c, life, max: life, s: 1.6 * Math.max(.8, sc), tr: [] }, o || {}));
    const n = reduceMotionCel() ? 50 : 110 + Math.floor(Math.random() * 60), V = 5.2 * sc;
    if (kind === 'ring') for (let i = 0; i < n; i++) { const a = i / n * TAU; add(Math.cos(a) * V, Math.sin(a) * V, col, 70 + Math.random() * 14); }
    else if (kind === 'heart') for (let i = 0; i < n; i++) { const t = i / n * TAU, hx = 16 * Math.pow(Math.sin(t), 3), hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); add(hx * V / 16, hy * V / 16, '#ff5a8a', 82); }
    else if (kind === 'star') for (let i = 0; i < n; i++) { const a = i / n * TAU, r = (Math.floor(i / n * 10) % 2 ? .5 : 1) * (.55 + .45 * Math.abs(Math.cos(a * 2.5))); add(Math.cos(a) * V * r * 1.1, Math.sin(a) * V * r * 1.1, '#ffe27a', 80); }
    else if (kind === 'willow') for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = Math.pow(Math.random(), .6) * V * .9; add(Math.cos(a) * sp, Math.sin(a) * sp, '#ffcf5a', 130 + Math.random() * 40, { g: .045, dr: .975 }); }
    else if (kind === 'double') for (let i = 0; i < n; i++) { const a = Math.random() * TAU, inner = i % 3 === 0, sp = (inner ? .5 : 1) * V * (.8 + Math.random() * .25); add(Math.cos(a) * sp, Math.sin(a) * sp, inner ? col2 : col, 74 + Math.random() * 20); }
    else for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = Math.pow(Math.random(), .5) * V; add(Math.cos(a) * sp, Math.sin(a) * sp, Math.random() < .25 ? '#ffffff' : col, 64 + Math.random() * 30, Math.random() < .12 ? { crackle: true } : null); }
    Cel.flashes.push({ x, y, r: 150 * sc, a: .5, c: col });
  }
  function reduceMotionCel() { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function celFrame(ts) {
    if (!Cel.el) return;
    const dt = Math.min(2.5, (ts - Cel.last) / 16.667 || 1); Cel.last = ts; const g = Cel.g, { W, H } = Cel;
    // fondu vers le noir : traîne des étincelles
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,' + Math.min(.5, .22 * dt) + ')'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = Cel.flashes.length - 1; i >= 0; i--) { const f = Cel.flashes[i], gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r); gr.addColorStop(0, f.c + '99'); gr.addColorStop(1, f.c + '00'); g.globalAlpha = f.a; g.fillStyle = gr; g.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2); f.a -= .06 * dt; if (f.a <= 0) Cel.flashes.splice(i, 1); }
    g.globalAlpha = 1;
    for (let i = Cel.rockets.length - 1; i >= 0; i--) {
      const r = Cel.rockets[i]; r.tr.push([r.x, r.y]); if (r.tr.length > 9) r.tr.shift(); r.x += r.vx * dt; r.y += r.vy * dt; r.vy += .11 * dt * Math.max(.7, H / 800);
      g.strokeStyle = '#ffe8b0'; g.lineWidth = 2; g.beginPath(); r.tr.forEach((p, k) => { g.globalAlpha = k / r.tr.length; k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.stroke(); g.globalAlpha = 1;
      if (r.vy > -1.4 || r.y <= r.ty) { celExplode(r.x, r.y, r.col, r.sc); Cel.rockets.splice(i, 1); }
    }
    for (let i = Cel.parts.length - 1; i >= 0; i--) {
      const p = Cel.parts[i]; p.tr.push(p.x, p.y); if (p.tr.length > 8) p.tr.splice(0, 2);
      p.vx *= Math.pow(p.dr || .985, dt); p.vy = p.vy * Math.pow(p.dr || .985, dt) + (p.g || .06) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      const a = Math.max(0, p.life / p.max); g.globalAlpha = a < .3 ? a / .3 : 1; g.strokeStyle = p.c; g.lineWidth = p.s * (.6 + a * .6); g.lineCap = 'round';
      g.beginPath(); g.moveTo(p.tr[0], p.tr[1]); for (let k = 2; k < p.tr.length; k += 2) g.lineTo(p.tr[k], p.tr[k + 1]); g.lineTo(p.x, p.y); g.stroke();
      if (p.crackle && p.life < 14 && Math.random() < .35) Cel.parts.push({ x: p.x, y: p.y, vx: (Math.random() - .5) * 3, vy: (Math.random() - .5) * 3, c: '#fff', life: 16, max: 16, s: 1.2, tr: [] });
      if (p.life <= 0) Cel.parts.splice(i, 1);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (Cel.parts.length > 2600) Cel.parts.splice(0, Cel.parts.length - 2600);
    Cel.raf = requestAnimationFrame(celFrame);
  }
  function celSchedule() {
    clearTimeout(Cel.timer); if (!Cel.el) return;
    const t = (performance.now() - Cel.t0) / 1000, volley = Math.floor(t / 7) !== Math.floor((t - .9) / 7) && t > 6;
    if (volley && !reduceMotionCel()) for (let i = 0; i < 6; i++) setTimeout(() => Cel.el && celLaunch(Cel.W * (.1 + i * .16)), i * 140); else celLaunch();
    Cel.timer = setTimeout(celSchedule, reduceMotionCel() ? 2400 : 480 + Math.random() * 620);
  }
  function celClose() {
    if (!Cel.el) return; cancelAnimationFrame(Cel.raf); clearTimeout(Cel.timer); Cel.el.remove(); Cel.el = null; Cel.parts = []; Cel.rockets = []; Cel.flashes = [];
    document.documentElement.style.overflow = ''; try { if (Cel.ac) Cel.ac.close(); } catch (e) { /* rien */ } Cel.ac = null; Cel.snd = false;
  }
  function celStats() {
    const me = myPseudo(), names = [...new Set([...Object.keys(sheetData), ...Object.keys(overrides)])], infos = names.map((p) => ({ p, i: infoFor(p) }));
    const total = infos.length, alive = infos.filter((x) => !x.i.dead).length, known = !!me && names.includes(me), mine = known ? infoFor(me) : null;
    const st = standings(), lead = st[0] && st[0].total ? st[0] : null, reg = mine && mine.regiment ? REGIMENTS[mine.regiment] : null;
    let bud = null; if (mine && mine.buddy) { const bi = infoFor(mine.buddy); bud = { name: (sheetData[mine.buddy] && sheetData[mine.buddy].name) || mine.buddyName || mine.buddy, alive: !bi.dead, key: mine.buddy }; }
    return { me, known, mine, total, alive, lead, reg, bud, msgs: me ? (totals[me] || 0) : 0, name: me ? disp(me) : '' };
  }
  function celebrate(preview) {
    if (Cel.el) return; Cel.preview = !!preview;
    const S = celStats(), alive = S.known && !S.mine.dead, fallen = S.known && S.mine.dead;
    const el = document.createElement('div'); el.className = 'nnn-cel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    const title = fallen ? `<span>BRAVO POUR TON COURAGE,</span> TU AS FAIT VIVRE LE <em>NO NUT NOVEMBER 2026</em>`
      : S.known ? `<span>FÉLICITATIONS,</span> TU AS SURVÉCU AU <em>NO NUT NOVEMBER 2026</em>`
        : `<span>FÉLICITATIONS</span> AUX SURVIVANTS DU <em>NO NUT NOVEMBER 2026</em>`;
    const rate = S.total ? Math.round(S.alive / S.total * 100) : 0, c = [];
    c.push(`<div class="b"><b>${S.alive}</b><small>survivants sur ${S.total}</small></div>`, `<div class="b"><b>${rate}%</b><small>ont tenu jusqu'au bout</small></div>`);
    if (S.lead) c.push(`<div class="b" style="--c:${REGIMENTS[S.lead.i].color}"><img src="${REGIMENTS[S.lead.i].logo}" alt=""><small>${REGIMENTS[S.lead.i].name} en tête · ${S.lead.alive} survivant${S.lead.alive > 1 ? 's' : ''}</small></div>`);
    if (S.known && S.msgs) c.push(`<div class="b"><b>${S.msgs}</b><small>messages postés</small></div>`);
    const sub = alive ? `${esc(S.name)} · ${S.reg ? esc(S.reg.name) : 'sans régiment'}${S.mine.matricule ? ' · #' + esc(S.mine.matricule) : ''}` : fallen ? `${esc(S.name)} · tombé au combat${S.mine.date ? ' le ' + esc(S.mine.date) : ''}, mais jamais oublié` : '30 jours, 4 régiments, une seule torche à garder allumée';
    const bud = S.bud ? `<div class="bud">🤝 ${S.bud.alive ? `Ton binôme <b>${esc(S.bud.name)}</b> a survécu lui aussi !` : `Ton binôme <b>${esc(S.bud.name)}</b> est tombé, mais vous avez tenu ensemble.`}</div>` : '';
    el.innerHTML = `<canvas></canvas><div class="in"><div class="logos">${[1, 2, 3, 4].map((i) => `<img src="${REGIMENTS[i].logo}" alt="">`).join('')}</div><h1>${title}</h1><p class="sub">${sub}</p><div class="stats">${c.join('')}</div>${bud}
      <div class="btns"><button type="button" data-a="more">🎆 Encore des feux d'artifice</button>${S.known ? '<button type="button" data-a="copy">📋 Copier mon message</button>' : ''}<button type="button" data-a="snd">🔇 Son</button><button type="button" data-a="close" class="pri">Continuer</button></div>${preview ? '<div class="pv">Aperçu — la vraie célébration s\'affichera le 1er décembre à minuit.</div>' : ''}</div>`;
    document.body.appendChild(el); document.documentElement.style.overflow = 'hidden'; Cel.el = el; Cel.cv = el.querySelector('canvas'); Cel.g = Cel.cv.getContext('2d');
    const fit = () => { Cel.dpr = Math.min(2, window.devicePixelRatio || 1); Cel.W = el.clientWidth; Cel.H = el.clientHeight; Cel.cv.width = Cel.W * Cel.dpr; Cel.cv.height = Cel.H * Cel.dpr; Cel.g.setTransform(Cel.dpr, 0, 0, Cel.dpr, 0, 0); };
    fit(); window.addEventListener('resize', fit);
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') celClose(); }); el.tabIndex = -1; el.focus();
    el.querySelector('[data-a=close]').onclick = celClose;
    el.querySelector('[data-a=more]').onclick = () => { for (let i = 0; i < 7; i++) setTimeout(() => Cel.el && celLaunch(Cel.W * (.08 + i * .14)), i * 120); };
    el.querySelector('[data-a=snd]').onclick = (e) => { Cel.snd = !Cel.snd; e.target.textContent = Cel.snd ? '🔊 Son' : '🔇 Son'; if (Cel.snd && !Cel.ac) { try { Cel.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (er) { Cel.snd = false; } } if (Cel.ac) Cel.ac.resume(); };
    const cp = el.querySelector('[data-a=copy]'); if (cp) cp.onclick = () => { const txt = alive ? `🔥 J'ai survécu au No Nut November 2026 ! ${S.reg ? S.reg.name + ' · ' : ''}${S.alive} survivants sur ${S.total}. Félicitations aux kheys qui ont tenu 💪` : `🕯 Tombé au combat, mais fier d'avoir participé au No Nut November 2026 !`; try { navigator.clipboard.writeText(txt).then(() => { cp.textContent = '✅ Copié !'; }, () => { prompt('Copie ce message :', txt); }); } catch (e) { prompt('Copie ce message :', txt); } };
    Cel.t0 = performance.now(); Cel.last = performance.now(); Cel.raf = requestAnimationFrame(celFrame);
    for (let i = 0; i < 4; i++) setTimeout(() => Cel.el && celLaunch(Cel.W * (.2 + i * .2)), 250 + i * 260);
    Cel.timer = setTimeout(celSchedule, 1800);
  }
  function checkCelebration() {
    if (Cel.el || !celebReached() || GM_getValue('celebSeen', 0)) return;
    if (document.hidden) return;
    GM_setValue('celebSeen', 1); celebrate(false);
  }
  (function planCelebration() {
    const ms = CELEB_AT() - new Date();
    if (ms > 0 && ms < 2147000000) setTimeout(() => { refreshSheet(true).then(() => { refreshAll(); checkCelebration(); }); }, ms + 500);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkCelebration(); });
    setInterval(checkCelebration, 30000); setTimeout(checkCelebration, 3000);
  })();

  let lastPanelHtml = '';
  const THEME_OPTS = [
    { k: 'op', label: '👑 Isssoufle — thème de l\'OP', sub: 'Fond sombre doré sur ses messages', get: () => opOn, set: (v) => { opOn = v; GM_setValue('opOn', v); } },
    { k: 'king', label: '⚜ Kaaido — Père fondateur', sub: 'Cape royale, portrait et médailles des éditions', get: () => kingOn, set: (v) => { kingOn = v; GM_setValue('kingOn', v); } },
    { k: 'clock', label: '⏱ Prolissou — thème horloges', sub: 'Saloon, horloges qui tournent et pseudo bordeaux', get: () => clockOn, set: (v) => { clockOn = v; GM_setValue('clockOn', v); } },
    { k: 'foot', label: '🦶 Levodpa2 — thème pieds', sub: 'Parquet, pieds et pseudo rose', get: () => footOn, set: (v) => { footOn = v; GM_setValue('footOn', v); } },
  ];
  function renderPanel() {
    const p = ensurePanelHost();
    const box = p.querySelector('.nnn-content');
    const keepScroll = (box.querySelector('.nnn-scroll') || {}).scrollTop || 0;
    const names = new Set([...Object.keys(sheetData), ...Object.keys(overrides)]);
    const st = { 1: [0, 0], 2: [0, 0], 3: [0, 0], 4: [0, 0] };
    let alive = 0, dead = 0;
    names.forEach((n) => {
      const i = infoFor(n);
      if (i.dead) dead++; else alive++;
      if (i.regiment) st[i.regiment][i.dead ? 1 : 0]++;
    });
    Beach.update();
    const di = dayInfo();
    const stand = standings();
    const leader = stand[0].total && (stand[0].alive > stand[1].alive || stand[0].rate > stand[1].rate) ? stand[0].i : 0;
    const reached = finalReached();
    let html = `<div class="nnn-ph" id="nnn-toggle"><img class="nnn-ft" src="${TORCH_LIT}" alt=""><div class="nnn-title"><b>NO NUT NOVEMBER</b><span>2026 · L'AVENTURE ${panelOpen ? '▾' : '▸'}</span></div><img class="nnn-ft" src="${TORCH_LIT}" alt="">${panelOpen ? `<button class="nnn-gear ${settingsOpen ? 'on' : ''}" id="nnn-gear" title="Paramètres" aria-label="Paramètres">⚙</button>` : ''}</div>`;
    if (panelOpen) {
      if (settingsOpen && panelOpen) html += `<div class="nnn-set"><h4>PARAMÈTRES</h4>${THEME_OPTS.map((o) => `<label><input type="checkbox" data-theme-opt="${o.k}" ${o.get() ? 'checked' : ''}><span>${o.label}<small>${o.sub}</small></span></label>`).join('')}</div>`;
      html += `<div class="nnn-days"><div class="nnn-dbar"><i style="width:${di.pct}%"></i><em style="left:${di.pct}%"></em></div><div class="nnn-dtxt">${di.txt}</div></div>`;
      html += `<div class="nnn-score"><div class="nnn-sc alive"><b>${alive}</b><span>en vie</span></div><div class="nnn-sc dead"><b>${dead}</b><span>tombés au combat</span></div></div>`;
      html += `<div class="nnn-regs">` + [1, 2, 3, 4].map((i) => {
        const tot = st[i][0] + st[i][1], pct = tot ? st[i][0] / tot * 100 : 0;
        return `<div class="nnn-reg" style="--c:${REGIMENTS[i].color}">${leader === i ? '<span class="nnn-lead">👑 En tête</span>' : ''}<img src="${REGIMENTS[i].logo}" alt=""><div><b>${REGIMENTS[i].name}</b><div class="nnn-rb"><i style="width:${pct}%"></i></div><small>${st[i][0]} en vie · ${st[i][1]} ☠</small></div></div>`;
      }).join('') + `</div>`;
      const btn = (v, label, extra) => `<button data-view="${v}" class="${view === v ? 'on' : ''} ${extra || ''}">${label}</button>`;
      html += `<div class="nnn-pbody">${btn('rank', '🏆 Classement')}${btn('charts', '📈 Courbes')}${btn('wall', `🪦 Les disparus (${dead})`)}${celebReached() ? '<button data-celeb="1">🎆 Célébration</button>' : ''}${btn('final', reached || finalPreview ? '🏅 Podium final' : '🔒 Podium final', reached || finalPreview ? '' : 'off')}</div>`;
      if (lastSync) html += `<div class="nnn-sync">🔄 GDOC synchronisé à ${new Date(lastSync).toLocaleTimeString('fr-FR')}</div>`;
      if (gdocInfo) html += `<div class="nnn-warn">${esc(gdocInfo)}</div>`;
      if (!sheetUrl) html += `<div class="nnn-warn">⚠ GDOC non configuré (menu Tampermonkey → « Définir l'URL du GDOC »)</div>`;
      if (crawlInfo) html += `<div class="nnn-warn" style="color:inherit;opacity:.7">${esc(crawlInfo)}</div>`;
      if (view === 'rank') html += rankingHtml();
      if (view === 'charts') html += chartsHtml();
      if (view === 'wall') html += wallHtml();
      if (view === 'final') html += finalHtml();
    }
    if (html !== lastPanelHtml || !box.firstChild) {
      lastPanelHtml = html;
      box.innerHTML = html;
      box.querySelector('#nnn-toggle').onclick = () => { panelOpen = !panelOpen; GM_setValue('panelOpen', panelOpen); renderPanel(); };
      box.querySelectorAll('[data-view]').forEach((b) => {
        b.onclick = () => {
          const v = b.dataset.view;
          if (v === 'final' && !finalReached() && !finalPreview) { alert("Le podium final sera dévoilé le 30 novembre.\n(Un aperçu est disponible via le menu Tampermonkey.)"); return; }
          view = view === v ? '' : v;
          if (view === 'final') GM_setValue('finalSeen', 1);
          renderPanel();
        };
      });
      const gear = box.querySelector('#nnn-gear');
      if (gear) gear.onclick = (e) => { e.stopPropagation(); settingsOpen = !settingsOpen; if (settingsOpen && !panelOpen) panelOpen = true; renderPanel(); };
      box.querySelectorAll('[data-theme-opt]').forEach((c) => { c.onchange = () => { THEME_OPTS.find((o) => o.k === c.dataset.themeOpt).set(c.checked); refreshAll(); }; });
      const cb = box.querySelector('[data-celeb]'); if (cb) cb.onclick = () => celebrate(false);
      box.querySelectorAll('[data-wmode]').forEach((b) => { b.onclick = () => { wallMode = b.dataset.wmode; GM_setValue('wallMode', wallMode); renderPanel(); }; });
      box.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { rankTab = b.dataset.tab; renderPanel(); }; });
      box.querySelectorAll('[data-chart]').forEach((b) => { b.onclick = () => { chartKind = b.dataset.chart; renderPanel(); }; });
      box.querySelectorAll('[data-cum]').forEach((b) => { b.onclick = () => { chartCum = !chartCum; renderPanel(); }; });
      const only = box.querySelector('#nnn-only');
      if (only) only.onchange = () => { rankOnlyMembers = only.checked; renderPanel(); };
      const sc = box.querySelector('.nnn-scroll');
      if (sc) sc.scrollTop = keepScroll;
    }
    const bh = box.querySelector('.nnn-beach-host');
    if (bh && panelOpen && view === 'wall' && wallMode === 'beach') Beach.mount(bh); else Beach.unmount();
    const conf = p.querySelector('.nnn-confetti');           // confettis : créés une seule fois à l'ouverture du podium
    if (view === 'final' && panelOpen) { if (!conf) p.appendChild(makeConfetti()); } else if (conf) conf.remove();
  }

  /* ======================================================================
   *  MENU TAMPERMONKEY
   * ==================================================================== */
  GM_registerMenuCommand("Définir l'URL du GDOC", () => {
    const v = prompt('URL du Google Sheets (partagé en lecture pour « tous ceux qui ont le lien ») :', sheetUrl || '');
    if (v === null) return;
    sheetUrl = v.trim(); GM_setValue('sheetUrl2', sheetUrl);
    refreshSheet(true).then(refreshAll);
  });
  GM_registerMenuCommand('Rafraîchir le GDOC maintenant', () => refreshSheet(true).then(refreshAll));
  GM_registerMenuCommand('Diagnostic du GDOC (colonnes détectées)', () => {
    alert((sheetReport || "Aucune donnée GDOC lue pour l'instant (URL non définie ou GDOC non public).") + '\n\nMembres dans le GDOC : ' + Object.keys(sheetData).length);
  });
  GM_registerMenuCommand('Associer les colonnes du GDOC à la main', () => {
    const cur = Object.keys(colMap).map((k) => k + '=' + colMap[k]).join(', ');
    const v = prompt('Indique la lettre de colonne de chaque info (laisse vide = détection auto).\nExemple : pseudo=A, matricule=B, regiment=J, elim=F+G+H\n\nInfos possibles : pseudo, matricule, regiment, elim (plusieurs colonnes reliées par +)', cur);
    if (v === null) return;
    const m = {};
    v.split(/[,;]+/).forEach((p) => { const [k, l] = p.split('=').map((x) => (x || '').trim()); if (k && l && /^(pseudo|matricule|regiment)$/.test(k) && /^[A-Za-z]{1,2}$/.test(l)) m[k] = l.toUpperCase(); else if (k === 'elim' && /^[A-Za-z]{1,2}(\+[A-Za-z]{1,2})*$/.test(l)) m[k] = l.toUpperCase(); });
    colMap = m; save('colMap', colMap);
    refreshSheet(true).then(() => { refreshAll(); alert(sheetReport); });
  });
  GM_registerMenuCommand('Matricules automatiques (si colonne absente) : ON/OFF', () => {
    autoMat = !autoMat; GM_setValue('autoMat', autoMat);
    refreshSheet(true).then(() => { refreshAll(); alert('Numérotation automatique : ' + (autoMat ? 'ACTIVÉE' : 'désactivée')); });
  });
  GM_registerMenuCommand('Vitesse du comptage (pages en parallèle)', () => {
    const v = prompt('Nombre de pages téléchargées en même temps (1 à 8, défaut 3).\nPlus haut = plus rapide, mais le site peut ralentir ou bloquer.', GM_getValue('conc', 3));
    if (v === null) return; GM_setValue('conc', Math.max(1, Math.min(8, +v || 3)));
  });
  GM_registerMenuCommand('Thème « pieds » : ON/OFF', () => {
    footOn = !footOn; GM_setValue('footOn', footOn); refreshAll();
    document.querySelectorAll('[data-nnn-p]').forEach((el) => tagify(el, el.dataset.nnnP));
  });
  GM_registerMenuCommand('Thème « horloges » (Prolissou) : ON/OFF', () => {
    clockOn = !clockOn; GM_setValue('clockOn', clockOn); refreshAll();
    document.querySelectorAll('[data-nnn-p]').forEach((el) => tagify(el, el.dataset.nnnP));
  });
  GM_registerMenuCommand('Thème « Fondateur » (Kaaido) : ON/OFF', () => {
    kingOn = !kingOn; GM_setValue('kingOn', kingOn); refreshAll();
    document.querySelectorAll('[data-nnn-p]').forEach((el) => tagify(el, el.dataset.nnnP));
  });
  GM_registerMenuCommand('Recompter tous les messages', () => { counts = { pages: {} }; totals = {}; save('counts_' + TOPIC_ID, counts); crawl(); });
  GM_registerMenuCommand('Ouvrir le classement des messages', () => { view = 'rank'; panelOpen = true; renderPanel(); });
  GM_registerMenuCommand('Ouvrir le mur des disparus', () => { view = 'wall'; panelOpen = true; renderPanel(); });
  GM_registerMenuCommand('Aperçu de la célébration de fin', () => celebrate(true));
  GM_registerMenuCommand('Définir mon pseudo (célébration)', () => { const v = prompt('Ton pseudo JVC (détecté automatiquement si tu es connecté) :', GM_getValue('myPseudo', '') || myPseudo()); if (v !== null) GM_setValue('myPseudo', v.trim()); });
  GM_registerMenuCommand('Plage des éteints en plein écran', () => { view = 'wall'; wallMode = 'beach'; panelOpen = true; renderPanel(); setTimeout(() => Beach.fullscreen(true), 80); });
  GM_registerMenuCommand('Ouvrir les courbes (éliminations / messages)', () => { view = 'charts'; panelOpen = true; renderPanel(); });
  GM_registerMenuCommand('Aperçu du podium final (test)', () => { finalPreview = true; view = 'final'; panelOpen = true; lastPanelHtml = ''; renderPanel(); });
  GM_registerMenuCommand('Activer / désactiver la détection des défaites', () => {
    detectOn = !detectOn; GM_setValue('detectOn', detectOn);
    alert('Détection des défaites : ' + (detectOn ? 'ACTIVÉE' : 'désactivée')); refreshAll();
  });
  GM_registerMenuCommand('Réinitialiser les suggestions ignorées', () => { dismissed = {}; save('dismissed', dismissed); refreshAll(); });
  GM_registerMenuCommand('Exporter les corrections manuelles', () => prompt('Copie ce JSON :', JSON.stringify(overrides)));
  GM_registerMenuCommand('Importer des corrections manuelles', () => {
    const v = prompt('Colle le JSON :'); if (!v) return;
    try { overrides = JSON.parse(v); save('overrides', overrides); refreshAll(); } catch (e) { alert('JSON invalide'); }
  });

  /* ======================================================================
   *  OBSERVATEUR (nouveaux messages : pagination AJAX, JVChat, citations…)
   * ==================================================================== */
  let scheduled = false;
  const scan = () => {
    allMessages().forEach((m) => { if (!m.dataset.nnn || !m.querySelector('.nnn-line')) decorate(m); });
    ensurePanelHost();
  };
  const mo = new MutationObserver((muts) => {
    let relevant = false;
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1 || (n.closest && n.closest('#nnn-panel'))) continue;
        if ((n.matches && n.matches(MSG_SEL + ', #jvchat-leftbar, #jvchat-main, .jvchat-container')) ||
            (n.querySelector && n.querySelector(MSG_SEL + ', #jvchat-leftbar, .jvchat-container'))) { relevant = true; break; }
      }
      if (relevant) break;
    }
    if (!relevant || scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; scan(); });
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // évènements officiels de JVChat Premium (en plus de l'observateur)
  [window, typeof unsafeWindow !== 'undefined' ? unsafeWindow : null].filter(Boolean).forEach((w) => {
    try {
      w.addEventListener('jvchat:newmessage', () => setTimeout(scan, 0));
      w.addEventListener('jvchat:activation', () => setTimeout(() => { scan(); renderPanel(); }, 50));
    } catch (e) { /* ignore */ }
  });

  /* ======================================================================
   *  DÉMARRAGE
   * ==================================================================== */
  recomputeTotals();
  refreshAll();
  refreshSheet(false).then(refreshAll);
  if (finalReached() && !GM_getValue('finalSeen', 0)) { view = 'final'; panelOpen = true; GM_setValue('finalSeen', 1); renderPanel(); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSheet(false).then(refreshAll); });
  window.addEventListener('focus', () => refreshSheet(false).then(refreshAll));
  crawl();
  setInterval(() => {
    if (document.hidden) return;
    ensurePanelHost();
    refreshSheet(false).then(refreshAll);
    crawl();
  }, COUNT_REFRESH_MS);
})();
