// Generated by CoffeeScript 1.7.1

/*
  backbone-sql.js 0.6.3
  Copyright (c) 2013 Vidigami - https://github.com/vidigami/backbone-sql
  License: MIT (http://www.opensource.org/licenses/mit-license.php)
 */

(function() {
  var Backbone, BackboneORM, CAPABILITIES, Connection, DESTROY_BATCH_LIMIT, DatabaseTools, DatabaseURL, JSONUtils, Queue, SQLUtils, Schema, SqlCursor, SqlSync, Utils, _, _ref,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  _ref = BackboneORM = require('backbone-orm'), _ = _ref._, Backbone = _ref.Backbone, Queue = _ref.Queue, Schema = _ref.Schema, Utils = _ref.Utils, JSONUtils = _ref.JSONUtils, DatabaseURL = _ref.DatabaseURL;

  SqlCursor = require('./cursor');

  DatabaseTools = require('./database_tools');

  Connection = require('./lib/connection');

  SQLUtils = require('./lib/utils');

  DESTROY_BATCH_LIMIT = 1000;

  CAPABILITIES = {
    mysql: {
      embed: false,
      json: false,
      unique: false,
      manual_ids: false,
      dynamic: false,
      self_reference: false
    },
    postgres: {
      embed: false,
      json: true,
      unique: true,
      manual_ids: false,
      dynamic: false,
      self_reference: false
    },
    sqlite: {
      embed: false,
      json: false,
      unique: false,
      manual_ids: false,
      dynamic: false,
      self_reference: false
    }
  };

  SqlSync = (function() {
    function SqlSync(model_type, options) {
      var key, value;
      this.model_type = model_type;
      if (options == null) {
        options = {};
      }
      this.db = __bind(this.db, this);
      this.getConnection = __bind(this.getConnection, this);
      this.getTable = __bind(this.getTable, this);
      this.deleteCB = __bind(this.deleteCB, this);
      this.update = __bind(this.update, this);
      this.create = __bind(this.create, this);
      for (key in options) {
        value = options[key];
        this[key] = value;
      }
      this.model_type.model_name = Utils.findOrGenerateModelName(this.model_type);
      this.schema = new Schema(this.model_type, {
        id: {
          type: 'Integer'
        }
      });
      this.backbone_adapter = require('./lib/backbone_adapter');
    }

    SqlSync.prototype.initialize = function() {
      var url;
      if (this.is_initialized) {
        return;
      }
      this.is_initialized = true;
      this.schema.initialize();
      if (!(url = _.result(new this.model_type(), 'url'))) {
        throw new Error("Missing url for model");
      }
      return this.connect(url);
    };

    SqlSync.prototype.read = function(model, options) {
      if (model.models) {
        return this.cursor().toJSON((function(_this) {
          return function(err, json) {
            if (err) {
              return options.error(err);
            }
            if (!json) {
              return options.error(new Error('Collection not fetched'));
            }
            return typeof options.success === "function" ? options.success(json) : void 0;
          };
        })(this));
      } else {
        return this.cursor(model.id).toJSON((function(_this) {
          return function(err, json) {
            if (err) {
              return options.error(err);
            }
            if (!json) {
              return options.error(new Error("Model not found. Id " + model.id));
            }
            return options.success(json);
          };
        })(this));
      }
    };

    SqlSync.prototype.create = function(model, options) {
      var json;
      json = model.toJSON();
      return this.getTable('master').insert(json, 'id').exec((function(_this) {
        return function(err, res) {
          if (err) {
            return options.error(err);
          }
          if (!(res != null ? res.length : void 0)) {
            return options.error(new Error("Failed to create model with attributes: " + (JSONUtils.stringify(model.attributes))));
          }
          json.id = res[0];
          return options.success(json);
        };
      })(this));
    };

    SqlSync.prototype.update = function(model, options) {
      var json;
      json = model.toJSON();
      return this.getTable('master').where('id', model.id).update(json).exec((function(_this) {
        return function(err, res) {
          if (err) {
            return options.error(model, err);
          }
          return options.success(json);
        };
      })(this));
    };

    SqlSync.prototype["delete"] = function(model, options) {
      return this.deleteCB(model, (function(_this) {
        return function(err) {
          if (err) {
            return options.error(err);
          } else {
            return options.success();
          }
        };
      })(this));
    };

    SqlSync.prototype.deleteCB = function(model, callback) {
      return this.getTable('master').where('id', model.id).del().exec((function(_this) {
        return function(err, res) {
          if (err) {
            return callback(err);
          }
          return Utils.patchRemove(_this.model_type, model, callback);
        };
      })(this));
    };

    SqlSync.prototype.resetSchema = function(options, callback) {
      return this.db().resetSchema(options, callback);
    };

    SqlSync.prototype.cursor = function(query) {
      var options;
      if (query == null) {
        query = {};
      }
      options = _.pick(this, ['model_type', 'backbone_adapter']);
      options.connection = this.getConnection();
      return new SqlCursor(query, options);
    };

    SqlSync.prototype.destroy = function(query, callback) {
      var _ref1;
      if (arguments.length === 1) {
        _ref1 = [{}, query], query = _ref1[0], callback = _ref1[1];
      }
      return this.model_type.each(_.extend({
        $each: {
          limit: DESTROY_BATCH_LIMIT,
          json: true
        }
      }, query), this.deleteCB, callback);
    };

    SqlSync.prototype.connect = function(url) {
      var slave_url, _i, _len, _ref1, _ref2;
      this.table = (new DatabaseURL(url)).table;
      this.connections || (this.connections = {
        all: [],
        master: new Connection(url),
        slaves: []
      });
      if ((_ref1 = this.slaves) != null ? _ref1.length : void 0) {
        _ref2 = this.slaves;
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          slave_url = _ref2[_i];
          this.connections.slaves.push(new Connection("" + slave_url + "/" + this.table));
        }
      }
      this.connections.all = [this.connections.master].concat(this.connections.slaves);
      return this.schema.initialize();
    };

    SqlSync.prototype.getTable = function(db_type) {
      return this.getConnection(db_type)(this.table);
    };

    SqlSync.prototype.getConnection = function(db_type) {
      if (db_type === 'master' || this.connections.all.length === 1) {
        return this.connections.master.knex();
      }
      return this.connections.all[~~(Math.random() * this.connections.all.length)].knex();
    };

    SqlSync.prototype.db = function() {
      return this.db_tools || (this.db_tools = new DatabaseTools(this.connections.master, this.table, this.schema));
    };

    return SqlSync;

  })();

  module.exports = function(type, options) {
    var model_type, sync, sync_fn;
    if (Utils.isCollection(new type())) {
      model_type = Utils.configureCollectionModelType(type, module.exports);
      return type.prototype.sync = model_type.prototype.sync;
    }
    sync = new SqlSync(type, options);
    type.prototype.sync = sync_fn = function(method, model, options) {
      if (options == null) {
        options = {};
      }
      sync.initialize();
      if (method === 'createSync') {
        return module.exports.apply(null, Array.prototype.slice.call(arguments, 1));
      }
      if (method === 'sync') {
        return sync;
      }
      if (method === 'db') {
        return sync.db();
      }
      if (method === 'schema') {
        return sync.schema;
      }
      if (method === 'isRemote') {
        return false;
      }
      if (method === 'tableName') {
        return sync.table;
      }
      if (sync[method]) {
        return sync[method].apply(sync, Array.prototype.slice.call(arguments, 1));
      } else {
        return void 0;
      }
    };
    Utils.configureModelType(type);
    return BackboneORM.model_cache.configureSync(type, sync_fn);
  };

  module.exports.capabilities = function(url) {
    return CAPABILITIES[SQLUtils.protocolType(url)] || {};
  };

}).call(this);
