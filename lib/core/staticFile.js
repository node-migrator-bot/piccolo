
var mime = require('mime');

// TODO: support Range requests

module.exports = function handle_staticFile() {
  if (this.allowMethod(['GET', 'HEAD'])) return;

  // send static file
  var file = this.piccolo.build.staticFile.read(this.cache.filepath);
  this.send(file);
};
