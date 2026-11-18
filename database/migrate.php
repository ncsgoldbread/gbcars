<?php
/*
 * Import data from the old CarSYS 1.13 database dump into GB CarSys 2.0.
 *
 * Usage (command line):
 *   php database/migrate.php --dump=F:/Project/gbcarsys/admin_carsys.sql [--files=F:/Project/gbcarsys/fileupload] [--yes]
 *
 *   --dump   phpMyAdmin SQL export of the old database (admin_carsys)
 *   --files  old "fileupload" folder; car/driver/user/booking files are copied to config upload_dir
 *   --yes    replace data that already exists in the new database
 *
 * What it does:
 *   1. creates the database (if missing) and the 2.0 schema (database/schema.sql)
 *   2. empties the CarSYS tables and imports every INSERT from the dump
 *   3. converts '0000-00-00' dates to NULL, fixes AUTO_INCREMENT
 *   4. old md5 passwords keep working and are upgraded to bcrypt at first login
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(403); exit('CLI only'); }

$opts = getopt('', ['dump:', 'files::', 'yes']);
$dump = $opts['dump'] ?? null;
if (!$dump || !is_file($dump)) {
    fwrite(STDERR, "ระบุไฟล์ dump เก่าด้วย --dump=path/to/admin_carsys.sql\n");
    exit(1);
}
$cfgFile = __DIR__ . '/../config/config.php';
if (!is_file($cfgFile)) { fwrite(STDERR, "ไม่พบ config/config.php (คัดลอกจาก config.sample.php)\n"); exit(1); }
$cfg = require $cfgFile;
$c = $cfg['db'];

$pdo = new PDO(sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $c['host'], $c['port'] ?? 3306), $c['user'], $c['pass'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::MYSQL_ATTR_MULTI_STATEMENTS => true,
]);
$db = str_replace('`', '', $c['name']);
$pdo->exec("CREATE DATABASE IF NOT EXISTS `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$pdo->exec("USE `$db`");
$pdo->exec(file_get_contents(__DIR__ . '/schema.sql'));
// drain multi-statement results
$pdo = null;
$pdo = new PDO(sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['host'], $c['port'] ?? 3306, $db), $c['user'], $c['pass'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);
echo "✓ สร้างโครงสร้างฐานข้อมูล `$db` แล้ว\n";

$tables = ['tb_booking', 'tb_brand', 'tb_car', 'tb_carfile', 'tb_carfix', 'tb_carfix_sub', 'tb_cartype', 'tb_carwork', 'tb_company', 'tb_depart',
    'tb_docprefix', 'tb_driver', 'tb_faculty', 'tb_garage', 'tb_insurance', 'tb_insurer', 'tb_leasing', 'tb_oil', 'tb_payleasing', 'tb_plb',
    'tb_province', 'tb_tabian', 'tb_user', 'tb_userdepart'];

$existing = (int)$pdo->query('SELECT (SELECT COUNT(*) FROM tb_car) + (SELECT COUNT(*) FROM tb_booking) + (SELECT COUNT(*) FROM tb_user)')->fetchColumn();
if ($existing > 0 && !isset($opts['yes'])) {
    fwrite(STDERR, "ฐานข้อมูลใหม่มีข้อมูลอยู่แล้ว ($existing แถว). เพิ่ม --yes เพื่อแทนที่ด้วยข้อมูลเก่า\n");
    exit(1);
}

$pdo->exec("SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO'");
$pdo->exec('SET NAMES utf8mb4');
foreach ($tables as $t) $pdo->exec("TRUNCATE TABLE `$t`");

/** Split a SQL dump into statements, respecting quoted strings and comments. */
function sql_statements(string $sql): Generator
{
    $len = strlen($sql);
    $buf = '';
    $quote = null;
    for ($i = 0; $i < $len; $i++) {
        $ch = $sql[$i];
        if ($quote !== null) {
            $buf .= $ch;
            if ($ch === '\\') { $buf .= $sql[++$i] ?? ''; continue; }
            if ($ch === $quote) {
                if (($sql[$i + 1] ?? '') === $quote) { $buf .= $sql[++$i]; continue; }
                $quote = null;
            }
            continue;
        }
        if ($ch === "'" || $ch === '"' || $ch === '`') { $quote = $ch; $buf .= $ch; continue; }
        if ($ch === '-' && ($sql[$i + 1] ?? '') === '-' && ($buf === '' || trim($buf) === '' || in_array($sql[$i - 1] ?? "\n", ["\n", "\r"], true))) {
            $nl = strpos($sql, "\n", $i);
            $i = $nl === false ? $len : $nl;
            continue;
        }
        if ($ch === '/' && ($sql[$i + 1] ?? '') === '*') {
            $end = strpos($sql, '*/', $i + 2);
            $i = $end === false ? $len : $end + 1;
            continue;
        }
        if ($ch === ';') {
            if (trim($buf) !== '') yield trim($buf);
            $buf = '';
            continue;
        }
        $buf .= $ch;
    }
    if (trim($buf) !== '') yield trim($buf);
}

