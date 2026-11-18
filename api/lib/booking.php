<?php
declare(strict_types=1);

/*
 * Booking workflow (same status codes as CarSYS 1.13):
 * 0 รออนุมัติ -> 1 เปิดอ่านแล้ว -> 2 อนุมัติ | 3 ไม่อนุมัติ ; 4 ยกเลิก ; 2 -> 5 ส่งคืนรถแล้ว -> 6 รับคืนรถแล้ว
 * Approvers are users listed in tb_userdepart for the booking's department (admins can do everything).
 */

const BOOKING_FIELDS = ['car_id', 'driver_id', 'start_date', 'end_date', 'working', 'address', 'tumbol', 'aumphur', 'province',
    'passenger_amount', 'passenger_name', 'depart_id', 'person_name', 'tel', 'comment', 'docref'];
const BUSY_STATUSES = '0,1,2,5';

function booking_select(): string
{
    return "SELECT b.*, CONCAT_WS(' ', c.code, IF(c.carno<>'', CONCAT('(', c.carno, ')'), NULL), c.model) AS car_id__t, c.picture1 AS car_picture,
        c.code AS car_code, c.carno AS car_no, c.model AS car_model, pv.name AS car_province,
        CONCAT(IFNULL(d.title,''), d.firstname, ' ', IFNULL(d.surname,'')) AS driver_id__t, d.tel AS driver_tel,
        CONCAT_WS(' ', dp.code, dp.name) AS depart_id__t,
        CONCAT(IFNULL(us.title,''), us.firstname, ' ', IFNULL(us.surname,'')) AS user_save_id__t,
        CONCAT(IFNULL(ua.title,''), ua.firstname, ' ', IFNULL(ua.surname,'')) AS user_approve_id__t
        FROM tb_booking b
        LEFT JOIN tb_car c ON c.id = b.car_id
        LEFT JOIN tb_driver d ON d.id = b.driver_id
        LEFT JOIN tb_depart dp ON dp.id = b.depart_id
        LEFT JOIN tb_user us ON us.id = b.user_save_id
        LEFT JOIN tb_user ua ON ua.id = b.user_approve_id
        LEFT JOIN tb_province pv ON pv.code = c.prov_code";
}

function can_approve(array $b): bool
{
    $u = current_user();
    if (!$u) return false;
    if (is_admin()) return true;
    return in_array((int)$b['depart_id'], approver_departs((int)$u['id']), true);
}

function booking_load(int $id): array
{
    $b = row(booking_select() . ' WHERE b.id = ?', [$id]);
    if (!$b) throw new HttpError(404, 'ไม่พบรายการจอง');
    $u = require_login();
    $isOwner = (int)$b['user_save_id'] === (int)$u['id'];
    if (!$isOwner && !can_approve($b)) throw new HttpError(403, 'ไม่มีสิทธิ์ดูรายการนี้');
    $b['_can'] = [
        'edit' => ($isOwner && in_array((int)$b['status'], [0, 1], true)) || is_admin(),
        'cancel' => ($isOwner || is_admin()) && in_array((int)$b['status'], [0, 1, 2], true),
        'approve' => can_approve($b) && in_array((int)$b['status'], [0, 1], true),
        'return' => ($isOwner || can_approve($b)) && (int)$b['status'] === 2,
        'receive' => can_approve($b) && (int)$b['status'] === 5,
        'delete' => is_admin(),
    ];
    $b['status_text'] = BOOKING_STATUS[(string)$b['status']] ?? '';
    return $b;
}

