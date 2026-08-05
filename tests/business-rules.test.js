const assert = require('node:assert/strict');
const rules = require('../js/business-rules.js');

assert.equal(rules.isTenantMovedOut({ status: 'moved_out' }), true);
assert.equal(rules.isTenantMovedOut({ moveOutDate: '2026-08-05' }), true);
assert.equal(rules.isTenantMovedOut({ status: 'active' }), false);

const tenants = [{ roomId: 'r1', status: 'active' }, { roomId: 'r1', status: 'moved_out' }];
assert.equal(rules.isRoomOccupied('r1', tenants), true);
assert.equal(rules.isRoomOccupied('r2', tenants), false);

const rooms = [{ name: 'Số 03 - Lầu 2' }, { name: 'Số 02 - Lầu 1' }, { name: 'Số 01 - Lầu 1' }];
rooms.sort(rules.compareRoomsByDisplayOrder);
assert.deepEqual(rooms.map(room => room.name), ['Số 01 - Lầu 1', 'Số 02 - Lầu 1', 'Số 03 - Lầu 2']);

console.log('Business rules checks passed.');
