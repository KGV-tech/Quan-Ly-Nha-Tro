// Pure business rules: shared by the UI and the automated checks.
(function (global) {
    function isTenantMovedOut(tenant) {
        return tenant?.status === 'moved_out' || Boolean(tenant?.moveOutDate) || Boolean(tenant?.endDate);
    }

    function getRoomDisplayOrder(room) {
        const name = room?.name || '';
        const floorMatch = name.match(/lầu\s*(\d+)/i);
        const numberMatch = name.match(/số\s*(\d+)/i);
        return {
            floor: floorMatch ? Number(floorMatch[1]) : Number.MAX_SAFE_INTEGER,
            number: numberMatch ? Number(numberMatch[1]) : Number.MAX_SAFE_INTEGER,
            name
        };
    }

    function getActiveTenantsForRoom(roomId, tenants) {
        return (tenants || []).filter(tenant => tenant.roomId === roomId && !isTenantMovedOut(tenant));
    }

    function isRoomOccupied(roomId, tenants) {
        return getActiveTenantsForRoom(roomId, tenants).length > 0;
    }

    function compareRoomsByDisplayOrder(firstRoom, secondRoom) {
        const first = getRoomDisplayOrder(firstRoom);
        const second = getRoomDisplayOrder(secondRoom);
        return first.floor - second.floor || first.number - second.number || first.name.localeCompare(second.name, 'vi');
    }

    const rules = { isTenantMovedOut, getRoomDisplayOrder, compareRoomsByDisplayOrder, getActiveTenantsForRoom, isRoomOccupied };
    global.RentalBusinessRules = rules;
    if (typeof module !== 'undefined') module.exports = rules;
}(typeof window !== 'undefined' ? window : globalThis));
