import { describe, expect, it } from 'vitest'
import { initials } from './initials'

describe('initials', () => {
  it('takes the first letter of up to two words', () => {
    expect(initials('ana  maria souza')).toBe('AM')
    expect(initials('Bruno')).toBe('B')
  })
})
