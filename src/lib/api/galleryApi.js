import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { initialGallery } from './mockData';
import { publicGalleryEntry } from '../galleryPublicModel';

const STORAGE_KEY = 'lavestreat_gallery_data_v16';

function getLocalGallery() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialGallery));
      return initialGallery;
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) throw new Error('Invalid gallery cache');
    return parsed;
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialGallery));
    return initialGallery;
  }
}

function saveLocalGallery(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export const galleryApi = {
  async getGallery(onlyHome = false) {
    let list = [];
    if (isFirebaseConfigured) {
      try {
        const colRef = collection(db, 'gallery');
        const q = onlyHome ? query(colRef, where('tampil_di_home', '==', true)) : colRef;
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        return onlyHome ? docs.map(publicGalleryEntry) : docs;
      } catch (err) {
        throw new Error('Galeri belum dapat dimuat. Silakan coba lagi.');
      }
    }

    if (list.length === 0) {
      const items = getLocalGallery();
      list = onlyHome ? items.filter(i => i.tampil_di_home) : items;
    }

    return onlyHome ? list.map(publicGalleryEntry) : list;
  },

  async getGalleryItemById(id, publicOnly = false) {
    if (!id) return null;
    if (publicOnly) {
      const items = await galleryApi.getGallery(true);
      return items.find(item => String(item.id) === String(id)) || null;
    }
    let found = null;

    if (isFirebaseConfigured) {
      try {
        const snap = await getDoc(doc(db, 'gallery', id));
        if (snap.exists()) {
          found = { ...snap.data(), id: snap.id };
        } else {
          const colRef = collection(db, 'gallery');
          const snapAll = await getDocs(colRef);
          const match = snapAll.docs.find(d => {
            const data = d.data();
            return String(d.id) === String(id) ||
                   String(data.item_id) === String(id) ||
                   String(data.order_id) === String(id) ||
                   String(data.invoice) === String(id) ||
                   String(data.invoice_number) === String(id);
          });
          if (match) {
            found = { ...match.data(), id: match.id };
          }
        }
      } catch (err) {
        throw new Error('Dokumentasi belum dapat dimuat. Silakan coba lagi.');
      }
      return found;
    }

    if (!found) {
      const items = getLocalGallery();
      found = items.find(i =>
        String(i.id) === String(id) ||
        String(i.item_id) === String(id) ||
        String(i.order_id) === String(id) ||
        String(i.invoice) === String(id) ||
        String(i.invoice_number) === String(id)
      ) || null;
    }

    return found;
  },

  async createGalleryItem(payload) {
    if (!payload.before_url || !payload.after_url) {
      throw new Error('Kedua foto (Sebelum dan Sesudah) wajib diunggah.');
    }

    const cleanPayload = {
      before_url: payload.before_url,
      after_url: payload.after_url,
      caption: payload.caption || '',
      layanan_terkait: payload.layanan_terkait || '',
      order_id: payload.order_id || null,
      invoice: payload.invoice || payload.order_id || null,
      shoe_brand: payload.shoe_brand || '',
      shoe_type: payload.shoe_type || '',
      object_position: payload.object_position || '50% 50%',
      pos_x: payload.pos_x ?? 50,
      pos_y: payload.pos_y ?? 50,
      featured_slot: payload.featured_slot || 1,
      tampil_di_home: payload.tampil_di_home !== false,
      framing_before: payload.framing_before || null,
      framing_after: payload.framing_after || null,
      slots: payload.slots || [],
      created_at: new Date().toISOString()
    };

    if (isFirebaseConfigured) {
      const docRef = await addDoc(collection(db, 'gallery'), cleanPayload);
      return { id: docRef.id, ...cleanPayload };
    }

    const items = getLocalGallery();
    const newItem = {
      id: 'gal-' + Date.now(),
      ...cleanPayload
    };
    items.unshift(newItem);
    saveLocalGallery(items);
    return newItem;
  },

  async updateGalleryItem(id, payload) {
    // Visibility-only actions must preserve the existing pair and its framing.
    const current = await galleryApi.getGalleryItemById(id);
    if (!current) throw new Error('Item galeri tidak ditemukan');
    payload = { ...current, ...payload };
    if (!payload.before_url || !payload.after_url) {
      throw new Error('Kedua foto (Sebelum dan Sesudah) wajib diisi.');
    }

    const cleanPayload = {
      before_url: payload.before_url,
      after_url: payload.after_url,
      caption: payload.caption || '',
      layanan_terkait: payload.layanan_terkait || '',
      order_id: payload.order_id || null,
      invoice: payload.invoice || payload.order_id || null,
      shoe_brand: payload.shoe_brand || '',
      shoe_type: payload.shoe_type || '',
      object_position: payload.object_position || '50% 50%',
      pos_x: payload.pos_x ?? 50,
      pos_y: payload.pos_y ?? 50,
      featured_slot: payload.featured_slot || 1,
      tampil_di_home: payload.tampil_di_home !== false,
      framing_before: payload.framing_before || null,
      framing_after: payload.framing_after || null,
      slots: payload.slots || []
    };

    if (isFirebaseConfigured) {
      await updateDoc(doc(db, 'gallery', id), cleanPayload);
      return { id, ...cleanPayload };
    }

    const items = getLocalGallery();
    const index = items.findIndex(i => i.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...cleanPayload };
      saveLocalGallery(items);
      return items[index];
    }
    throw new Error('Item galeri tidak ditemukan');
  },

  async deleteGalleryItem(id) {
    if (isFirebaseConfigured) {
      await deleteDoc(doc(db, 'gallery', id));
      return true;
    }

    const items = getLocalGallery();
    const filtered = items.filter(i => i.id !== id);
    saveLocalGallery(filtered);
    return true;
  }
};
