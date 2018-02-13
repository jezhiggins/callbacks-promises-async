/* eslint-env mocha */

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)
const assert = require('assert')

const readdirtree = require('../index.js')

const fixtures = `${__dirname}/../../test-fixture`

describe('return promises to mocha', () => {
  it('one level deep', () => {
    return readdirtree(`${fixtures}/one-level`)
      .then(files => {
        expect(files.length).to.equal(2)
        expect(files).to.eql([
          'file-1',
          'file-2'
        ])
      })
  })

  it('multiple levels deep', () => {
    return readdirtree(`${fixtures}/multi-level`)
      .then(files => {
        expect(files.length).to.equal(13)
        expect(files).to.eql([
          'a',
          'b/a',
          'b/b',
          'c',
          'd/a/a',
          'd/a/b',
          'd/b',
          'd/c',
          'd/d/a',
          'd/d/b/a',
          'd/d/b/b',
          'e',
          'f'
        ])
      })
  })

  it('non-existent directory errors out', () => {
    return readdirtree(`${fixtures}/does-not-exist`)
      .then(() => assert.fail())
      .catch(() => { })
  })
})
