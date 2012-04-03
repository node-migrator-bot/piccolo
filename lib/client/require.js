piccolo.require = (function () {

  var cache = {};
  var callbacks = {};
  var head = document.getElementsByTagName('head')[0];
  var path = "window.piccolo.require";

  function request(url, callback) {
    var requester;

    // create HTTP request object
    requester = new XMLHttpRequest();
    requester.open("GET", url, true);

    // call callback when all the content is rescived
    requester.onreadystatechange = function () {
      if (requester.readyState !== 4) return;
      callback(requester.responseText);
    };

    requester.send(null);
  }

  function callbackHandler(script, filename) {
    return {
      list: [],
      done: function (exports) {
        // save exports in cache
        cache[filename] = exports;

        // cleanup by deleteing callbackHandler and script tag reference
        delete callbacks[filename];
        head.removeChild(script);

        // execute all callbacks in the list
        var i = this.list.length;
        while(i--) this.list[i](exports);
      }
    };
  }

  // the exposed piccolo.require function
  function require(filename, callback) {

    if (!callback) throw new Error("missing callback in require");

    // translate native module names to filepath
    if (piccolo.NativeModule[filename]) {
      callback(piccolo.NativeModule[filename]);
      return;
    }

    // module loaded: use cache
    if (cache[filename]) {
      callback(cache[filename]);
      return;
    }

    // loading in progress: add callback to handler list
    var handler = callbacks[filename];
    if (handler) {
      handler.list.push(callback);
      return;
    }

    // create script tag where content will be evaluated
    var script = document.createElement('script');

    // begin new module loading
    handler = callbacks[filename] = callbackHandler(script, filename);
    handler.list.push(callback);

    request(filename, function (content) {

      var handlerPath = path + '.callbacks["' + filename + '"]';

      script.appendChild(document.createTextNode(
        ';(function (exports, require) {' +
          content +
        '})(' + handlerPath + '.done.bind(' + handlerPath + '), ' + path + ');'));

      head.appendChild(script);
    });
  }

  // expose also these internal objects
  require.cache = cache;
  require.callbacks = callbacks;

  return require;
})();