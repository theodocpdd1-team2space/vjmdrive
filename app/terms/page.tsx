import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f4f4ef] px-5 py-12 text-black md:px-8">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-black text-black/50 hover:text-black">driveOne</Link>
        <h1 className="mt-6 text-4xl font-black tracking-tight">Syarat Penggunaan</h1>
        <p className="mt-4 text-sm leading-7 text-black/62">driveOne adalah layanan cloud storage, file sharing, dan Beauty Share delivery untuk menyimpan, menata, membagikan, dan mengirim file secara profesional.</p>

        <section className="mt-8 space-y-5 text-sm leading-7 text-black/72">
          <p>driveOne bukan jaminan backup permanen atau arsip kritikal. Pengguna wajib menyimpan backup independen untuk file penting, karena tidak ada layanan online yang dapat menjamin 100% uptime atau 100% keamanan data.</p>
          <p>File tetap dimiliki oleh pengguna. driveOne dapat memproses file hanya untuk menjalankan layanan, termasuk upload, storage, preview, thumbnail, cache, sharing, dan Beauty Share.</p>
          <p>Penggunaan yang dilarang mencakup malware, phishing, konten ilegal, penyalahgunaan hak cipta, spam, penyalahgunaan bandwidth, dan penyalahgunaan data pribadi. Fair usage berlaku walaupun tidak ada batas download harian yang tertulis.</p>
          <p>Pembayaran dapat dilakukan manual melalui tautan pembayaran pihak ketiga. Refund terbatas dan diputuskan kasus per kasus. Paket yang kedaluwarsa dapat memiliki masa tenggang sebelum akses dibatasi atau data dihapus. File yang sudah dihapus mungkin tidak dapat dipulihkan.</p>
          <p>Untuk Enterprise atau custom storage, pelanggan dapat membayar biaya setup infrastruktur atau storage. Perangkat fisik menjadi aset operasional driveOne; pelanggan memperoleh hak memakai kapasitas yang dialokasikan, bukan kepemilikan hardware. Biaya online atau maintenance dapat berlaku, misalnya mulai Rp100.000 per bulan.</p>
          <p>Tanggung jawab driveOne terbatas pada penyediaan layanan secara wajar. Pengguna bertanggung jawab memastikan backup file kritikal dan menggunakan layanan sesuai hukum yang berlaku.</p>
        </section>

        <footer className="mt-10 border-t border-black/10 pt-5 text-xs font-bold text-black/50">
          Built by solusivendor.com
        </footer>
      </article>
    </main>
  );
}
