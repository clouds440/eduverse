import { api } from './api';
import { Notification } from '@/types';

const cache: { items: Notification[]; unreadCount: number; readPage: number; hasMoreRead: boolean } = {
    items: [],
    unreadCount: 0,
    readPage: 1,
    hasMoreRead: false,
};
const listeners = new Set<() => void>();
const inFlightMark = new Set<string>();
const inFlightDelete = new Set<string>();
let inFlightMarkAll = false;

function notify() {
    listeners.forEach(l => l());
}

export const notificationsStore = {
    async fetchAll(token?: string) {
        return this.fetchDropdown(token, { readPage: 1, append: false });
    },

    async fetchDropdown(token?: string, options: { readPage?: number; append?: boolean } = {}) {
        if (!token) return cache;
        try {
            const readPage = options.readPage || 1;
            const res = await api.notifications.getDropdownNotifications(token, { readPage, readLimit: 10 });
            let items: Notification[] = res.data || [];

            // Reflect optimistic single-item marks locally
            if (inFlightMark.size > 0) {
                items = items.map(n => inFlightMark.has(n.id) ? { ...n, isRead: true } : n);
            }

            // If a mark-all is in flight, treat items as read locally
            if (inFlightMarkAll) {
                items = items.map(n => ({ ...n, isRead: true }));
            }

            if (options.append && readPage > 1) {
                const itemMap = new Map(cache.items.map((item) => [item.id, item]));
                for (const item of items) itemMap.set(item.id, item);
                cache.items = Array.from(itemMap.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            } else {
                cache.items = items;
            }
            cache.unreadCount = inFlightMarkAll ? 0 : (res.unreadCount || cache.items.filter((n: Notification) => !n.isRead).length);
            cache.readPage = res.readPage;
            cache.hasMoreRead = res.hasMoreRead;
            notify();
            return cache;
        } catch (err) {
            console.error('notificationsStore.fetchDropdown error', err);
            throw err;
        }
    },

    getAll() {
        return { ...cache, items: [...cache.items] };
    },

    subscribe(fn: () => void) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    },

    // Add incoming notification (socket)
    applyNew(notif: Notification) {
        // Avoid duplicate insertions
        const exists = cache.items.find(n => n.id === notif.id);
        if (exists) {
            const updated = { ...exists, ...notif } as Notification;
            const idx = cache.items.findIndex(n => n.id === notif.id);
            const arr = [...cache.items];
            arr.splice(idx, 1);
            arr.unshift(updated);
            cache.items = arr;
            try { console.debug('[notificationsStore] applyNew (existing) id=', notif.id); } catch { }
            notify();
            return;
        }

        const alreadyMarked = inFlightMark.has(notif.id);
        cache.items = [{ ...(alreadyMarked ? { ...notif, isRead: true } : notif) }, ...cache.items];
        if (!notif.isRead && !alreadyMarked && !inFlightMarkAll) {
            cache.unreadCount = (cache.unreadCount || 0) + 1;
        }
        try { console.debug('[notificationsStore] applyNew id=', notif.id, 'isRead=', !!notif.isRead, 'alreadyMarked=', alreadyMarked); } catch { }
        notify();
    },

    applyRead(notificationId: string) {
        const idx = cache.items.findIndex(n => n.id === notificationId);
        if (idx === -1) {
            // Unknown item; nothing to adjust locally
            try { console.debug('[notificationsStore] applyRead unknown id=', notificationId); } catch { }
            notify();
            return;
        }
        const existing = cache.items[idx];
        if (!existing.isRead) {
            cache.items = cache.items.map(n => n.id === notificationId ? { ...n, isRead: true } : n);
            cache.unreadCount = Math.max(0, (cache.unreadCount || 0) - 1);
            try { console.debug('[notificationsStore] applyRead id=', notificationId, 'newUnread=', cache.unreadCount); } catch { }
            notify();
        }
    },

    applyReadAll() {
        cache.items = cache.items.map(n => ({ ...n, isRead: true }));
        cache.unreadCount = 0;
        notify();
    },

    applyDelete(notificationId: string, wasUnread?: boolean) {
        const optimisticDelete = inFlightDelete.has(notificationId);
        const existing = cache.items.find(n => n.id === notificationId);
        cache.items = cache.items.filter(n => n.id !== notificationId);
        if (!optimisticDelete && (wasUnread || existing?.isRead === false) && !inFlightMarkAll) {
            cache.unreadCount = Math.max(0, (cache.unreadCount || 0) - 1);
        }
        notify();
    },

    // Guarded mark-as-read to avoid duplicate API calls
    async markAsReadGuard(id: string, token?: string) {
        if (!token) return;
        // If already marked locally, skip
        const existing = cache.items.find(n => n.id === id);
        if (existing && existing.isRead) return;
        if (inFlightMark.has(id)) return;
        inFlightMark.add(id);
        // Optimistic local update
        try {
            this.applyRead(id);
            await api.notifications.markAsRead(id, token);
        } catch (err) {
            console.error('markAsReadGuard error', err);
            // Resync from server to ensure accurate state
            try { await this.fetchAll(token); } catch { /* swallow */ }
        } finally {
            inFlightMark.delete(id);
        }
    },

    async markAllAsReadGuard(token?: string) {
        if (!token) return;
        if ((cache.unreadCount || 0) === 0) return;
        if (inFlightMarkAll) return;
        inFlightMarkAll = true;
        // Optimistic local update
        try {
            this.applyReadAll();
            await api.notifications.markAllAsRead(token);
        } catch (err) {
            console.error('markAllAsReadGuard error', err);
            // Resync from server
            try { await this.fetchAll(token); } catch { /* swallow */ }
        } finally {
            inFlightMarkAll = false;
        }
    },

    async deleteGuard(id: string, token?: string) {
        if (!token) return;
        const existing = cache.items.find(n => n.id === id);
        this.applyDelete(id);
        inFlightDelete.add(id);
        try {
            await api.notifications.deleteNotification(id, token);
        } catch (err) {
            console.error('deleteNotificationGuard error', err);
            if (existing) {
                cache.items = [existing, ...cache.items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                if (!existing.isRead) cache.unreadCount = (cache.unreadCount || 0) + 1;
                notify();
            }
        } finally {
            inFlightDelete.delete(id);
        }
    }
};

export default notificationsStore;
