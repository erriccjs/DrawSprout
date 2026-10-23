/* Sets the language before the page finishes loading.
   The same rule lives in src/i18n/locale.ts. English unless the device
   language is Indonesian, and a saved choice wins. */
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem('drawsprout.locale');
  } catch (error) {
    stored = null;
  }
  var list = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || ''];
  var indonesian = false;
  for (var index = 0; index < list.length; index += 1) {
    var tag = String(list[index] || '').toLowerCase();
    if (tag === 'id' || tag.indexOf('id-') === 0) indonesian = true;
  }
  var lang = stored === 'en' || stored === 'id' ? stored : (indonesian ? 'id' : 'en');
  document.documentElement.lang = lang;
  var link = document.getElementById('drawsprout-manifest');
  if (link) link.setAttribute('href', lang === 'id' ? '/manifest.webmanifest' : '/manifest-en.webmanifest');
  document.title = lang === 'id'
    ? 'DrawSprout — Belajar Menggambar'
    : 'DrawSprout — Learn to Draw';
  var description = document.querySelector('meta[name="description"]');
  if (description) {
    description.setAttribute('content', lang === 'id'
      ? 'Belajar menggambar langkah demi langkah di tablet.'
      : 'Learn to draw, one step at a time, on a tablet.');
  }
})();
