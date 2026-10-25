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

// ---------- Pengirim SMTP asli (tanpa dependensi) ----------
// Terhubung langsung ke server SMTP dari pengaturan tersimpan di database
// (host/port/enkripsi/username/password) lalu mengirim email HTML.
// Mendukung SSL (465) dan STARTTLS (587). Error disimpan di $SMTP_ERR
// agar bisa dikembalikan ke browser untuk ditampilkan di dashboard admin.
$SMTP_ERR = '';
function smtpSend($smtp, $to, $subject, $html) {
    global $SMTP_ERR;
    $host = isset($smtp['host']) ? $smtp['host'] : '';
    $port = isset($smtp['port']) ? (int)$smtp['port'] : 587;
    $enc  = isset($smtp['encryption']) ? $smtp['encryption'] : 'tls';
    // Auto-koreksi kombinasi umum yang tertukar: 465 = SSL, 587 = STARTTLS
    if ($port === 465 && $enc !== 'ssl') $enc = 'ssl';
    if ($port === 587 && $enc === 'ssl') $enc = 'tls';
    $user = isset($smtp['username']) ? $smtp['username'] : '';
    $pass = isset($smtp['password']) ? $smtp['password'] : '';
    $from = !empty($smtp['fromEmail']) ? $smtp['fromEmail'] : $user;
    $fromName = !empty($smtp['fromName']) ? $smtp['fromName'] : 'Nandin Kitchen';
    $myhost = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
    if ($host === '' || $port <= 0) { $SMTP_ERR = 'Host/port SMTP belum diisi'; return false; }

    $errno = 0; $errstr = '';
    $remote = ($enc === 'ssl' ? 'ssl://' : '') . $host;
    $fp = @stream_socket_client("$remote:$port", $errno, $errstr, 15);
    if (!$fp) { $SMTP_ERR = "Koneksi ke $host:$port gagal ($errstr)"; return false; }
    stream_set_timeout($fp, 15);

    $read = function () use ($fp) {
        $data = '';
        while (($line = fgets($fp, 515)) !== false) {
            $data .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        return $data;
    };
    $cmd = function ($c) use ($fp, $read) {
        fwrite($fp, $c . "\r\n");
        return $read();
    };
    $fail = function ($msg) use ($fp, &$SMTP_ERR) {
        $SMTP_ERR = $msg;
        @fclose($fp);
        return false;
    };

    $banner = $read();
    if (substr($banner, 0, 3) !== '220') return $fail('SMTP menolak koneksi: ' . trim($banner));
    $cmd('EHLO ' . $myhost);
    if ($enc === 'tls') {
        $t = $cmd('STARTTLS');
        if (substr($t, 0, 3) !== '220') return $fail('STARTTLS ditolak: ' . trim($t));
        if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT))
            return $fail('Negosiasi TLS gagal — coba ganti enkripsi ke SSL/port 465');
        $cmd('EHLO ' . $myhost);
    }
    if ($user !== '') {
        $cmd('AUTH LOGIN');
        $cmd(base64_encode($user));
        $auth = $cmd(base64_encode($pass));
        if (substr($auth, 0, 3) !== '235')
            return $fail('Autentikasi SMTP ditolak (cek username / app password): ' . trim($auth));
    }
    $mf = $cmd("MAIL FROM:<$from>");
    if (substr($mf, 0, 3) !== '250') return $fail('Alamat pengirim ditolak: ' . trim($mf));
    $rc = $cmd("RCPT TO:<$to>");
    if (substr($rc, 0, 3) !== '250' && substr($rc, 0, 3) !== '251') return $fail('Penerima ditolak: ' . trim($rc));
    $cmd('DATA');
    $headers = 'From: =?UTF-8?B?' . base64_encode($fromName) . "?= <$from>\r\n"
        . "To: <$to>\r\n"
        . 'Subject: =?UTF-8?B?' . base64_encode($subject) . "?=\r\n"
        . "MIME-Version: 1.0\r\n"
        . "Content-Type: text/html; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n\r\n";
    $res = $cmd($headers . chunk_split(base64_encode($html)) . "\r\n.");
    $ok = substr($res, 0, 3) === '250';
    if (!$ok) $SMTP_ERR = 'SMTP menolak isi pesan: ' . trim($res);
    $cmd('QUIT');
    fclose($fp);
    return $ok;
}

