<?php
declare(strict_types=1);

function table_columns(string $table): array
{
    static $cache = [];
    if (!isset($cache[$table])) {
        $cache[$table] = array_column(rows("SHOW COLUMNS FROM `$table`"), 'Field');
    }
    return $cache[$table];
}

function can_read(array $res): bool { return is_admin() || !empty($res['readAll']); }
function can_write(array $res): bool { return is_admin() || !empty($res['userWrite']); }

/** Build SELECT with LEFT JOINs that resolve lookup fields to "<field>__t" text columns. */
function select_sql(array $res): string
{
    $cols = ['t.*'];
    $joins = [];
    $lk = lookups();
    $i = 0;
    foreach ($res['fields'] as $f) {
        if ($f['type'] !== 'lookup') continue;
        $l = $lk[$f['lookup']];
        $a = 'l' . (++$i);
        $value = $l['value'] ?? 'id';
        $joins[] = "LEFT JOIN `{$l['table']}` $a ON $a.`$value` = t.`{$f['name']}`";
        $cols[] = str_replace('t.', "$a.", $l['text']) . " AS `{$f['name']}__t`";
    }
    return 'SELECT ' . implode(', ', $cols) . " FROM `{$res['table']}` t " . implode(' ', $joins);
}

function clean_row(array $res, array $r): array
{
    unset($r['password']);
    return $r;
}

function crud_list(array $res): array
{
    if (!can_read($res)) throw new HttpError(403, 'ไม่มีสิทธิ์เข้าถึง');
    $where = [];
    $params = [];
    $q = trim((string)($_GET['q'] ?? ''));
    if ($q !== '' && !empty($res['search'])) {
        $or = [];
        foreach ($res['search'] as $c) { $or[] = "t.`$c` LIKE ?"; $params[] = "%$q%"; }
        // also search lookup texts
        $where[] = '(' . implode(' OR ', $or) . ')';
    }
    $names = array_column($res['fields'], 'name');
    foreach ((array)($_GET['f'] ?? []) as $k => $v) {
        if ($v === '' || !in_array($k, $names, true)) continue;
        $where[] = "t.`$k` = ?";
        $params[] = $v;
    }
    $dateField = $_GET['datefield'] ?? null;
    if ($dateField && in_array($dateField, $names, true)) {
        if (!empty($_GET['from'])) { $where[] = "t.`$dateField` >= ?"; $params[] = $_GET['from']; }
        if (!empty($_GET['to'])) { $where[] = "t.`$dateField` <= ?"; $params[] = $_GET['to'] . ' 23:59:59'; }
    }
    $w = $where ? ' WHERE ' . implode(' AND ', $where) : '';

    $order = $res['order'] ?? (in_array('docno', $names, true) ? 't.id DESC' : 't.id');
    $sort = $_GET['sort'] ?? '';
    if ($sort !== '' && (in_array($sort, $names, true) || $sort === 'id')) {
        $order = "t.`$sort` " . (strtolower($_GET['dir'] ?? '') === 'desc' ? 'DESC' : 'ASC');
    }
    $per = min(500, max(1, (int)($_GET['per'] ?? 25)));
    $page = max(1, (int)($_GET['page'] ?? 1));
    $off = ($page - 1) * $per;

    $total = (int)val("SELECT COUNT(*) FROM `{$res['table']}` t$w", $params);
    $data = rows(select_sql($res) . "$w ORDER BY $order LIMIT $per OFFSET $off", $params);
    return ['rows' => array_map(fn($r) => clean_row($res, $r), $data), 'total' => $total, 'page' => $page, 'per' => $per];
}

function crud_get(array $res, int $id): array
{
    if (!can_read($res)) throw new HttpError(403, 'ไม่มีสิทธิ์เข้าถึง');
    $r = row(select_sql($res) . ' WHERE t.id = ?', [$id]);
    if (!$r) throw new HttpError(404, 'ไม่พบข้อมูล');
    $r = clean_row($res, $r);
    if (!empty($res['children'])) {
        $c = $res['children'];
        $r['_items'] = rows("SELECT * FROM `{$c['table']}` WHERE `{$c['fk']}` = ? ORDER BY id", [$id]);
    }
    if ($res['name'] === 'car') {
        $r['_files'] = rows('SELECT id, oldfilename, filename, comment FROM tb_carfile WHERE car_id = ? ORDER BY id DESC', [$id]);
    }
    return $r;
}

