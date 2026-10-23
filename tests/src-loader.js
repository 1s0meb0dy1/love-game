const fs = require('fs'); const path = require('path');
module.exports = () => fs.readFileSync(path.join(__dirname, '..', 'src', 'app.jsx'), 'utf8');