function booking_list(): array
{
    $u = require_login();
    $scope = $_GET['scope'] ?? 'mine';
    $where = [];
    $params = [];
    $departs = approver_departs((int)$u['id']);
    $departIn = $departs ? implode(',', $departs) : '0';

    if ($scope === 'mine') {
        $where[] = 'b.user_save_id = ?';
        $params[] = $u['id'];
    } elseif ($scope === 'approve' || $scope === 'return' || $scope === 'all') {
        if (!is_admin()) $where[] = "b.depart_id IN ($departIn)";
        if ($scope === 'approve') $where[] = 'b.status IN (0,1)';
        if ($scope === 'return') $where[] = 'b.status = 5';
    } else {
        throw new HttpError(400, 'scope ไม่ถูกต้อง');
    }
    if (isset($_GET['status']) && $_GET['status'] !== '') { $where[] = 'b.status = ?'; $params[] = (int)$_GET['status']; }
    foreach (['car_id', 'depart_id', 'driver_id'] as $k) {
        if (!empty($_GET[$k])) { $where[] = "b.`$k` = ?"; $params[] = (int)$_GET[$k]; }
    }
    if (!empty($_GET['from'])) { $where[] = 'b.end_date >= ?'; $params[] = $_GET['from'] . ' 00:00:00'; }
    if (!empty($_GET['to'])) { $where[] = 'b.start_date <= ?'; $params[] = $_GET['to'] . ' 23:59:59'; }
    $q = trim((string)($_GET['q'] ?? ''));
    if ($q !== '') {
        $where[] = '(b.docno LIKE ? OR b.working LIKE ? OR b.person_name LIKE ? OR b.province LIKE ? OR c.code LIKE ?)';
        array_push($params, "%$q%", "%$q%", "%$q%", "%$q%", "%$q%");
    }
    $w = $where ? ' WHERE ' . implode(' AND ', $where) : '';
    $per = min(200, max(1, (int)($_GET['per'] ?? 25)));
    $page = max(1, (int)($_GET['page'] ?? 1));
    $total = (int)val("SELECT COUNT(*) FROM tb_booking b LEFT JOIN tb_car c ON c.id = b.car_id$w", $params);
    $data = rows(booking_select() . "$w ORDER BY b.start_date DESC, b.id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $params);
    foreach ($data as &$r) $r['status_text'] = BOOKING_STATUS[(string)$r['status']] ?? '';
    return ['rows' => $data, 'total' => $total, 'page' => $page, 'per' => $per];
}

function booking_input(array $in): array
{
    $d = [];
    foreach (BOOKING_FIELDS as $k) {
        if (!array_key_exists($k, $in)) continue;
        $v = is_string($in[$k]) ? trim($in[$k]) : $in[$k];
        $d[$k] = ($v === '') ? null : $v;
    }
    foreach (['start_date', 'end_date'] as $k) {
        if (empty($d[$k])) throw new HttpError(422, 'กรุณาระบุวันเวลาเริ่มและสิ้นสุด', $k);
        $v = str_replace('T', ' ', (string)$d[$k]);
        if (!preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/', $v)) throw new HttpError(422, 'รูปแบบวันเวลาไม่ถูกต้อง', $k);
        $d[$k] = strlen($v) === 16 ? "$v:00" : $v;
    }
    if (strtotime($d['end_date']) <= strtotime($d['start_date'])) throw new HttpError(422, 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม', 'end_date');
    if (empty($d['car_id'])) throw new HttpError(422, 'กรุณาเลือกรถ', 'car_id');
    if (empty($d['working'])) throw new HttpError(422, 'กรุณาระบุภารกิจ', 'working');
    if (empty($d['depart_id'])) throw new HttpError(422, 'กรุณาเลือกแผนก', 'depart_id');
    foreach (['car_id', 'driver_id', 'depart_id', 'passenger_amount'] as $k) {
        if (isset($d[$k]) && $d[$k] !== null) $d[$k] = (int)$d[$k];
    }
    return $d;
}

function car_busy(int $carId, string $start, string $end, int $excludeId = 0): ?array
{
    return row('SELECT id, docno, start_date, end_date FROM tb_booking WHERE car_id = ? AND id <> ? AND status IN (' . BUSY_STATUSES . ')
        AND start_date < ? AND end_date > ? LIMIT 1', [$carId, $excludeId, $end, $start]);
}

function check_car(array $d, int $excludeId = 0): array
{
    $car = row('SELECT id, status, rate FROM tb_car WHERE id = ?', [$d['car_id']]);
    if (!$car) throw new HttpError(422, 'ไม่พบรถที่เลือก');
    if ((int)$car['status'] !== 0) throw new HttpError(422, 'รถคันนี้ไม่พร้อมให้บริการ (' . (CAR_STATUS[(string)$car['status']] ?? '') . ')');
    if ($busy = car_busy((int)$d['car_id'], $d['start_date'], $d['end_date'], $excludeId)) {
        throw new HttpError(409, "รถคันนี้ถูกจองแล้วในช่วงเวลาดังกล่าว (ใบจอง {$busy['docno']})");
    }
    if (!empty($d['driver_id'])) {
        $drv = row('SELECT status FROM tb_driver WHERE id = ?', [$d['driver_id']]);
        if (!$drv) throw new HttpError(422, 'ไม่พบพนักงานขับรถ');
        if ((int)$drv['status'] !== 0) throw new HttpError(422, 'พนักงานขับรถคนนี้ถูกระงับการขับรถ');
        $dBusy = row('SELECT docno FROM tb_booking WHERE driver_id = ? AND id <> ? AND status IN (' . BUSY_STATUSES . ') AND start_date < ? AND end_date > ? LIMIT 1',
            [$d['driver_id'], $excludeId, $d['end_date'], $d['start_date']]);
        if ($dBusy) throw new HttpError(409, "พนักงานขับรถติดงานในช่วงเวลาดังกล่าว (ใบจอง {$dBusy['docno']})");
    }
    return $car;
}

function booking_money(array $car, array $d): array
{
    $minutes = max(0, (int)round((strtotime($d['end_date']) - strtotime($d['start_date'])) / 60));
    $rate = (float)$car['rate'];
    return ['car_rate' => $rate, 'car_money' => round($rate * $minutes, 2)];
}

function booking_create(array $in): array
{
    $u = require_login();
    $d = booking_input($in);
    $car = check_car($d);
    $d += booking_money($car, $d);
    $d['docno'] = next_docno('tb_booking');
    $d['docdate'] = date('Y-m-d');
    $d['doctime'] = date('H:i');
    $d['status'] = 0;
    $d['user_save_id'] = $u['id'];
    $d['date_create'] = $d['date_edit'] = now();
    $k = array_keys($d);
    q('INSERT INTO tb_booking (`' . implode('`,`', $k) . '`) VALUES (' . implode(',', array_fill(0, count($k), '?')) . ')', array_values($d));
    return booking_load((int)db()->lastInsertId());
}

function booking_update(int $id, array $in): array
{
    $b = booking_load($id);
    if (!$b['_can']['edit']) throw new HttpError(403, 'ไม่สามารถแก้ไขรายการนี้ได้');
    $d = booking_input($in);
    $car = check_car($d, $id);
    $d += booking_money($car, $d);
    $d['date_edit'] = now();
    $set = implode(', ', array_map(fn($k) => "`$k` = ?", array_keys($d)));
    q("UPDATE tb_booking SET $set WHERE id = ?", [...array_values($d), $id]);
    return booking_load($id);
}

function booking_action(int $id, string $action, array $in): array
{
    $u = require_login();
    $b = booking_load($id);
    $comment = trim((string)($in['comment'] ?? ''));
    switch ($action) {
        case 'read':
            if (can_approve($b) && (int)$b['status'] === 0) {
                q('UPDATE tb_booking SET status = 1, read_date = ? WHERE id = ? AND status = 0', [now(), $id]);
            }
            break;
        case 'approve':
        case 'reject':
            if (!$b['_can']['approve']) throw new HttpError(403, 'ไม่มีสิทธิ์อนุมัติรายการนี้');
            $set = ['status' => $action === 'approve' ? 2 : 3, 'approve_date' => now(), 'approve_comment' => $comment, 'user_approve_id' => $u['id']];
            if ($action === 'approve' && array_key_exists('driver_id', $in)) {
                $drv = ($in['driver_id'] === '' || $in['driver_id'] === null) ? null : (int)$in['driver_id'];
                if ($drv) check_car(['car_id' => $b['car_id'], 'driver_id' => $drv, 'start_date' => $b['start_date'], 'end_date' => $b['end_date']], $id);
                $set['driver_id'] = $drv;
            }
            if (empty($b['read_date'])) $set['read_date'] = now();
            $s = implode(', ', array_map(fn($k) => "`$k` = ?", array_keys($set)));
            q("UPDATE tb_booking SET $s WHERE id = ?", [...array_values($set), $id]);
            break;
        case 'cancel':
            if (!$b['_can']['cancel']) throw new HttpError(403, 'ไม่สามารถยกเลิกรายการนี้ได้');
            q('UPDATE tb_booking SET status = 4, comment = CONCAT(IFNULL(comment, ""), ?), date_edit = ? WHERE id = ?',
                [$comment !== '' ? "\n[ยกเลิก] $comment" : '', now(), $id]);
            break;
        case 'return':
            if (!$b['_can']['return']) throw new HttpError(403, 'ไม่สามารถส่งคืนรถได้');
            q('UPDATE tb_booking SET status = 5, date_return = ?, return_comment = ? WHERE id = ?', [now(), $comment, $id]);
            break;
        case 'receive':
            if (!$b['_can']['receive']) throw new HttpError(403, 'ไม่มีสิทธิ์รับคืนรถ');
            $damage = str_replace(',', '', (string)($in['damage'] ?? '0'));
            if ($damage !== '' && !is_numeric($damage)) throw new HttpError(422, 'ค่าเสียหายต้องเป็นตัวเลข');
            q('UPDATE tb_booking SET status = 6, date_return_ok = ?, damage = ?, return_comment = TRIM(CONCAT(IFNULL(return_comment, ""), " ", ?)), user_return_id = ? WHERE id = ?',
                [now(), (float)$damage, $comment, $u['id'], $id]);
            break;
        default:
            throw new HttpError(400, 'คำสั่งไม่ถูกต้อง');
    }
    return booking_load($id);
}

function booking_delete(int $id): array
{
    require_admin();
    q('DELETE FROM tb_booking WHERE id = ?', [$id]);
    return ['ok' => true];
}

/** Cars with a busy flag for the requested period – used by the booking form's car picker. */
function booking_availability(): array
{
    require_login();
    $start = str_replace('T', ' ', (string)($_GET['start'] ?? ''));
    $end = str_replace('T', ' ', (string)($_GET['end'] ?? ''));
    $exclude = (int)($_GET['exclude'] ?? 0);
    $cars = rows("SELECT c.id, c.code, c.carno, c.model, c.color, c.seats, c.rate, c.status, c.picture1,
        ct.name AS cartype, br.name AS brand FROM tb_car c
        LEFT JOIN tb_cartype ct ON ct.id = c.cartype_id LEFT JOIN tb_brand br ON br.id = c.brand_id
        WHERE c.status IN (0,1,2) ORDER BY c.code");
    $busy = [];
    if ($start && $end) {
        foreach (rows('SELECT car_id, docno, start_date, end_date FROM tb_booking WHERE id <> ? AND status IN (' . BUSY_STATUSES . ') AND start_date < ? AND end_date > ?', [$exclude, $end, $start]) as $r) {
            $busy[$r['car_id']] = $r;
        }
    }
    foreach ($cars as &$c) {
        $c['busy'] = $busy[$c['id']] ?? null;
        $c['available'] = (int)$c['status'] === 0 && !$c['busy'];
    }
    return $cars;
}

function calendar_events(): array
{
    require_login();
    $from = $_GET['from'] ?? date('Y-m-01');
    $to = $_GET['to'] ?? date('Y-m-t');
    $params = [$to . ' 23:59:59', $from . ' 00:00:00'];
    $carFilter = '';
    if (!empty($_GET['car_id'])) { $carFilter = ' AND b.car_id = ?'; $params[] = (int)$_GET['car_id']; }
    $data = rows("SELECT b.id, b.docno, b.status, b.start_date, b.end_date, b.working, b.province, b.person_name, b.car_id,
        c.code AS car_code, c.carno, CONCAT_WS(' ', dp.name) AS depart, CONCAT(IFNULL(d.firstname,''), ' ', IFNULL(d.nickname,'')) AS driver
        FROM tb_booking b LEFT JOIN tb_car c ON c.id = b.car_id LEFT JOIN tb_depart dp ON dp.id = b.depart_id LEFT JOIN tb_driver d ON d.id = b.driver_id
        WHERE b.status IN (0,1,2,5,6) AND b.start_date <= ? AND b.end_date >= ?$carFilter ORDER BY b.start_date", $params);
    foreach ($data as &$r) $r['status_text'] = BOOKING_STATUS[(string)$r['status']] ?? '';
    return $data;
}

function booking_counts(): array
{
    $u = current_user();
    if (!$u) return ['approve' => 0, 'return' => 0, 'expired' => 0, 'expiring' => 0];
    $soon = date('Y-m-d', strtotime('+30 days'));
    $today = date('Y-m-d');
    $least = "LEAST(IFNULL(date_e_code,'9999-12-31'), IFNULL(date_e_cpi,'9999-12-31'), IFNULL(date_e_insure,'9999-12-31'))";
    $docs = row("SELECT SUM($least < ?) expired, SUM($least >= ? AND $least <= ?) expiring FROM tb_car WHERE status <> 3", [$today, $today, $soon]);
    $out = ['approve' => 0, 'return' => 0, 'expired' => (int)($docs['expired'] ?? 0), 'expiring' => (int)($docs['expiring'] ?? 0)];
    if (is_admin()) {
        $where = '1=1';
    } else {
        $departs = approver_departs((int)$u['id']);
        if (!$departs) return $out;
        $where = 'depart_id IN (' . implode(',', $departs) . ')';
    }
    $out['approve'] = (int)val("SELECT COUNT(*) FROM tb_booking WHERE $where AND status IN (0,1)");
    $out['return'] = (int)val("SELECT COUNT(*) FROM tb_booking WHERE $where AND status = 5");
    return $out;
}
