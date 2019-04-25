import { expect } from 'chai'
import {jsonHash, getBoolean} from '../../server/util'

describe('server/util', () => {
  describe('jsonHash', () => {
    it('should hash an object', () => {
      const input = {approval: '😍'}
      expect(jsonHash(input)).to.equal('a1e5345e22fb40487c724595a9251a22aaf5ff820dee77e1a5222279115ed4d1')
    })
  })

  describe('getBoolean', () => {
    it('return true when passed boolean true', () => {
      expect(getBoolean(true)).to.be.true
    })

    it('return true when passed boolean true and default false', () => {
      expect(getBoolean(true, false)).to.be.true
    })

    it('return true when passed "true"', () => {
      expect(getBoolean("true")).to.be.true
    })

    it('return true when passed "true" and default false', () => {
      expect(getBoolean("true", false)).to.be.true
    })

    it('return false when passed non boolean string with default value as true', () => {
      expect(getBoolean("123", true)).to.be.false
      expect(getBoolean("", true)).to.be.false
    })

    it('return true when passed null and default true', () => {
      expect(getBoolean(null, true)).to.be.true
    })

    it('return false when passed boolean false', () => {
      expect(getBoolean(false)).to.be.false
    })

    it('return false when passed boolean false and default true', () => {
      expect(getBoolean(false, true)).to.be.false
    })

    it('return false when passed "false"', () => {
      expect(getBoolean("false")).to.be.false
    })

    it('return false when passed "false" and default true', () => {
      expect(getBoolean("false", true)).to.be.false
    })

    it('return false when passed null and default false', () => {
      expect(getBoolean(null, false)).to.be.false
    })
  })
})
