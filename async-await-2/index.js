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
  const files = []

  for (const path of paths) {
    const fullPath = `${rootPath}/${path}`
    const localPath = `${prefix}${path}`

    const stats = await stat(fullPath)
    if (stats.isFile()) {
      files.push(localPath)
    }
    if (stats.isDirectory()) {
      files.push(...await walktree(fullPath, `${localPath}/`))
    }
  }

  return files
} // checkPaths

module.exports = readdirtree
