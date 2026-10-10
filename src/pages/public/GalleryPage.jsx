import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Truck, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { PageHeader } from '../../components/common/PageHeader';
import { galleryApi } from '../../lib/api';
import { getImageFramingStyle } from '../../lib/framing';
import { BeforeAfterCompare } from '../../features/gallery/BeforeAfterCompare';

const ITEMS_PER_PAGE = 12;

function GalleryCard({ item }) {
  return <BeforeAfterCompare beforeUrl={item.before_url} afterUrl={item.after_url}
    beforeStyle={getImageFramingStyle(item, 'before')} afterStyle={getImageFramingStyle(item, 'after')}
    caption={item.caption} serviceTag={item.layanan_terkait || 'Treatment Sepatu'} imageClassName="aspect-[4/3] min-h-[190px]"
    footer={<Link to={`/galeri/${item.id}`} className="inline-flex items-center gap-1.5 text-sm text-brand-600 font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">Lihat detail <ChevronRight size={15} aria-hidden="true" /></Link>} />;
}

function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 2) {
        end = Math.min(4, totalPages - 1);
      }
      if (currentPage >= totalPages - 1) {
        start = Math.max(totalPages - 3, 2);
      }

      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <nav aria-label="Navigasi halaman galeri" className="flex items-center justify-center gap-1.5 mt-14">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="w-9 h-9 rounded-md bg-white border border-brand-200 text-brand-900 hover:bg-brand-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
        aria-label="Halaman sebelumnya"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {getPageNumbers().map((page, idx) =>
        page === '...' ? (
          <span key={`dots-${idx}`} className="w-9 h-9 flex items-center justify-center text-xs text-slate-wet select-none">
            ...
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`w-9 h-9 rounded-md text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
              currentPage === page
                ? 'bg-brand-600 text-white shadow-xs border border-brand-600'
                : 'bg-white border border-brand-200 text-brand-900 hover:bg-brand-100'
            }`}
            aria-label={`Halaman ${page}`}
            aria-current={currentPage === page ? 'page' : undefined}
          >
            {page}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="w-9 h-9 rounded-md bg-white border border-brand-200 text-brand-900 hover:bg-brand-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
        aria-label="Halaman selanjutnya"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}

const GALLERY_CATEGORIES = [
  { id: 'all', label: 'Semua Treatment' },
  { id: 'cuci', label: 'Cuci Sepatu' },
  { id: 'repaint', label: 'Repaint Sepatu' },
  { id: 'sabun', label: 'Sabun & Perawatan' }
];

export function GalleryPage() {
  const navigate = useNavigate();
  const [gallery, setGallery] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const gridRef = useRef(null);

  useEffect(() => {
    let active = true;
    async function loadGallery() {
      setLoading(true); setError('');
      try {
        const items = await galleryApi.getGallery(true);
        if (active) setGallery(items);
      } catch {
        if (active) setError('Galeri belum dapat dimuat. Periksa koneksi dan coba lagi.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadGallery();
    return () => { active = false; };
  }, [retry]);

  const getItemCategory = (item) => {
    if (item.kategori) return item.kategori.toLowerCase();
    const txt = `${item.layanan_terkait || ''} ${item.caption || ''}`.toLowerCase();
    if (txt.includes('repaint')) return 'repaint';
    if (txt.includes('sabun') || txt.includes('cleaner') || txt.includes('refresher')) return 'sabun';
    return 'cuci';
  };

  const filteredGallery = selectedCategory === 'all'
    ? gallery
    : gallery.filter((item) => getItemCategory(item) === selectedCategory);

  const totalPages = Math.ceil(filteredGallery.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredGallery.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleCategoryChange = useCallback((catId) => {
    setSelectedCategory(catId);
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    if (gridRef.current) {
      gridRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const resultStart = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const resultEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredGallery.length);

  return (
    <div className="bg-brand-light min-h-screen page-smooth-enter">
      <PageHeader
        title="Before–After"
        breadcrumb={[{ label: 'Galeri' }]}
        subtitle="Lihat hasil perawatan nyata dari workshop Lave Streat. Geser pembanding atau buka detail untuk melihat setiap sudut sepatu."
        bgImage="/services/repaint.jpg"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div ref={gridRef} className="scroll-mt-24">
          <div className="flex items-center justify-center flex-wrap gap-2 mb-10">
            {GALLERY_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryChange(cat.id)}
                  aria-pressed={isActive}
                  className={`px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-white text-brand-900 hover:bg-brand-100 border border-brand-200'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {!loading && filteredGallery.length > 0 && (
            <div className="flex items-center justify-between mb-6 px-1">
              <p className="text-xs text-slate-wet">
                Menampilkan <strong className="text-brand-900">{resultStart}-{resultEnd}</strong> dari <strong className="text-brand-900">{filteredGallery.length}</strong> dokumentasi
              </p>
            </div>
          )}
        </div>

        {error ? <div role="alert" className="bg-white border border-brand-200 rounded-card p-8 text-center"><p className="text-sm text-danger mb-4">{error}</p><Button onClick={() => setRetry(value => value + 1)}>Coba lagi</Button></div> : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-lg overflow-hidden">
                <div className="w-full aspect-[4/3] min-h-[190px] bg-slate-200 animate-pulse" />
                <div className="bg-white p-4 space-y-2 border border-brand-200 border-t-0 rounded-b-lg">
                  <div className="h-4 bg-slate-200 rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-slate-100 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredGallery.length === 0 ? (
          <div className="text-center py-16 text-slate-wet bg-white rounded-lg border border-brand-200 shadow-xs">
            <p className="text-sm">Belum ada dokumentasi untuk kategori ini.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {paginatedItems.map((item) => (
                <GalleryCard
                  key={item.id}
                  item={item}
                />
              ))}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>

      <section className="py-14 sm:py-16 bg-brand-900 text-snow-foam w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl text-left">
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight leading-snug">
              Sepatu kotor atau butuh perawatan berkala?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
              Jadwalkan penjemputan sekarang. Tim kurir kami siap menjemput dan merawat sepatu Anda di area Sidoarjo dan Surabaya.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <Button
              onClick={() => navigate('/pesan')}
              size="lg"
              className="shadow-md flex items-center gap-2"
            >
              <Truck className="w-4 h-4" />
              <span>Pesan Sekarang</span>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
