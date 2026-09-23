import fs from 'node:fs'
import { describe, it, expect } from 'vitest'

describe('inspect asset', () => {
  it('reads logo-p-fddcd.png', () => {
    const buffer = fs.readFileSync('src/assets/logo-p-fddcd.png')
    const magic = buffer.subarray(0, 8).toString('hex')
    const width = buffer.readUInt32BE(16)
    const height = buffer.readUInt32BE(20)
    console.log('BUFFER LEN:', buffer.length)
    console.log('MAGIC HEX:', magic)
    console.log('DIMENSIONS:', `${width}x${height}`)
    console.log('ASPECT RATIO (w/h):', width / height)
    console.log('BASE64 PREFIX:', buffer.subarray(0, 32).toString('base64'))
    const base64 = buffer.toString('base64')
    expect(magic).toBe('89504e470d0a1a0a')
    expect(width).toBeGreaterThan(0)
    fs.writeFileSync('src/utils/logo-info.json', JSON.stringify({
      width,
      height,
      ratio: width / height,
      base64Prefix: base64.substring(0, 60),
      base64TotalLen: base64.length
    }))
  })
})
