<?php
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/resources.php';
require __DIR__ . '/lib/crud.php';
require __DIR__ . '/lib/booking.php';
require __DIR__ . '/lib/reports.php';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

try {
    date_default_timezone_set(config('timezone') ?? 'Asia/Bangkok');
    if (config('debug')) { ini_set('display_errors', '1'); error_reporting(E_ALL); } else { ini_set('display_errors', '0'); }
    start_session();

    $method = $_SERVER['REQUEST_METHOD'];
    $path = $_SERVER['PATH_INFO'] ?? ($_GET['_r'] ?? '');
    $seg = array_values(array_filter(explode('/', trim($path, '/')), 'strlen'));
    $a = $seg[0] ?? '';

    if ($a === 'session' && $method === 'GET') json_out(session_info());
    if ($a === 'file' && $method === 'GET') serve_file($seg[1] ?? '', $seg[2] ?? '');

    check_csrf();
    if ($a === 'login' && $method === 'POST') json_out(login(body()));
    if ($a === 'logout' && $method === 'POST') { $_SESSION = []; session_destroy(); json_out(['ok' => true]); }

    require_login();
    switch ($a) {
        case 'meta':
            json_out(meta());
        case 'lookup':
            json_out(lookup_list($seg[1] ?? ''));
        case 'dashboard':
            json_out(dashboard());
        case 'counts':
            json_out(booking_counts());
        case 'calendar':
            json_out(calendar_events());
        case 'profile':
            if ($method === 'PUT') json_out(update_profile(body()));
            break;
        case 'availability':
            json_out(booking_availability());
        case 'booking':
            $id = isset($seg[1]) ? (int)$seg[1] : null;
            if ($id === null) {
                if ($method === 'GET') json_out(booking_list());
                if ($method === 'POST') json_out(booking_create(body()), 201);
            } elseif (isset($seg[2])) {
                if ($method === 'POST') json_out(booking_action($id, $seg[2], body()));
            } else {
                if ($method === 'GET') json_out(booking_load($id));
                if ($method === 'PUT') json_out(booking_update($id, body()));
                if ($method === 'DELETE') json_out(booking_delete($id));
            }
            break;
        case 'report':
            if (($seg[1] ?? '') === '') json_out(report_defs());
            if (($seg[2] ?? '') === 'csv') report_csv($seg[1]);
            json_out(report_run($seg[1]));
        case 'carfile':
            if ($method === 'POST') json_out(carfile_upload((int)($seg[1] ?? 0)), 201);
            if ($method === 'DELETE') json_out(carfile_delete((int)($seg[1] ?? 0)));
            break;
        case 'r':
            $res = resource($seg[1] ?? '');
            $id = isset($seg[2]) ? (int)$seg[2] : null;
            if ($id === null) {
                if ($method === 'GET') json_out(crud_list($res));
                if ($method === 'POST') json_out(crud_save($res, null, body()), 201);
            } elseif (($seg[3] ?? '') === 'image') {
                if ($method === 'POST') json_out(crud_image($res, $id, $seg[4] ?? ''));
            } else {
                if ($method === 'GET') json_out(crud_get($res, $id));
                if ($method === 'PUT') json_out(crud_save($res, $id, body()));
                if ($method === 'DELETE') json_out(crud_delete($res, $id));
            }
            break;
    }
    throw new HttpError(404, 'ไม่พบ API: ' . $method . ' /' . implode('/', $seg));
} catch (HttpError $e) {
    json_out(array_filter(['error' => $e->getMessage(), 'field' => $e->field]), $e->status);
} catch (PDOException $e) {
    error_log('[gbcars] ' . $e);
    // name the setup problem (never the credentials) so a fresh deploy is easy to diagnose
    // query errors carry the MySQL code in errorInfo; connection errors only in the text: "SQLSTATE[HY000] [1045] ..."
    $code = (int)($e->errorInfo[1] ?? 0);
    if (!$code && preg_match('/\[(\d{4})\]/', $e->getMessage(), $m)) $code = (int)$m[1];
    $msg = match (true) {
        $code === 1045 => 'เชื่อมต่อฐานข้อมูลไม่ได้: ชื่อผู้ใช้หรือรหัสผ่านใน config/config.php ไม่ถูกต้อง',
        $code === 1044, $code === 1049 => 'เชื่อมต่อฐานข้อมูลไม่ได้: ไม่พบฐานข้อมูลที่ตั้งไว้ใน config/config.php หรือผู้ใช้ไม่มีสิทธิ์',
        $code === 2002, $code === 2005, $code === 2006 => 'เชื่อมต่อฐานข้อมูลไม่ได้: ตรวจค่า host/port ใน config/config.php',
        $code === 1146 => 'ฐานข้อมูลยังไม่มีตาราง: กรุณานำเข้าไฟล์ SQL ผ่าน phpMyAdmin',
        $code === 1054 => 'โครงสร้างฐานข้อมูลไม่ตรงกับเวอร์ชันโปรแกรม: กรุณานำเข้าไฟล์ SQL ล่าสุด',
        default => config('debug') ? $e->getMessage() : 'เกิดข้อผิดพลาดของฐานข้อมูล (ดูรายละเอียดใน error log)',
    };
    json_out(['error' => $msg], 500);
} catch (Throwable $e) {
    error_log('[gbcars] ' . $e);
    json_out(['error' => config('debug') ? $e->getMessage() : 'เกิดข้อผิดพลาดในระบบ'], 500);
}

