export function publicGalleryEntry(entry) {
  const fields = ['id', 'caption', 'before_url', 'after_url', 'layanan_terkait', 'shoe_brand', 'shoe_type', 'object_position', 'pos_x', 'pos_y', 'featured_slot', 'tampil_di_home', 'framing_before', 'framing_after', 'kategori', 'created_at'];
  const result = Object.fromEntries(fields.filter(key => entry[key] !== undefined).map(key => [key, entry[key]]));
  result.slots = (entry.slots || []).map(slot => Object.fromEntries(['slot', 'label', 'before_url', 'after_url', 'framing_before', 'framing_after', 'object_position'].filter(key => slot[key] !== undefined).map(key => [key, slot[key]])));
  return result;
}
