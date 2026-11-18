<?php
declare(strict_types=1);

/*
 * Single source of truth for every data table: the API uses it for validation / SQL,
 * and the frontend receives it from GET /api/meta to build lists and forms.
 *
 * field keys: name, label, type (text|textarea|number|money|date|time|datetime|select|lookup|image|password|email|tel)
 *             options (for select), lookup (lookup name), required, list (show in table), col (1-4 grid width),
 *             hidden (not in form), readonly, help
 */

const CAR_STATUS = ['0' => 'ปกติ', '1' => 'ซ่อมแซม', '2' => 'งดให้บริการชั่วคราว', '3' => 'ยกเลิกใช้'];
const BOOKING_STATUS = [
    '9' => 'อยู่ระหว่างทำรายการจอง', '0' => 'รออนุมัติ', '1' => 'เปิดอ่านแล้ว', '2' => 'อนุมัติ',
    '3' => 'ไม่อนุมัติ', '4' => 'ยกเลิก', '5' => 'ส่งคืนรถแล้ว', '6' => 'รับคืนรถแล้ว',
];

function lookups(): array
{
    return [
        'faculty'  => ['table' => 'tb_faculty', 'text' => "CONCAT_WS(' ', t.code, t.name)", 'order' => 't.code'],
        'depart'   => ['table' => 'tb_depart', 'text' => "CONCAT_WS(' ', t.code, t.name)", 'order' => 't.code'],
        'province' => ['table' => 'tb_province', 'value' => 'code', 'text' => 't.name', 'order' => 't.name'],
        'brand'    => ['table' => 'tb_brand', 'text' => 't.name', 'order' => 't.name'],
        'cartype'  => ['table' => 'tb_cartype', 'text' => 't.name', 'order' => 't.name'],
        'oil'      => ['table' => 'tb_oil', 'text' => 't.name', 'order' => 't.name'],
        'insurer'  => ['table' => 'tb_insurer', 'text' => 't.name', 'order' => 't.name'],
        'leasing'  => ['table' => 'tb_leasing', 'text' => 't.name', 'order' => 't.name'],
        'garage'   => ['table' => 'tb_garage', 'text' => 't.name', 'order' => 't.name'],
        'car'      => ['table' => 'tb_car', 'text' => "CONCAT_WS(' ', t.code, IF(t.carno<>'', CONCAT('(', t.carno, ')'), NULL), t.model)", 'order' => 't.code'],
        'driver'   => ['table' => 'tb_driver', 'text' => "CONCAT(IFNULL(t.title,''), t.firstname, ' ', IFNULL(t.surname,''), IF(IFNULL(t.nickname,'')<>'', CONCAT(' (', t.nickname, ')'), ''))", 'order' => 't.firstname'],
        'user'     => ['table' => 'tb_user', 'text' => "CONCAT(IFNULL(t.title,''), t.firstname, ' ', IFNULL(t.surname,''))", 'order' => 't.firstname'],
    ];
}

function F(string $name, string $label, string $type = 'text', array $extra = []): array
{
    return ['name' => $name, 'label' => $label, 'type' => $type] + $extra;
}

