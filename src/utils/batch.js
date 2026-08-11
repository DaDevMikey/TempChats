import { db } from '../firebase';

// Firestore allows at most 500 writes per batch, so long conversations have to
// be deleted in chunks. Keeping this in one place means every cleanup path
// (logout, purge, deleting a direct chat) behaves the same way.
const BATCH_LIMIT = 450;

export async function deleteDocsInBatches(refs) {
  const list = refs.filter(Boolean);
  for (let i = 0; i < list.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    list.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
}
