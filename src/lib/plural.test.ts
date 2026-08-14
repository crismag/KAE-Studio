/**
 * The helper that exists to avoid a tell, producing a tell.
 *
 * Its own comment promised *"1 dependency / 2 dependencies"* while the code
 * appended `s`, so a live deployment's GitHub settings page read **"68
 * repositorys available"**. Nothing caught it because the helper reads as
 * though it handles the case, so callers stopped passing the plural.
 */

import { describe, expect, it } from 'vitest'

import { plural } from './plural'

describe('counting things in English', () => {
  it('turns a consonant + y into -ies', () => {
    expect(plural(68, 'repository')).toBe('68 repositories')
    expect(plural(2, 'dependency')).toBe('2 dependencies')
  })

  it('leaves a vowel + y alone', () => {
    // `days`, not `daies`. The rule is about the consonant, not the letter.
    expect(plural(3, 'day')).toBe('3 days')
  })

  it('adds the syllable a sibilant needs', () => {
    expect(plural(2, 'branch')).toBe('2 branches')
    expect(plural(0, 'class')).toBe('0 classes')
  })

  it('still says one of a thing in the singular', () => {
    expect(plural(1, 'repository')).toBe('1 repository')
    expect(plural(1, 'branch')).toBe('1 branch')
  })

  it('lets a caller name an irregular plural', () => {
    // Rather than growing a table nobody maintains.
    expect(plural(2, 'person', 'people')).toBe('2 people')
  })

  it('says none rather than nothing, when there are none', () => {
    expect(plural(0, 'source')).toBe('0 sources')
  })
})
