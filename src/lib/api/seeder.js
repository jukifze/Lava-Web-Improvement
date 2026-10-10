import { 
  collection, 
  getDocs, 
  doc, 
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { 
  initialServices, 
  initialGallery, 
  initialTestimonials, 
  initialSettings, 
  initialHomeContent, 
  initialAboutContent 
} from './mockData';
import { publicGalleryEntry } from '../galleryPublicModel';

export async function seedFirestore(force = false) {
  if (!isFirebaseConfigured) {
    return { success: false, message: 'Firebase belum dikonfigurasi di file .env' };
  }

  try {
    const servicesSnap = await getDocs(collection(db, 'services'));
    if (!force && !servicesSnap.empty) {
      return { success: true, message: 'Database Firestore sudah berisi data.' };
    }

    const batch = writeBatch(db);

    initialServices.forEach((service) => {
      const docRef = doc(db, 'services', service.id);
      batch.set(docRef, service);
    });

    initialGallery.forEach((item) => {
      const docRef = doc(db, 'gallery', item.id);
      batch.set(docRef, publicGalleryEntry(item));
    });

    initialTestimonials.forEach((testi) => {
      const docRef = doc(db, 'testimonials', testi.id);
      batch.set(docRef, testi);
    });

    batch.set(doc(db, 'settings', 'general'), initialSettings);
    batch.set(doc(db, 'content', 'home'), initialHomeContent);
    batch.set(doc(db, 'content', 'about'), initialAboutContent);

    await batch.commit();
    return { success: true, message: 'Berhasil memasukkan seluruh data ke database Firestore.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

export async function checkAndAutoSeed() {
  if (!isFirebaseConfigured) return;
  try {
    const servicesSnap = await getDocs(collection(db, 'services'));
    if (servicesSnap.empty) {
      await seedFirestore(false);
    }
  } catch (err) {
  }
}
