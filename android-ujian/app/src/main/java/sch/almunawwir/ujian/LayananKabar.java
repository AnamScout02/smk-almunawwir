package sch.almunawwir.ujian;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.webkit.CookieManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * KABAR SEKOLAH — pengambil notifikasi berkala untuk MyAlwis Mobile (23 September 2026).
 *
 * Notifikasi push web (Web Push) TIDAK didukung WebView Android, jadi versi aplikasi tidak pernah menerima
 * pemberitahuan seperti versi browser. Layanan ini menutup celah itu: tiap ±15 menit ia menanyakan kotak
 * notifikasi akun yang sedang masuk (/api/aplikasi/notifikasi, memakai cookie sesi milik WebView) lalu
 * memunculkan notifikasi Android biasa. Tanpa pustaka tambahan — JobScheduler bawaan sistem, supaya APK tetap
 * kecil dan tidak perlu AndroidX.
 *
 * Aturan yang dijaga:
 * - DIAM SELAMA UJIAN: peserta tidak boleh diganggu notifikasi saat mengerjakan (MainActivity.UJIAN_BERLANGSUNG).
 * - TIDAK menandai apa pun sebagai dibaca; id yang sudah pernah ditampilkan diingat di SharedPreferences.
 * - Belum masuk (tanpa cookie) = tidak melakukan apa-apa.
 */
public class LayananKabar extends JobService {
    private static final int ID_TUGAS = 71;
    private static final long JEDA = 15 * 60 * 1000L; // batas terkecil yang diizinkan Android untuk tugas berkala
    private static final String SALURAN = "kabar-sekolah";
    private static final String PREF = "kabar", KUNCI_TAMPIL = "sudah-tampil";
    private static final int SIMPAN_ID = 200;

    /** Dipasang sekali dari MainActivity; KEEP — penjadwalan lama tidak digantikan supaya hitungannya tidak diulang. */
    static void jadwalkan(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        for (JobInfo ada : js.getAllPendingJobs()) if (ada.getId() == ID_TUGAS) return;
        JobInfo.Builder b = new JobInfo.Builder(ID_TUGAS, new ComponentName(c, LayananKabar.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPersisted(true)
                .setPeriodic(JEDA);
        try {
            js.schedule(b.build());
        } catch (Exception abaikan) {
            // Beberapa HP membatasi tugas berkala; aplikasi tetap jalan normal tanpa notifikasi latar.
        }
    }

    @Override
    public boolean onStartJob(JobParameters p) {
        new Thread(() -> {
            try {
                ambil();
            } catch (Throwable abaikan) {
                // jaringan putus / sesi habis — coba lagi pada jadwal berikutnya
            }
            jobFinished(p, false);
        }).start();
        return true; // pekerjaan berlanjut di thread lain
    }

    @Override
    public boolean onStopJob(JobParameters p) {
        return true; // jadwalkan ulang bila sistem menghentikan di tengah jalan
    }

    private void ambil() throws Exception {
        if (MainActivity.UJIAN_BERLANGSUNG) return;
        String kuki = CookieManager.getInstance().getCookie(MainActivity.ALAMAT);
        if (kuki == null || kuki.isEmpty()) return; // belum masuk

        HttpURLConnection c = (HttpURLConnection) new URL(MainActivity.ALAMAT + "/api/aplikasi/notifikasi").openConnection();
        c.setRequestProperty("Cookie", kuki);
        c.setRequestProperty("User-Agent", "MyAlwisMobile/" + MainActivity.VERSI);
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        if (c.getResponseCode() != 200) return;

        StringBuilder isi = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"))) {
            String baris;
            while ((baris = r.readLine()) != null) isi.append(baris);
        }
        JSONArray item = new JSONObject(isi.toString()).optJSONArray("item");
        if (item == null || item.length() == 0) return;

        SharedPreferences pref = getSharedPreferences(PREF, MODE_PRIVATE);
        Set<String> pernah = new LinkedHashSet<>(pref.getStringSet(KUNCI_TAMPIL, new HashSet<>()));
        boolean adaBaru = false;
        // Dari yang terlama supaya urutannya di panel notifikasi masuk akal.
        for (int i = item.length() - 1; i >= 0; i--) {
            JSONObject n = item.optJSONObject(i);
            if (n == null) continue;
            String id = n.optString("id", "");
            if (id.isEmpty() || pernah.contains(id)) continue;
            tampilkan(id, n.optString("judul", "Kabar sekolah"), n.optString("isi", ""), n.optString("url", "/notifikasi"));
            pernah.add(id);
            adaBaru = true;
        }
        if (!adaBaru) return;

        List<String> daftar = new ArrayList<>(pernah);
        if (daftar.size() > SIMPAN_ID) daftar = daftar.subList(daftar.size() - SIMPAN_ID, daftar.size());
        pref.edit().putStringSet(KUNCI_TAMPIL, new HashSet<>(daftar)).apply();
    }

    private void tampilkan(String id, String judul, String isi, String url) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel saluran = new NotificationChannel(SALURAN, "Kabar sekolah", NotificationManager.IMPORTANCE_DEFAULT);
            saluran.setDescription("Pengumuman, pengingat, dan kabar dari sekolah");
            nm.createNotificationChannel(saluran);
        }
        Intent buka = new Intent(this, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .putExtra("buka", url)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int bendera = Build.VERSION.SDK_INT >= 23
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent tujuan = PendingIntent.getActivity(this, id.hashCode(), buka, bendera);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, SALURAN)
                : new Notification.Builder(this);
        b.setContentTitle(judul)
                .setContentText(isi)
                .setStyle(new Notification.BigTextStyle().bigText(isi))
                .setSmallIcon(R.drawable.ic_kabar)
                .setAutoCancel(true)
                .setContentIntent(tujuan);
        if (Build.VERSION.SDK_INT >= 21) b.setColor(Color.rgb(15, 26, 69));
        nm.notify(id.hashCode(), b.build());
    }
}
