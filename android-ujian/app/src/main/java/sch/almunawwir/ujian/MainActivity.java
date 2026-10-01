package sch.almunawwir.ujian;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;

/**
 * APLIKASI SMK AL-MUNAWWIR (versi 2.0, 22 September 2026) — satu aplikasi untuk seluruh portal (siswa, guru, orang tua, TU).
 *
 * MODE BIASA: situs layar penuh; unduh berkas (Excel/PDF), cetak, kamera (pindai QR), lokasi (jurnal PKL), unggah berkas,
 *   tautan luar (WhatsApp, peta) dibuka di aplikasi lain.
 * MODE UJIAN (pengganti Exambro): dinyalakan HALAMAN PENGERJAAN UJIAN lewat window.AplikasiSMK.modeUjian(true) dan dimatikan
 *   begitu ujian dikumpulkan / halaman ditinggalkan. Selama mode ujian: layar disematkan (startLockTask — tombol Home & aplikasi
 *   lain terkunci), FLAG_SECURE (tangkapan & rekaman layar diblokir), tautan luar diblokir, keluar wajib PIN pengawas
 *   (/api/ujian/aplikasi/keluar, SiteSetting ujian.pinAplikasi).
 *
 * User-Agent diberi "MyAlwisMobile/versi": situs menampilkan halaman masuk khusus aplikasi & mengenali aplikasi untuk ujian
 * ber-wajibAplikasi (src/lib/aplikasi-ujian.ts).
 */
public class MainActivity extends Activity {
    // Domain resmi sekolah, aktif 30 September 2026. Terowongan Tailscale Funnel
    // (smk-almunawwir.tail984090.ts.net) SENGAJA tetap hidup supaya APK v2.2 ke bawah yang sudah
    // terpasang di HP tidak mati — jangan dimatikan sebelum semua HP memasang versi ini.
    private static final String HOST = "smkalmunawwiriibs.sch.id";
    static final String ALAMAT = "https://" + HOST;
    private static final String AWAL = ALAMAT + "/login"; // yang sudah masuk langsung diteruskan ke dashboard-nya
    static final String VERSI = "2.3";
    private static final int KODE_BERKAS = 11, KODE_MEDIA = 12, KODE_LOKASI = 13, KODE_SIMPAN = 14, KODE_KABAR = 15;
    private static final int NAVY = Color.rgb(15, 26, 69);

    private WebView web;
    private ProgressBar muat;
    private LinearLayout bilahUjian;
    private ValueCallback<Uri[]> tungguBerkas;
    private PermissionRequest tungguIzin;
    private GeolocationPermissions.Callback tungguLokasi;
    private String asalLokasi;
    private Runnable tungguSimpan;
    /** Dibaca LayananKabar: notifikasi latar didiamkan selama peserta mengerjakan ujian. */
    static volatile boolean UJIAN_BERLANGSUNG = false;

    private boolean modeUjian = false;
    private boolean memilihBerkas = false;

    @Override
    protected void onCreate(Bundle simpan) {
        super.onCreate(simpan);
        getWindow().setStatusBarColor(NAVY);
        getWindow().setNavigationBarColor(Color.WHITE);
        if (Build.VERSION.SDK_INT >= 26) {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }

        LinearLayout akar = new LinearLayout(this);
        akar.setOrientation(LinearLayout.VERTICAL);
        akar.setBackgroundColor(NAVY);

        // Bilah MODE UJIAN (tersembunyi di mode biasa).
        bilahUjian = new LinearLayout(this);
        bilahUjian.setOrientation(LinearLayout.HORIZONTAL);
        bilahUjian.setGravity(Gravity.CENTER_VERTICAL);
        bilahUjian.setBackgroundColor(Color.rgb(184, 125, 14));
        bilahUjian.setPadding(dp(14), dp(2), dp(4), dp(2));
        TextView judul = new TextView(this);
        judul.setText("🔒  Mode Ujian — layar terkunci");
        judul.setTextColor(Color.WHITE);
        judul.setTextSize(13);
        judul.setTypeface(Typeface.DEFAULT_BOLD);
        bilahUjian.addView(judul, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        bilahUjian.addView(tombol("Keluar", v -> mintaKeluar()));
        bilahUjian.setVisibility(View.GONE);
        akar.addView(bilahUjian, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        muat = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        muat.setMax(100);
        akar.addView(muat, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        akar.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(akar);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " MyAlwisMobile/" + VERSI);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);

        web.addJavascriptInterface(new Jembatan(), "AplikasiSMK");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (situsSekolah(u)) return false;
                if (modeUjian) {
                    Toast.makeText(MainActivity.this, "Selama ujian, tautan di luar situs sekolah diblokir.", Toast.LENGTH_SHORT).show();
                    return true;
                }
                bukaDiLuar(u);
                return true;
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                // window.print() → dialog cetak Android (rapor, rekap, surat…).
                v.evaluateJavascript("window.print=function(){AplikasiSMK.cetak(document.title||'Dokumen SMK Al Munawwir IIBS')}", null);
            }

            @Override
            public void doUpdateVisitedHistory(WebView v, String url, boolean muatUlang) {
                // Jaring pengaman: bila halaman ujian ditinggalkan tanpa sempat memanggil modeUjian(false).
                if (modeUjian && !halamanUjian(url)) aturModeUjian(false);
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) tampilkanGalat();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView v, int n) {
                muat.setProgress(n);
                muat.setVisibility(n >= 100 ? View.GONE : View.VISIBLE);
            }

