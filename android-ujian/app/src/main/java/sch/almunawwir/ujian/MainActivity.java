package sch.almunawwir.ujian;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
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
import java.util.Scanner;

/**
 * APLIKASI UJIAN SMK AL-MUNAWWIR (22 September 2026) — pengganti Exambro.
 *
 *  - WebView ke portal ujian (HTTPS, hanya domain sekolah; tautan luar diblokir).
 *  - Layar DISEMATKAN (startLockTask): tombol Home & aplikasi terakhir tidak bisa dipakai selama aplikasi terbuka.
 *  - FLAG_SECURE: tangkapan layar, rekaman layar, dan pratinjau di daftar aplikasi terakhir diblokir.
 *  - Tombol Kembali tidak pernah menutup aplikasi. Keluar lewat tombol Keluar; saat halaman pengerjaan ujian terbuka,
 *    wajib PIN pengawas (SiteSetting ujian.pinAplikasi, dicek /api/ujian/aplikasi/keluar).
 *  - User-Agent diberi "SMKUjianApp/versi" — situs mengenali aplikasi (ujian ber-wajibAplikasi).
 *  - Mikrofon (soal Jawaban Lisan) & pemilih berkas (soal Unggah) didukung; sebelum membuka pemilih berkas halaman diberi
 *    tahu lewat window.__ujianAplikasi.tahan() supaya tidak tercatat "pindah tab".
 */
public class MainActivity extends Activity {
    private static final String HOST = "smk-almunawwir.tail984090.ts.net";
    private static final String ALAMAT = "https://" + HOST;
    private static final String BERANDA = ALAMAT + "/ujian-online";
    private static final String VERSI = "1.0";
    private static final int KODE_BERKAS = 11, KODE_MIKROFON = 12;
    private static final int NAVY = Color.rgb(15, 26, 69);

    private WebView web;
    private ProgressBar muat;
    private ValueCallback<Uri[]> tungguBerkas;
    private PermissionRequest tungguIzin;
    private boolean memilihBerkas = false;

    @Override
    protected void onCreate(Bundle simpan) {
        super.onCreate(simpan);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(NAVY);

        LinearLayout akar = new LinearLayout(this);
        akar.setOrientation(LinearLayout.VERTICAL);
        akar.setBackgroundColor(Color.WHITE);

        // Bilah atas: judul + Muat Ulang + Keluar.
        LinearLayout bilah = new LinearLayout(this);
        bilah.setOrientation(LinearLayout.HORIZONTAL);
        bilah.setGravity(Gravity.CENTER_VERTICAL);
        bilah.setBackgroundColor(NAVY);
        int p = dp(10);
        bilah.setPadding(dp(14), p / 2, p / 2, p / 2);
        TextView judul = new TextView(this);
        judul.setText("Ujian SMK Al-Munawwir");
        judul.setTextColor(Color.WHITE);
        judul.setTextSize(16);
        judul.setTypeface(Typeface.DEFAULT_BOLD);
        bilah.addView(judul, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        bilah.addView(tombol("Muat Ulang", v -> web.reload()));
        bilah.addView(tombol("Keluar", v -> mintaKeluar()));
        akar.addView(bilah, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        muat = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        muat.setMax(100);
        akar.addView(muat, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        web = new WebView(this);
        akar.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(akar);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " SMKUjianApp/" + VERSI);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("https".equals(u.getScheme()) && HOST.equalsIgnoreCase(u.getHost())) return false;
                Toast.makeText(MainActivity.this, "Tautan di luar situs ujian diblokir.", Toast.LENGTH_SHORT).show();
                return true;
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
                // Hanya mikrofon, hanya untuk situs sekolah (soal Jawaban Lisan).
                boolean audio = false;
                for (String x : r.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(x)) audio = true;
                if (!audio || !HOST.equalsIgnoreCase(r.getOrigin().getHost())) { r.deny(); return; }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    r.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                } else {
                    tungguIzin = r;
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, KODE_MIKROFON);
                }
            }

            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (tungguBerkas != null) tungguBerkas.onReceiveValue(null);
                tungguBerkas = cb;
                try {
                    // Galeri/berkas adalah aplikasi lain: sematan layar dilepas sebentar & halaman diberi tahu (bukan pindah tab).
                    memilihBerkas = true;
                    web.evaluateJavascript("window.__ujianAplikasi&&window.__ujianAplikasi.tahan(120000)", null);
                    lepasSematan();
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

        if (simpan != null) web.restoreState(simpan);
        else web.loadUrl(BERANDA);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (!memilihBerkas) sematkan();
        sembunyikanBilahSistem();
    }

    @Override
    protected void onSaveInstanceState(Bundle keluar) {
        super.onSaveInstanceState(keluar);
        web.saveState(keluar);
    }

    @Override
    public void onWindowFocusChanged(boolean fokus) {
        super.onWindowFocusChanged(fokus);
        if (fokus) sembunyikanBilahSistem();
    }

    @Override
    public void onBackPressed() {
        // Kembali = halaman sebelumnya di situs; TIDAK PERNAH menutup aplikasi.
        if (web.canGoBack()) web.goBack();
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
        new Handler(Looper.getMainLooper()).postDelayed(() ->
            web.evaluateJavascript("window.__ujianAplikasi&&window.__ujianAplikasi.lepas()", null), 1500);
        sematkan();
    }

    @Override
    public void onRequestPermissionsResult(int kode, String[] izin, int[] hasil) {
        super.onRequestPermissionsResult(kode, izin, hasil);
        if (kode != KODE_MIKROFON || tungguIzin == null) return;
        if (hasil.length > 0 && hasil[0] == PackageManager.PERMISSION_GRANTED) tungguIzin.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        else tungguIzin.deny();
        tungguIzin = null;
    }

    /* ---------------- sematan layar ---------------- */

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

    private void sembunyikanBilahSistem() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    /* ---------------- keluar ---------------- */

    /** Halaman pengerjaan ujian = /ujian-online/<id> (bukan beranda, mulai, panduan, atau hasil). */
    private boolean sedangMengerjakan() {
        String u = web.getUrl();
        if (u == null) return false;
        String jalur = Uri.parse(u).getPath();
        if (jalur == null) return false;
        return jalur.matches("^/ujian-online/[^/]+/?$") && !jalur.matches("^/ujian-online/(panduan|mulai)/?$");
    }

    private void mintaKeluar() {
        if (!sedangMengerjakan()) {
            new AlertDialog.Builder(this).setTitle("Keluar dari aplikasi ujian?")
                .setPositiveButton("Keluar", (d, w) -> keluar())
                .setNegativeButton("Batal", null).show();
            return;
        }
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
                int kode = c.getResponseCode();
                ok = kode == 200;
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
                if (lolos) keluar();
                else Toast.makeText(this, p, Toast.LENGTH_LONG).show();
            });
        }).start();
    }

    private void keluar() {
        lepasSematan();
        finishAndRemoveTask();
    }

    /* ---------------- tampilan ---------------- */

    private void tampilkanGalat() {
        String html = "<html><body style='font-family:sans-serif;text-align:center;padding:48px 24px;color:#0F1A45'>"
            + "<h2>Tidak tersambung ke server ujian</h2><p>Periksa Wi-Fi / data seluler, lalu tekan tombol di bawah.</p>"
            + "<p><a href='" + BERANDA + "' style='display:inline-block;margin-top:16px;padding:12px 20px;background:#1B2B6B;color:#fff;"
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
