const fs = require('fs')
const promisify = require('util').promisify

const readdir = promisify(fs.readdir)
const stat = promisify(fs.stat)

function readdirtree (root) {
  return walktree(root, '')
}

async function walktree (root, prefix) {
  const paths = await readdir(root)
  return checkPaths(root, paths, prefix)
} // walktree

async function checkPaths (rootPath, paths, prefix) {
  const allFiles = []

  for (const path of paths) {
    const fullPath = `${rootPath}/${path}`
    const localPath = `${prefix}${path}`

    const files = await checkPath(fullPath, localPath)
    allFiles.push(files)
  }

  return flattenArray(allFiles)
} // checkPaths

async function checkPath (fullPath, localPath) {
  const stats = await stat(fullPath)
  if (stats.isFile()) {
    return localPath
  }
  if (stats.isDirectory()) {
    return walktree(fullPath, `${localPath}/`)
  }
} // checkPath

function flattenArray (files) {
  return [].concat(...files)
}
module.exports = readdirtree
