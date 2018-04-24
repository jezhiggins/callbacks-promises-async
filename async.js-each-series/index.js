const fs = require('fs')
const eachSeries = require('async-each-series')

function readdirtree (root, callback) {
  walktree(root, '', callback)
}

function walktree (root, prefix, callback) {
  fs.readdir(root, (err, paths) => {
    if (err) {
      return callback(err)
    }

    checkPaths(root, paths, 0, prefix, callback)
  })
} // walktree

function checkPaths (rootPath, paths, index, prefix, callback) {
  const found = []

  eachSeries(
      paths,
      (path, next) => {
        const fullPath = `${rootPath}/${path}`
        const localPath = `${prefix}${path}`

        fs.stat(fullPath, (err, stats) => {
          if (err) {
            callback(err)
          } else if (stats.isFile()) {
            found.push(localPath)
            next()
          } else if (stats.isDirectory()) {
            walktree(fullPath, `${localPath}/`, (err, files) => {
              if (err) {
                callback(err)
              }
              found.push(...files)
              next()
            })
          } else {
            next()
          }
        })
      },
      err => callback(err || null, found)
  )
} // checkPaths

module.exports = readdirtree
