'use strict';

var crypto = require('crypto');
var through = require('through2');

var plugin = function (cachebleStream) {
  if (!cachebleStream) {
    throw new Error('gulp-use-cache: cacheble action is required');
  }

  function genHash(value) {
    return crypto.createHash('md5').update(value).digest('hex');
  }

  function hasCache(key, hash) {
    return plugin.cacheParsed[key] &&
           plugin.cacheSourse[key] &&
           plugin.cacheSourse[key] === hash;
  }

  function getCache(key) {
    return plugin.cacheParsed[key] || null;
  }

  function setCache(key, hash, file) {
    plugin.cacheSourse[key] = hash;
    plugin.cacheParsed[key] = {
      path: file.path,
      contents: file.contents
    };
  }

  function makeTransform(key, hash, file, enc, callback) {
    var transformFile, transformErr;
    var hasFlush = !!cachebleStream._flush;

    if (!cachebleStream._transform) {
      return callback(null, file);
    }

    cachebleStream._transform(file, enc, function(err, file) {
      transformErr = err;
      transformFile = file;

      if (err) {
        return callback(err, file);
      }
      
      if (!hasFlush) {
        setCache(key, hash, file);
        return callback(err, file);
      }

    });

    if (hasFlush) {
      cachebleStream._flush(function() {
        if (!transformErr) {
          setCache(key, hash, transformFile);
        }
        return callback(transformErr, transformFile);
      });
    }
  }

  return through.obj(function(file, enc, callback){
    
    var key = genHash(file.path);
    var hash = file.checksum;

    if (!hash) {
      if (file.isStream()) {
        return callback(null, file);
      }
      if (file.isBuffer()) {
        hash = genHash(file.contents.toString('utf8'));
      }
    }

    if (hasCache(key, hash)) {
      var cachedFile = getCache(key);
      file.path = cachedFile.path;
      file.contents = new Buffer(cachedFile.contents);
      return callback(null, file);
    }

    return makeTransform(key, hash, file, enc, callback);
  });
}

plugin.cacheSourse = {}
plugin.cacheParsed = {}

module.exports = plugin;