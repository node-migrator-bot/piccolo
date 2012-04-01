
var util = require('util');
var events = require('events');
var path = require('path');

var common = require('./common.js');
var handler = common.core('handler');

function Piccolo() {
  
  // Setup default modules
  this.modules = {
    'route': common.defaults('route')
  };
  
  // Setup a directories map
  var map = this.directories = {};
      map.project = path.dirname(module.parent.filename);
      map['static'] = path.join(map.project, 'static');
  
  // Contain listen information
  this.address = null;
  
  // Store connect handler
  this.handler = null;
}
util.inherits(Piccolo, events.EventEmitter);

module.exports = function () { return new Piccolo(); };

// Allow developers to use there own submodules
// Note this is a sync function
Piccolo.prototype.overwrite = function (part, filepath) {
  
  // Check that no servers are attached
  if (this.handler) {
    throw new Error('A server has already been attach');
  }
  
  // Check arguments
  if (arguments.length === 0) {
    throw new TypeError('No arguments was given');
  }

  // Check that the part name is valid
  if (this.modules[part] === undefined) {
    throw new TypeError('The ' + part + ' is not a valid module');
  }
  
  // Check the filepath argument
  if (typeof filepath !== 'string') {
    throw new TypeError('The filepath must be a string');
  }
  
  filepath = path.resolve(this.directories.project, filepath);
  if (common.existsSync(filepath) === false) {
    throw new Error('The filepath ' + filepath + ' do not exist');
  }
  
  // overwrite default submodule
  this.modules[part] = filepath;
};

// Allow developers to use there own directory structur
Piccolo.prototype.directory = function (what, dirpath) {
  
  // Check that no servers are attached
  if (this.handler) {
    throw new Error('A server has already been attach');
  }
  
  // Check arguments
  if (arguments.length === 0) {
    throw new TypeError('No arguments was given');
  }

  // Check that the part name is valid
  if (this.modules[what] === undefined) {
    throw new TypeError('The ' + what + ' is not a key directory');
  }
  
  // Check the filepath argument
  if (typeof dirpath !== 'string') {
    throw new TypeError('The filepath must be a string');
  }
  
  // in case it is the project directory there is being set
  // do not atempt to resolve the path 
  if (what !== 'project') {
    dirpath = path.resolve(this.directories.project, dirpath);
  }
  
  if (common.existsSync(dirpath) === false) {
    throw new Error('The path ' + dirpath + ' do not exist');
  }
  
  // Overwrite default directory
  this.directories[what] = dirpath;
};

// Attach a handler to a server instance
Piccolo.prototype.attach = function (server) {
  
  // Check arguments
  if (typeof server !== 'object' || server === null) {
    throw new TypeError('A server object must be given');
  }
  
  // Create handle for first time
  if (this.handler === null) {
    this.handlers = handler.setup(this);
  }
  
  // Attach handler to server
  server.on('request', this.handlers);
};