/* -------------------------------------------------------------------------- */

function company(): array
{
    return row('SELECT name, webheader, address, tel FROM tb_company ORDER BY id LIMIT 1') ?? ['name' => 'GB CarSys', 'webheader' => 'GB CarSys'];
}

function session_info(): array
{
    $u = current_user();
    $out = ['csrf' => $_SESSION['csrf'], 'user' => null, 'company' => company()];
    if ($u) {
        $out['user'] = $u + ['approver' => is_admin() || (bool)approver_departs((int)$u['id'])];
    }
    return $out;
}

function login(array $in): array
{
    $username = trim((string)($in['username'] ?? ''));
    $password = (string)($in['password'] ?? '');
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    q('DELETE FROM tb_login_attempt WHERE created_at < ?', [date('Y-m-d H:i:s', time() - 3600)]);
    $fails = (int)val('SELECT COUNT(*) FROM tb_login_attempt WHERE ip = ? AND created_at > ?', [$ip, date('Y-m-d H:i:s', time() - 900)]);
    if ($fails >= 10) throw new HttpError(429, 'เข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 15 นาที');
    if ($username === '' || $password === '') throw new HttpError(422, 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');

    $user = row('SELECT * FROM tb_user WHERE LOWER(username) = LOWER(?) LIMIT 1', [$username]);
    if (!$user || !verify_password($password, $user['password'])) {
        q('INSERT INTO tb_login_attempt (ip, username, created_at) VALUES (?, ?, ?)', [$ip, mb_substr($username, 0, 50), now()]);
        throw new HttpError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
    if ((int)$user['status'] !== 0) throw new HttpError(403, 'บัญชีนี้ถูกระงับการใช้งาน');

    // Upgrade legacy md5 hash to bcrypt transparently.
    if (!str_starts_with((string)$user['password'], '$') || password_needs_rehash($user['password'], PASSWORD_DEFAULT)) {
        q('UPDATE tb_user SET password = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $user['id']]);
    }
    q('UPDATE tb_user SET date_last_login = ?, time_last_login = ? WHERE id = ?', [date('Y-m-d'), date('H:i:s'), $user['id']]);
    q('DELETE FROM tb_login_attempt WHERE ip = ?', [$ip]);

    session_regenerate_id(true);
    $_SESSION['user'] = user_session($user);
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return session_info();
}

function user_session(array $user): array
{
    return [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'member_type' => (int)$user['member_type'],
        'code' => $user['code'],
        'title' => $user['title'],
        'firstname' => $user['firstname'],
        'surname' => $user['surname'],
        'nickname' => $user['nickname'],
        'depart_id' => $user['depart_id'] !== null ? (int)$user['depart_id'] : null,
        'position_name' => $user['position_name'],
        'tel' => $user['tel'],
        'email' => $user['email'],
        'picture1' => $user['picture1'],
    ];
}

function update_profile(array $in): array
{
    $u = require_login();
    $user = row('SELECT * FROM tb_user WHERE id = ?', [$u['id']]);
    if (!$user) throw new HttpError(404, 'ไม่พบผู้ใช้');
    $set = [];
    foreach (['nickname', 'tel', 'email', 'position_name'] as $k) {
        if (array_key_exists($k, $in)) $set[$k] = trim((string)$in[$k]);
    }
    if (!empty($in['new_password'])) {
        if (!verify_password((string)($in['current_password'] ?? ''), $user['password'])) throw new HttpError(422, 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
        if (mb_strlen((string)$in['new_password']) < 6) throw new HttpError(422, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
        $set['password'] = password_hash((string)$in['new_password'], PASSWORD_DEFAULT);
    }
    if ($set) {
        q('UPDATE tb_user SET ' . implode(', ', array_map(fn($k) => "`$k` = ?", array_keys($set))) . ' WHERE id = ?', [...array_values($set), $u['id']]);
    }
    $_SESSION['user'] = user_session(row('SELECT * FROM tb_user WHERE id = ?', [$u['id']]));
    return session_info();
}

function meta(): array
{
    $out = [];
    foreach (resources() as $name => $r) {
        $out[$name] = [
            'title' => $r['title'], 'icon' => $r['icon'], 'group' => $r['group'], 'fields' => $r['fields'],
            'children' => $r['children']['fields'] ?? null, 'childrenTitle' => $r['children']['title'] ?? null,
            'images' => $r['images'] ?? [], 'uploadType' => $r['uploadType'] ?? null,
            'docno' => !empty($r['docno']), 'noCreate' => !empty($r['noCreate']),
            'canRead' => can_read($r), 'canWrite' => can_write($r), 'searchable' => !empty($r['search']),
        ];
    }
    $reports = report_defs();
    foreach ($reports as &$r) {
        if (isset($r['groups'])) $r['groups'] = array_map(fn($g) => ['label' => $g['label']], $r['groups']);
    }
    return ['resources' => $out, 'carStatus' => CAR_STATUS, 'bookingStatus' => BOOKING_STATUS, 'reports' => $reports];
}

function serve_file(string $type, string $name): never
{
    if (!current_user()) throw new HttpError(401, 'กรุณาเข้าสู่ระบบ');
    $name = basename($name);
    if ($name === '' || !preg_match('/^[\w\-. ()]+$/u', $name)) throw new HttpError(400, 'ชื่อไฟล์ไม่ถูกต้อง');
    $file = upload_dir($type) . DIRECTORY_SEPARATOR . $name;
    if (!is_file($file)) throw new HttpError(404, 'ไม่พบไฟล์');
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $mime = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif', 'webp' => 'image/webp', 'pdf' => 'application/pdf',
        'doc' => 'application/msword', 'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls' => 'application/vnd.ms-excel', 'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'][$ext] ?? 'application/octet-stream';
    $etag = '"' . md5($file . filemtime($file) . filesize($file)) . '"';
    header('ETag: ' . $etag);
    header('Cache-Control: private, max-age=86400');
    if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) { http_response_code(304); exit; }
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($file));
    $dl = !str_starts_with($mime, 'image/') && $mime !== 'application/pdf';
    $orig = $_GET['name'] ?? $name;
    header('Content-Disposition: ' . ($dl ? 'attachment' : 'inline') . "; filename*=UTF-8''" . rawurlencode(basename((string)$orig)));
    readfile($file);
    exit;
}

function carfile_upload(int $carId): array
{
    require_admin();
    if (!row('SELECT id FROM tb_car WHERE id = ?', [$carId])) throw new HttpError(404, 'ไม่พบรถ');
    if (empty($_FILES['file'])) throw new HttpError(400, 'ไม่พบไฟล์');
    $name = save_upload($_FILES['file'], 'car', $carId . '_' . date('YmdHis'), ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'doc', 'docx', 'xls', 'xlsx']);
    q('INSERT INTO tb_carfile (car_id, oldfilename, filename, path, comment) VALUES (?, ?, ?, ?, ?)',
        [$carId, mb_substr(basename($_FILES['file']['name']), 0, 255), $name, 'fileupload/car/', mb_substr(trim((string)($_POST['comment'] ?? '')), 0, 255)]);
    return ['id' => (int)db()->lastInsertId(), 'filename' => $name];
}

function carfile_delete(int $id): array
{
    require_admin();
    $f = row('SELECT * FROM tb_carfile WHERE id = ?', [$id]);
    if (!$f) throw new HttpError(404, 'ไม่พบไฟล์');
    $path = upload_dir('car') . DIRECTORY_SEPARATOR . basename((string)$f['filename']);
    if (is_file($path)) @unlink($path);
    q('DELETE FROM tb_carfile WHERE id = ?', [$id]);
    return ['ok' => true];
}