// ---------- Midtrans (Snap) ----------
// Baca konfigurasi Midtrans dari pengaturan database.
function mtSettings($pdo) {
    $st = $pdo->prepare("SELECT data FROM nk_records WHERE id = '__settings__'");
    $st->execute();
    $row = $st->fetch();
    $s = $row ? json_decode($row['data'], true) : [];
    return is_array($s) && isset($s['midtrans']) && is_array($s['midtrans']) ? $s['midtrans'] : [];
}

function mtBase($mt) {
    return (!empty($mt['env']) && $mt['env'] === 'production') ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
}

function mtSnapBase($mt) {
    return (!empty($mt['env']) && $mt['env'] === 'production') ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
}

// Panggil API Midtrans (server-to-server, memakai Server Key)
function mtCall($url, $serverKey, $payload = null) {
    if (!function_exists('curl_init')) return [0, ['error' => 'PHP cURL tidak tersedia di hosting']];
    $ch = curl_init($url);
    $hdr = ['Accept: application/json', 'Content-Type: application/json', 'Authorization: Basic ' . base64_encode($serverKey . ':')];
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $hdr,
        CURLOPT_TIMEOUT        => 20,
    ]);
    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    }
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    $json = json_decode($body === false ? '' : $body, true);
    if ($body === false) return [0, ['error' => $err !== '' ? $err : 'gagal menghubungi Midtrans']];
    return [$code, is_array($json) ? $json : []];
}

