<?php
// ============================================================
// NANDIN KITCHEN — Konfigurasi Database
// EDIT FILE INI di cPanel → File Manager → api/config.php
//
// Cara mengisi (dari cPanel → menu "MySQL Databases"):
//   DB_NAME = nama database yang kamu buat      (mis. ciptakar_nandin)
//   DB_USER = user database yang kamu buat      (mis. ciptakar_admin)
//   DB_PASS = password user database
//
// Catatan: DB_HOST hampir selalu "localhost" di shared hosting.
// ============================================================

define('DB_HOST', 'localhost');
define('DB_NAME', 'GANTI_DENGAN_NAMA_DATABASE');
define('DB_USER', 'GANTI_DENGAN_USER_DATABASE');
define('DB_PASS', 'GANTI_DENGAN_PASSWORD_DATABASE');

// (Opsional) Kunci cadangan untuk aksi admin via header X-Admin-Token.
// Isi dengan teks acak panjang, atau biarkan kosong.
define('ADMIN_TOKEN', '');
