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

The style of programming that developed to build out asynch JavaScript 
systems has become known as Node-style callbacks (aka error-first or errback).  A
Node-style async function takes, as its last argument, a callback function.
That callback function, in turn, take two argument. The first argument is 
the error object. If any error has occurred it will be passed to the callback 
in the first argument. Conversely, if no error has occurred the error object 
is null or undefined. The callback's second argument is the return data of
the original function.    

We see this all the time in Node programs

```javascript
fs.readFile('path/to/file', function(err, data) {
  if (err) {
    throw err  
  }
  console.log(data)
}
```

In this simple example, everything's straightforward enough.  However, as
our processing gets more complicated, the callback style becomes
increasingly difficult to reason about, particularly if we need to loop over
some data. Modern JavaScript constructs like Promises and now async and 
await allow to move away from the callback-style of programming, while 
retaining all the advantages of the evening environment.  

I've put together ```readdirtree```, a function that returns a list of all
the files in a directory, written in using Node-style callbacks. I'm going to
refactor that code towards Promises, and then to async/await.  We'll be able
to see, I hope, that the code becomes easier to write, significantly more
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
    
```readdirtree``` is a simple function that returns a list of all the files
below a specified directory.  It uses only Node's ```fs.readdir``` and 
```fs.stats``` methods, and no third-party packages. 

### Callback style

Before we get into the initial implementation, let's look at how it's 
used. Using it is straightforward enough. 

```javascript 
readdirtree('path/to/directory', function(err, data) {
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
paths we pass them to checkPaths to work out which is a file and which is a directory.

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
And almost immediately, things get wild.  We can just loop through out paths, 
checking each one.  `fs.stat` provides us the information we
need about each path, but it is another of our non-blocking methods that takes a 
callback. Consequently, we can't just fire off a for-loop, do a bit of work, and 
be done. 

Instead, we have to call `fs.stat` providing a local callback of our own. 
```javascript
  fs.stat(fullPath, (err, stats) => {
    if (err) {
      callback(err)
    }
```
If fs.stat goes wrong, invoke our user-supplied callback to flag that error.  
Otherwise, if the path points to a file, add it to `found` and then move 
on to check the next path in the list.
```javascript
     else if (stats.isFile()) {
      found.push(localPath)
      next()
```
The function `next`, defined as 
```javascript
  const next = () => checkPaths(rootPath, paths, index + 1, prefix, found, callback)
```
is a convenience function that tail-recurses on path.  It invokes `checkPaths`
with the next path in the list (hence the `index + 1` in the parameter list).  The
tail-recursion explains why `checkPaths` begins with a check to see if we've
reached the end of the paths array.  

In this kind of callback style programming, tail recursion is an extremely common way 
to loop over arrays and other data structures.  It is, perhaps predictably, a functional
programming technique and almost ubiquitous in Lisp-like languages. (We could divert at
this point into a sidebar discussion about whether JavaScript is Lisp-like, but 
let's park that.)

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
When we're pass those files, assuming nothing went wrong, we can add them to our 
`found` array, and then tail-recurse to check the next path.
```javascript
        found.push(...files)
        next()
      })
```
If our call to `fs.readdir` gave us a path to anything else (socket, symlink, etc), 
just skip over it.

```javascript
    } else {
      next()
    }
```

#### Clearer?

I think it's pretty obvious that the callback-style and code clarity are not natural 
bedfellows. This code, even though it performs a simple task is really quite difficult
to reason about. Thinking your way through a list of paths, then down into a directory, 
then down into another is enough to make your head bleed.  

Now consider the error case. Are errors propagated out correctly? While writing this
explanation I realised that they weren't, despite my best efforts to do thing
properly. Had I not been writing this essay it might easily have gone unnoticed, and 
lain latent waiting to bugger things up months later.