            @Override
            public void onPermissionRequest(PermissionRequest r) {
                if (!HOST.equalsIgnoreCase(r.getOrigin().getHost())) { r.deny(); return; }
                List<String> perlu = new ArrayList<>();
                for (String x : r.getResources()) {
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(x)) perlu.add(Manifest.permission.RECORD_AUDIO);
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(x)) perlu.add(Manifest.permission.CAMERA);
                }
                if (perlu.isEmpty()) { r.deny(); return; }
                List<String> belum = new ArrayList<>();
                for (String p : perlu) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) belum.add(p);
                if (belum.isEmpty()) { r.grant(r.getResources()); return; }
                tungguIzin = r;
                requestPermissions(belum.toArray(new String[0]), KODE_MEDIA);
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String asal, GeolocationPermissions.Callback cb) {
                if (!HOST.equalsIgnoreCase(Uri.parse(asal).getHost())) { cb.invoke(asal, false, false); return; }
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) { cb.invoke(asal, true, false); return; }
                tungguLokasi = cb;
                asalLokasi = asal;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, KODE_LOKASI);
            }

            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (tungguBerkas != null) tungguBerkas.onReceiveValue(null);
                tungguBerkas = cb;
                try {
                    memilihBerkas = true;
                    if (modeUjian) {
                        // Galeri/berkas adalah aplikasi lain: halaman diberi tahu (bukan "pindah tab") & sematan dilepas sebentar.
                        web.evaluateJavascript("window.__ujianAplikasi&&window.__ujianAplikasi.tahan(120000)", null);
                        lepasSematan();
                    }
                    startActivityForResult(params.createIntent(), KODE_BERKAS);
                } catch (Exception e) {
                    memilihBerkas = false;
                    tungguBerkas = null;
                    Toast.makeText(MainActivity.this, "Pemilih berkas tidak tersedia.", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });
        web.setDownloadListener((url, ua, disposisi, jenis, panjang) -> unduh(url, ua, disposisi, jenis));

        if (simpan != null) web.restoreState(simpan);
        else web.loadUrl(AWAL);

        // Kabar sekolah: push web tidak jalan di WebView, jadi aplikasi mengambilnya sendiri tiap ±15 menit.
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, KODE_KABAR);
        }
        LayananKabar.jadwalkan(this);
        bukaDariNotifikasi(getIntent());
    }

    /** Ketukan pada notifikasi Android membuka halaman yang bersangkutan di dalam aplikasi. */
    @Override
    protected void onNewIntent(Intent niat) {
        super.onNewIntent(niat);
        setIntent(niat);
        bukaDariNotifikasi(niat);
    }

    private void bukaDariNotifikasi(Intent niat) {
        if (niat == null || modeUjian) return; // saat ujian layar tidak boleh berpindah
        String tujuan = niat.getStringExtra("buka");
        if (tujuan == null || tujuan.isEmpty()) return;
        niat.removeExtra("buka");
        web.loadUrl(tujuan.startsWith("http") ? tujuan : ALAMAT + (tujuan.startsWith("/") ? tujuan : "/" + tujuan));
    }

    /** Dipanggil JavaScript situs (hanya halaman sekolah yang dimuat di WebView ini — situs lain dibuka di luar). */
    private class Jembatan {
        @JavascriptInterface
        public void modeUjian(boolean aktif) { runOnUiThread(() -> aturModeUjian(aktif)); }

        @JavascriptInterface
        public boolean sedangModeUjian() { return modeUjian; }

        @JavascriptInterface
        public String versi() { return VERSI; }

        @JavascriptInterface
        public void cetak(String judul) { runOnUiThread(() -> cetakHalaman(judul)); }
    }

    /* ---------------- siklus hidup ---------------- */

    @Override
    protected void onResume() {
        super.onResume();
        if (modeUjian && !memilihBerkas) sematkan();
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onSaveInstanceState(Bundle keluar) {
        super.onSaveInstanceState(keluar);
        web.saveState(keluar);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) { web.goBack(); return; }
        if (modeUjian) return; // selama ujian tombol Kembali tidak pernah menutup aplikasi
        super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int kode, int hasil, Intent data) {
        super.onActivityResult(kode, hasil, data);
        if (kode != KODE_BERKAS) return;
        memilihBerkas = false;
        if (tungguBerkas != null) {
            tungguBerkas.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(hasil, data));
            tungguBerkas = null;
        }
        if (modeUjian) {
            new Handler(Looper.getMainLooper()).postDelayed(() ->
                web.evaluateJavascript("window.__ujianAplikasi&&window.__ujianAplikasi.lepas()", null), 1500);
            sematkan();
        }
    }

    @Override
    public void onRequestPermissionsResult(int kode, String[] izin, int[] hasil) {
        super.onRequestPermissionsResult(kode, izin, hasil);
        boolean semua = hasil.length > 0;
        for (int h : hasil) if (h != PackageManager.PERMISSION_GRANTED) semua = false;
        if (kode == KODE_MEDIA && tungguIzin != null) {
            if (semua) tungguIzin.grant(tungguIzin.getResources()); else tungguIzin.deny();
            tungguIzin = null;
        } else if (kode == KODE_LOKASI && tungguLokasi != null) {
            tungguLokasi.invoke(asalLokasi, hasil.length > 0 && hasil[0] == PackageManager.PERMISSION_GRANTED, false);
            tungguLokasi = null;
        } else if (kode == KODE_SIMPAN && tungguSimpan != null) {
            if (semua) tungguSimpan.run(); else Toast.makeText(this, "Izin penyimpanan ditolak — berkas tidak diunduh.", Toast.LENGTH_LONG).show();
            tungguSimpan = null;
        }
    }

    /* ---------------- mode ujian ---------------- */

    private void aturModeUjian(boolean aktif) {
        if (aktif == modeUjian) return;
        modeUjian = aktif;
        UJIAN_BERLANGSUNG = aktif;
        if (aktif) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            bilahUjian.setVisibility(View.VISIBLE);
            sematkan();
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            bilahUjian.setVisibility(View.GONE);
            lepasSematan();
        }
    }

    /** Halaman pengerjaan = /ujian-online/<id> (bukan beranda, panduan, mulai, atau hasil). */
    private static boolean halamanUjian(String url) {
        if (url == null) return false;
        String jalur = Uri.parse(url).getPath();
        return jalur != null && jalur.matches("^/ujian-online/[^/]+/?$") && !jalur.matches("^/ujian-online/(panduan|mulai)/?$");
    }

    private boolean sedangDisematkan() {
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        return am != null && am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
    }

    private void sematkan() {
        try { if (!sedangDisematkan()) startLockTask(); } catch (Exception ignored) { }
    }

    private void lepasSematan() {
        try { if (sedangDisematkan()) stopLockTask(); } catch (Exception ignored) { }
    }

    private void mintaKeluar() {
        final EditText isian = new EditText(this);
        isian.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        isian.setHint("PIN pengawas");
        LinearLayout bungkus = new LinearLayout(this);
        bungkus.setPadding(dp(20), dp(8), dp(20), 0);
        bungkus.addView(isian, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        new AlertDialog.Builder(this).setTitle("Sedang mengerjakan ujian")
            .setMessage("Keluar saat ujian berlangsung membutuhkan PIN dari pengawas. Jawaban yang sudah terisi tetap tersimpan.")
            .setView(bungkus)
            .setPositiveButton("Keluar", (d, w) -> periksaPin(isian.getText().toString()))
            .setNegativeButton("Batal", null).show();
    }

    private void periksaPin(final String pin) {
        new Thread(() -> {
            boolean ok = false;
            String pesan = "Tidak bisa memeriksa PIN — periksa koneksi.";
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(ALAMAT + "/api/ujian/aplikasi/keluar").openConnection();
                c.setRequestMethod("POST");
                c.setConnectTimeout(10000);
                c.setReadTimeout(10000);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json");
                String isi = "{\"pin\":\"" + pin.replaceAll("[^0-9]", "") + "\"}";
                try (OutputStream o = c.getOutputStream()) { o.write(isi.getBytes(StandardCharsets.UTF_8)); }
                ok = c.getResponseCode() == 200;
                if (!ok) {
                    try (Scanner sc = new Scanner(c.getErrorStream(), "UTF-8")) {
                        String j = sc.useDelimiter("\\A").hasNext() ? sc.next() : "";
                        int a = j.indexOf("\"error\":\"");
                        pesan = a >= 0 ? j.substring(a + 9, j.indexOf('"', a + 9)) : "PIN salah.";
                    } catch (Exception e) { pesan = "PIN salah."; }
                }
                c.disconnect();
            } catch (Exception ignored) { }
            final boolean lolos = ok;
            final String p = pesan;
            runOnUiThread(() -> {
                if (lolos) { aturModeUjian(false); finishAndRemoveTask(); }
                else Toast.makeText(this, p, Toast.LENGTH_LONG).show();
            });
        }).start();
    }

    /* ---------------- mode biasa: tautan luar, unduhan, cetak ---------------- */

    private static boolean situsSekolah(Uri u) {
        return ("https".equals(u.getScheme()) || "http".equals(u.getScheme())) && HOST.equalsIgnoreCase(u.getHost());
    }

    private void bukaDiLuar(Uri u) {
        try {
            Intent i = "intent".equals(u.getScheme()) ? Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME) : new Intent(Intent.ACTION_VIEW, u);
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(i);
        } catch (Exception e) {
            Toast.makeText(this, "Tidak ada aplikasi untuk membuka tautan ini.", Toast.LENGTH_SHORT).show();
        }
    }

    private void unduh(String url, String ua, String disposisi, String jenis) {
        Runnable kerja = () -> {
            try {
                String nama = URLUtil.guessFileName(url, disposisi, jenis);
                DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
                String kue = CookieManager.getInstance().getCookie(url);
                if (kue != null) r.addRequestHeader("Cookie", kue);
                r.addRequestHeader("User-Agent", ua);
                r.setMimeType(jenis);
                r.setTitle(nama);
                r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, nama);
                ((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(r);
                Toast.makeText(this, "Mengunduh " + nama + " …", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Gagal mengunduh berkas.", Toast.LENGTH_LONG).show();
            }
        };
        if (Build.VERSION.SDK_INT < 29 && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            tungguSimpan = kerja;
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, KODE_SIMPAN);
        } else kerja.run();
    }

    private void cetakHalaman(String judul) {
        try {
            PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
            String nama = judul == null || judul.trim().isEmpty() ? "Dokumen SMK Al Munawwir IIBS" : judul.trim();
            pm.print(nama, web.createPrintDocumentAdapter(nama),
                new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
        } catch (Exception e) {
            Toast.makeText(this, "Cetak tidak tersedia di perangkat ini.", Toast.LENGTH_SHORT).show();
        }
    }

    /* ---------------- tampilan ---------------- */

    private void tampilkanGalat() {
        String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
            + "<body style='font-family:sans-serif;text-align:center;padding:64px 24px;color:#0F1A45;background:#fff'>"
            + "<h2 style='margin:0 0 8px'>Tidak tersambung ke server sekolah</h2><p style='color:#555'>Periksa Wi-Fi / data seluler, lalu coba lagi.</p>"
            + "<p><a href='" + AWAL + "' style='display:inline-block;margin-top:20px;padding:12px 22px;background:#1B2B6B;color:#fff;"
            + "border-radius:12px;text-decoration:none'>Coba Lagi</a></p></body></html>";
        web.loadDataWithBaseURL(ALAMAT, html, "text/html", "UTF-8", null);
    }

    private Button tombol(String teks, View.OnClickListener aksi) {
        Button b = new Button(this);
        b.setText(teks);
        b.setAllCaps(false);
        b.setTextColor(Color.WHITE);
        b.setBackgroundColor(Color.TRANSPARENT);
        b.setOnClickListener(aksi);
        return b;
    }

    private int dp(int n) {
        return Math.round(n * getResources().getDisplayMetrics().density);
    }
}
