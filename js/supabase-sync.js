// Cloud backup and cross-device synchronization for the existing local-first app.
(function () {
    const CLOUD_TABLE = 'app_state';
    const CLOUD_STORAGE_KEYS = [
        LS_HOUSES_KEY,
        LS_ROOMS_KEY,
        LS_TENANTS_KEY,
        LS_EXPENSES_KEY,
        'houseExpenses',
        'bank_qr_code',
        'bank_qr_codes_history'
    ];

    const config = window.SUPABASE_CONFIG;
    const status = { client: null, user: null, applyingRemote: false, timer: null, channel: null };

    function getClient() {
        if (!config || !config.url || !config.publishableKey || !window.supabase) return null;
        if (!status.client) status.client = window.supabase.createClient(config.url, config.publishableKey);
        return status.client;
    }

    function cloudSnapshot() {
        const data = {};
        CLOUD_STORAGE_KEYS.forEach(key => {
            const value = localStorage.getItem(key);
            if (value !== null) data[key] = value;
        });
        Object.keys(localStorage)
            .filter(key => key.startsWith('houseProviderInfo_'))
            .forEach(key => { data[key] = localStorage.getItem(key); });
        return data;
    }

    function hasBusinessData(snapshot) {
        return [LS_HOUSES_KEY, LS_ROOMS_KEY, LS_TENANTS_KEY, LS_EXPENSES_KEY, 'houseExpenses']
            .some(key => snapshot[key] && snapshot[key] !== '[]');
    }

    function applySnapshot(snapshot) {
        status.applyingRemote = true;
        try {
            const existingKeys = Object.keys(localStorage).filter(key =>
                CLOUD_STORAGE_KEYS.includes(key) || key.startsWith('houseProviderInfo_')
            );
            existingKeys.forEach(key => localStorage.removeItem(key));
            Object.entries(snapshot || {}).forEach(([key, value]) => localStorage.setItem(key, value));
        } finally {
            status.applyingRemote = false;
        }
    }

    function setCloudMessage(message, type) {
        const el = document.getElementById('cloud-sync-status');
        if (!el) return;
        el.textContent = message;
        el.className = `export-note cloud-sync-status ${type || ''}`;
    }

    async function pushSnapshot() {
        const client = getClient();
        if (!client || !status.user || status.applyingRemote) return;
        const { error } = await client.from(CLOUD_TABLE).upsert({
            user_id: status.user.id,
            data: cloudSnapshot(),
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        if (error) {
            console.error('Cloud sync failed:', error);
            setCloudMessage('Chưa thể đồng bộ. Dữ liệu vẫn được lưu trên thiết bị.', 'error');
            return;
        }
        setCloudMessage(`Đã đồng bộ lúc ${new Date().toLocaleTimeString('vi-VN')}.`, 'success');
    }

    function schedulePush() {
        if (status.applyingRemote || !status.user) return;
        clearTimeout(status.timer);
        status.timer = setTimeout(pushSnapshot, 700);
    }

    async function loadCloudState() {
        const client = getClient();
        if (!client || !status.user) return;
        const { data: row, error } = await client
            .from(CLOUD_TABLE)
            .select('data, updated_at')
            .eq('user_id', status.user.id)
            .maybeSingle();
        if (error) {
            console.error('Cloud state load failed:', error);
            setCloudMessage('Chưa thấy bảng đồng bộ. Hãy chạy supabase/schema.sql một lần.', 'error');
            return;
        }

        const local = cloudSnapshot();
        if (!row) {
            if (hasBusinessData(local)) await pushSnapshot();
            else setCloudMessage('Chưa có dữ liệu để đồng bộ.', '');
            return;
        }

        if (hasBusinessData(local)) {
            const useCloud = confirm(
                `Đã tìm thấy bản dữ liệu trên đám mây (${new Date(row.updated_at).toLocaleString('vi-VN')}).\n\n` +
                'Chọn OK để dùng dữ liệu đám mây; chọn Hủy để giữ dữ liệu trên thiết bị và ghi đè bản đám mây.'
            );
            if (!useCloud) {
                await pushSnapshot();
                return;
            }
        }
        applySnapshot(row.data);
        setCloudMessage(`Đã tải dữ liệu đám mây (${new Date(row.updated_at).toLocaleString('vi-VN')}).`, 'success');
        if (typeof refreshCurrentView === 'function') refreshCurrentView();
        else location.reload();
    }

    function subscribeToRemoteChanges() {
        const client = getClient();
        if (!client || !status.user || status.channel) return;
        status.channel = client.channel(`app-state-${status.user.id}`)
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: CLOUD_TABLE,
                filter: `user_id=eq.${status.user.id}`
            }, payload => {
                if (!status.applyingRemote && payload.new && payload.new.data) {
                    applySnapshot(payload.new.data);
                    setCloudMessage('Đã nhận dữ liệu mới từ thiết bị khác.', 'success');
                    if (typeof refreshCurrentView === 'function') refreshCurrentView();
                }
            })
            .subscribe();
    }

    async function updateSession(session) {
        status.user = session ? session.user : null;
        const controls = document.getElementById('cloud-sync-controls');
        if (controls) controls.style.display = status.user ? 'flex' : 'none';
        if (!status.user) {
            setCloudMessage('Đăng nhập để sao lưu và đồng bộ dữ liệu giữa các thiết bị.', '');
            return;
        }
        setCloudMessage(`Đã đăng nhập: ${status.user.email}. Đang kiểm tra dữ liệu đám mây…`, '');
        await loadCloudState();
        subscribeToRemoteChanges();
    }

    async function openCloudSignIn() {
        const client = getClient();
        if (!client) return alert('Thiếu cấu hình Supabase.');
        const email = prompt('Email đăng nhập Supabase:');
        if (!email) return;
        const password = prompt('Mật khẩu (ít nhất 6 ký tự):');
        if (!password) return;
        setCloudMessage('Đang đăng nhập…', '');
        let result = await client.auth.signInWithPassword({ email, password });
        if (result.error && /Invalid login credentials/i.test(result.error.message)) {
            const createAccount = confirm('Tài khoản chưa tồn tại hoặc mật khẩu chưa đúng. Bạn có muốn tạo tài khoản mới?');
            if (createAccount) result = await client.auth.signUp({ email, password });
        }
        if (result.error) {
            setCloudMessage(`Không thể đăng nhập: ${result.error.message}`, 'error');
            return;
        }
        if (!result.data.session) {
            setCloudMessage('Hãy xác nhận email rồi đăng nhập lại để bắt đầu đồng bộ.', '');
        }
    }

    async function signOutCloud() {
        const client = getClient();
        if (client) await client.auth.signOut();
    }

    window.openCloudSignIn = openCloudSignIn;
    window.signOutCloud = signOutCloud;
    window.syncToCloudNow = pushSnapshot;

    window.addEventListener('cloud-sync-ui-ready', () => {
        const controls = document.getElementById('cloud-sync-controls');
        if (controls) controls.style.display = status.user ? 'flex' : 'none';
        if (status.user) setCloudMessage(`Đã đăng nhập: ${status.user.email}.`, 'success');
    });

    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
        originalSetItem.call(this, key, value);
        if (this === localStorage && (CLOUD_STORAGE_KEYS.includes(key) || key.startsWith('houseProviderInfo_'))) schedulePush();
    };

    document.addEventListener('DOMContentLoaded', async () => {
        const client = getClient();
        if (!client) {
            setCloudMessage('Chưa có cấu hình Supabase.', 'error');
            return;
        }
        const { data: { session } } = await client.auth.getSession();
        await updateSession(session);
        client.auth.onAuthStateChange((_event, newSession) => { updateSession(newSession); });
    });
}());
