import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f4f4ef] px-5 py-12 text-black md:px-8">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-black text-black/50 hover:text-black">driveOne</Link>
        <h1 className="mt-6 text-4xl font-black tracking-tight">Kebijakan Privasi</h1>
        <p className="mt-4 text-sm leading-7 text-black/62">Kebijakan ini menjelaskan data yang diproses driveOne untuk menyediakan cloud storage, file sharing, dan Beauty Share delivery.</p>

        <section className="mt-8 space-y-5 text-sm leading-7 text-black/72">
          <p>Data yang dikumpulkan dapat mencakup email, informasi akun, password yang sudah di-hash, file yang diunggah, metadata file, share links, access logs, status paket, dan status pembayaran.</p>
          <p>Data digunakan untuk menyediakan storage dan sharing, login, preview, cache, thumbnail, Beauty Share, bantuan support, keamanan, serta pencegahan penyalahgunaan layanan.</p>
          <p>Akses admin dibatasi untuk kebutuhan operasional, support, keamanan, dan investigasi gangguan. File dapat diakses oleh pihak lain sesuai pengaturan share yang dibuat pengguna.</p>
          <p>Retensi data mengikuti status akun atau paket, termasuk masa aktif, masa tenggang, dan proses penghapusan. Pengguna dapat meminta bantuan penghapusan akun atau data dengan menghubungi admin.</p>
          <p>driveOne menerapkan kontrol akses, validasi path, hashing password, dan pengamanan operasional. Layanan pihak ketiga seperti payment link atau email provider dapat digunakan bila diperlukan.</p>
          <p>Jika terjadi insiden keamanan, driveOne akan melakukan investigasi dan memberikan pemberitahuan sesuai kewajiban hukum yang berlaku bila diperlukan.</p>
        </section>

        <footer className="mt-10 border-t border-black/10 pt-5 text-xs font-bold text-black/50">
          Built by solusivendor.com
        </footer>
      </article>
    </main>
  );
}
