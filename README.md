# Refactoring To Promises

When Node was first released, it was something a little bit revolutionary.
In contrast to many programming environments, it isn't procedural and
linear, it's asynchronous and event driven. It's so deeply asynchronous
that it turns even a 'normal' operation like reading a file inside out
into a series of file read events.

Naturally enough, Node presents this as a good and positive thing:

> As an asynchronous event driven JavaScript runtime, Node is designed
> to build scalable network applications. ... in contrast to today's more
> common concurrency model where OS threads are employed. Thread-based
> networking is relatively inefficient and very difficult to use.
> Furthermore, users of Node are free from worries of dead-locking the
> process, since there are no locks. Almost no function in Node directly
> performs I/O, so the process never blocks. Because nothing blocks,
> scalable systems are very reasonable to develop in Node.

And so it is. However, back in 2009, when Node was first released,
JavaScript was a rather different language to what we have now, and even
less well suited to asynchronous event driven programming.

The style of programming that developed to build out asynchronous JavaScript
systems has become known as Node-style callbacks (aka error-first or errback).
A Node-style async function takes, as its last argument, a callback function.
That callback function, in turn, take two arguments. The first argument is
the error object. If an error has occurred it will be passed to the callback
in the first argument. Conversely, if no error has occurred the error object
is `null` or `undefined`. The callback's second argument is the return
data of the original function.

We see this all the time in Node programs

```javascript
fs.readFile('path/to/file', function(err, filelist) {
  if (err) {
    throw err
  }
  console.log(filelist)
})
```

In this simple example, everything's straightforward enough.  However, as
our processing gets more complicated, the callback style becomes
increasingly difficult to reason about, particularly if we need to loop over
some data. Modern JavaScript constructs like Promises and now ```async``` and
```await``` allow us to move away from the callback-style of programming,
while retaining all the advantages of the eventing environment.