function normalize(array $f, $v)
{
    if (is_string($v)) $v = trim($v);
    switch ($f['type']) {
        case 'number':
        case 'money':
            if ($v === '' || $v === null) return null;
            $v = str_replace([',', ' '], '', (string)$v);
            if (!is_numeric($v)) throw new HttpError(422, "{$f['label']}: ต้องเป็นตัวเลข");
            return $v + 0;
        case 'lookup':
            return ($v === '' || $v === null) ? null : $v;
        case 'select':
            if ($v === '' || $v === null) return null;
            if (isset($f['options']) && !array_key_exists((string)$v, $f['options'])) throw new HttpError(422, "{$f['label']}: ค่าไม่ถูกต้อง");
            return $v;
        case 'date':
            if ($v === '' || $v === null) return null;
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$v)) throw new HttpError(422, "{$f['label']}: รูปแบบวันที่ไม่ถูกต้อง");
            return $v;
        case 'datetime':
            if ($v === '' || $v === null) return null;
            $v = str_replace('T', ' ', (string)$v);
            if (!preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/', $v)) throw new HttpError(422, "{$f['label']}: รูปแบบวันเวลาไม่ถูกต้อง");
            return strlen($v) === 16 ? "$v:00" : $v;
        case 'time':
            if ($v === '' || $v === null) return null;
            if (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', (string)$v)) throw new HttpError(422, "{$f['label']}: รูปแบบเวลาไม่ถูกต้อง");
            return substr((string)$v, 0, 5);
        default:
            return ($v === null) ? null : (string)$v;
    }
}

