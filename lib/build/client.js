
var path = require('path');
var async = require('async');
var flower = require('flower');
var uglify = require("uglify-js");

var common = require('../common.js');
var utils = common.load('utils');
var readdir = common.load('helpers', 'readdir');
var readfile = common.load('helpers', 'file');

function remove(list, name) {
  return list.splice(list.indexOf(name), 1)[0];
}

function loadfile(file, callback) {
  if (!file.path) {
    return callback(null, file);
  }

  readfile(file.path, function (error, fileobject) {
    if (error) return callback(error, null);

    // convert buffer to string
    fileobject.content = fileobject.content.toString();

    // add input properties to fileobject
    callback(null, utils.extend(fileobject, file));
  });
}

function ClientCore(piccolo, callback) {
  if (!(this instanceof ClientCore)) return new ClientCore(piccolo, callback);

  var self = this;

  async.parallel({
    bindings: readdir.bind(null, common.find('bindings', null)),
    modules: readdir.bind(null, common.find('modules', null)),
    core: readdir.bind(null, common.find('client', null))
  }, function (error, list) {
    if (error) return callback(error, null);

    // remove head and foot file from core list
    var head = { path: remove(list.core, common.find('client', 'head')) };
    var foot = { path: remove(list.core, common.find('client', 'foot')) };
    var init = { path: remove(list.core, common.find('client', 'init')) };

    list.bindings = list.bindings
      // remove server files from modules
      .filter(function (filepath) {
        return (filepath.indexOf('.server.js') === -1);
      })
      // resolve filepaths to include modulename
      .map(function (filepath) {
        var bindingname = path.basename(filepath, ".client.js");

        return {
          path: filepath,
          binding: bindingname
        };
      });

    // resolve filepaths to include modulename
    list.modules = list.modules.map(function (filepath) {
      var modulename = path.basename(filepath, ".js");

      return {
        path: filepath,
        module: modulename
      };
    });

    // Add router module
    list.modules.push({
      path: piccolo.get('router'),
      module: 'router'
    });

    // resolve core files
    list.core = list.core.map(function (filepath) {
      return { path: filepath };
    });

    // create stringified buildMap
    var buildMap = (function () {
      var map = {};
      var mtime = 0;
      var build = piccolo.build.dependencies.build;

      Object.keys(build).forEach(function (rootname) {
        // generate source code
        map[rootname] = {
          dirMap: build[rootname].dirMap,
          packageMap: build[rootname].packageMap
        };

        // Calculate mtime
        Object.keys(build[rootname].mtime).forEach(function (filename) {
          var timestamp = build[rootname].mtime[filename];
          if (timestamp > mtime) {
            mtime = timestamp;
          }
        });
      });

      // return fileobject
      return {
        content: 'build.buildMap = ' + JSON.stringify(map),
        mtime: new Date(mtime)
      };
    })();

    // create load list
    var loadlist;
    loadlist = [];
    loadlist.push(head);
    loadlist.push(buildMap);
    loadlist.push.apply(loadlist, list.bindings);
    loadlist.push.apply(loadlist, list.modules);
    loadlist.push(init);
    loadlist.push.apply(loadlist, list.core);
    loadlist.push(foot);

    // load all files
    async.map(loadlist, loadfile, function (error, files) {
      if (error) return callback(error, null);

      var mtime = 0, content = "";
      var jsp = uglify.parser;
      var pro = uglify.uglify;

      files.forEach(function (file) {
        // calculate the mtime
        var timestamp = file.mtime.getTime();
        if (timestamp > mtime) {
          mtime = timestamp;
        }

        // Add module content as a string so it can be compiled separately
        if (file.module) {
          // store source code in object property value
          content += 'build.NativeModuleSource.' + file.module + ' = ';

          // Compress content if settings says
          if (piccolo.get('compress')) {
            var ast = jsp.parse(file.content.toString());
                ast = pro.ast_mangle(ast);
                ast = pro.ast_squeeze(ast);

            file.content = pro.gen_code(ast);
          }

          // escape and add content
          content += JSON.stringify(file.content);

          // End JS quote
          content += ';';
        }
        // Add binding content in an function wrapper
        else if (file.binding) {
          content += 'build.NativeBinding.' + file.binding + ' = function (exports, require, module, piccolo, __filename, __dirname) {\n';
          content += file.content;
          content += '\n};';
        }
        // Add normal JS code
        else {
          content += file.content;
        }

        // Add linebreak (they are so beautiful)
        content += "\n";
      });

      // set mtime date
      self.mtime = new Date(mtime);

      // Compress content if settings says
      if (piccolo.get('compress')) {
        var ast = jsp.parse(content);
            ast = pro.ast_mangle(ast);
            ast = pro.ast_squeeze(ast);

        content = pro.gen_code(ast);
      }

      // create memory stream
      self.memory = flower.memoryStream();
      flower.buffer2stream(new Buffer(content)).pipe(self.memory);

      // return client object
      callback(null, self);
    });
  });
}
module.exports = ClientCore;

ClientCore.prototype.read = function () {
  var stream = this.memory.relay();
      stream.pause();

  // add metadata properties
  stream.type = 'application/javascript';
  stream.mtime = this.mtime;

  // emit ready on next tick
  process.nextTick(function () {
    stream.emit('ready');
  });

  return stream;
};
