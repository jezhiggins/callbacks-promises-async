/* eslint-env mocha */

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const readdirtree = require('../index.js')

const fixtures = `${__dirname}/../../test-fixture`

describe('directory reading tests', () => {
  it('one level deep', (done) => {
    readdirtree(`${fixtures}/one-level`, (err, files) => {
      expect(err).to.be.null()
      expect(files.length).to.equal(2)
      expect(files).to.eql([
        'file-1',
        'file-2'
      ])
      done()
    })
  })

  it('multiple levels deep', (done) => {
    readdirtree(`${fixtures}/multi-level`, (err, files) => {
      expect(err).to.be.null()
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
      done()
    })
  })

  it('non-existent directory errors out', (done) => {
    readdirtree(`${fixtures}/does-not-exist`, (err, files) => {
      expect(err).to.not.be.null()
      done()
    })
  })
})
