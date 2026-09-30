import { describe, expect, it } from 'vitest'
import { sanitize } from './appearance'

describe('appearance sanitize', () => {
  it('keeps valid fields, including uci strings', () => {
    expect(sanitize({ seed: '#80636C', variant: 'vibrant', contrast: '0.5', mode: 'dark' })).toEqual({
      seed: '#80636C',
      variant: 'vibrant',
      contrast: 0.5,
      mode: 'dark',
    })
  })
  it('drops each bad field on its own', () => {
    expect(sanitize({ seed: 'red', variant: 'rainbow', contrast: '7', mode: 'dim' })).toEqual({})
    expect(sanitize({ seed: '#123456', mode: 'dim' })).toEqual({ seed: '#123456' })
  })
  it('treats an empty router section as nothing saved', () => {
    expect(sanitize({})).toEqual({})
  })
})
