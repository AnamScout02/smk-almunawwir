package sch.almunawwir.papan;

import android.content.Context;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;

import java.util.Locale;

/**
 * JEMBATAN SUARA — pengumuman kantor dibacakan lewat mesin suara ANDROID, bukan Web Speech API.
 *
 * Alasannya mendasar: **WebView Android tidak mengimplementasikan `speechSynthesis`.** Itu fitur Chrome, bukan
 * WebView, sehingga kode `new SpeechSynthesisUtterance(...)` di halaman papan diam-diam tidak melakukan apa pun —
 * tidak ada galat, tidak ada suara, hanya nada perhatian dan tulisan besarnya yang jalan (terbukti 25 Sep 2026,
 * TV TCL Ruang Rapat: WebView 151, Google TTS terpasang, tetapi pengumuman tidak pernah terdengar).
 *
 * Halaman papan memanggil `window.PapanSuara.ucap(teks)` bila ada, dan baru jatuh ke `speechSynthesis` saat papan
 * dibuka lewat peramban biasa di komputer.
 *
 * Yang perlu dijaga:
 * - **Bahasa diminta id-ID, dengan cadangan bahasa sistem.** TV sekolah berbahasa Inggris (`en-GB`), dan data
 *   suara Indonesia belum tentu terunduh. Kalau id-ID tidak tersedia, kalimatnya tetap dibacakan memakai suara
 *   yang ada — logat Inggris untuk teks Indonesia jelek, tetapi masih jauh lebih berguna daripada bisu.
 * - **Mesin suara disiapkan sekali** saat aplikasi dibuka, bukan tiap kali membaca: menyiapkan TextToSpeech
 *   perlu waktu, dan pengumuman justru datang saat mendesak.
 * - `QUEUE_FLUSH`: pengumuman terbaru memotong yang lama. Dua pengumuman yang saling menimpa di ruangan hanya
 *   membuat keduanya tidak terdengar.
 */
public class JembatanSuara {
    private TextToSpeech mesin;
    private boolean siap = false;

    public JembatanSuara(Context konteks) {
        mesin = new TextToSpeech(konteks, status -> {
            if (status != TextToSpeech.SUCCESS) { siap = false; return; }
            int hasil = mesin.setLanguage(new Locale("id", "ID"));
            if (hasil == TextToSpeech.LANG_MISSING_DATA || hasil == TextToSpeech.LANG_NOT_SUPPORTED) {
                mesin.setLanguage(Locale.getDefault());
            }
            mesin.setSpeechRate(0.95f);
            siap = true;
        });
    }

    /** Dipanggil dari halaman papan: `window.PapanSuara.ucap("...")`. */
    @JavascriptInterface
    public void ucap(String teks) {
        if (!siap || teks == null || teks.trim().isEmpty()) return;
        mesin.speak(teks, TextToSpeech.QUEUE_FLUSH, null, "pengumuman");
    }

    /** Papan memeriksanya dulu supaya tidak memanggil mesin yang belum siap lalu mengira sudah berbunyi. */
    @JavascriptInterface
    public boolean siap() { return siap; }

    public void lepas() {
        if (mesin != null) { mesin.stop(); mesin.shutdown(); mesin = null; siap = false; }
    }
}
