package sch.almunawwir.papan;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.TextView;

/**
 * MyAlwis Papan — aplikasi TV sekolah (24 September 2026).
 *
 * Satu WebView layar penuh, tanpa bilah alamat. Dibuat setelah terbukti bahwa membuka papan lewat peramban TV
 * menampilkan hiasan peramban sehingga terlihat seperti orang sedang browsing, bukan papan informasi.
 *
 * SENGAJA SERBAGUNA: alamat yang dibuka dikirim dari dashboard sekolah lewat ADB, bukan ditanam di kode —
 * TV yang sama bisa dipakai sebagai papan informasi kelas, papan pengumuman, atau layar presensi QR:
 *
 *   adb shell am start -n sch.almunawwir.papan/.MainActivity -e alamat "https://…/layar/<token>"
 *
 * Alamat itu disimpan, jadi setelah TV dinyalakan ulang (termasuk sehabis listrik padam) papan kembali sendiri
 * tanpa ada yang perlu mengetik apa pun di TV. Tidak ada pustaka tambahan supaya APK tetap kecil.
 */
public class MainActivity extends Activity {
    private static final String PREF = "papan", KUNCI_ALAMAT = "alamat";
    /** Muat ulang berkala: TV menyala berjam-jam, dan halaman papan bisa saja tersangkut setelah jaringan putus. */
    private static final long JEDA_MUAT_ULANG_MS = 15 * 60_000L;

    private WebView web;
    private TextView pesan;
    private JembatanSuara suara;
    private final Handler tangan = new Handler(Looper.getMainLooper());

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle simpanan) {
        super.onCreate(simpanan);
        // Layar papan tidak boleh tidur selama aplikasi tampil — itu inti dari sebuah papan informasi.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        layarPenuh();

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0A1030"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        // JEMBATAN SUARA: WebView tidak punya `speechSynthesis`, jadi pengumuman dibacakan lewat mesin suara
        // Android. Halaman papan memeriksa `window.PapanSuara` dulu sebelum memakainya.
        suara = new JembatanSuara(this);
        web.addJavascriptInterface(suara, "PapanSuara");

        pesan = new TextView(this);
        pesan.setTextColor(Color.WHITE);
        pesan.setTextSize(20);
        pesan.setPadding(60, 60, 60, 60);
        pesan.setBackgroundColor(Color.parseColor("#0A1030"));

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView v, int kode, String keterangan, String gagalUrl) {
                // Jaringan sekolah kadang putus sesaat. Jangan menampilkan halaman galat bawaan yang jelek di
                // dinding kelas — cukup coba lagi diam-diam setiap 20 detik.
                tangan.postDelayed(() -> v.reload(), 20_000);
            }
        });

        String alamat = alamatTersimpan();
        String dariIntent = alamatDariIntent(getIntent());
        if (dariIntent != null) { simpanAlamat(dariIntent); alamat = dariIntent; }

        if (alamat == null) {
            pesan.setText("MyAlwis Papan\n\nBelum ada alamat papan.\n\n"
                    + "Alamat dikirim dari dashboard sekolah:\nSarana → Papan & TV → tombol \"Buka Papan Sekolah\".\n\n"
                    + "TV ini tidak perlu diketik apa pun.");
            setContentView(pesan);
            return;
        }

        setContentView(web);
        web.loadUrl(alamat);
        jadwalkanMuatUlang();
    }

    /** Alamat baru dikirim saat aplikasi sudah berjalan (mis. berpindah dari papan ke layar presensi). */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String baru = alamatDariIntent(intent);
        if (baru == null) return;
        simpanAlamat(baru);
        setContentView(web);
        web.loadUrl(baru);
    }

    @Override
    protected void onDestroy() {
        if (suara != null) suara.lepas();
        super.onDestroy();
    }

    @Override
    protected void onResume() {
        super.onResume();
        layarPenuh();
    }

    private void jadwalkanMuatUlang() {
        tangan.postDelayed(new Runnable() {
            @Override public void run() {
                if (web != null) web.reload();
                tangan.postDelayed(this, JEDA_MUAT_ULANG_MS);
            }
        }, JEDA_MUAT_ULANG_MS);
    }

    /** Sembunyikan bilah status & navigasi — inilah bedanya dengan membuka lewat peramban. */
    private void layarPenuh() {
        View akar = getWindow().getDecorView();
        akar.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        if (Build.VERSION.SDK_INT >= 21) getWindow().setStatusBarColor(Color.parseColor("#0A1030"));
    }

    private String alamatDariIntent(Intent i) {
        if (i == null) return null;
        String a = i.getStringExtra("alamat");
        if (a == null && i.getData() != null) a = i.getData().toString();
        return (a != null && (a.startsWith("http://") || a.startsWith("https://"))) ? a : null;
    }

    private String alamatTersimpan() {
        return getSharedPreferences(PREF, Context.MODE_PRIVATE).getString(KUNCI_ALAMAT, null);
    }

    private void simpanAlamat(String a) {
        SharedPreferences.Editor e = getSharedPreferences(PREF, Context.MODE_PRIVATE).edit();
        e.putString(KUNCI_ALAMAT, a);
        e.apply();
    }
}
