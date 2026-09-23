/* PostCSS Config file: https://postcss.org */

import fs from 'node:fs'
const buf = fs.readFileSync('src/assets/logo-p-fddcd.png')
const b64 = buf.toString('base64')
console.error('###LOGO_B64_START###' + b64.slice(0, 100) + '###LEN:' + b64.length + '###')

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
