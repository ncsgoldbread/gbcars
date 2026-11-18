<?php
/*
 * Reset a user's password from the command line (for when nobody can log in).
 *
 *   Windows:  powershell -ExecutionPolicy Bypass -File database\reset-password.ps1 -User patpon
 *   Linux:    php database/reset-password.php --user=patpon
 *
 * The new password is read from the keyboard (hidden), never from the command line.
 * Also clears failed-login lockouts.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(403); exit('CLI only'); }

$opts = getopt('', ['user:']);
$username = trim((string)($opts['user'] ?? ''));
if ($username === '') { fwrite(STDERR, "ระบุชื่อผู้ใช้: --user=ชื่อผู้ใช้\n"); exit(1); }

$cfgFile = __DIR__ . '/../config/config.php';
if (!is_file($cfgFile)) { fwrite(STDERR, "ไม่พบ config/config.php\n"); exit(1); }
$c = (require $cfgFile)['db'];
$pdo = new PDO(sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['host'], $c['port'] ?? 3306, $c['name']), $c['user'], $c['pass'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

$st = $pdo->prepare('SELECT id, username, firstname, surname, status, member_type FROM tb_user WHERE LOWER(username) = LOWER(?)');
$st->execute([$username]);
$user = $st->fetch();
if (!$user) { fwrite(STDERR, "ไม่พบผู้ใช้ \"$username\"\n"); exit(1); }

function read_secret(string $prompt): string
{
    if (!getenv('GBCARS_NOPROMPT')) fwrite(STDOUT, $prompt); // the .ps1 wrapper asks for the password itself
    $hide = DIRECTORY_SEPARATOR === '/' && posix_isatty_safe();
    if ($hide) shell_exec('stty -echo');
    $line = fgets(STDIN);
    if ($hide) { shell_exec('stty echo'); fwrite(STDOUT, "\n"); }
    // Windows pipes may prefix a UTF-8 BOM to stdin
    return rtrim(preg_replace('/^\xEF\xBB\xBF/', '', (string)$line), "\r\n");
}
function posix_isatty_safe(): bool { return function_exists('posix_isatty') ? posix_isatty(STDIN) : true; }

echo "รีเซ็ตรหัสผ่าน: {$user['username']} ({$user['firstname']} {$user['surname']})\n";
$pw = read_secret('รหัสผ่านใหม่ (อย่างน้อย 6 ตัว): ');
$pw2 = read_secret('ยืนยันรหัสผ่านใหม่: ');
if ($pw !== $pw2) { fwrite(STDERR, "รหัสผ่านไม่ตรงกัน — ยังไม่ได้เปลี่ยน\n"); exit(1); }
if (mb_strlen($pw) < 6) { fwrite(STDERR, "รหัสผ่านสั้นเกินไป — ยังไม่ได้เปลี่ยน\n"); exit(1); }

$pdo->prepare('UPDATE tb_user SET password = ? WHERE id = ?')->execute([password_hash($pw, PASSWORD_DEFAULT), $user['id']]);
$pdo->exec('DELETE FROM tb_login_attempt');
echo "✓ เปลี่ยนรหัสผ่านของ {$user['username']} แล้ว\n";
if ((int)$user['status'] !== 0) echo "! บัญชีนี้ถูกระงับใช้อยู่ — แก้สถานะในเมนู ผู้ใช้งาน หรือ tb_user.status = 0\n";
