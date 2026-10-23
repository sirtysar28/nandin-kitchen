<?php
// ============================================================
// NANDIN KITCHEN — REST API + MySQL untuk cPanel
// Tanpa composer, tanpa framework, tanpa terminal.
// Tabel database dibuat OTOMATIS saat pertama kali diakses.
//
// Endpoint (dipanggil aplikasi frontend lewat ?action=...):
//   GET  ?action=bootstrap  → seluruh data (dipakai saat load/polling)
//   GET  ?action=version    → penanda perubahan terbaru (polling ringan)
//   POST ?action=upsert     → simpan/ubah 1 record  {col, id, data}
//   POST ?action=delete     → hapus 1 record        {col, id}
//   POST ?action=settings   → simpan pengaturan     {data}       (admin)
//   POST ?action=seq        → nomor pesanan atomik berikutnya
//   POST ?action=login      → login admin/kasir (session PHP)
//   POST ?action=logout     → keluar session
//   POST ?action=import     → isi database dari data lokal         (auto saat kosong)
//   POST ?action=reset      → kosongkan seluruh data               (admin)
// ============================================================

// Perpanjang umur sesi di sisi server (shared hosting sering memangkas
// session lebih cepat — bikin antrean sinkronisasi admin ditolak 403).
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.gc_maxlifetime', 60 * 60 * 24 * 14);
    session_start([
        'cookie_httponly' => true,
        'cookie_samesite' => 'Lax',
        'cookie_lifetime' => 60 * 60 * 24 * 14, // session admin 14 hari
    ]);
}
require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// ---------- Helper ----------
function jout($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function body() {
    static $b = null;
    if ($b === null) {
        $raw = file_get_contents('php://input');
        $b = json_decode($raw, true);
        if (!is_array($b)) $b = [];
    }
    return $b;
}

function conn() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
    // Buat tabel otomatis (aman dijalankan berulang)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS nk_records (
            id VARCHAR(64) NOT NULL,
            col VARCHAR(32) NOT NULL,
            data MEDIUMTEXT NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY i_col (col),
            KEY i_upd (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS nk_kv (
            k VARCHAR(64) NOT NULL PRIMARY KEY,
            v VARCHAR(255) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    // Baris bawaan: penomoran pesanan & penanda revisi data (dipakai polling)
    $pdo->exec("INSERT IGNORE INTO nk_kv (k, v) VALUES ('seq_order', '200'), ('rev', '0')");
    return $pdo;
}

// Naikkan penanda revisi — dipakai perangkat lain untuk mendeteksi ada
// perubahan data (lebih andal daripada timestamp yang presisinya 1 detik).
function bumpRev($pdo) {
    $pdo->query("UPDATE nk_kv SET v = LAST_INSERT_ID(v + 1) WHERE k = 'rev'");
}

function currentVersion($pdo) {
    $r = $pdo->query("SELECT v FROM nk_kv WHERE k = 'rev'")->fetch();
    $rev = $r ? (string)$r['v'] : '0';
    $m = $pdo->query("SELECT MAX(updated_at) AS m, COUNT(*) AS n FROM nk_records")->fetch();
    return ['version' => 'r' . $rev . '@' . (isset($m['m']) ? $m['m'] : ''), 'n' => (int)$m['n']];
}

// Koleksi data yang dikenal aplikasi
$COLS = ['categories', 'products', 'users', 'customers', 'orders', 'purchases', 'expenses', 'stockMoves', 'emails'];
// Koleksi yang boleh ditulis pengunjung tanpa login (pelanggan memesan kue)
$PUBLIC_WRITE = ['orders', 'customers', 'emails'];

function isAdmin() {
    if (!empty($_SESSION['nk_admin'])) return true;
    $token = isset($_SERVER['HTTP_X_ADMIN_TOKEN']) ? $_SERVER['HTTP_X_ADMIN_TOKEN'] : '';
    if ($token !== '' && ADMIN_TOKEN !== '' && hash_equals(ADMIN_TOKEN, $token)) {
        $_SESSION['nk_admin'] = 1;
        return true;
    }
    return false;
}

// Cari user admin/kasir berdasar email+password di tabel (password disimpan
// aplikasi sebagai teks biasa — mengikuti desain data yang ada)
function verifyAdmin($email, $password) {
    $st = conn()->prepare("SELECT data FROM nk_records WHERE col = 'users'");
    $st->execute();
    foreach ($st->fetchAll() as $r) {
        $u = json_decode($r['data'], true);
        if (!is_array($u)) continue;
        $em  = isset($u['email']) ? strtolower(trim($u['email'])) : '';
        $pw  = isset($u['password']) ? $u['password'] : '';
        $rol = isset($u['role']) ? $u['role'] : '';
        if ($em === strtolower(trim((string)$email)) && $pw !== '' && hash_equals($pw, (string)$password)
            && ($rol === 'admin' || $rol === 'kasir')) {
            return true;
        }
    }
    return false;
}

// Kurangi/tambah stok produk + catat kartu stok (dipakai aksi komposit pesanan)
function applyStockMove($pdo, $it, $type, $note, $ref) {
    $pid = isset($it['productId']) ? $it['productId'] : '';
    if ($pid === '') return;
    $qty = isset($it['qty']) ? (int)$it['qty'] : 0;
    if ($qty <= 0) return;
    $st = $pdo->prepare("SELECT data FROM nk_records WHERE id = ? AND col = 'products'");
    $st->execute([$pid]);
    $r = $st->fetch();
    if (!$r) return;
    $p = json_decode($r['data'], true);
    if (!is_array($p)) return;
    $delta = $type === 'in' ? $qty : -$qty;
    $p['stock'] = max(0, (int)(isset($p['stock']) ? $p['stock'] : 0) + $delta);
    $pdo->prepare("UPDATE nk_records SET data = ? WHERE id = ?")
        ->execute([json_encode($p, JSON_UNESCAPED_UNICODE), $pid]);
    $sm = [
        'productId' => $pid,
        'name'      => isset($p['name']) ? $p['name'] : '',
        'type'      => $type,
        'qty'       => $qty,
        'note'      => $note,
        'ref'       => $ref,
        'createdAt' => date('c'),
    ];
    $smid = 'sm-' . bin2hex(random_bytes(6));
    $pdo->prepare("INSERT IGNORE INTO nk_records (id, col, data) VALUES (?, 'stockMoves', ?)")
        ->execute([$smid, json_encode($sm, JSON_UNESCAPED_UNICODE)]);
}

// ---------- Router ----------
$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    // Cegah akses dengan konfigurasi belum diisi
    if (strpos(DB_NAME, 'GANTI_') === 0 || strpos(DB_USER, 'GANTI_') === 0) {
        jout(['ok' => false, 'error' => 'config', 'message' => 'api/config.php belum diisi. Buka File Manager → api/config.php lalu isi DB_NAME, DB_USER, DB_PASS.'], 500);
    }

    $pdo = conn();

    if ($action === 'bootstrap' || $action === '') {
        $rows = $pdo->query("SELECT id, col, data FROM nk_records ORDER BY updated_at ASC, id ASC")->fetchAll();
        $out = [];
        foreach ($COLS as $c) $out[$c] = [];
        $settings = null;
        $ver = '';
        foreach ($rows as $r) {
            $d = json_decode($r['data'], true);
            if (!is_array($d)) continue;
            $d['id'] = $r['id'];
            if ($r['col'] === '_settings') { $settings = $d; continue; }
            if (isset($out[$r['col']])) $out[$r['col']][] = $d;
        }
        $v = currentVersion($pdo);
        jout([
            'ok' => true,
            'empty' => $v['n'] === 0,
            'version' => $v['version'],
            'settings' => $settings,
            'data' => $out,
        ]);
    }

    if ($action === 'version') {
        $v = currentVersion($pdo);
        jout(['ok' => true, 'version' => $v['version'], 'n' => $v['n']]);
    }

    if ($action === 'upsert') {
        $col = isset($_GET['col']) ? $_GET['col'] : '';
        if (!in_array($col, $COLS, true)) jout(['ok' => false, 'error' => 'Koleksi tidak dikenal'], 400);
        $b = body();
        $id = isset($b['id']) ? (string)$b['id'] : '';
        $data = isset($b['data']) && is_array($b['data']) ? $b['data'] : null;
        if ($id === '' || $data === null) jout(['ok' => false, 'error' => 'id/data wajib'], 400);

        // Aturan akses: publik hanya untuk koleksi pelanggan; "users" publik
        // hanya untuk pendaftaran akun pelanggan BARU (role customer).
        $public = in_array($col, $PUBLIC_WRITE, true);
        if (!$public && $col === 'users') {
            $isCust  = isset($data['role']) && $data['role'] === 'customer';
            $st = $pdo->prepare("SELECT COUNT(*) AS n FROM nk_records WHERE id = ?");
            $st->execute([$id]);
            $baru = (int)$st->fetch()['n'] === 0;
            $public = $isCust && $baru;
        }
        if (!$public && !isAdmin()) jout(['ok' => false, 'error' => 'Wajib login admin/kasir'], 403);

        $st = $pdo->prepare("
            INSERT INTO nk_records (id, col, data) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE col = VALUES(col), data = VALUES(data)
        ");
        $st->execute([$id, $col, json_encode($data, JSON_UNESCAPED_UNICODE)]);
        bumpRev($pdo);
        jout(['ok' => true, 'id' => $id]);
    }

    if ($action === 'delete') {
        $col = isset($_GET['col']) ? $_GET['col'] : '';
        $id  = isset($_GET['id']) ? $_GET['id'] : '';
        if (!in_array($col, $COLS, true) || $id === '') jout(['ok' => false], 400);
        $public = in_array($col, $PUBLIC_WRITE, true);
        if (!$public && !isAdmin()) jout(['ok' => false, 'error' => 'Wajib login admin/kasir'], 403);
        $st = $pdo->prepare("DELETE FROM nk_records WHERE id = ? AND col = ?");
        $st->execute([$id, $col]);
        bumpRev($pdo);
        jout(['ok' => true]);
    }

    if ($action === 'settings') {
        if (!isAdmin()) jout(['ok' => false, 'error' => 'Wajib login admin/kasir'], 403);
        $b = body();
        $data = isset($b['data']) && is_array($b['data']) ? $b['data'] : null;
        if (!$data) jout(['ok' => false, 'error' => 'data wajib'], 400);
        $st = $pdo->prepare("
            INSERT INTO nk_records (id, col, data) VALUES ('__settings__', '_settings', ?)
            ON DUPLICATE KEY UPDATE data = VALUES(data)
        ");
        $st->execute([json_encode($data, JSON_UNESCAPED_UNICODE)]);
        bumpRev($pdo);
        jout(['ok' => true]);
    }

    if ($action === 'seq') {
        // Nomor pesanan atomik: dua perangkat tidak akan mendapat nomor sama.
        // LAST_INSERT_ID(v+1) menyimpan nilai baru pada sesi ini sehingga
        // aman walau dijalankan bersamaan dari perangkat berbeda.
        $pdo->exec("INSERT IGNORE INTO nk_kv (k, v) VALUES ('seq_order', '200')");
        $pdo->exec("UPDATE nk_kv SET v = LAST_INSERT_ID(v + 1) WHERE k = 'seq_order'");
        $next = $pdo->query("SELECT LAST_INSERT_ID() AS v")->fetch();
        jout(['ok' => true, 'next' => (int)$next['v']]);
    }

    if ($action === 'login') {
        $b = body();
        $email = isset($b['email']) ? $b['email'] : '';
        $password = isset($b['password']) ? $b['password'] : '';
        if (!verifyAdmin($email, $password)) jout(['ok' => false, 'error' => 'Email/kata sandi salah atau bukan akun admin/kasir'], 401);
        $_SESSION['nk_admin'] = 1;
        jout(['ok' => true]);
    }

    if ($action === 'logout') {
        unset($_SESSION['nk_admin']);
        jout(['ok' => true]);
    }

    if ($action === 'import') {
        $b = body();
        $data = isset($b['data']) && is_array($b['data']) ? $b['data'] : null;
        $settings = isset($b['settings']) && is_array($b['settings']) ? $b['settings'] : null;
        $seqOrder = isset($b['seqOrder']) ? (int)$b['seqOrder'] : 200;
        if (!$data && !$settings) jout(['ok' => false, 'error' => 'data kosong'], 400);

        // Hanya diizinkan saat database masih kosong (migrasi pertama)
        // atau oleh admin yang sedang login.
        $n = (int)$pdo->query("SELECT COUNT(*) AS n FROM nk_records")->fetch()['n'];
        if ($n > 0 && !isAdmin()) jout(['ok' => false, 'error' => 'Database sudah berisi data'], 403);

        $pdo->beginTransaction();
        try {
            $pdo->exec("DELETE FROM nk_records");
            $ins = $pdo->prepare("INSERT INTO nk_records (id, col, data) VALUES (?, ?, ?)");
            foreach ($COLS as $c) {
                if (!isset($data[$c]) || !is_array($data[$c])) continue;
                foreach ($data[$c] as $item) {
                    if (!is_array($item) || empty($item['id'])) continue;
                    $row = $item;
                    $rid = (string)$row['id'];
                    unset($row['id']);
                    $ins->execute([$rid, $c, json_encode($row, JSON_UNESCAPED_UNICODE)]);
                }
            }
            if ($settings) {
                $pdo->exec("DELETE FROM nk_records WHERE id = '__settings__'");
                $pdo->prepare("INSERT INTO nk_records (id, col, data) VALUES ('__settings__', '_settings', ?)")
                    ->execute([json_encode($settings, JSON_UNESCAPED_UNICODE)]);
            }
            $pdo->exec("INSERT INTO nk_kv (k, v) VALUES ('seq_order', '" . max(200, $seqOrder) . "')
                        ON DUPLICATE KEY UPDATE v = GREATEST(v, VALUES(v))");
            bumpRev($pdo);
            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
        jout(['ok' => true]);
    }

    if ($action === 'order-paid') {
        // Aksi komposit (atomik): tandai lunas + potong stok + kartu stok.
        // Boleh dipanggil pelanggan (mis. konfirmasi bayar Midtrans) maupun admin;
        // idempoten — pesanan yang sudah lunas tidak diproses ulang.
        $b = body();
        $id = isset($b['id']) ? (string)$b['id'] : '';
        $method = isset($b['method']) ? (string)$b['method'] : '';
        if ($id === '') jout(['ok' => false], 400);
        $st = $pdo->prepare("SELECT data FROM nk_records WHERE id = ? AND col = 'orders'");
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) jout(['ok' => false, 'error' => 'Pesanan tidak ditemukan'], 404);
        $o = json_decode($row['data'], true);
        if (!is_array($o)) jout(['ok' => false, 'error' => 'Data pesanan rusak'], 500);
        $pay = isset($o['payment']) && is_array($o['payment']) ? $o['payment'] : [];
        if (isset($pay['status']) && $pay['status'] === 'paid') jout(['ok' => true]); // sudah lunas
        $o['payment'] = [
            'method' => $method !== '' ? $method : (isset($pay['method']) ? $pay['method'] : ''),
            'status' => 'paid',
            'paidAt' => date('c'),
        ];
        if ((isset($o['status']) ? $o['status'] : '') === 'menunggu') $o['status'] = 'diproses';
        if (empty($o['stockApplied']) && !empty($o['items']) && is_array($o['items'])) {
            foreach ($o['items'] as $it) {
                if (is_array($it)) applyStockMove($pdo, $it, 'out', 'Penjualan ' . (isset($o['number']) ? $o['number'] : ''), $id);
            }
            $o['stockApplied'] = true;
        }
        $pdo->prepare("UPDATE nk_records SET data = ? WHERE id = ?")
            ->execute([json_encode($o, JSON_UNESCAPED_UNICODE), $id]);
        bumpRev($pdo);
        jout(['ok' => true]);
    }

    if ($action === 'order-status') {
        // Aksi komposit: ubah status pesanan + penyesuaian stok otomatis.
        // Admin boleh semua transisi; pelanggan hanya membatalkan pesanan
        // yang masih "menunggu".
        $b = body();
        $id = isset($b['id']) ? (string)$b['id'] : '';
        $status = isset($b['status']) ? (string)$b['status'] : '';
        $valid = ['menunggu', 'diproses', 'siap', 'dikirim', 'selesai', 'dibatalkan'];
        if ($id === '' || !in_array($status, $valid, true)) jout(['ok' => false], 400);
        $st = $pdo->prepare("SELECT data FROM nk_records WHERE id = ? AND col = 'orders'");
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) jout(['ok' => false, 'error' => 'Pesanan tidak ditemukan'], 404);
        $o = json_decode($row['data'], true);
        if (!is_array($o)) jout(['ok' => false, 'error' => 'Data pesanan rusak'], 500);
        $cur = isset($o['status']) ? $o['status'] : '';
        if (!isAdmin() && ($status !== 'dibatalkan' || $cur !== 'menunggu')) {
            jout(['ok' => false, 'error' => 'Tidak diizinkan'], 403);
        }
        if ($status === 'dibatalkan' && !empty($o['stockApplied']) && !empty($o['items'])) {
            foreach ($o['items'] as $it) {
                if (is_array($it)) applyStockMove($pdo, $it, 'in', 'Pembatalan ' . (isset($o['number']) ? $o['number'] : ''), $id);
            }
            $o['stockApplied'] = false;
        }
        if ($status === 'diproses' && empty($o['stockApplied']) && !empty($o['items'])) {
            foreach ($o['items'] as $it) {
                if (is_array($it)) applyStockMove($pdo, $it, 'out', 'Penjualan ' . (isset($o['number']) ? $o['number'] : ''), $id);
            }
            $o['stockApplied'] = true;
        }
        $o['status'] = $status;
        $pdo->prepare("UPDATE nk_records SET data = ? WHERE id = ?")
            ->execute([json_encode($o, JSON_UNESCAPED_UNICODE), $id]);
        bumpRev($pdo);
        jout(['ok' => true]);
    }

    if ($action === 'reset') {
        if (!isAdmin()) {
            $b = body();
            $creds = isset($b['creds']) ? $b['creds'] : [];
            $email = isset($creds['email']) ? $creds['email'] : '';
            $password = isset($creds['password']) ? $creds['password'] : '';
            if (!verifyAdmin($email, $password)) jout(['ok' => false, 'error' => 'Konfirmasi kata sandi admin salah'], 403);
        }
        $pdo->exec("DELETE FROM nk_records");
        bumpRev($pdo);
        jout(['ok' => true]);
    }

    jout(['ok' => false, 'error' => 'action tidak dikenal'], 404);
} catch (PDOException $e) {
    $msg = 'Database gagal diakses. Pastikan DB_NAME/DB_USER/DB_PASS di api/config.php benar dan user sudah di-assign ke database.';
    jout(['ok' => false, 'error' => 'db', 'message' => $msg, 'detail' => $e->getMessage()], 500);
}