function resources(): array
{
    $simpleName = fn(string $label) => [F('name', $label, 'text', ['required' => true, 'list' => true, 'col' => 4])];
    $company = [
        F('name', 'ชื่อบริษัท', 'text', ['required' => true, 'list' => true, 'col' => 4]),
        F('address', 'ที่อยู่', 'textarea', ['col' => 4]),
        F('tel', 'โทรศัพท์', 'tel', ['list' => true, 'col' => 2]),
        F('fax', 'แฟกซ์', 'tel', ['col' => 2]),
    ];
    $docFields = fn(string $table) => [
        F('docno', 'เลขที่เอกสาร', 'text', ['list' => true, 'readonly' => true, 'col' => 1, 'help' => 'สร้างอัตโนมัติ']),
        F('docdate', 'วันที่เอกสาร', 'date', ['list' => true, 'required' => true, 'col' => 1, 'default' => 'today']),
        F('car_id', 'รถ', 'lookup', ['lookup' => 'car', 'required' => true, 'list' => true, 'col' => 2]),
    ];
    $audit = [
        F('person_name', 'ผู้ดำเนินการ', 'text', ['col' => 2]),
        F('comment', 'หมายเหตุ', 'textarea', ['col' => 4]),
    ];

    return [
        /* ---------- master data ---------- */
        'faculty' => ['table' => 'tb_faculty', 'title' => 'หน่วยงาน', 'icon' => 'building', 'group' => 'master', 'search' => ['code', 'name'],
            'fields' => [F('code', 'รหัส', 'text', ['list' => true, 'col' => 1]), F('name', 'ชื่อหน่วยงาน', 'text', ['required' => true, 'list' => true, 'col' => 3])]],
        'depart' => ['table' => 'tb_depart', 'title' => 'แผนก', 'icon' => 'sitemap', 'group' => 'master', 'search' => ['code', 'name'],
            'fields' => [
                F('faculty_id', 'หน่วยงาน', 'lookup', ['lookup' => 'faculty', 'list' => true, 'col' => 4]),
                F('code', 'รหัส', 'text', ['list' => true, 'col' => 1]),
                F('name', 'ชื่อแผนก', 'text', ['required' => true, 'list' => true, 'col' => 3]),
            ]],
        'oil' => ['table' => 'tb_oil', 'title' => 'ประเภทน้ำมัน', 'icon' => 'fuel', 'group' => 'master', 'search' => ['name'],
            'fields' => [F('name', 'ชื่อ', 'text', ['required' => true, 'list' => true, 'col' => 3]), F('price', 'ราคา/ลิตร', 'money', ['list' => true, 'col' => 1])]],
        'cartype' => ['table' => 'tb_cartype', 'title' => 'ประเภทรถ', 'icon' => 'tag', 'group' => 'master', 'search' => ['name'], 'fields' => $simpleName('ประเภทรถ')],
        'brand' => ['table' => 'tb_brand', 'title' => 'ยี่ห้อรถ', 'icon' => 'tag', 'group' => 'master', 'search' => ['name'], 'fields' => $simpleName('ยี่ห้อรถ')],
        'insurer' => ['table' => 'tb_insurer', 'title' => 'บริษัทประกันภัย', 'icon' => 'shield', 'group' => 'master', 'search' => ['name', 'tel'], 'fields' => $company],
        'leasing' => ['table' => 'tb_leasing', 'title' => 'บริษัทสินเชื่อ', 'icon' => 'bank', 'group' => 'master', 'search' => ['name', 'tel'], 'fields' => $company],
        'garage' => ['table' => 'tb_garage', 'title' => 'อู่ซ่อมรถ', 'icon' => 'wrench', 'group' => 'master', 'search' => ['name', 'tel'],
            'fields' => array_merge([F('garage_type', 'ประเภทอู่', 'select', ['options' => ['0' => 'อู่ภายนอก', '1' => 'อู่ภายใน'], 'list' => true, 'col' => 1])], [
                F('name', 'ชื่ออู่', 'text', ['required' => true, 'list' => true, 'col' => 3]),
                F('address', 'ที่อยู่', 'textarea', ['col' => 4]),
                F('tel', 'โทรศัพท์', 'tel', ['list' => true, 'col' => 2]),
                F('fax', 'แฟกซ์', 'tel', ['col' => 2]),
                F('comment', 'หมายเหตุ', 'textarea', ['col' => 4]),
            ])],
        'province' => ['table' => 'tb_province', 'title' => 'จังหวัด', 'icon' => 'map', 'group' => 'master', 'search' => ['code', 'name'],
            'fields' => [F('code', 'รหัส', 'text', ['list' => true, 'col' => 1]), F('name', 'ชื่อจังหวัด', 'text', ['required' => true, 'list' => true, 'col' => 3])]],

        /* ---------- cars ---------- */
        'car' => ['table' => 'tb_car', 'title' => 'ข้อมูลรถ', 'icon' => 'car', 'group' => 'car', 'search' => ['code', 'carno', 'model', 'color', 'machine_no', 'machine_tank'],
            'order' => 't.code', 'readAll' => true, 'images' => ['picture1', 'picture2', 'picture3', 'picture4', 'picture5'], 'uploadType' => 'car',
            'fields' => [
                F('code', 'ทะเบียนรถ', 'text', ['required' => true, 'list' => true, 'col' => 1]),
                F('prov_code', 'จังหวัด', 'lookup', ['lookup' => 'province', 'list' => true, 'col' => 1]),
                F('carno', 'รหัสรถ', 'text', ['list' => true, 'col' => 1]),
                F('status', 'สถานะ', 'select', ['options' => CAR_STATUS, 'list' => true, 'col' => 1]),
                F('cartype_id', 'ประเภทรถ', 'lookup', ['lookup' => 'cartype', 'list' => true, 'col' => 1]),
                F('brand_id', 'ยี่ห้อ', 'lookup', ['lookup' => 'brand', 'list' => true, 'col' => 1]),
                F('model', 'รุ่น', 'text', ['list' => true, 'col' => 1]),
                F('color', 'สี', 'text', ['col' => 1]),
                F('oil_id', 'น้ำมันเชื้อเพลิง', 'lookup', ['lookup' => 'oil', 'col' => 1]),
                F('power', 'กำลัง/ซีซี', 'text', ['col' => 1]),
                F('seats', 'จำนวนที่นั่ง', 'number', ['col' => 1]),
                F('rate', 'อัตราค่าใช้รถ (บาท/นาที)', 'money', ['col' => 1]),
                F('machine_no', 'เลขเครื่องยนต์', 'text', ['col' => 2]),
                F('machine_tank', 'เลขตัวถัง', 'text', ['col' => 2]),
                F('price', 'ราคารถ', 'money', ['col' => 1]),
                F('date_buy', 'วันที่ซื้อ', 'date', ['col' => 1]),
                F('date_in', 'วันที่รับรถ', 'date', ['col' => 1]),
                F('insurer_id', 'บริษัทประกันภัย', 'lookup', ['lookup' => 'insurer', 'col' => 1]),
                F('date_f_code', 'ทะเบียน เริ่ม', 'date', ['col' => 1, 'section' => 'วันหมดอายุเอกสาร']),
                F('date_e_code', 'ทะเบียน หมดอายุ', 'date', ['col' => 1, 'list' => true]),
                F('date_f_cpi', 'พ.ร.บ. เริ่ม', 'date', ['col' => 1]),
                F('date_e_cpi', 'พ.ร.บ. หมดอายุ', 'date', ['col' => 1, 'list' => true]),
                F('date_f_insure', 'ประกันภัย เริ่ม', 'date', ['col' => 1]),
                F('date_e_insure', 'ประกันภัย หมดอายุ', 'date', ['col' => 1, 'list' => true]),
                F('comment', 'หมายเหตุ', 'textarea', ['col' => 4]),
            ]],
        'insurance' => ['table' => 'tb_insurance', 'title' => 'ชำระเบี้ยประกันภัย', 'icon' => 'shield', 'group' => 'car', 'docno' => true, 'search' => ['docno', 'insurance_no'],
            'syncCar' => ['date_f_insure' => 'datef', 'date_e_insure' => 'datee', 'insurer_id' => 'insurer_id'],
            'fields' => array_merge($docFields('tb_insurance'), [
                F('insurer_id', 'บริษัทประกันภัย', 'lookup', ['lookup' => 'insurer', 'list' => true, 'col' => 2]),
                F('insurance_no', 'เลขกรมธรรม์', 'text', ['col' => 1]),
                F('insurance_type', 'ประเภทประกัน', 'text', ['col' => 1, 'help' => 'เช่น ชั้น 1, 2+, 3']),
                F('datef', 'วันเริ่มคุ้มครอง', 'date', ['required' => true, 'col' => 1]),
                F('datee', 'วันสิ้นสุด', 'date', ['required' => true, 'list' => true, 'col' => 1]),
                F('price', 'เบี้ยสุทธิ', 'money', ['list' => true, 'col' => 1]),
                F('amount', 'วงเงินคุ้มครอง', 'money', ['col' => 1]),
            ], $audit)],
        'tabian' => ['table' => 'tb_tabian', 'title' => 'ต่อทะเบียน', 'icon' => 'doc', 'group' => 'car', 'docno' => true, 'search' => ['docno'],
            'syncCar' => ['date_f_code' => 'datef', 'date_e_code' => 'datee'],
            'fields' => array_merge($docFields('tb_tabian'), [
                F('datef', 'วันเริ่ม', 'date', ['required' => true, 'col' => 1]),
                F('datee', 'วันหมดอายุ', 'date', ['required' => true, 'list' => true, 'col' => 1]),
                F('price', 'ค่าภาษี', 'money', ['list' => true, 'col' => 1]),
                F('price_other', 'ค่าใช้จ่ายอื่น', 'money', ['col' => 1]),
            ], $audit)],
        'plb' => ['table' => 'tb_plb', 'title' => 'ต่อ พ.ร.บ.', 'icon' => 'doc', 'group' => 'car', 'docno' => true, 'search' => ['docno'],
            'syncCar' => ['date_f_cpi' => 'datef', 'date_e_cpi' => 'datee'],
            'fields' => array_merge($docFields('tb_plb'), [
                F('datef', 'วันเริ่ม', 'date', ['required' => true, 'col' => 1]),
                F('datee', 'วันหมดอายุ', 'date', ['required' => true, 'list' => true, 'col' => 1]),
                F('price', 'ค่า พ.ร.บ.', 'money', ['list' => true, 'col' => 2]),
            ], $audit)],
        'payleasing' => ['table' => 'tb_payleasing', 'title' => 'ชำระค่างวด', 'icon' => 'bank', 'group' => 'car', 'docno' => true, 'search' => ['docno', 'doc_leasing', 'docref'],
            'fields' => array_merge($docFields('tb_payleasing'), [
                F('leasing_id', 'บริษัทสินเชื่อ', 'lookup', ['lookup' => 'leasing', 'list' => true, 'col' => 2]),
                F('doc_leasing', 'เลขที่สัญญา', 'text', ['col' => 1]),
                F('docref', 'เลขที่ใบเสร็จ', 'text', ['col' => 1]),
                F('datef', 'วันที่นำจ่าย', 'date', ['list' => true, 'required' => true, 'col' => 1]),
                F('no', 'งวดที่', 'number', ['list' => true, 'col' => 1]),
                F('price', 'จำนวนเงิน', 'money', ['list' => true, 'col' => 2]),
            ], $audit)],
        'carfix' => ['table' => 'tb_carfix', 'title' => 'ซ่อมบำรุง', 'icon' => 'wrench', 'group' => 'car', 'docno' => true, 'search' => ['docno', 'docref', 'person_name'],
            'children' => ['table' => 'tb_carfix_sub', 'fk' => 'carfix_id', 'title' => 'รายการซ่อม', 'fields' => [
                F('item', 'รายการ', 'text', ['required' => true]), F('unitname', 'หน่วย', 'text'),
                F('qty', 'จำนวน', 'number'), F('price', 'ราคา/หน่วย', 'money'), F('comment', 'หมายเหตุ', 'text'),
            ]],
            'fields' => [
                F('docno', 'เลขที่เอกสาร', 'text', ['list' => true, 'readonly' => true, 'col' => 1, 'help' => 'สร้างอัตโนมัติ']),
                F('datefix', 'วันที่แจ้งซ่อม', 'date', ['list' => true, 'required' => true, 'col' => 1, 'default' => 'today']),
                F('car_id', 'รถ', 'lookup', ['lookup' => 'car', 'required' => true, 'list' => true, 'col' => 2]),
                F('garage_id', 'อู่ซ่อม', 'lookup', ['lookup' => 'garage', 'list' => true, 'col' => 2]),
                F('docref', 'เลขที่อ้างอิง', 'text', ['col' => 1]),
                F('km', 'เลขไมล์', 'number', ['col' => 1]),
                F('dateprocess', 'วันที่เข้าซ่อม', 'date', ['col' => 1]),
                F('datecomplete', 'วันที่ซ่อมเสร็จ', 'date', ['list' => true, 'col' => 1]),
                F('depart_id', 'แผนก', 'lookup', ['lookup' => 'depart', 'col' => 2]),
                F('person_name', 'ผู้แจ้งซ่อม', 'text', ['col' => 2]),
                F('comment', 'อาการ/หมายเหตุ', 'textarea', ['col' => 4]),
            ]],

        /* ---------- daily ---------- */
        'carwork' => ['table' => 'tb_carwork', 'title' => 'บันทึกการใช้รถ', 'icon' => 'route', 'group' => 'daily', 'docno' => true, 'readAll' => true, 'userWrite' => true,
            'search' => ['docno', 'working', 'person_name', 'province'], 'order' => 't.start_date DESC, t.id DESC',
            'fields' => [
                F('docno', 'เลขที่เอกสาร', 'text', ['list' => true, 'readonly' => true, 'col' => 1, 'help' => 'สร้างอัตโนมัติ']),
                F('docdate', 'วันที่เอกสาร', 'date', ['required' => true, 'col' => 1, 'default' => 'today']),
                F('car_id', 'รถ', 'lookup', ['lookup' => 'car', 'required' => true, 'list' => true, 'col' => 2]),
                F('booking_id', 'อ้างอิงใบจอง', 'number', ['hidden' => true]),
                F('working', 'ภารกิจ', 'text', ['required' => true, 'list' => true, 'col' => 4]),
                F('start_date', 'วันที่ออก', 'date', ['required' => true, 'list' => true, 'col' => 1]),
                F('start_time', 'เวลาออก', 'time', ['col' => 1]),
                F('end_date', 'วันที่กลับ', 'date', ['col' => 1]),
                F('end_time', 'เวลากลับ', 'time', ['col' => 1]),
                F('start_km', 'เลขไมล์ออก', 'number', ['col' => 1]),
                F('end_km', 'เลขไมล์กลับ', 'number', ['col' => 1]),
                F('driver_id', 'พนักงานขับรถ', 'lookup', ['lookup' => 'driver', 'list' => true, 'col' => 2]),
                F('depart_id', 'แผนก', 'lookup', ['lookup' => 'depart', 'list' => true, 'col' => 2]),
                F('person_name', 'ผู้ขอใช้รถ', 'text', ['col' => 1]),
                F('tel', 'โทรศัพท์', 'tel', ['col' => 1]),
                F('address', 'สถานที่', 'text', ['col' => 2]),
                F('province', 'จังหวัด', 'text', ['col' => 1]),
                F('passenger_amount', 'จำนวนผู้โดยสาร', 'number', ['col' => 1]),
                F('passenger_name', 'รายชื่อผู้โดยสาร', 'text', ['col' => 3]),
                F('docref', 'เลขที่อ้างอิง/ใบจอง', 'text', ['col' => 1]),
                F('amount_oil', 'เติมน้ำมัน (ลิตร)', 'number', ['col' => 1, 'section' => 'ค่าใช้จ่าย']),
                F('oil_rate', 'ราคาน้ำมัน/ลิตร', 'money', ['col' => 1]),
                F('pay_outcome', 'ค่าใช้จ่าย', 'money', ['col' => 1]),
                F('pay_income', 'รายรับ', 'money', ['col' => 1]),
                F('outcome_comment', 'รายละเอียดค่าใช้จ่าย', 'textarea', ['col' => 2]),
                F('income_comment', 'รายละเอียดรายรับ', 'textarea', ['col' => 2]),
                F('car_rate', 'อัตราค่าใช้รถ (บาท/นาที)', 'money', ['col' => 1]),
                F('car_money', 'ค่าใช้รถ', 'money', ['col' => 1]),
                F('discount', 'ส่วนลด', 'money', ['col' => 2]),
                F('work_comment', 'หมายเหตุ', 'textarea', ['col' => 4]),
            ]],

        /* ---------- people ---------- */
        'driver' => ['table' => 'tb_driver', 'title' => 'พนักงานขับรถ', 'icon' => 'steering', 'group' => 'people', 'search' => ['code', 'firstname', 'surname', 'nickname', 'tel'],
            'images' => ['picture1'], 'uploadType' => 'driver',
            'fields' => [
                F('code', 'รหัส', 'text', ['list' => true, 'col' => 1]),
                F('title', 'คำนำหน้า', 'text', ['col' => 1]),
                F('firstname', 'ชื่อ', 'text', ['required' => true, 'list' => true, 'col' => 1]),
                F('surname', 'นามสกุล', 'text', ['list' => true, 'col' => 1]),
                F('nickname', 'ชื่อเล่น', 'text', ['list' => true, 'col' => 1]),
                F('tel', 'โทรศัพท์', 'tel', ['list' => true, 'col' => 1]),
                F('idcard', 'เลขบัตรประชาชน', 'text', ['col' => 2]),
                F('datef', 'วันที่ใบขับขี่', 'date', ['col' => 1]),
                F('datet', 'ใบขับขี่หมดอายุ', 'date', ['list' => true, 'col' => 1]),
                F('status', 'สถานะ', 'select', ['options' => ['0' => 'ปกติ', '1' => 'ห้ามขับรถ'], 'list' => true, 'col' => 2]),
                F('comment', 'หมายเหตุ', 'textarea', ['col' => 4]),
            ]],
        'user' => ['table' => 'tb_user', 'title' => 'ผู้ใช้งาน', 'icon' => 'users', 'group' => 'people', 'search' => ['code', 'firstname', 'surname', 'nickname', 'username', 'email'],
            'images' => ['picture1'], 'uploadType' => 'user',
            'fields' => [
                F('code', 'รหัสพนักงาน', 'text', ['list' => true, 'col' => 1]),
                F('title', 'คำนำหน้า', 'text', ['col' => 1]),
                F('firstname', 'ชื่อ', 'text', ['required' => true, 'list' => true, 'col' => 1]),
                F('surname', 'นามสกุล', 'text', ['list' => true, 'col' => 1]),
                F('nickname', 'ชื่อเล่น', 'text', ['col' => 1]),
                F('depart_id', 'แผนก', 'lookup', ['lookup' => 'depart', 'list' => true, 'col' => 2]),
                F('position_name', 'ตำแหน่ง', 'text', ['col' => 1]),
                F('tel', 'โทรศัพท์', 'tel', ['col' => 1]),
                F('email', 'อีเมล', 'email', ['col' => 3]),
                F('username', 'ชื่อผู้ใช้ (Username)', 'text', ['required' => true, 'list' => true, 'col' => 2, 'section' => 'บัญชีผู้ใช้']),
                F('password', 'รหัสผ่าน', 'password', ['col' => 2, 'help' => 'เว้นว่างไว้หากไม่ต้องการเปลี่ยน']),
                F('member_type', 'สิทธิ์', 'select', ['options' => ['0' => 'ผู้ใช้งาน', '1' => 'ผู้ดูแลระบบ'], 'list' => true, 'col' => 2]),
                F('status', 'สถานะ', 'select', ['options' => ['0' => 'ปกติ', '1' => 'ระงับใช้'], 'list' => true, 'col' => 2]),
            ]],
        'userdepart' => ['table' => 'tb_userdepart', 'title' => 'ผู้อนุมัติประจำแผนก', 'icon' => 'check', 'group' => 'people', 'search' => [],
            'fields' => [
                F('user_id', 'ผู้อนุมัติ', 'lookup', ['lookup' => 'user', 'required' => true, 'list' => true, 'col' => 2]),
                F('depart_id', 'แผนก', 'lookup', ['lookup' => 'depart', 'required' => true, 'list' => true, 'col' => 2]),
            ]],

        /* ---------- settings ---------- */
        'company' => ['table' => 'tb_company', 'title' => 'สถานประกอบการ', 'icon' => 'building', 'group' => 'settings', 'search' => ['name'],
            'fields' => [
                F('name', 'ชื่อสถานประกอบการ', 'text', ['required' => true, 'list' => true, 'col' => 3]),
                F('webheader', 'ชื่อที่แสดงบนเว็บ', 'text', ['list' => true, 'col' => 1]),
                F('manager', 'ผู้จัดการ', 'text', ['col' => 2]),
                F('province', 'จังหวัด', 'text', ['col' => 2]),
                F('address', 'ที่อยู่', 'textarea', ['col' => 4]),
                F('tel', 'โทรศัพท์', 'tel', ['list' => true, 'col' => 2]),
                F('fax', 'แฟกซ์', 'tel', ['col' => 2]),
            ]],
        'docprefix' => ['table' => 'tb_docprefix', 'title' => 'การรันเลขเอกสาร', 'icon' => 'hash', 'group' => 'settings', 'search' => ['docname', 'prefix'], 'noCreate' => true,
            'fields' => [
                F('docname', 'ชื่อเอกสาร', 'text', ['required' => true, 'list' => true, 'col' => 2]),
                F('prefix', 'อักษรนำหน้า', 'text', ['required' => true, 'list' => true, 'col' => 1]),
                F('numlimit', 'จำนวนหลักเลขรัน', 'number', ['required' => true, 'list' => true, 'col' => 1]),
                F('tbname', 'ตาราง', 'text', ['readonly' => true, 'list' => true, 'col' => 4]),
            ]],
    ];
}

function resource(string $name): array
{
    $r = resources()[$name] ?? null;
    if (!$r) throw new HttpError(404, 'ไม่พบข้อมูล: ' . $name);
    $r['name'] = $name;
    return $r;
}
