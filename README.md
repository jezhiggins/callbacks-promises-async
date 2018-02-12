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

```readdirtree``` is a simple function that returns a list of all the files
below a specified directory.  It uses only Node's ```fs.readdir``` and 
```fs.stats``` methods, and no third-party packages. Using it is 
straightforward 

```javascript 
readdirtree('path/to/directory', function(err, data) {
  if (err) {
    return // oh noes!
  }
  
  // do something with the list of files
})
```



