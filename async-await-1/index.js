const fs = require('fs')
const promisify = require('util').promisify

const readdir = promisify(fs.readdir)
const stat = promisify(fs.stat)

function readdirtree (root) {
  return walktree(root, '')
}

function walktree (root, prefix) {
  return readdir(root)
      .then(paths => checkPaths(root, paths, prefix))
} // walktree

function checkPaths (rootPath, paths, prefix) {
  const checks = paths.map(path => {
    const fullPath = `${rootPath}/${path}`
    const localPath = `${prefix}${path}`

    return stat(fullPath)
      .then(stats => {
        if (stats.isFile()) {
          return localPath
        }
        if (stats.isDirectory()) {
          return walktree(fullPath, `${localPath}/`)
        }
      })
  })

  return Promise.all(checks)
      .then(files => flattenArray(files))
} // checkPaths

function flattenArray (files) {
  return [].concat(...files)
}

module.exports = readdirtree
