<?php
declare(strict_types=1);

final class HttpError extends Exception
{
    public function __construct(public int $status, string $message)
    {
        parent::__construct($message);
    }
}

function config(?string $key = null)
{
    static $cfg = null;
    if ($cfg === null) {
        $file = __DIR__ . '/../../config/config.php';
        if (!is_file($file)) {
            throw new HttpError(500, 'ยังไม่ได้ตั้งค่าระบบ: คัดลอก config/config.sample.php เป็น config/config.php');
        }
        $cfg = require $file;
    }
    if ($key === null) return $cfg;
    $v = $cfg;
    foreach (explode('.', $key) as $k) {
        if (!is_array($v) || !array_key_exists($k, $v)) return null;
        $v = $v[$k];
    }
    return $v;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = config('db');
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $c['host'], $c['port'] ?? 3306, $c['name'], $c['charset'] ?? 'utf8mb4');
        $pdo = new PDO($dsn, $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
        $pdo->exec("SET time_zone = '+07:00'");
    }
    return $pdo;
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function rows(string $sql, array $params = []): array { return q($sql, $params)->fetchAll(); }
function row(string $sql, array $params = []): ?array { $r = q($sql, $params)->fetch(); return $r === false ? null : $r; }
function val(string $sql, array $params = []) { $r = q($sql, $params)->fetchColumn(); return $r === false ? null : $r; }

function json_out($data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function body(): array
{
    static $b = null;
    if ($b === null) {
        $ct = $_SERVER['CONTENT_TYPE'] ?? '';
        if (str_contains($ct, 'application/json')) {
            $b = json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];
        } else {
            $b = $_POST;
        }
    }
    return $b;
}

function now(): string { return date('Y-m-d H:i:s'); }

/* ---------- session & auth ---------- */

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_name('GBCARS');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
}

function current_user(): ?array
{
    return $_SESSION['user'] ?? null;
}

function require_login(): array
{
    $u = current_user();
    if (!$u) throw new HttpError(401, 'กรุณาเข้าสู่ระบบ');
    return $u;
}

function is_admin(): bool { return (int)(current_user()['member_type'] ?? 0) === 1; }

function require_admin(): array
{
    $u = require_login();
    if (!is_admin()) throw new HttpError(403, 'เฉพาะผู้ดูแลระบบ');
    return $u;
}

/** Departments this user approves bookings for. */
function approver_departs(int $userId): array
{
    return array_map('intval', array_column(rows('SELECT depart_id FROM tb_userdepart WHERE user_id = ?', [$userId]), 'depart_id'));
}

function check_csrf(): void
{
    $m = $_SERVER['REQUEST_METHOD'];
    if (in_array($m, ['GET', 'HEAD', 'OPTIONS'], true)) return;
    $t = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!hash_equals($_SESSION['csrf'] ?? '', $t)) throw new HttpError(419, 'เซสชันหมดอายุ กรุณาโหลดหน้าใหม่');
}

function legacy_hash(string $pw): string
{
    return md5((config('legacy_salt') ?? 'carsys12348') . $pw);
}

function verify_password(string $pw, ?string $stored): bool
{
    if (!$stored) return false;
    if (str_starts_with($stored, '$2y$') || str_starts_with($stored, '$argon')) return password_verify($pw, $stored);
    return hash_equals(strtolower($stored), legacy_hash($pw));
}

/* ---------- document numbers ---------- */

/** Next running number e.g. REV69110001 (prefix + Thai year(2) + month + running). */
function next_docno(string $table): ?string
{
    $p = row('SELECT prefix, numlimit FROM tb_docprefix WHERE tbname = ?', [$table]);
    if (!$p) return null;
    $len = max(1, (int)$p['numlimit']);
    $prefix = $p['prefix'] . substr((string)((int)date('Y') + 543), 2, 2) . date('m');
    $max = val("SELECT MAX(CAST(RIGHT(docno, $len) AS UNSIGNED)) FROM `$table` WHERE docno LIKE ?", [$prefix . '%']);
    return $prefix . str_pad((string)(((int)$max) + 1), $len, '0', STR_PAD_LEFT);
}

/* ---------- uploads ---------- */

function upload_dir(string $type): string
{
    $allowed = ['car', 'driver', 'user', 'booking'];
    if (!in_array($type, $allowed, true)) throw new HttpError(400, 'ประเภทไฟล์ไม่ถูกต้อง');
    $base = rtrim((string)config('upload_dir'), '/\\');
    $dir = $base . DIRECTORY_SEPARATOR . $type;
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    return $dir;
}

function save_upload(array $file, string $type, string $basename, array $exts): string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) throw new HttpError(400, 'อัปโหลดไฟล์ไม่สำเร็จ');
    $max = (int)(config('max_upload_mb') ?? 20) * 1024 * 1024;
    if ($file['size'] > $max) throw new HttpError(400, 'ไฟล์มีขนาดใหญ่เกินกำหนด');
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $exts, true)) throw new HttpError(400, 'ไม่รองรับไฟล์ชนิด .' . $ext);
    if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true) && @getimagesize($file['tmp_name']) === false) {
        throw new HttpError(400, 'ไฟล์รูปภาพไม่ถูกต้อง');
    }
    $name = preg_replace('/[^A-Za-z0-9_\-]/', '', $basename) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], upload_dir($type) . DIRECTORY_SEPARATOR . $name)) {
        throw new HttpError(500, 'บันทึกไฟล์ไม่สำเร็จ');
    }
    return $name;
}