function collect(array $res, array $in, bool $isNew): array
{
    $data = [];
    foreach ($res['fields'] as $f) {
        $n = $f['name'];
        if (!empty($f['readonly']) && !($n === 'docno' && $isNew)) continue;
        if ($f['type'] === 'image') continue;
        if ($f['type'] === 'password') {
            $pw = (string)($in[$n] ?? '');
            if ($pw !== '') {
                if (mb_strlen($pw) < 6) throw new HttpError(422, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
                $data[$n] = password_hash($pw, PASSWORD_DEFAULT);
            } elseif ($isNew) {
                throw new HttpError(422, 'กรุณากำหนดรหัสผ่าน');
            }
            continue;
        }
        if (!array_key_exists($n, $in)) {
            if ($isNew && !empty($f['required'])) throw new HttpError(422, "กรุณากรอก {$f['label']}");
            continue;
        }
        $v = normalize($f, $in[$n]);
        if (!empty($f['required']) && ($v === null || $v === '')) throw new HttpError(422, "กรุณากรอก {$f['label']}");
        $data[$n] = $v;
    }
    return $data;
}

function crud_save(array $res, ?int $id, array $in): array
{
    $u = require_login();
    if (!can_write($res)) throw new HttpError(403, 'ไม่มีสิทธิ์แก้ไขข้อมูล');
    if ($id === null && !empty($res['noCreate'])) throw new HttpError(403, 'ไม่สามารถเพิ่มรายการนี้ได้');
    $table = $res['table'];
    $cols = table_columns($table);

    if ($id !== null) {
        $old = row("SELECT * FROM `$table` WHERE id = ?", [$id]);
        if (!$old) throw new HttpError(404, 'ไม่พบข้อมูล');
        if (!is_admin() && isset($old['user_save_id']) && (int)$old['user_save_id'] !== (int)$u['id']) {
            throw new HttpError(403, 'แก้ไขได้เฉพาะรายการที่คุณบันทึก');
        }
    }
    $data = collect($res, $in, $id === null);

    if ($res['name'] === 'user' && isset($data['username'])) {
        $dup = val('SELECT id FROM tb_user WHERE LOWER(username) = LOWER(?) AND id <> ?', [$data['username'], $id ?? 0]);
        if ($dup) throw new HttpError(422, 'ชื่อผู้ใช้นี้มีอยู่แล้ว');
    }
    if ($id === null && !empty($res['docno']) && empty($data['docno'])) {
        $data['docno'] = next_docno($table);
    }
    if (in_array('date_edit', $cols, true)) $data['date_edit'] = now();
    if ($id === null) {
        if (in_array('date_create', $cols, true)) $data['date_create'] = now();
        if (in_array('user_save_id', $cols, true)) $data['user_save_id'] = $u['id'];
        if (in_array('doctime', $cols, true) && !isset($data['doctime'])) $data['doctime'] = date('H:i');
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        if ($id === null) {
            $keys = array_keys($data);
            q("INSERT INTO `$table` (`" . implode('`,`', $keys) . '`) VALUES (' . implode(',', array_fill(0, count($keys), '?')) . ')', array_values($data));
            $id = (int)$pdo->lastInsertId();
        } elseif ($data) {
            $set = implode(', ', array_map(fn($k) => "`$k` = ?", array_keys($data)));
            q("UPDATE `$table` SET $set WHERE id = ?", [...array_values($data), $id]);
        }

        if (!empty($res['children']) && isset($in['_items']) && is_array($in['_items'])) {
            $c = $res['children'];
            q("DELETE FROM `{$c['table']}` WHERE `{$c['fk']}` = ?", [$id]);
            foreach ($in['_items'] as $item) {
                $rowData = [$c['fk'] => $id];
                $empty = true;
                foreach ($c['fields'] as $f) {
                    $v = normalize($f, $item[$f['name']] ?? null);
                    if ($v !== null && $v !== '') $empty = false;
                    $rowData[$f['name']] = $v;
                }
                if ($empty) continue;
                $k = array_keys($rowData);
                q("INSERT INTO `{$c['table']}` (`" . implode('`,`', $k) . '`) VALUES (' . implode(',', array_fill(0, count($k), '?')) . ')', array_values($rowData));
            }
        }

        if (!empty($res['syncCar'])) sync_car_dates($res, $id);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    return crud_get($res + ['readAll' => true], $id);
}

/** After an insurance / tax / พ.ร.บ. renewal, copy the latest period to tb_car so expiry alerts stay right. */
function sync_car_dates(array $res, int $id): void
{
    $carId = val("SELECT car_id FROM `{$res['table']}` WHERE id = ?", [$id]);
    if (!$carId) return;
    $latest = row("SELECT * FROM `{$res['table']}` WHERE car_id = ? AND datee IS NOT NULL ORDER BY datee DESC, id DESC LIMIT 1", [$carId]);
    if (!$latest) return;
    $set = [];
    $params = [];
    foreach ($res['syncCar'] as $carCol => $srcCol) {
        if ($latest[$srcCol] === null) continue;
        $set[] = "`$carCol` = ?";
        $params[] = $latest[$srcCol];
    }
    if ($set) q('UPDATE tb_car SET ' . implode(', ', $set) . ' WHERE id = ?', [...$params, $carId]);
}

function crud_delete(array $res, int $id): array
{
    $u = require_login();
    if (!can_write($res) || !empty($res['noCreate'])) throw new HttpError(403, 'ไม่มีสิทธิ์ลบข้อมูล');
    $old = row("SELECT * FROM `{$res['table']}` WHERE id = ?", [$id]);
    if (!$old) throw new HttpError(404, 'ไม่พบข้อมูล');
    if (!is_admin() && isset($old['user_save_id']) && (int)$old['user_save_id'] !== (int)$u['id']) {
        throw new HttpError(403, 'ลบได้เฉพาะรายการที่คุณบันทึก');
    }
    if ($res['name'] === 'user' && $id === (int)$u['id']) throw new HttpError(422, 'ไม่สามารถลบบัญชีของตัวเองได้');
    $inUse = [
        'car' => [['tb_booking', 'car_id'], ['tb_carwork', 'car_id']],
        'driver' => [['tb_booking', 'driver_id'], ['tb_carwork', 'driver_id']],
        'depart' => [['tb_booking', 'depart_id'], ['tb_user', 'depart_id']],
    ][$res['name']] ?? [];
    foreach ($inUse as [$t, $c]) {
        if (val("SELECT COUNT(*) FROM `$t` WHERE `$c` = ?", [$id]) > 0) {
            throw new HttpError(422, 'ไม่สามารถลบได้ เนื่องจากมีการใช้งานข้อมูลนี้อยู่');
        }
    }
    q("DELETE FROM `{$res['table']}` WHERE id = ?", [$id]);
    if (!empty($res['children'])) q("DELETE FROM `{$res['children']['table']}` WHERE `{$res['children']['fk']}` = ?", [$id]);
    return ['ok' => true];
}

function crud_image(array $res, int $id, string $field): array
{
    require_admin();
    if (!in_array($field, $res['images'] ?? [], true)) throw new HttpError(400, 'ฟิลด์รูปภาพไม่ถูกต้อง');
    if (!row("SELECT id FROM `{$res['table']}` WHERE id = ?", [$id])) throw new HttpError(404, 'ไม่พบข้อมูล');
    if (empty($_FILES['file'])) throw new HttpError(400, 'ไม่พบไฟล์');
    $suffix = $res['name'] === 'car' ? '_' . substr($field, -1) : '';
    $name = save_upload($_FILES['file'], $res['uploadType'], $id . $suffix . '_' . date('His'), ['jpg', 'jpeg', 'png', 'gif', 'webp']);
    q("UPDATE `{$res['table']}` SET `$field` = ? WHERE id = ?", [$name, $id]);
    return ['file' => $name];
}

function lookup_list(string $name): array
{
    require_login();
    $l = lookups()[$name] ?? null;
    if (!$l) throw new HttpError(404, 'ไม่พบข้อมูล');
    $value = $l['value'] ?? 'id';
    $extra = '';
    if ($name === 'car') $extra = ', t.status, t.rate, t.seats, t.picture1';
    if ($name === 'user') $extra = ', t.depart_id';
    return rows("SELECT t.`$value` AS id, {$l['text']} AS text$extra FROM `{$l['table']}` t ORDER BY {$l['order']}");
}
