const fs = require('fs')

function readdirtree (root, callback) {
  walktree(root, '', callback)
}

function walktree (root, prefix, callback) {
  fs.readdir(root, (err, paths) => {
    if (err) {
      return callback(err)
    }

    checkPaths(root, paths, 0, prefix, [], callback)
  })
} // walktree

function checkPaths (rootPath, paths, index, prefix, found, callback) {
  if (index === paths.length) {
    return callback(null, found)
  }

  const path = paths[index]
  const fullPath = `${rootPath}/${path}`
  const localPath = `${prefix}${path}`
  const next = () => checkPaths(rootPath, paths, index + 1, prefix, found, callback)

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
} // checkPaths

module.exports = (root) => {
  return new Promise((resolve, reject) => {
    readdirtree(root, (err, files) => {
      if (err) {
        return reject(err)
      }
      resolve(files)
    })
  })
}
