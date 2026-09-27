package sch.almunawwir.papan;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Menyalakan papan kembali setelah TV dinyalakan — termasuk sehabis listrik padam.
 *
 * Inilah yang menjawab keluhan "masa tiap TV hidup harus memasukkan link lagi": alamat papan sudah tersimpan di
 * aplikasi, jadi penerima ini cukup membuka layarnya kembali tanpa ada yang perlu mengetik apa pun di TV.
 *
 * Sebagian TV melarang aplikasi tampil langsung saat boot; kalau begitu, papan tetap bisa dibuka satu ketukan
 * dari dashboard (tombol "Buka Papan Sekolah") atau oleh penjadwal yang memeriksa TV nganggur tiap 5 menit.
 */
public class PenerimaBoot extends BroadcastReceiver {
    @Override
    public void onReceive(Context konteks, Intent intent) {
        String aksi = intent == null ? null : intent.getAction();
        if (aksi == null) return;
        if (!Intent.ACTION_BOOT_COMPLETED.equals(aksi) && !"android.intent.action.LOCKED_BOOT_COMPLETED".equals(aksi)) return;
        try {
            Intent buka = new Intent(konteks, MainActivity.class);
            buka.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            konteks.startActivity(buka);
        } catch (Exception abaikan) {
            // TV yang membatasi aktivitas saat boot: papan dibuka dari dashboard seperti biasa.
        }
    }
}