$sql = file_get_contents($dump);
if (str_starts_with($sql, "\xEF\xBB\xBF")) $sql = substr($sql, 3);
$n = 0;
$skipped = [];
$pdo->beginTransaction();
foreach (sql_statements($sql) as $st) {
    if (!preg_match('/^INSERT\s+INTO\s+`?(\w+)`?/i', $st, $m)) continue;
    if (!in_array($m[1], $tables, true)) { $skipped[$m[1]] = true; continue; }
    $pdo->exec($st);
    $n++;
}
$pdo->commit();
echo "✓ นำเข้าคำสั่ง INSERT $n ชุด\n";
if ($skipped) echo '  (ข้ามตาราง: ' . implode(', ', array_keys($skipped)) . ")\n";

// zero dates -> NULL, fix AUTO_INCREMENT
foreach ($tables as $t) {
    foreach ($pdo->query("SHOW COLUMNS FROM `$t`")->fetchAll(PDO::FETCH_ASSOC) as $col) {
        if (preg_match('/^(date|datetime)/', $col['Type'])) {
            $f = $col['Field'];
            $pdo->exec("UPDATE `$t` SET `$f` = NULL WHERE `$f` < '1000-01-01'");
        }
    }
    $max = (int)$pdo->query("SELECT IFNULL(MAX(id), 0) FROM `$t`")->fetchColumn();
    $pdo->exec("ALTER TABLE `$t` AUTO_INCREMENT = " . ($max + 1));
}
// docprefix / company must exist
$pdo->exec("INSERT IGNORE INTO tb_docprefix (id, docname, prefix, numlimit, tbname) VALUES
 (1,'เอกสารการจอง','REV',4,'tb_booking'),(2,'เอกสารการใช้รถ','USE',4,'tb_carwork'),(3,'เอกสารการซ่อมบำรุง','MAN',4,'tb_carfix'),
 (4,'เอกสารชำระเบี้ยประกันภัย','INS',4,'tb_insurance'),(5,'เอกสารการต่อทะเบียน','TAB',4,'tb_tabian'),(6,'เอกสารการต่อ พรบ.','PLB',4,'tb_plb'),
 (7,'เอกสารการชำระค่างวด','INV',4,'tb_payleasing')");
if ((int)$pdo->query('SELECT COUNT(*) FROM tb_company')->fetchColumn() === 0) {
    $pdo->exec("INSERT INTO tb_company (id, name, webheader) VALUES (1, 'บริษัทของฉัน', 'GB CarSys')");
}

echo "\nจำนวนข้อมูลที่นำเข้า:\n";
foreach ($tables as $t) {
    printf("  %-16s %6d\n", $t, (int)$pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn());
}
$admins = (int)$pdo->query('SELECT COUNT(*) FROM tb_user WHERE member_type = 1 AND status = 0')->fetchColumn();
echo "\nผู้ดูแลระบบที่ใช้งานได้: $admins คน (เข้าสู่ระบบด้วยรหัสผ่านเดิมได้ทันที)\n";

// copy uploaded files
if (!empty($opts['files'])) {
    $src = rtrim((string)$opts['files'], '/\\');
    $dst = rtrim((string)$cfg['upload_dir'], '/\\');
    $copied = 0;
    foreach (['car', 'driver', 'user', 'booking'] as $type) {
        if (!is_dir("$src/$type")) continue;
        @mkdir("$dst/$type", 0775, true);
        foreach (new DirectoryIterator("$src/$type") as $f) {
            if (!$f->isFile()) continue;
            $target = "$dst/$type/" . $f->getFilename();
            if (is_file($target) && filesize($target) === $f->getSize()) continue;
            copy($f->getPathname(), $target);
            $copied++;
        }
    }
    echo "✓ คัดลอกไฟล์แนบ $copied ไฟล์ ไปที่ $dst\n";
}
echo "\nเสร็จสิ้น\n";
