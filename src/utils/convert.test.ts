import fs from 'node:fs'
import { describe, it, expect } from 'vitest'

describe('convert logo', () => {
  it('converts png to base64', () => {
    const buf = fs.readFileSync('src/assets/logo-p-fddcd.png')
    const b64 = buf.toString('base64')
    fs.writeFileSync('src/utils/logo-b64.txt', `data:image/png;base64,${b64}`)
    expect(buf.length).toBeGreaterThan(0)
  })
})
