util = require 'util'
assert = require 'assert'

BackboneORM = require 'backbone-orm'
{_, Backbone, Queue, Utils, JSONUtils} = BackboneORM

_.each BackboneORM.TestUtils.optionSets(), exports = (options) ->
  options = _.extend({}, options, __test__parameters) if __test__parameters?
  return if options.embed

  DATABASE_URL = options.database_url or ''
  BASE_SCHEMA = options.schema or {}
  SYNC = options.sync

  describe "Sql db tools #{options.$parameter_tags or ''}#{options.$tags}", ->
    Flat = Reverse = Owner = null
    before ->
      BackboneORM.configure {model_cache: {enabled: !!options.cache, max: 100}}

      class Flat extends Backbone.Model
        urlRoot: "#{DATABASE_URL}/flats"
        schema: _.extend BASE_SCHEMA,
          a_string: 'String'
        sync: SYNC(Flat)

      class Reverse extends Backbone.Model
        urlRoot: "#{DATABASE_URL}/reverses"
        schema: _.defaults({
          owner: -> ['belongsTo', Owner]
          another_owner: -> ['belongsTo', Owner, as: 'more_reverses']
          many_owners: -> ['hasMany', Owner, as: 'many_reverses']
        }, BASE_SCHEMA)
        sync: SYNC(Reverse)

      class Owner extends Backbone.Model
        urlRoot: "#{DATABASE_URL}/owners"
        schema: _.defaults({
          a_string: 'String'
          flats: -> ['hasMany', Flat]
          reverses: -> ['hasMany', Reverse]
          more_reverses: -> ['hasMany', Reverse, as: 'another_owner']
          many_reverses: -> ['hasMany', Reverse, as: 'many_owners']
        }, BASE_SCHEMA)
        sync: SYNC(Owner)

    after (callback) -> Utils.resetSchemas [Flat], callback
    beforeEach (callback) ->
      queue = new Queue(1)
      queue.defer (callback) -> Utils.resetSchemas [Flat], callback
      for model_type in [Flat, Reverse, Owner]
        do (model_type) -> queue.defer (callback) -> model_type.db().dropTableIfExists callback
      queue.await callback

    it 'should return Integer for the schema type of the id', ->
      assert.equal(Flat.schema().type('id'), 'Integer')
    it 'should return Integer for the schema type of a belongsTo id', ->
      assert.equal(Reverse.schema().type('owner_id'), 'Integer')
    it 'should return Integer for the schema type of a hasMany id', ->
      assert.equal(Owner.schema().type('reverse_id'), 'Integer')
    it 'should parse a related belongsTo id as an Integer (dot)', ->
      assert.equal(Reverse.schema().idType('owner.reverse.id'), 'Integer')
    it 'should parse a related belongsTo id as an Integer (underscore)', ->
      assert.equal(Reverse.schema().idType('owner.reverse_id'), 'Integer')
    it 'should parse a related hasMany id as an Integer', ->
      assert.equal(Owner.schema().idType('reverse.another_owner_id'), 'Integer')
    describe 'JSONUtils', ->
      it 'should parse a belongsTo id as an Integer', ->
        assert.strictEqual(JSONUtils.parse({'owner_id': '1'}, Reverse)['owner_id'], 1)
      it 'should parse a hasMany id as an Integer', ->
        assert.strictEqual(JSONUtils.parse({'reverse_id': '1'}, Owner)['reverse_id'], 1)
      it 'should parse a related belongsTo id as an Integer', ->
        assert.strictEqual(JSONUtils.parse({'owner.reverse_id': '1'}, Reverse)['owner.reverse_id'], 1)
      it 'should parse a related hasMany id as an Integer', ->
        assert.strictEqual(JSONUtils.parse({'reverse.another_owner_id': '1'}, Owner)['reverse.another_owner_id'], 1)
