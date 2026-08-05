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
    const status = { client: null, user: null, applyingRemote: false, timer: null, channel: null, loadedUserId: null };

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
        if (window.applicationStarted && typeof refreshCurrentView === 'function') refreshCurrentView();
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
                    if (window.applicationStarted && typeof refreshCurrentView === 'function') refreshCurrentView();
                }
            })
            .subscribe();
    }

    async function updateSession(session) {
        status.user = session ? session.user : null;
        document.body.classList.toggle('authenticated', Boolean(status.user));
        document.body.classList.toggle('auth-pending', !status.user);
        const controls = document.getElementById('cloud-sync-controls');
        if (controls) controls.style.display = status.user ? 'flex' : 'none';
        if (!status.user) {
            status.loadedUserId = null;
            setCloudMessage('Đăng nhập để sao lưu và đồng bộ dữ liệu giữa các thiết bị.', '');
            return;
        }
        if (status.loadedUserId === status.user.id) return;
        status.loadedUserId = status.user.id;
        setCloudMessage(`Đã đăng nhập: ${status.user.email}. Đang kiểm tra dữ liệu đám mây…`, '');
        await loadCloudState();
        subscribeToRemoteChanges();
        if (typeof window.startApplication === 'function') window.startApplication();
    }

    async function submitLogin(email, password) {
        const client = getClient();
        if (!client) throw new Error('Thiếu cấu hình Supabase.');
        setCloudMessage('Đang đăng nhập…', '');
        const result = await client.auth.signInWithPassword({ email, password });
        if (result.error) {
            setCloudMessage(`Không thể đăng nhập: ${result.error.message}`, 'error');
            throw result.error;
        }
    }

    function openCloudSignIn() {
        document.body.classList.remove('authenticated');
        document.body.classList.add('auth-pending');
        document.getElementById('login-email')?.focus();
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

        document.getElementById('login-form').addEventListener('submit', async event => {
            event.preventDefault();
            const errorEl = document.getElementById('login-error');
            const button = document.getElementById('login-submit');
            errorEl.textContent = '';
            button.disabled = true;
            button.textContent = 'Đang đăng nhập…';
            try {
                await submitLogin(
                    document.getElementById('login-email').value.trim(),
                    document.getElementById('login-password').value
                );
            } catch (error) {
                errorEl.textContent = 'Email hoặc mật khẩu không đúng, hoặc tài khoản chưa được cấp quyền.';
            } finally {
                button.disabled = false;
                button.textContent = 'Đăng nhập';
            }
        });
    });
}());