// Tandai pesanan lunas + potong stok (dipakai order-paid, verifikasi & webhook Midtrans)
function applyPaid($pdo, $id, $method) {
    $st = $pdo->prepare("SELECT data FROM nk_records WHERE id = ? AND col = 'orders'");
    $st->execute([$id]);
    $row = $st->fetch();
    if (!$row) return ['ok' => false, 'error' => 'Pesanan tidak ditemukan', 'code' => 404];
    $o = json_decode($row['data'], true);
    if (!is_array($o)) return ['ok' => false, 'error' => 'Data pesanan rusak', 'code' => 500];
    $pay = isset($o['payment']) && is_array($o['payment']) ? $o['payment'] : [];
    if (isset($pay['status']) && $pay['status'] === 'paid') return ['ok' => true, 'sudah' => true];
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
    return ['ok' => true];
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

    if ($action === 'midtrans-test') {
        // Cek apakah Server Key valid: tanyakan status order dummy ke Midtrans.
        // HTTP 401/403 → key salah; 404 dengan JSON → key benar (terhubung).
        if (!isAdmin()) jout(['ok' => false, 'error' => 'Wajib login admin/kasir'], 403);
        $mt = mtSettings($pdo);
        if (empty($mt['serverKey'])) jout(['ok' => false, 'error' => 'Server Key masih kosong'], 400);
        $env = (!empty($mt['env']) && $mt['env'] === 'production') ? 'PRODUCTION' : 'SANDBOX';
        list($code, $json) = mtCall(mtBase($mt) . '/v2/nandin-test-koneksi/status', $mt['serverKey']);
        if ($code === 401 || $code === 403)
            jout(['ok' => false, 'error' => 'Server Key DITOLAK Midtrans (401) — periksa key & environment (' . $env . ')']);
        if ($code === 0)
            jout(['ok' => false, 'error' => 'Tidak bisa menghubungi Midtrans: ' . (isset($json['error']) ? $json['error'] : 'hosting memblokir koneksi keluar')]);
        jout(['ok' => true, 'message' => 'Terhubung ke Midtrans (' . $env . ') — Server Key valid ✅', 'http' => $code, 'env' => $env]);
    }

    if ($action === 'snap-token') {
        // Buat token Snap untuk pesanan (nominal dibaca dari database, bukan browser)
        $mt = mtSettings($pdo);
        if (empty($mt['enabled'])) jout(['ok' => false, 'error' => 'Midtrans nonaktif'], 400);
        if (empty($mt['serverKey'])) jout(['ok' => false, 'error' => 'Server Key kosong'], 400);
        $b = body();
        $id = isset($b['orderId']) ? (string)$b['orderId'] : '';
        $st = $pdo->prepare("SELECT data FROM nk_records WHERE id = ? AND col = 'orders'");
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) jout(['ok' => false, 'error' => 'Pesanan tidak ditemukan'], 404);
        $o = json_decode($row['data'], true);
        if (!is_array($o)) jout(['ok' => false, 'error' => 'Data pesanan rusak'], 500);
        $pay = isset($o['payment']) && is_array($o['payment']) ? $o['payment'] : [];
        if (isset($pay['status']) && $pay['status'] === 'paid') jout(['ok' => false, 'error' => 'Pesanan sudah lunas'], 400);
        $items = [];
        foreach ((isset($o['items']) && is_array($o['items']) ? $o['items'] : []) as $it) {
            $items[] = [
                'id'       => isset($it['productId']) ? $it['productId'] : 'item',
                'price'    => (int)(isset($it['price']) ? $it['price'] : 0),
                'quantity' => (int)(isset($it['qty']) ? $it['qty'] : 1),
                'name'     => mb_substr(isset($it['name']) ? $it['name'] : 'Item', 0, 50),
            ];
        }
        $gross = (int)(isset($o['total']) ? $o['total'] : 0);
        // Midtrans butuh item_details + ongkir/pajak = gross → selipkan biaya lain
        $itemsSum = 0;
        foreach ($items as $it) $itemsSum += $it['price'] * $it['quantity'];
        if ($itemsSum > 0 && $itemsSum < $gross)
            $items[] = ['id' => 'biaya-lain', 'price' => $gross - $itemsSum, 'quantity' => 1, 'name' => 'Ongkir/Pajak'];
        $payload = [
            'transaction_details' => ['order_id' => $id, 'gross_amount' => $gross],
            'item_details'        => $items,
            'customer_details'    => [
                'first_name' => isset($o['customerName']) ? $o['customerName'] : '',
                'email'      => isset($o['customerEmail']) ? $o['customerEmail'] : '',
                'phone'      => isset($o['customerPhone']) ? $o['customerPhone'] : '',
            ],
        ];
        list($code, $json) = mtCall(mtSnapBase($mt) . '/snap/v1/transactions', $mt['serverKey'], $payload);
        if ($code === 201 && !empty($json['token']))
            jout(['ok' => true, 'token' => $json['token'], 'redirectUrl' => isset($json['redirect_url']) ? $json['redirect_url'] : '']);
        jout(['ok' => false, 'error' => isset($json['error_messages'][0]) ? $json['error_messages'][0] : ('Midtrans menolak (HTTP ' . $code . ')')], 502);
    }

    if ($action === 'midtrans-verify') {
        // Cek status pembayaran langsung ke Midtrans & tandai lunas bila settled
        $mt = mtSettings($pdo);
        if (empty($mt['serverKey'])) jout(['ok' => false, 'error' => 'Server Key kosong'], 400);
        $b = body();
        $id = isset($b['orderId']) ? (string)$b['orderId'] : '';
        list($code, $json) = mtCall(mtBase($mt) . '/v2/' . rawurlencode($id) . '/status', $mt['serverKey']);
        if ($code !== 200) jout(['ok' => false, 'error' => 'Status tidak ditemukan di Midtrans (HTTP ' . $code . ')'], 404);
        $ts = isset($json['transaction_status']) ? $json['transaction_status'] : '';
        if ($ts === 'capture' || $ts === 'settlement') {
            $r = applyPaid($pdo, $id, 'midtrans');
            jout(['ok' => true, 'paid' => true, 'status' => $ts]);
        }
        jout(['ok' => true, 'paid' => false, 'status' => $ts]);
    }

    if ($action === 'midtrans-notification') {
        // Webhook Payment Notification dari Midtrans (opsional — verifikasi tanda tangan)
        $mt = mtSettings($pdo);
        $b = body();
        $oid = isset($b['order_id']) ? (string)$b['order_id'] : '';
        $scode = isset($b['status_code']) ? (string)$b['status_code'] : '';
        $gross = isset($b['gross_amount']) ? (string)$b['gross_amount'] : '';
        $sig = isset($b['signature_key']) ? (string)$b['signature_key'] : '';
        $expect = hash('sha512', $oid . $scode . $gross . (isset($mt['serverKey']) ? $mt['serverKey'] : ''));
        if ($oid === '' || $sig === '' || !hash_equals($expect, $sig))
            jout(['ok' => false, 'error' => 'Signature tidak valid'], 403);
        $ts = isset($b['transaction_status']) ? $b['transaction_status'] : '';
        if ($ts === 'capture' || $ts === 'settlement') applyPaid($pdo, $oid, 'midtrans');
        jout(['ok' => true]);
    }

    if ($action === 'email') {
        // Kirim email HTML via SMTP dari pengaturan database. Boleh dipanggil
        // publik karena notifikasi registrasi/pesanan terjadi tanpa sesi admin;
        // parameter divalidasi ketat untuk mencegah penyalahgunaan.
        $b = body();
        $to = isset($b['to']) ? filter_var(trim((string)$b['to']), FILTER_VALIDATE_EMAIL) : false;
        $subject = mb_substr(trim(isset($b['subject']) ? (string)$b['subject'] : ''), 0, 200);
        $html = isset($b['html']) ? (string)$b['html'] : '';
        if (!$to || $subject === '' || $html === '' || strlen($html) > 300000)
            jout(['ok' => false, 'error' => 'Parameter email tidak valid'], 400);
        $st = $pdo->prepare("SELECT data FROM nk_records WHERE id = '__settings__'");
        $st->execute();
        $row = $st->fetch();
        $settings = $row ? json_decode($row['data'], true) : [];
        $smtp = is_array($settings) && isset($settings['smtp']) && is_array($settings['smtp']) ? $settings['smtp'] : [];
        if (empty($smtp['enabled'])) jout(['ok' => false, 'error' => 'SMTP belum diaktifkan di Pengaturan'], 400);
        if (smtpSend($smtp, $to, $subject, $html)) jout(['ok' => true]);
        jout(['ok' => false, 'error' => $SMTP_ERR !== '' ? $SMTP_ERR : 'Pengiriman email gagal'], 500);
    }

    if ($action === 'forgot-password') {
        // Minta tautan pemulihan. Selalu jawab ok agar tidak membocorkan
        // keberadaan email. Jika terdaftar → kirim email berisi tautan
        // token berlaku 1 jam (disimpan di nk_kv).
        $b = body();
        $email = isset($b['email']) ? strtolower(trim((string)$b['email'])) : '';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jout(['ok' => false, 'error' => 'Email tidak valid'], 400);
        $st = $pdo->prepare("SELECT id, data FROM nk_records WHERE col = 'users'");
        $st->execute();
        $uid = null;
        foreach ($st->fetchAll() as $r) {
            $u = json_decode($r['data'], true);
            if (is_array($u) && isset($u['email']) && strtolower(trim((string)$u['email'])) === $email) {
                $uid = $r['id'];
                $uname = isset($u['name']) ? $u['name'] : 'Pengguna';
                break;
            }
        }
        if ($uid !== null) {
            $token = bin2hex(random_bytes(16));
            $exp = time() + 3600;
            $pdo->prepare('INSERT INTO nk_kv (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)')
                ->execute(['pwr_' . $token, $uid . '|' . $exp]);
            $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $link = $scheme . '://' . $_SERVER['HTTP_HOST'] . '/reset-sandi?token=' . $token . '&email=' . urlencode($email);
            $st2 = $pdo->prepare("SELECT data FROM nk_records WHERE id = '__settings__'");
            $st2->execute();
            $srow = $st2->fetch();
            $settings = $srow ? json_decode($srow['data'], true) : [];
            $smtp = is_array($settings) && isset($settings['smtp']) ? $settings['smtp'] : [];
            $storeName = is_array($settings) && !empty($settings['storeName']) ? $settings['storeName'] : 'Nandin Kitchen';
            if (!empty($smtp['enabled'])) {
                $html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f7f1e8;font-family:Arial,Helvetica,sans-serif;">'
                    . '<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">'
                    . '<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;">'
                    . '<tr><td align="center" style="background:#3B2A1E;padding:22px;"><img src="' . $scheme . '://' . $_SERVER['HTTP_HOST'] . '/logo-nandin.png" alt="' . $storeName . '" style="height:52px;border-radius:10px;"></td></tr>'
                    . '<tr><td style="padding:28px 30px;">'
                    . '<h1 style="margin:0 0 12px;font-size:20px;color:#3B2A1E;">Atur ulang kata sandi</h1>'
                    . '<p style="font-size:14.5px;line-height:1.7;color:#5b4636;">Hai <b>' . htmlspecialchars($uname) . '</b>, kami menerima permintaan atur ulang kata sandi untuk akun <b>' . htmlspecialchars($email) . '</b>.</p>'
                    . '<p style="text-align:center;margin:26px 0;"><a href="' . $link . '" style="background:#c07b2e;color:#fff;text-decoration:none;padding:13px 30px;border-radius:999px;font-weight:bold;font-size:15px;display:inline-block;">🔑 Atur Ulang Kata Sandi</a></p>'
                    . '<p style="font-size:12.5px;color:#9b7e63;">Tautan berlaku 1 jam dan hanya bisa dipakai sekali. Abaikan email ini jika kamu tidak meminta pemulihan.</p>'
                    . '</td></tr>'
                    . '<tr><td align="center" style="background:#FBF5EE;padding:12px;font-size:11.5px;color:#b39b84;">Email otomatis dari ' . $storeName . ' — mohon jangan dibalas.</td></tr>'
                    . '</table></td></tr></table></body></html>';
                smtpSend($smtp, $email, 'Atur ulang kata sandi ' . $storeName . ' 🔑', $html);
            }
        }
        jout(['ok' => true]);
    }

    if ($action === 'reset-password') {
        $b = body();
        $token = isset($b['token']) ? preg_replace('/[^a-f0-9]/', '', (string)$b['token']) : '';
        $password = isset($b['password']) ? (string)$b['password'] : '';
        if ($token === '' || strlen($password) < 6) jout(['ok' => false, 'error' => 'Token tidak valid / kata sandi minimal 6 karakter'], 400);
        $st = $pdo->prepare('SELECT v FROM nk_kv WHERE k = ?');
        $st->execute(['pwr_' . $token]);
        $row = $st->fetch();
        if (!$row) jout(['ok' => false, 'error' => 'Tautan pemulihan tidak ditemukan atau sudah dipakai'], 400);
        list($uid, $exp) = array_pad(explode('|', $row['v'], 2), 2, '0');
        if ((int)$exp < time()) {
            $pdo->prepare('DELETE FROM nk_kv WHERE k = ?')->execute(['pwr_' . $token]);
            jout(['ok' => false, 'error' => 'Tautan pemulihan sudah kedaluwarsa — minta yang baru'], 400);
        }
        $st = $pdo->prepare("SELECT data FROM nk_records WHERE id = ? AND col = 'users'");
        $st->execute([$uid]);
        $urow = $st->fetch();
        if (!$urow) jout(['ok' => false, 'error' => 'Akun tidak ditemukan'], 404);
        $u = json_decode($urow['data'], true);
        if (!is_array($u)) jout(['ok' => false, 'error' => 'Data akun rusak'], 500);
        $u['password'] = $password;
        $pdo->prepare('UPDATE nk_records SET data = ? WHERE id = ?')
            ->execute([json_encode($u, JSON_UNESCAPED_UNICODE), $uid]);
        $pdo->prepare('DELETE FROM nk_kv WHERE k = ?')->execute(['pwr_' . $token]);
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
