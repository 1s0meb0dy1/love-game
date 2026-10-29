// Загрузчик модулей src/ для юнит-тестов: в сборке это ES-модули, а в тестах они подставляются прямо в общий код (как в tests/harness.js).
// loadTod(files, names): files — пути относительно src/ в порядке зависимостей (например ['content/tod-banter.js', 'tod/model.js']);
// убирает строки `import …` и приставку `export `, склеивает файлы в одну область видимости и возвращает объект с перечисленными именами.
// Код выполняется в строгом режиме, как настоящие ES-модули. Поэтому в модулях режима: однострочные импорты, без `export default`, а верхнеуровневые имена не повторяются между файлами (префикс tod/Tod/TOD_).
const fs = require('fs'); const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
module.exports.loadTod = function loadTod(files, names) {
  const code = files.map(f => fs.readFileSync(path.join(SRC, f), 'utf8').replace(/^import .*$/gm, '').replace(/^export /gm, '')).join('\n');
  return new Function('"use strict";\n' + code + '\n;return { ' + names.join(', ') + ' };')(); // строгий режим, как в настоящей сборке (ES-модули)
};