I've put together ```readdirtree```, a function that returns a list of all
the files in a directory, written using Node-style callbacks. I'm going to
refactor that code towards Promises, and then onto ```async/await```.  We'll
be able to see, I hope, that the code becomes easier to write, significantly more
obvious to read, and also easier to use.  We'll be looking at this code from
two sides - that of the consumer, the person using the code (in TDD, part of
the job of tests is to play this role), and that of the maintainer, the
person writing the code (in TDD, that's us).

## readdirtree

Building a list of files in a directory is the kind of straightforward task
we do all the time -
  * grab a list of the paths in the current directory
  * for each of those paths
    * check what it points to
    * if it's a file, keep it!
    * if it's a directory, recurse into it and repeat this procedure
  * and there we are, an ordered list of the files in the directory tree

`readdirtree` is a simple function that returns a list of all the files
below a specified directory.  It uses only Node's `fs.readdir` and
`fs.stats` methods, and no third-party packages.

## Callback style

Before we get into the initial implementation, let's look at how it's
used. Using it is straightforward enough.

```javascript
readdirtree('path/to/directory', function(err, filelist) {
  if (err) {
    return // oh noes!
  }

  // do something with the list of files
})
```

Let's have a look at the callback-style implementation

```javascript
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

module.exports = readdirtree
```

#### I'm sorry, what now?

How much complexity can we pack into 47 lines? Let's unpick it a bit.

```javascript
const fs = require('fs')

function readdirtree (root, callback) {
  walktree(root, '', callback)
}
```
`readdirtree` is our entry point function.  All it does is set up the initial
call to `walktree`, which is where the actual work begins.

```javascript
function walktree (root, prefix, callback) {
  fs.readdir(root, (err, paths) => {
    if (err) {
      return callback(err)
    }

    checkPaths(root, paths, 0, prefix, [], callback)
  })
} // walktree
```
`fs.readdir` provides the list of paths in the directory.  Once we have those
paths we pass them to `checkPaths` to work out which is a file and which is a directory.

```javascript
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
```
And almost immediately, things get wild.  We can't just loop through our paths,
checking each one.  `fs.stat` provides us the information we
need about a path, but it is another of our non-blocking methods that takes a
callback. Consequently, we can't just fire off a for-loop, do a bit of work, and
be done.

Instead, we have to provide `fs.stat` with a local callback of our own.
```javascript
  fs.stat(fullPath, (err, stats) => {
    if (err) {
      callback(err)
    }
```
If `fs.stat` goes wrong, it invokes our user-supplied callback to flag that
error. Otherwise, if the path points to a file, add it to `found` and then
move on to check the next path in the list.
```javascript
     else if (stats.isFile()) {
      found.push(localPath)
      next()
```
`next`, defined as
```javascript
  const next = () => checkPaths(rootPath, paths, index + 1, prefix, found, callback)
```
is a convenience function that tail-recurses on path.  It invokes `checkPaths`
with the next path in the list (hence the `index + 1` in the parameter list).  The
tail-recursion explains why `checkPaths` begins with a check to see if we've
reached the end of the paths array.

In this kind of callback-style programming, tail recursion is an extremely common way
to loop over arrays and other data structures.  It is, perhaps predictably, a functional
programming technique and almost ubiquitous in Lisp-like languages. (We could divert at
this point into a sidebar discussion about whether JavaScript is Lisp-like, but
let's park that.)

In JavaScript it's not uncommon to see tail-recursion lightly disguised by use of
helper libraries like [`async.eachSeries`](https://caolan.github.io/async/docs.html#eachSeries),
but it's still there and still requires a bit of thinking about. (If you're feeling
keen, refactor this example to use `async.eachSeries` and see if feel it feels any more
straightforward.)

Ok, back to the code.  We've handled the simple case of a file.  Now, let's consider
what we need to do if we find a directory?  We need to step down into it, and we
have a function for that, `walktree`, to which we'll provide a local callback to
receive the files it finds.
```javascript
    } else if (stats.isDirectory()) {
      walktree(fullPath, `${localPath}/`, (err, files) => {
        if (err) {
          callback(err)
        }
```
When we're passed those files, assuming nothing went wrong, we can add them to our
`found` array, and then tail-recurse to check the next path.
```javascript
        found.push(...files)
        next()
      })
```
If our call to `fs.readdir` gave us a path to anything else (socket, symlink, etc),
just skip over it and move on to our next path.
```javascript
    } else {
      next()
    }
```

#### So that's all clear then?

I think it's pretty obvious that the callback-style and code clarity are not natural
bedfellows. This code, even though it performs a simple task is really quite difficult
to reason about. Thinking your way through a list of paths, then down into a directory,
then down into another is enough to make your head bleed.

Now consider the error case. Are errors propagated out correctly? While writing this
explanation I realised that they weren't, despite my best efforts to do things
properly. Had I not been writing this essay it might easily have gone unnoticed, and
lain latent waiting to bugger things up months later.

## First steps to Promises

So, we want to be all new and modern. We've got this callback code that we want to
bring into the modern age, but where to begin? Where. To. Begin?  What's the smallest
useful change we can make?

#### Outside-In

I said earlier that we'd look at this from both the perspective of someone using our
code, and of the person writing the code. If our `readdirtree` returns a promise
rather than taking a callback, it'll present a different face to the outside world.
It'll still be the same old convoluted callback malarkey on the inside, but we can
worry about that later.  From the outside then, we want our `readdirtree` call to
go from
```javascript
readdirtree('path/to/directory', function(err, filelist) {
  if (err) {
    return // oh noes!
  }

  // do something with the list of files
})
```
to something like
```javascript
readdirtree('path/to/directory')
  .then(filelist => { /* do something with the list of files */ })
  .catch(err => { /* oh deary me! */ })
```

To my eye, this is immediately better code.  The happy path and the error case are
separate, and clearly labelled. The sequence of actions - read the tree, then do
the next thing - is more obvious. The happy case, the thing we expect to happen
nearly all the time, comes first.  If `readdirtree` returns a promise, it's chainable -
```javascript
readdirtree('path/to/directory')
  .then(filelist => doTheNextThing(filelist))
  .then(filecontent => doAnotherThing(filecontent))
  .then(foo => andSoOn(foo))
  .catch(err => unifiedErrorHandler(err))
```
All good stuff.  Let's do it.

Creating a 'naked' promise looks something like this
```javascript
const p = new Promise((resolve, reject) => {
  try {
    // some (potentially) time consuming operation
    resolve(results)
  } catch (err) {
    reject(err)
  }
})
```
You simply construct a Promise, passing a lambda to its constructor.  The lambda takes
two parameters: `resolve`, the function to call when your operation completes successfully, and `reject`, which you call in the event of an error.  Calling `resolve`
and `reject` are analogous to invoking our callback function with its success or error
parameters.

Our initial implementation exported the `readdirtree` directly,
```javascript
module.exports = readdirtree
```
We can easily throw a promise around that, mapping our callback function onto the
Promise's `resolve` and `reject`
```javascript
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
```
And that's it! Boom - `readdirtree` now returns a Promise, and no one would ever know
that inside it's a horrible callbacky mess.

We can, trivially, wrap any Node-style callback function with a Promise.
In fact, this is so common there's a Node utility method called [`promisify`](https://nodejs.org/api/util.html#util_util_promisify_original) that does exactly
that. Some Node libraries offer callbacks or Promises - if you pass a callback as
the last parameter to a function then it operates in a callback mode, otherwise
it returns a Promise. I can see how this offers a migration path, and I've done
it myself, but I'm not entirely sure how I feel about it for a long term thing.

## All in with Promises

With its external interface switched from callbacks to Promises, we can have a
look at reworking `readdirtree`'s internals.

#### Heading Inside

`readdirtree` relies on two library
functions `fs.readdir` and `fs.stat` and is shaped by their callback interfaces,
ending up with convoluted logic and callbacks-on-callbacks. If we convert those
functions to their Promise-returning equivalents, where do we end up?

```javascript
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

    return checkPath(fullPath, localPath)
  })

  return Promise.all(checks)
    .then(files => flattenArray(files))
} // checkPaths

function checkPath (fullPath, localPath) {
  return stat(fullPath)
    .then(stats => {
      if (stats.isFile()) {
        return localPath
      }
      if (stats.isDirectory()) {
        return walktree(fullPath, `${localPath}/`)
      }
    })
} // checkPath

function flattenArray (files) {
  return [].concat(...files)
}

module.exports = readdirtree
```

#### Well ok, I guess?

```javascript
const fs = require('fs')
const promisify = require('util').promisify

const readdir = promisify(fs.readdir)
const stat = promisify(fs.stat)

function readdirtree (root) {
  return walktree(root, '')
}
```
As with out original implementation, ```readdirtree``` is our entry point function,
and simply ses up the initial conditions for ```walktree```, where the real
action starts
```javascript
function walktree (root, prefix) {
  return readdir(root)
    .then(paths => checkPaths(root, paths, prefix))
} // walktree
```
`readdir`, our `promisify`ed version of `fs.readdir`, provides a list of paths in the directory which, as before, we had off to `checkPaths` to process.

```javascript
function checkPaths (rootPath, paths, prefix) {
  const checks = paths.map(path => {
    const fullPath = `${rootPath}/${path}`
    const localPath = `${prefix}${path}`

    return checkPath(fullPath, localPath)
  })

  return Promise.all(checks)
    .then(files => flattenArray(files))
} // checkPaths
```
This is where the implementation really starts to diverge from our original
implementation.  Then we had to do a crazy, hard to follow, tail recursion in
order to make sure we processed each path correctly.  Here, promises allow
us to side-step all that nonsense -
```javascript
  const checks = paths.map(path => {
     ...
  }
```
[`Array.map()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map) creates a new array containing the results of calling the provided function on every element of the calling array. So, for each path in our `paths` array we're going to
perform some operation (the nature of which doesn't concern us at the moment),
gathering those results into our new `checks` array.
```javascript
  return Promise.all(checks)
    .then(files => flattenArray(files))
```
[`Promise.all`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all) combines
all those promises together, and resolves when they have all resolved. Here, those
promises give us list of files, which we combine together to give our complete
file list.

We can summarise `checkPaths` as
  * do something potentially time consuming to everything in an array
  * wait for them all to finish
  * do the next thing
Try summarising our initial version of `checkPaths` in the same way.  It's tricky.

So, what is the mysterious operation we're doing on each path?
```javascript
function checkPath (fullPath, localPath) {
  return stat(fullPath)
    .then(stats => {
      if (stats.isFile()) {
        return localPath
      }
      if (stats.isDirectory()) {
        return walktree(fullPath, `${localPath}/`)
      }
    })
} // checkPath
```
This all looks pretty clear - `stat` the path and if it's a file we want to
keep it. If the path points to a directory, then head down into it to find
its contents. If the path points to anything else, well, we don't even have to
worry about it.

#### Clearer?

I think so, and I hope you do too. Walking down a directory is always going to
involve a certain amount of recursion, but at least now we've only got it through
`walktree` rather than through `walktree` and `checkPaths`.  Notice also that
while we're using Promises throughout the code, we don't explicitly create any of
them.

Finally, consider also the error case. We don't have any explicit error handling
either. Because we're working bottom to top with promises, any errors are
propagated up and out for our calling to code to handle in its `catch` handler
```javascript
readdirtree('path/to/directory')
  .then(filelist => { /* do something with the list of files */ })
  .else(err => { /* oh deary me! */ })
```


