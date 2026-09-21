const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Mongoose } = require('mongoose');
const { ingredientModel } = require('../dist/models/ingredient');
const { userModel } = require('../dist/models/user');
const { auditRecordModel } = require('../dist/models/audit-record');
const { loginAttemptModel } = require('../dist/models/login-attempt');
const { mongoLoginAttemptStore, LOGIN_WINDOW_MS } = require('../dist/services/login-limiter');
const { createIngredientStore } = require('../dist/services/ingredient-store');
const { createAdministrationStore } = require('../dist/services/administration-store');
const { migrateManagerRole, provisionHardeningIndexes } = require('../dist/services/backend-maintenance');
const { ingredientPagination } = require('../dist/validators/ingredient');

// Opt-in: all writes use randomly named test collections, never application collections.
test('MongoDB enforces indexes, durable atomic login counters, soft archives, audit transactions and role migration', { skip: process.env.RUN_MONGO_HARDENING_TESTS !== 'true' }, async () => {
  const driver = new Mongoose();
  const prefix = `hardening_test_${randomUUID().replaceAll('-', '')}_`;
  const models = [];
  const isolated = factory => {
    const original = factory(driver);
    const model = driver.model(`Test${original.modelName}`, original.schema.clone(), prefix + original.collection.name);
    models.push(model);
    return model;
  };
  try {
    await driver.connect(process.env.MONGO_URI, { dbName: 'shelflifeai', autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 5000 });
    const ingredients = isolated(ingredientModel), users = isolated(userModel), audits = isolated(auditRecordModel), attempts = isolated(loginAttemptModel);
    for (const model of models) await model.createCollection();
    const index = await provisionHardeningIndexes(ingredients, attempts);
    assert.equal(index.unique, true);
    assert.deepEqual(await provisionHardeningIndexes(ingredients, attempts), index);
    const ttl = (await attempts.collection.listIndexes().toArray()).find(index => index.key.expiresAt === 1);
    assert.equal(ttl.expireAfterSeconds, 0);

    const store = mongoLoginAttemptStore(attempts), secondWorker = mongoLoginAttemptStore(attempts);
    const now = new Date();
    const slots = await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? store : secondWorker).reserve('concurrent-key', now)));
    assert.equal(slots.filter(slot => slot.allowed).length, 5);
    assert.equal((await attempts.findById('concurrent-key').lean()).attempts, 5);
    assert.equal((await secondWorker.reserve('concurrent-key', now)).allowed, false);
    await store.finish('concurrent-key', slots[0].expiresAt, true);
    assert.equal((await secondWorker.reserve('concurrent-key', now)).allowed, true);
    const future = new Date(now.getTime() + LOGIN_WINDOW_MS);
    assert.equal((await store.reserve('concurrent-key', future)).allowed, true);
    // Late completion from an old window must not erase the new counter.
    await store.finish('concurrent-key', slots[0].expiresAt, true);
    assert.equal((await attempts.findById('concurrent-key').lean()).attempts, 1);

    const actorId = new driver.Types.ObjectId().toString();
    const input = { name: 'Milk', brand: '', description: '', category: 'Dairy', unitOfMeasure: 'L' };
    const service = createIngredientStore(driver, ingredients, users, audits);
    const created = await service.create(actorId, input);
    assert.equal(created.isActive, true);
    await assert.rejects(service.create(actorId, { ...input, name: 'MILK' }), e => e.code === 11000);
    await assert.rejects(ingredients.findByIdAndUpdate(created.id, { category: 'Unknown' }, { runValidators: true }).exec());
    await assert.rejects(ingredients.findByIdAndUpdate(created.id, { unitOfMeasure: 'liter' }, { runValidators: true }).exec());
    await service.update(actorId, created.id, { ...input, brand: 'New' });
    assert.equal(await service.remove(actorId, created.id), true);
    assert.equal(await service.remove(actorId, created.id), false);
    assert.equal(await service.update(actorId, created.id, input), null);
    // Raw-driver read: verifies persistence independently of Mongoose defaults/serialization.
    const archived = await ingredients.collection.findOne({ _id: new driver.Types.ObjectId(created.id) });
    assert.ok(archived, 'archived ingredient must still exist in MongoDB');
    assert.equal(archived.isActive, false);
    assert.equal(archived.name, input.name);
    assert.equal((await service.list(ingredientPagination({}))).total, 0);
    const history = await service.list(ingredientPagination({ includeArchived: 'true' }));
    assert.equal(history.total, 1);
    assert.equal(history.items[0].isActive, false);
    await assert.rejects(service.create(actorId, input), e => e.code === 11000);
    const events = await audits.find().sort({ timestamp: 1, _id: 1 }).lean();
    assert.deepEqual(events.map(row => row.action), ['CREATE', 'UPDATE', 'DEACTIVATE']);
    assert.equal(events[0].oldValue, null);
    assert.equal(events[0].newValue.name, 'Milk');
    assert.equal(events[1].oldValue.brand, '');
    assert.equal(events[1].newValue.brand, 'New');
    assert.equal(events[2].oldValue.brand, 'New');
    assert.equal(events[2].oldValue.isActive, true);
    assert.equal(events[2].newValue.isActive, false);
    assert.equal(events[2].newValue.id, created.id);
    assert.ok(events.every(row => row.userId.toString() === actorId && row.targetType === 'Ingredient'));
    console.log(JSON.stringify({ check: 'ingredient-soft-archive', host: new URL(process.env.MONGO_URI).hostname, database: driver.connection.name, collection: ingredients.collection.name, id: created.id, documentExists: true, isActive: archived.isActive, activeListTotal: 0, includeArchivedTotal: history.total, auditAction: events[2].action }));

    const failAudits = { create: async () => { throw new Error('Simulated audit failure'); } };
    const failing = createIngredientStore(driver, ingredients, users, failAudits);
    const secondInput = { ...input, name: 'Rollback fixture' };
    await assert.rejects(failing.create(actorId, secondInput), /Simulated audit failure/);
    assert.equal(await ingredients.countDocuments(), 1);
    const retained = await service.create(actorId, secondInput);
    await assert.rejects(failing.update(actorId, retained.id, { ...secondInput, brand: 'Must roll back' }));
    assert.equal((await ingredients.findById(retained.id).lean()).brand, '');
    await assert.rejects(failing.remove(actorId, retained.id));
    assert.equal(await ingredients.countDocuments(), 2);
    assert.equal((await ingredients.collection.findOne({ _id: new driver.Types.ObjectId(retained.id) })).isActive, true);

    // Pre-migration documents without a flag remain visible and can be archived.
    await ingredients.collection.updateOne({ _id: new driver.Types.ObjectId(retained.id) }, { $unset: { isActive: '' } });
    const legacyPage = await service.list(ingredientPagination({}));
    assert.equal(legacyPage.total, 1);
    assert.equal(legacyPage.items[0].isActive, true);
    const concurrent = await Promise.all([service.remove(actorId, retained.id), service.remove(actorId, retained.id)]);
    assert.deepEqual(concurrent.sort(), [false, true]);
    assert.equal(await audits.countDocuments({ targetId: retained.id, action: 'DEACTIVATE' }), 1);
    assert.equal((await ingredients.collection.findOne({ _id: new driver.Types.ObjectId(retained.id) })).isActive, false);

    const legacyId = new driver.Types.ObjectId();
    await users.collection.insertOne({ _id: legacyId, firstName: 'Test', lastName: 'Manager', email: 'isolated@shelflife.com', role: 'Manager', isActive: true, authVersion: 2, resetTokenHash: 'private-reset', createdAt: now, updatedAt: now });
    assert.equal(await migrateManagerRole(driver, users, audits), 1);
    assert.equal(await migrateManagerRole(driver, users, audits), 0);
    const canonical = await users.findById(legacyId).select('+resetTokenHash').lean();
    assert.equal(canonical.role, 'Inventory Manager');
    assert.equal(canonical.authVersion, 3);
    assert.equal(canonical.resetTokenHash, undefined);
    const migration = await audits.findOne({ targetId: legacyId }).lean();
    assert.equal(migration.actorType, 'System');
    assert.equal(migration.userId, null);
    assert.equal(migration.oldValue.role, 'Manager');
    assert.equal(migration.newValue.role, 'Inventory Manager');
    const page = await createAdministrationStore(driver, users, audits).audits({ page: 1, pageSize: 100, sortBy: 'timestamp', sortOrder: 'asc' });
    assert.equal(page.items.find(row => row.targetId === legacyId.toString()).actor.name, 'System maintenance');
    assert.equal(/password|authVersion|resetToken/.test(JSON.stringify(page)), false);
  } finally {
    try {
      for (const model of models) {
        assert.ok(model.collection.name.startsWith(prefix));
        await model.collection.drop();
      }
    } finally { await driver.disconnect(); }
  }
});
