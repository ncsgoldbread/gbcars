<?php
declare(strict_types=1);

function dashboard(): array
{
    $u = require_login();
    $today = date('Y-m-d');
    $soon = date('Y-m-d', strtotime('+30 days'));
    $carStatus = [];
    foreach (rows('SELECT status, COUNT(*) n FROM tb_car GROUP BY status') as $r) $carStatus[(string)$r['status']] = (int)$r['n'];

    $expiring = rows("SELECT id, code, carno, model, date_e_code, date_e_cpi, date_e_insure FROM tb_car
        WHERE status <> 3 AND ((date_e_code IS NOT NULL AND date_e_code <= ?) OR (date_e_cpi IS NOT NULL AND date_e_cpi <= ?) OR (date_e_insure IS NOT NULL AND date_e_insure <= ?))
        ORDER BY LEAST(IFNULL(date_e_code,'9999-12-31'), IFNULL(date_e_cpi,'9999-12-31'), IFNULL(date_e_insure,'9999-12-31'))", [$soon, $soon, $soon]);
    $alerts = [];
    foreach ($expiring as $c) {
        foreach (['date_e_code' => 'ภาษี/ทะเบียน', 'date_e_cpi' => 'พ.ร.บ.', 'date_e_insure' => 'ประกันภัย'] as $k => $label) {
            if ($c[$k] && $c[$k] <= $soon) {
                $days = (int)floor((strtotime($c[$k]) - strtotime($today)) / 86400);
                $alerts[] = ['car_id' => $c['id'], 'car' => trim($c['code'] . ' ' . ($c['carno'] ? "({$c['carno']})" : '')), 'type' => $label, 'date' => $c[$k], 'days' => $days];
            }
        }
    }
    usort($alerts, fn($a, $b) => $a['days'] <=> $b['days']);

    $todayTrips = rows("SELECT b.id, b.docno, b.status, b.start_date, b.end_date, b.working, b.province, c.code AS car_code, b.person_name
        FROM tb_booking b LEFT JOIN tb_car c ON c.id = b.car_id
        WHERE b.status IN (0,1,2,5) AND b.start_date <= ? AND b.end_date >= ? ORDER BY b.start_date", [$today . ' 23:59:59', $today . ' 00:00:00']);

    $months = [];
    for ($i = 5; $i >= 0; $i--) {
        $m = date('Y-m', strtotime("first day of -$i month"));
        $months[$m] = ['month' => $m, 'bookings' => 0, 'trips' => 0];
    }
    $start = array_key_first($months) . '-01';
    foreach (rows("SELECT DATE_FORMAT(start_date, '%Y-%m') m, COUNT(*) n FROM tb_booking WHERE start_date >= ? AND status NOT IN (3,4) GROUP BY m", [$start]) as $r) {
        if (isset($months[$r['m']])) $months[$r['m']]['bookings'] = (int)$r['n'];
    }
    foreach (rows("SELECT DATE_FORMAT(start_date, '%Y-%m') m, COUNT(*) n FROM tb_carwork WHERE start_date >= ? GROUP BY m", [$start]) as $r) {
        if (isset($months[$r['m']])) $months[$r['m']]['trips'] = (int)$r['n'];
    }

    $mine = rows("SELECT b.id, b.docno, b.status, b.start_date, b.end_date, b.working, c.code AS car_code FROM tb_booking b
        LEFT JOIN tb_car c ON c.id = b.car_id WHERE b.user_save_id = ? ORDER BY b.id DESC LIMIT 5", [$u['id']]);
    foreach ($mine as &$m) $m['status_text'] = BOOKING_STATUS[(string)$m['status']] ?? '';
    foreach ($todayTrips as &$t) $t['status_text'] = BOOKING_STATUS[(string)$t['status']] ?? '';

    $inUse = (int)val("SELECT COUNT(DISTINCT car_id) FROM tb_booking WHERE status IN (2,5) AND start_date <= ? AND end_date >= ?", [now(), now()]);
    $week = rows("SELECT b.id, b.docno, b.status, b.start_date, b.end_date, b.working, c.code AS car_code, b.person_name
        FROM tb_booking b LEFT JOIN tb_car c ON c.id = b.car_id
        WHERE b.status IN (0,1,2) AND b.start_date > ? AND b.start_date <= ? ORDER BY b.start_date LIMIT 8", [$today . ' 23:59:59', date('Y-m-d', strtotime('+7 days')) . ' 23:59:59']);
    foreach ($week as &$w) $w['status_text'] = BOOKING_STATUS[(string)$w['status']] ?? '';
    return [
        'inUse' => $inUse,
        'week' => $week,
        'cars' => ['total' => array_sum($carStatus), 'status' => $carStatus],
        'drivers' => (int)val('SELECT COUNT(*) FROM tb_driver WHERE status = 0'),
        'counts' => booking_counts(),
        'alerts' => array_slice($alerts, 0, 50),
        'alertTotal' => count($alerts),
        'today' => $todayTrips,
        'months' => array_values($months),
        'mine' => $mine,
    ];
}

/* -------------------------------------------------------------------------- */

function report_defs(): array
{
    $groups = [
        'depart' => ['label' => 'แผนก', 'expr' => "CONCAT_WS(' ', dp.code, dp.name)"],
        'faculty' => ['label' => 'หน่วยงาน', 'expr' => "CONCAT_WS(' ', fc.code, fc.name)"],
        'car' => ['label' => 'ทะเบียนรถ', 'expr' => "CONCAT_WS(' ', c.code, IF(c.carno<>'', CONCAT('(', c.carno, ')'), NULL))"],
        'driver' => ['label' => 'พนักงานขับรถ', 'expr' => "CONCAT(IFNULL(d.firstname,'(ไม่ระบุ)'), ' ', IFNULL(d.surname,''))"],
        'month' => ['label' => 'เดือน', 'expr' => "DATE_FORMAT(%DATE%, '%Y-%m')"],
    ];
    return [
        'booking' => ['title' => 'รายงานการจองรถ', 'cat' => 'การจอง', 'filters' => ['date', 'car', 'depart', 'driver', 'status']],
        'booking_sum' => ['title' => 'สรุปการจองรถ', 'cat' => 'การจอง', 'filters' => ['date', 'group'], 'groups' => $groups],
        'carwork' => ['title' => 'รายงานการใช้รถ', 'cat' => 'การใช้รถ', 'filters' => ['date', 'car', 'depart', 'driver']],
        'carwork_sum' => ['title' => 'สรุปการใช้รถ (ระยะทาง/น้ำมัน/ค่าใช้จ่าย)', 'cat' => 'การใช้รถ', 'filters' => ['date', 'group'], 'groups' => $groups],
        'money' => ['title' => 'สรุปค่าใช้รถ (รายได้)', 'cat' => 'การเงิน', 'filters' => ['date', 'group'], 'groups' => $groups],
        'car' => ['title' => 'ทะเบียนรถทั้งหมด', 'cat' => 'รถ', 'filters' => ['carstatus']],
        'car_expire' => ['title' => 'รถที่เอกสารใกล้หมดอายุ / หมดอายุ', 'cat' => 'รถ', 'filters' => ['days']],
        'carfix' => ['title' => 'รายงานการซ่อมบำรุง', 'cat' => 'รถ', 'filters' => ['date', 'car']],
        'insurance' => ['title' => 'รายงานการชำระเบี้ยประกันภัย', 'cat' => 'รถ', 'filters' => ['date', 'car']],
        'tabian' => ['title' => 'รายงานการต่อทะเบียน', 'cat' => 'รถ', 'filters' => ['date', 'car']],
        'plb' => ['title' => 'รายงานการต่อ พ.ร.บ.', 'cat' => 'รถ', 'filters' => ['date', 'car']],
        'payleasing' => ['title' => 'รายงานการชำระค่างวด', 'cat' => 'รถ', 'filters' => ['date', 'car']],
    ];
}

function report_run(string $name): array
{
    require_login();
    $defs = report_defs();
    $def = $defs[$name] ?? null;
    if (!$def) throw new HttpError(404, 'ไม่พบรายงาน');
    $from = $_GET['from'] ?? date('Y-m-01');
    $to = $_GET['to'] ?? date('Y-m-d');
    foreach ([$from, $to] as $d) if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) throw new HttpError(422, 'วันที่ไม่ถูกต้อง');
    $w = [];
    $p = [];
    $opt = function (string $col, string $key) use (&$w, &$p) {
        if (isset($_GET[$key]) && $_GET[$key] !== '') { $w[] = "$col = ?"; $p[] = $_GET[$key]; }
    };
    $groupKey = $_GET['group'] ?? 'depart';
    $group = $def['groups'][$groupKey] ?? null;
    if (isset($def['groups']) && !$group) throw new HttpError(422, 'การจัดกลุ่มไม่ถูกต้อง');
    $docJoin = 'LEFT JOIN tb_car c ON c.id = t.car_id';
    $out = ['title' => $def['title'], 'from' => $from, 'to' => $to];

    switch ($name) {
        case 'booking':
            $w[] = 't.start_date BETWEEN ? AND ?'; array_push($p, "$from 00:00:00", "$to 23:59:59");
            $opt('t.car_id', 'car_id'); $opt('t.depart_id', 'depart_id'); $opt('t.driver_id', 'driver_id'); $opt('t.status', 'status');
            $data = rows("SELECT t.docno, t.start_date, t.end_date, CONCAT_WS(' ', c.code, c.carno) car, t.working, t.province,
                CONCAT_WS(' ', dp.name) depart, t.person_name, CONCAT(IFNULL(d.firstname,''), ' ', IFNULL(d.surname,'')) driver, t.status, t.car_money
                FROM tb_booking t LEFT JOIN tb_car c ON c.id = t.car_id LEFT JOIN tb_depart dp ON dp.id = t.depart_id LEFT JOIN tb_driver d ON d.id = t.driver_id
                WHERE " . implode(' AND ', $w) . ' ORDER BY t.start_date', $p);
            foreach ($data as &$r) $r['status'] = BOOKING_STATUS[(string)$r['status']] ?? '';
            $out['columns'] = [['docno', 'เลขที่'], ['start_date', 'เริ่ม', 'datetime'], ['end_date', 'สิ้นสุด', 'datetime'], ['car', 'รถ'], ['working', 'ภารกิจ'],
                ['province', 'จังหวัด'], ['depart', 'แผนก'], ['person_name', 'ผู้ขอ'], ['driver', 'คนขับ'], ['status', 'สถานะ'], ['car_money', 'ค่าใช้รถ', 'money']];
            $out['rows'] = $data;
            $out['sum'] = ['car_money'];
            break;

        case 'booking_sum':
        case 'money':
            $expr = "COALESCE(NULLIF(" . str_replace('%DATE%', 't.start_date', $group['expr']) . ", ''), '(ไม่ระบุ)')";
            $data = rows("SELECT $expr AS grp, COUNT(*) AS n, SUM(TIMESTAMPDIFF(MINUTE, t.start_date, t.end_date)) / 60 AS hours,
                SUM(IFNULL(t.car_money,0)) AS money, SUM(IFNULL(t.discount,0)) AS discount, SUM(IFNULL(t.damage,0)) AS damage,
                SUM(IFNULL(t.car_money,0) - IFNULL(t.discount,0) + IFNULL(t.damage,0)) AS net
                FROM tb_booking t LEFT JOIN tb_car c ON c.id = t.car_id LEFT JOIN tb_depart dp ON dp.id = t.depart_id
                LEFT JOIN tb_faculty fc ON fc.id = dp.faculty_id LEFT JOIN tb_driver d ON d.id = t.driver_id
                WHERE t.status NOT IN (3,4) AND t.start_date BETWEEN ? AND ? GROUP BY grp ORDER BY grp", ["$from 00:00:00", "$to 23:59:59"]);
            $out['columns'] = $name === 'money'
                ? [['grp', $group['label']], ['n', 'จำนวนครั้ง', 'int'], ['money', 'ค่าใช้รถ', 'money'], ['discount', 'ส่วนลด', 'money'], ['damage', 'ค่าเสียหาย', 'money'], ['net', 'สุทธิ', 'money']]
                : [['grp', $group['label']], ['n', 'จำนวนครั้ง', 'int'], ['hours', 'ชั่วโมงรวม', 'number'], ['money', 'ค่าใช้รถ', 'money']];
            $out['rows'] = $data;
            $out['sum'] = ['n', 'hours', 'money', 'discount', 'damage', 'net'];
            $out['chart'] = ['label' => 'grp', 'value' => $name === 'money' ? 'net' : 'n'];
            break;

        case 'carwork':
            $w[] = 't.start_date BETWEEN ? AND ?'; array_push($p, $from, $to);
            $opt('t.car_id', 'car_id'); $opt('t.depart_id', 'depart_id'); $opt('t.driver_id', 'driver_id');
            $out['rows'] = rows("SELECT t.docno, t.start_date, CONCAT_WS(' ', c.code, c.carno) car, t.working, t.province, dp.name depart,
                CONCAT(IFNULL(d.firstname,''), ' ', IFNULL(d.surname,'')) driver, t.start_km, t.end_km,
                GREATEST(IFNULL(t.end_km,0) - IFNULL(t.start_km,0), 0) km, t.amount_oil, IFNULL(t.amount_oil,0) * IFNULL(t.oil_rate,0) oil_cost, t.pay_outcome, t.pay_income
                FROM tb_carwork t LEFT JOIN tb_car c ON c.id = t.car_id LEFT JOIN tb_depart dp ON dp.id = t.depart_id LEFT JOIN tb_driver d ON d.id = t.driver_id
                WHERE " . implode(' AND ', $w) . ' ORDER BY t.start_date, t.id', $p);
            $out['columns'] = [['docno', 'เลขที่'], ['start_date', 'วันที่', 'date'], ['car', 'รถ'], ['working', 'ภารกิจ'], ['province', 'จังหวัด'], ['depart', 'แผนก'],
                ['driver', 'คนขับ'], ['km', 'ระยะทาง (กม.)', 'int'], ['amount_oil', 'น้ำมัน (ลิตร)', 'number'], ['oil_cost', 'ค่าน้ำมัน', 'money'], ['pay_outcome', 'ค่าใช้จ่าย', 'money'], ['pay_income', 'รายรับ', 'money']];
            $out['sum'] = ['km', 'amount_oil', 'oil_cost', 'pay_outcome', 'pay_income'];
            break;

        case 'carwork_sum':
            $expr = "COALESCE(NULLIF(" . str_replace('%DATE%', 't.start_date', $group['expr']) . ", ''), '(ไม่ระบุ)')";
            $out['rows'] = rows("SELECT $expr AS grp, COUNT(*) n, SUM(GREATEST(IFNULL(t.end_km,0) - IFNULL(t.start_km,0), 0)) km,
                SUM(IFNULL(t.amount_oil,0)) oil, SUM(IFNULL(t.amount_oil,0) * IFNULL(t.oil_rate,0)) oil_cost,
                SUM(IFNULL(t.pay_outcome,0)) outcome, SUM(IFNULL(t.pay_income,0)) income, SUM(IFNULL(t.car_money,0)) money
                FROM tb_carwork t LEFT JOIN tb_car c ON c.id = t.car_id LEFT JOIN tb_depart dp ON dp.id = t.depart_id
                LEFT JOIN tb_faculty fc ON fc.id = dp.faculty_id LEFT JOIN tb_driver d ON d.id = t.driver_id
                WHERE t.start_date BETWEEN ? AND ? GROUP BY grp ORDER BY grp", [$from, $to]);
            $out['columns'] = [['grp', $group['label']], ['n', 'จำนวนเที่ยว', 'int'], ['km', 'ระยะทาง (กม.)', 'int'], ['oil', 'น้ำมัน (ลิตร)', 'number'],
                ['oil_cost', 'ค่าน้ำมัน', 'money'], ['outcome', 'ค่าใช้จ่าย', 'money'], ['income', 'รายรับ', 'money'], ['money', 'ค่าใช้รถ', 'money']];
            $out['sum'] = ['n', 'km', 'oil', 'oil_cost', 'outcome', 'income', 'money'];
            $out['chart'] = ['label' => 'grp', 'value' => 'km'];
            break;

        case 'car':
            $opt('c.status', 'carstatus');
            $data = rows("SELECT c.code, c.carno, ct.name cartype, br.name brand, c.model, c.color, c.seats, c.status, c.date_e_code, c.date_e_cpi, c.date_e_insure
                FROM tb_car c LEFT JOIN tb_cartype ct ON ct.id = c.cartype_id LEFT JOIN tb_brand br ON br.id = c.brand_id"
                . ($w ? ' WHERE ' . implode(' AND ', $w) : '') . ' ORDER BY c.code', $p);
            foreach ($data as &$r) $r['status'] = CAR_STATUS[(string)$r['status']] ?? '';
            $out['columns'] = [['code', 'ทะเบียน'], ['carno', 'รหัสรถ'], ['cartype', 'ประเภท'], ['brand', 'ยี่ห้อ'], ['model', 'รุ่น'], ['color', 'สี'], ['seats', 'ที่นั่ง', 'int'],
                ['status', 'สถานะ'], ['date_e_code', 'ภาษีหมดอายุ', 'date'], ['date_e_cpi', 'พ.ร.บ.หมดอายุ', 'date'], ['date_e_insure', 'ประกันหมดอายุ', 'date']];
            $out['rows'] = $data;
            $out['from'] = $out['to'] = null;
            break;

        case 'car_expire':
            $days = max(0, min(365, (int)($_GET['days'] ?? 30)));
            $lim = date('Y-m-d', strtotime("+$days days"));
            $out['rows'] = rows("SELECT c.code, c.carno, c.model, c.date_e_code, c.date_e_cpi, c.date_e_insure,
                DATEDIFF(LEAST(IFNULL(c.date_e_code,'9999-12-31'), IFNULL(c.date_e_cpi,'9999-12-31'), IFNULL(c.date_e_insure,'9999-12-31')), CURDATE()) AS days_left
                FROM tb_car c WHERE c.status <> 3 AND (c.date_e_code <= ? OR c.date_e_cpi <= ? OR c.date_e_insure <= ?) ORDER BY days_left", [$lim, $lim, $lim]);
            $out['columns'] = [['code', 'ทะเบียน'], ['carno', 'รหัสรถ'], ['model', 'รุ่น'], ['date_e_code', 'ภาษีหมดอายุ', 'date'], ['date_e_cpi', 'พ.ร.บ.หมดอายุ', 'date'],
                ['date_e_insure', 'ประกันหมดอายุ', 'date'], ['days_left', 'เหลือ (วัน)', 'int']];
            $out['from'] = $out['to'] = null;
            $out['subtitle'] = "ภายใน $days วัน (รวมที่หมดอายุแล้ว)";
            break;

        case 'carfix':
            $w[] = 't.datefix BETWEEN ? AND ?'; array_push($p, $from, $to); $opt('t.car_id', 'car_id');
            $out['rows'] = rows("SELECT t.docno, t.datefix, CONCAT_WS(' ', c.code, c.carno) car, g.name garage, t.km, t.datecomplete, t.comment,
                (SELECT SUM(IFNULL(s.qty,0) * IFNULL(s.price,0)) FROM tb_carfix_sub s WHERE s.carfix_id = t.id) total
                FROM tb_carfix t $docJoin LEFT JOIN tb_garage g ON g.id = t.garage_id WHERE " . implode(' AND ', $w) . ' ORDER BY t.datefix', $p);
            $out['columns'] = [['docno', 'เลขที่'], ['datefix', 'วันที่แจ้ง', 'date'], ['car', 'รถ'], ['garage', 'อู่'], ['km', 'เลขไมล์', 'int'],
                ['datecomplete', 'ซ่อมเสร็จ', 'date'], ['comment', 'อาการ'], ['total', 'ค่าซ่อม', 'money']];
            $out['sum'] = ['total'];
            break;

        case 'insurance':
            $w[] = 't.docdate BETWEEN ? AND ?'; array_push($p, $from, $to); $opt('t.car_id', 'car_id');
            $out['rows'] = rows("SELECT t.docno, t.docdate, CONCAT_WS(' ', c.code, c.carno) car, i.name insurer, t.insurance_no, t.insurance_type, t.datef, t.datee, t.price, t.amount
                FROM tb_insurance t $docJoin LEFT JOIN tb_insurer i ON i.id = t.insurer_id WHERE " . implode(' AND ', $w) . ' ORDER BY t.docdate', $p);
            $out['columns'] = [['docno', 'เลขที่'], ['docdate', 'วันที่', 'date'], ['car', 'รถ'], ['insurer', 'บริษัทประกัน'], ['insurance_no', 'กรมธรรม์'], ['insurance_type', 'ประเภท'],
                ['datef', 'เริ่ม', 'date'], ['datee', 'สิ้นสุด', 'date'], ['price', 'เบี้ยสุทธิ', 'money'], ['amount', 'วงเงินคุ้มครอง', 'money']];
            $out['sum'] = ['price'];
            break;

        case 'tabian':
        case 'plb':
            $w[] = 't.docdate BETWEEN ? AND ?'; array_push($p, $from, $to); $opt('t.car_id', 'car_id');
            $extra = $name === 'tabian' ? ', t.price_other' : '';
            $out['rows'] = rows("SELECT t.docno, t.docdate, CONCAT_WS(' ', c.code, c.carno) car, t.datef, t.datee, t.price$extra, t.person_name
                FROM tb_$name t $docJoin WHERE " . implode(' AND ', $w) . ' ORDER BY t.docdate', $p);
            $out['columns'] = [['docno', 'เลขที่'], ['docdate', 'วันที่', 'date'], ['car', 'รถ'], ['datef', 'เริ่ม', 'date'], ['datee', 'หมดอายุ', 'date'], ['price', 'จำนวนเงิน', 'money']];
            if ($name === 'tabian') $out['columns'][] = ['price_other', 'ค่าใช้จ่ายอื่น', 'money'];
            $out['columns'][] = ['person_name', 'ผู้ดำเนินการ'];
            $out['sum'] = ['price', 'price_other'];
            break;

        case 'payleasing':
            $w[] = 't.datef BETWEEN ? AND ?'; array_push($p, $from, $to); $opt('t.car_id', 'car_id');
            $out['rows'] = rows("SELECT t.docno, t.datef, CONCAT_WS(' ', c.code, c.carno) car, l.name leasing, t.doc_leasing, t.no, t.price
                FROM tb_payleasing t $docJoin LEFT JOIN tb_leasing l ON l.id = t.leasing_id WHERE " . implode(' AND ', $w) . ' ORDER BY t.datef', $p);
            $out['columns'] = [['docno', 'เลขที่'], ['datef', 'วันที่นำจ่าย', 'date'], ['car', 'รถ'], ['leasing', 'บริษัทสินเชื่อ'], ['doc_leasing', 'เลขที่สัญญา'], ['no', 'งวดที่', 'int'], ['price', 'จำนวนเงิน', 'money']];
            $out['sum'] = ['price'];
            break;
    }
    $out['columns'] = array_map(fn($c) => ['key' => $c[0], 'label' => $c[1], 'type' => $c[2] ?? 'text'], $out['columns']);
    $keys = array_column($out['columns'], 'key');
    $out['sum'] = array_values(array_intersect($out['sum'] ?? [], $keys));
    return $out;
}

function report_csv(string $name): never
{
    $r = report_run($name);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="report-' . $name . '-' . date('Ymd') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel shows Thai correctly
    fputcsv($out, [$r['title'] . ($r['from'] ? " {$r['from']} - {$r['to']}" : '')]);
    fputcsv($out, array_column($r['columns'], 'label'));
    foreach ($r['rows'] as $row) {
        fputcsv($out, array_map(fn($c) => $row[$c['key']] ?? '', $r['columns']));
    }
    fclose($out);
    exit;
}
